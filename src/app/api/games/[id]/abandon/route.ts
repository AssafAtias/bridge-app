import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: gameId } = await params;

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isPlayer = game.players.some((p) => p.userId === session.user!.id);
  if (!isPlayer)
    return NextResponse.json({ error: "Not in this game" }, { status: 403 });

  await db.game.update({
    where: { id: gameId },
    data: { status: "FINISHED" },
  });

  return NextResponse.json({ ok: true });
}
