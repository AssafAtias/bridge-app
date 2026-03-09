import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { canPlayCard, determineTrickWinner, isDummy, getOpeningLeader, getTrumpSuit } from "@/lib/bridge/play";
import { executeBotTurnsIfNeeded } from "@/lib/bridge/aiActions";
import { calculateScore, isNSSide } from "@/lib/bridge/scoring";
import { Card, Suit, getCardSuit } from "@/lib/bridge/deck";
import { Seat } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: gameId } = await params;
    const { card } = await req.json();

    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        players: { include: { user: true } },
        plays: { orderBy: [{ trickNum: "asc" }, { order: "asc" }] },
      },
    });

    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "PLAYING") {
      return NextResponse.json({ error: "Not in play phase" }, { status: 400 });
    }
    if (!game.contract || !game.declarer) {
      return NextResponse.json({ error: "No contract" }, { status: 400 });
    }

    const player = game.players.find((p) => p.userId === session.user!.id);
    if (!player) return NextResponse.json({ error: "Not in this game" }, { status: 403 });

    const dummySeat = isDummy(game.declarer as Seat, game.declarer as Seat);
    const currentSeat = game.currentSeat as Seat;

    // Determine who is actually playing (declarer plays for dummy)
    let playingSeat = currentSeat;
    if (currentSeat === dummySeat && player.seat === game.declarer) {
      playingSeat = dummySeat;
    } else if (currentSeat !== player.seat) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    // Get player's hand (or dummy's hand if declarer is playing for dummy)
    const handOwner = game.players.find((p) => p.seat === playingSeat);
    if (!handOwner) return NextResponse.json({ error: "Hand not found" }, { status: 400 });

    const hand: Card[] = JSON.parse(handOwner.hand);
    if (!hand.includes(card as Card)) {
      return NextResponse.json({ error: "Card not in hand" }, { status: 400 });
    }

    // Determine current trick
    const currentTrickNum = Math.floor(game.plays.length / 4);
    const currentTrickPlays = game.plays.filter((p) => p.trickNum === currentTrickNum);

    // Determine led suit
    const ledSuit: Suit | null =
      currentTrickPlays.length > 0
        ? getCardSuit(currentTrickPlays[0].card as Card)
        : null;

    // Validate card play
    if (!canPlayCard(card as Card, hand, ledSuit)) {
      return NextResponse.json({ error: "Must follow suit" }, { status: 400 });
    }

    // Remove card from hand
    const newHand = hand.filter((c) => c !== card);
    await db.gamePlayer.update({
      where: { id: handOwner.id },
      data: { hand: JSON.stringify(newHand) },
    });

    // Save card play
    await db.cardPlay.create({
      data: {
        gameId,
        seat: playingSeat,
        card,
        trickNum: currentTrickNum,
        order: currentTrickPlays.length,
      },
    });

    const trump = getTrumpSuit(game.contract);

    // Compute next seat for mid-trick (trick-complete will override for the 4th card)
    const newTrickPlayCount = currentTrickPlays.length + 1;
    const ORDER: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];
    const midTrickNextSeat = newTrickPlayCount < 4
      ? ORDER[(ORDER.indexOf(playingSeat) + 1) % 4]
      : null;

    await pusherServer.trigger(`private-game-${gameId}`, "card-played", {
      seat: playingSeat,
      card,
      trickNum: currentTrickNum,
      nextSeat: midTrickNextSeat,
    });

    // Reveal dummy after opening lead
    if (game.plays.length === 0 && !game.dummyRevealed) {
      const dummyPlayer = game.players.find((p) => p.seat === dummySeat);
      await db.game.update({
        where: { id: gameId },
        data: { dummyRevealed: true },
      });
      await pusherServer.trigger(`private-game-${gameId}`, "dummy-revealed", {
        dummySeat,
        dummyHand: JSON.parse(dummyPlayer?.hand ?? "[]"),
      });
    }

    // Check if trick is complete
    const newTrickPlays = [...currentTrickPlays, { seat: playingSeat, card }];
    if (newTrickPlays.length === 4) {
      const winner = determineTrickWinner(
        newTrickPlays.map((p) => ({ seat: p.seat as Seat, card: p.card as Card })),
        trump
      );

      // Count tricks per side
      const allPlays = [...game.plays, { seat: playingSeat, card, trickNum: currentTrickNum, order: currentTrickPlays.length }];
      const completedTricks = Math.floor(allPlays.length / 4);

      let nsTricks = 0;
      let ewTricks = 0;
      for (let t = 0; t < completedTricks; t++) {
        const trick = allPlays.filter((p) => p.trickNum === t);
        if (trick.length === 4) {
          const w = determineTrickWinner(
            trick.map((p) => ({ seat: p.seat as Seat, card: p.card as Card })),
            trump
          );
          if (isNSSide(w)) nsTricks++;
          else ewTricks++;
        }
      }

      await pusherServer.trigger(`private-game-${gameId}`, "trick-complete", {
        winner,
        trickNum: currentTrickNum,
        nsTricks,
        ewTricks,
      });

      // All 13 tricks done?
      if (completedTricks === 13) {
        const declarerSide = isNSSide(game.declarer as Seat) ? "NS" : "EW";
        const tricksMade = declarerSide === "NS" ? nsTricks : ewTricks;
        const vulnerable = game.vulnerability === "BOTH" ||
          (declarerSide === "NS" && game.vulnerability === "NS") ||
          (declarerSide === "EW" && game.vulnerability === "EW");

        const scoreResult = calculateScore({
          contract: game.contract,
          declarer: game.declarer as Seat,
          tricksMade,
          vulnerable,
        });

        const nsScore = declarerSide === "NS"
          ? scoreResult.declarerPoints
          : scoreResult.defenderPoints;
        const ewScore = declarerSide === "EW"
          ? scoreResult.declarerPoints
          : scoreResult.defenderPoints;

        await db.game.update({
          where: { id: gameId },
          data: {
            status: "FINISHED",
            nsScore: game.nsScore + nsScore,
            ewScore: game.ewScore + ewScore,
            currentSeat: null,
          },
        });

        await pusherServer.trigger(`private-game-${gameId}`, "game-ended", {
          finalScore: { ns: game.nsScore + nsScore, ew: game.ewScore + ewScore },
          result: {
            contract: game.contract,
            declarer: game.declarer,
            tricksMade,
            made: scoreResult.made,
            overtricks: scoreResult.overtricks,
            undertricks: scoreResult.undertricks,
          },
        });
      } else {
        // Next trick: winner leads
        await db.game.update({
          where: { id: gameId },
          data: { currentSeat: winner },
        });
      }
    } else {
      // Next player in trick
      const nextPlayer = (() => {
        const order: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];
        const idx = order.indexOf(playingSeat);
        return order[(idx + 1) % 4];
      })();

      await db.game.update({
        where: { id: gameId },
        data: { currentSeat: nextPlayer },
      });
    }

    // Await bot turns — Vercel serverless kills background tasks after response
    await executeBotTurnsIfNeeded(gameId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing card play:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
