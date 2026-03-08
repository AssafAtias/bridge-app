import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
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
      include: {
        players: {
          include: { user: { select: { username: true, id: true } } },
        },
        bids: { orderBy: { order: "asc" } },
        plays: { orderBy: [{ trickNum: "asc" }, { order: "asc" }] },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Only send the requesting player's hand (privacy)
    const userId = session.user.id;
    const myPlayer = game.players.find((p) => p.user.id === userId);
    const dummyPlayer = game.players.find(
      (p) => p.seat === game.dummy
    );

    const players = game.players.map((p) => ({
      seat: p.seat,
      username: p.user.username,
      userId: p.user.id,
      hand:
        p.user.id === userId
          ? JSON.parse(p.hand)
          : p.seat === game.dummy && game.dummyRevealed
          ? JSON.parse(p.hand)
          : null,
    }));

    return NextResponse.json({
      ...game,
      players,
    });
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
