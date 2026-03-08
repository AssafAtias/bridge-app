import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { dealHands } from "@/lib/bridge/deck";
import { getOrCreateBotUser, executeBotTurnsIfNeeded } from "@/lib/bridge/aiActions";
import { Seat } from "@prisma/client";

const SEAT_ORDER: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];

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

    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "WAITING") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }
    if (game.players.length >= 4) {
      return NextResponse.json({ error: "Game is full" }, { status: 400 });
    }

    // Only a player already in the game can add bots
    const isInGame = game.players.some((p) => p.userId === session.user!.id);
    if (!isInGame) {
      return NextResponse.json({ error: "Join the game before adding bots" }, { status: 403 });
    }

    // Find all empty seats and fill them with bots
    const takenSeats = game.players.map((p) => p.seat);
    const emptySeats = SEAT_ORDER.filter((s) => !takenSeats.includes(s));

    for (const seat of emptySeats) {
      const botUser = await getOrCreateBotUser(seat as import("@/lib/bridge/deck").Seat);
      // Check if this bot user is already in THIS game (shouldn't happen but be safe)
      const alreadyIn = await db.gamePlayer.findFirst({
        where: { gameId, userId: botUser.id },
      });
      if (alreadyIn) continue;

      try {
        await db.gamePlayer.create({
          data: { userId: botUser.id, gameId, seat, hand: "[]", isBot: true },
        });
      } catch {
        // Seat already taken (double-click race), skip
        continue;
      }

      await pusherServer.trigger(`private-game-${gameId}`, "player-joined", {
        seat,
        username: botUser.username,
        isBot: true,
      });
    }

    // Now the game is full — deal hands and start
    const allPlayers = await db.gamePlayer.findMany({
      where: { gameId },
      include: { user: true },
    });

    const hands = dealHands();

    await db.$transaction([
      ...allPlayers.map((player) =>
        db.gamePlayer.update({
          where: { id: player.id },
          data: { hand: JSON.stringify(hands[player.seat as keyof typeof hands]) },
        })
      ),
      db.game.update({
        where: { id: gameId },
        data: { status: "BIDDING", dealer: "NORTH", currentSeat: "NORTH" },
      }),
    ]);

    // Send each human player their hand
    for (const player of allPlayers) {
      if (player.isBot) continue;
      await pusherServer.trigger(`private-game-${gameId}`, "game-started", {
        dealer: "NORTH",
        vulnerability: game.vulnerability,
        hands: { [player.seat]: hands[player.seat as keyof typeof hands] },
        seat: player.seat,
        userId: player.userId,
      });
    }

    await pusherServer.trigger(`private-game-${gameId}`, "game-state", {
      status: "BIDDING",
      dealer: "NORTH",
      currentSeat: "NORTH",
      vulnerability: game.vulnerability,
      players: allPlayers.map((p) => ({
        seat: p.seat,
        username: p.user.username,
        userId: p.userId,
        isBot: p.isBot,
      })),
    });

    // Kick off any bot turns (if dealer is a bot)
    await executeBotTurnsIfNeeded(gameId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error adding bot:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
