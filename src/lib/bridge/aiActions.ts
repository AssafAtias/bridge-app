import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { Seat as PrismaSeat } from "@prisma/client";
import { chooseBid } from "./ai";
import { chooseCard } from "./ai";
import { AuctionState, updateAuction, validateBid } from "./bidding";
import { canPlayCard, determineTrickWinner, isDummy, getTrumpSuit } from "./play";
import { calculateScore, isNSSide } from "./scoring";
import { Card, Suit, Seat, getCardSuit, nextSeat } from "./deck";

const SEAT_ORDER: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];

type FullGame = NonNullable<Awaited<ReturnType<typeof db.game.findUnique>>> & {
  players: Array<{
    id: string;
    userId: string;
    seat: string;
    hand: string;
    isBot: boolean;
    user: { username: string };
  }>;
  bids: Array<{ seat: string; call: string; order: number }>;
  plays: Array<{ seat: string; card: string; trickNum: number; order: number }>;
};

function getDummySeat(declarer: Seat): Seat {
  return SEAT_ORDER[(SEAT_ORDER.indexOf(declarer) + 2) % 4];
}

/** Get or create a bot User for a given seat slot (NORTH/EAST/SOUTH/WEST) */
export async function getOrCreateBotUser(seat: Seat) {
  const email = `bot-${seat.toLowerCase()}@bridge.ai`;
  const username = `Bot-${seat[0]}${seat.slice(1).toLowerCase()}`;
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, username, password: "bot", isBot: true },
  });
}

/**
 * After any human action, run bot turns until a human needs to act (or game ends).
 */
export async function executeBotTurnsIfNeeded(gameId: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        players: { include: { user: true } },
        bids: { orderBy: { order: "asc" } },
        plays: { orderBy: [{ trickNum: "asc" }, { order: "asc" }] },
      },
    });

    if (!game || game.status === "FINISHED" || game.status === "WAITING") break;
    if (!game.currentSeat) break;

    const currentSeat = game.currentSeat as Seat;
    const dummySeat = game.declarer ? getDummySeat(game.declarer as Seat) : null;

    // Find who actually acts:
    // - During play, if it's the dummy's turn, the declarer acts for dummy
    let actingSeat = currentSeat;
    if (game.status === "PLAYING" && currentSeat === dummySeat && game.declarer) {
      actingSeat = game.declarer as Seat;
    }

    const actingPlayer = game.players.find((p) => p.seat === actingSeat);
    if (!actingPlayer?.isBot) break; // Human's turn

    if (game.status === "BIDDING") {
      await executeBotBid(gameId, game, actingPlayer, actingSeat);
    } else if (game.status === "PLAYING") {
      await executeBotPlay(gameId, game, currentSeat, actingSeat);
    }

    // Small delay so Pusher events don't flood the client
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ─── Bot bidding ──────────────────────────────────────────────────────────────

async function executeBotBid(
  gameId: string,
  game: FullGame,
  player: { id: string; hand: string; seat: string },
  seat: Seat
) {
  const hand: Card[] = JSON.parse(player.hand);
  const auctionState: AuctionState = {
    calls: game.bids.map((b) => ({ seat: b.seat as Seat, call: b.call })),
    currentSeat: seat,
    dealer: game.dealer as Seat,
    contract: game.contract,
    declarer: game.declarer as Seat | null,
    doubled: isLastCall(game.bids, "X"),
    redoubled: isLastCall(game.bids, "XX"),
    complete: false,
  };

  const call = chooseBid(hand, auctionState);
  const validation = validateBid(call, auctionState);
  const finalCall = validation.valid ? call : "PASS";

  const newState = updateAuction(auctionState, seat, finalCall);

  await db.bid.create({
    data: { gameId, seat: seat as PrismaSeat, call: finalCall, order: game.bids.length },
  });

  await pusherServer.trigger(`private-game-${gameId}`, "bid-made", {
    seat,
    call: finalCall,
    nextSeat: newState.currentSeat,
  });

  if (newState.complete) {
    if (!newState.contract || newState.contract.replace(/XX?$/, "") === "") {
      await db.game.update({
        where: { id: gameId },
        data: { status: "FINISHED", contract: "PASSED", currentSeat: null },
      });
      await pusherServer.trigger(`private-game-${gameId}`, "auction-complete", {
        contract: "PASSED",
        declarer: null,
        passedOut: true,
      });
    } else {
      const openingLeader = nextSeat(newState.declarer!);
      const dummySeat = SEAT_ORDER[(SEAT_ORDER.indexOf(newState.declarer! as Seat) + 2) % 4];
      await db.game.update({
        where: { id: gameId },
        data: {
          status: "PLAYING",
          contract: newState.contract,
          declarer: newState.declarer as PrismaSeat,
          dummy: dummySeat as PrismaSeat,
          currentSeat: openingLeader as PrismaSeat,
        },
      });
      await pusherServer.trigger(`private-game-${gameId}`, "auction-complete", {
        contract: newState.contract,
        declarer: newState.declarer,
        openingLeader,
        passedOut: false,
      });
    }
  } else {
    await db.game.update({
      where: { id: gameId },
      data: { currentSeat: newState.currentSeat as PrismaSeat },
    });
  }
}

