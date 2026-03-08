import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const games = await db.game.findMany({
      where: { status: "WAITING" },
      include: {
        players: {
          include: { user: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is already in a non-finished game
    const existingGame = await db.gamePlayer.findFirst({
      where: {
        userId: session.user.id,
        game: { status: { not: "FINISHED" } },
      },
    });

    if (existingGame) {
      return NextResponse.json(
        { error: "You are already in a game" },
        { status: 409 }
      );
    }

    const game = await db.game.create({
      data: {
        players: {
          create: {
            userId: session.user.id,
            seat: "NORTH",
            hand: "[]",
          },
        },
      },
      include: {
        players: {
          include: { user: { select: { username: true } } },
        },
      },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
