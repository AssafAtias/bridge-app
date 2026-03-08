import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { dealHands } from "@/lib/bridge/deck";
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

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "WAITING") {
      return NextResponse.json({ error: "Game is not accepting players" }, { status: 400 });
    }

    if (game.players.some((p) => p.userId === session.user!.id)) {
      return NextResponse.json({ error: "Already in this game" }, { status: 409 });
    }

    if (game.players.length >= 4) {
      return NextResponse.json({ error: "Game is full" }, { status: 400 });
    }

    // Find next available seat
    const takenSeats = game.players.map((p) => p.seat);
    const availableSeat = SEAT_ORDER.find((s) => !takenSeats.includes(s));

    if (!availableSeat) {
      return NextResponse.json({ error: "No seats available" }, { status: 400 });
    }

    // Add player to game
    await db.gamePlayer.create({
      data: {
        userId: session.user!.id,
        gameId,
        seat: availableSeat,
        hand: "[]",
      },
    });

    // Notify via Pusher
    await pusherServer.trigger(`private-game-${gameId}`, "player-joined", {
      seat: availableSeat,
      username: session.user!.name,
    });

    // If game is now full, deal hands and start
    const updatedPlayers = await db.gamePlayer.findMany({
      where: { gameId },
      include: { user: true },
    });

    if (updatedPlayers.length === 4) {
      const hands = dealHands();

      // Update each player's hand and game status
      await db.$transaction([
        ...updatedPlayers.map((player) =>
          db.gamePlayer.update({
            where: { id: player.id },
            data: { hand: JSON.stringify(hands[player.seat as keyof typeof hands]) },
          })
        ),
        db.game.update({
          where: { id: gameId },
          data: {
            status: "BIDDING",
            dealer: "NORTH",
            currentSeat: "NORTH",
          },
        }),
      ]);

      // Send game-started event to each player with their own hand
      for (const player of updatedPlayers) {
        await pusherServer.trigger(
          `private-game-${gameId}`,
          "game-started",
          {
            dealer: "NORTH",
            vulnerability: game.vulnerability,
            // Each player's hand is sent but filtered on client by their own seat
            hands: {
              [player.seat]: hands[player.seat as keyof typeof hands],
            },
            seat: player.seat,
            userId: player.userId,
          }
        );
      }

      // Also send full game state (without hands) for all players
      await pusherServer.trigger(`private-game-${gameId}`, "game-state", {
        status: "BIDDING",
        dealer: "NORTH",
        currentSeat: "NORTH",
        vulnerability: game.vulnerability,
        players: updatedPlayers.map((p) => ({
          seat: p.seat,
          username: p.user.username,
          userId: p.userId,
        })),
      });
    }

    return NextResponse.json({ seat: availableSeat, gameId });
  } catch (error) {
    console.error("Error joining game:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