// ─── Bot card play ─────────────────────────────────────────────────────────────

async function executeBotPlay(
  gameId: string,
  game: FullGame,
  currentSeat: Seat,   // the seat whose turn it is in the trick order
  actingSeat: Seat     // who actually chooses (declarer plays for dummy)
) {
  const trump = getTrumpSuit(game.contract!);
  const currentTrickNum = Math.floor(game.plays.length / 4);
  const currentTrickPlays = game.plays.filter((p) => p.trickNum === currentTrickNum);
  const ledSuit = currentTrickPlays.length > 0
    ? (getCardSuit(currentTrickPlays[0].card as Card) as Suit)
    : null;

  // The hand belongs to currentSeat (not actingSeat, since actingSeat may be declarer playing for dummy)
  const handOwner = game.players.find((p) => p.seat === currentSeat);
  if (!handOwner) return;

  const hand: Card[] = JSON.parse(handOwner.hand);
  if (hand.length === 0) return;

  const dummySeat = getDummySeat(game.declarer as Seat);
  const isDefender =
    actingSeat !== game.declarer && actingSeat !== dummySeat;

  const card = chooseCard(
    hand,
    ledSuit,
    trump,
    currentTrickPlays.map((p) => ({ seat: p.seat as Seat, card: p.card as Card })),
    isDefender
  );

  // Remove card from hand
  const newHand = hand.filter((c) => c !== card);
  await db.gamePlayer.update({
    where: { id: handOwner.id },
    data: { hand: JSON.stringify(newHand) },
  });

  await db.cardPlay.create({
    data: {
      gameId,
      seat: currentSeat as PrismaSeat,
      card,
      trickNum: currentTrickNum,
      order: currentTrickPlays.length,
    },
  });

  const newTrickPlayCount = currentTrickPlays.length + 1;
  const midTrickNextSeat = newTrickPlayCount < 4
    ? SEAT_ORDER[(SEAT_ORDER.indexOf(currentSeat) + 1) % 4]
    : null;

  await pusherServer.trigger(`private-game-${gameId}`, "card-played", {
    seat: currentSeat,
    card,
    trickNum: currentTrickNum,
    nextSeat: midTrickNextSeat,
  });

  // Reveal dummy after opening lead
  if (game.plays.length === 0 && !game.dummyRevealed) {
    const dummyPlayer = game.players.find((p) => p.seat === dummySeat);
    await db.game.update({ where: { id: gameId }, data: { dummyRevealed: true } });
    await pusherServer.trigger(`private-game-${gameId}`, "dummy-revealed", {
      dummySeat,
      dummyHand: JSON.parse(dummyPlayer?.hand ?? "[]"),
    });
  }

  // Check trick complete
  const newTrickPlays = [
    ...currentTrickPlays,
    { seat: currentSeat, card },
  ];

  if (newTrickPlays.length === 4) {
    const winner = determineTrickWinner(
      newTrickPlays.map((p) => ({ seat: p.seat as Seat, card: p.card as Card })),
      trump
    );

    const allPlays = [
      ...game.plays,
      { seat: currentSeat, card, trickNum: currentTrickNum, order: currentTrickPlays.length },
    ];
    const completedTricks = Math.floor(allPlays.length / 4);
    let nsTricks = 0, ewTricks = 0;
    for (let t = 0; t < completedTricks; t++) {
      const trick = allPlays.filter((p) => p.trickNum === t);
      if (trick.length === 4) {
        const w = determineTrickWinner(
          trick.map((p) => ({ seat: p.seat as Seat, card: p.card as Card })),
          trump
        );
        if (isNSSide(w)) nsTricks++; else ewTricks++;
      }
    }

    await pusherServer.trigger(`private-game-${gameId}`, "trick-complete", {
      winner,
      trickNum: currentTrickNum,
      nsTricks,
      ewTricks,
    });

    if (completedTricks === 13) {
      const declarerSide = isNSSide(game.declarer as Seat) ? "NS" : "EW";
      const tricksMade = declarerSide === "NS" ? nsTricks : ewTricks;
      const vulnerable =
        game.vulnerability === "BOTH" ||
        (declarerSide === "NS" && game.vulnerability === "NS") ||
        (declarerSide === "EW" && game.vulnerability === "EW");

      const scoreResult = calculateScore({
        contract: game.contract!,
        declarer: game.declarer as Seat,
        tricksMade,
        vulnerable,
      });
      const nsScore = declarerSide === "NS" ? scoreResult.declarerPoints : scoreResult.defenderPoints;
      const ewScore = declarerSide === "EW" ? scoreResult.declarerPoints : scoreResult.defenderPoints;

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
      await db.game.update({
        where: { id: gameId },
        data: { currentSeat: winner as PrismaSeat },
      });
    }
  } else {
    const nextPlayer = SEAT_ORDER[(SEAT_ORDER.indexOf(currentSeat) + 1) % 4];
    await db.game.update({
      where: { id: gameId },
      data: { currentSeat: nextPlayer as PrismaSeat },
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isLastCall(bids: { call: string }[], call: string): boolean {
  if (bids.length === 0) return false;
  return bids[bids.length - 1].call === call;
}

