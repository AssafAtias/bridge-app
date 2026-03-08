import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import GameClient from "@/components/game/GameClient";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

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

  if (!game) redirect("/lobby");

  const myPlayer = game.players.find((p) => p.user.id === session.user!.id);
  if (!myPlayer) redirect("/lobby");

  // Build initial state — only send my hand + dummy hand if revealed
  const players = game.players.map((p) => ({
    seat: p.seat,
    username: p.user.username,
    userId: p.user.id,
    isBot: p.isBot,
    hand:
      p.user.id === session.user!.id
        ? JSON.parse(p.hand)
        : p.seat === game.dummy && game.dummyRevealed
        ? JSON.parse(p.hand)
        : null,
  }));

  return (
    <GameClient
      gameId={gameId}
      userId={session.user!.id!}
      username={session.user!.name!}
      initialGame={{
        id: game.id,
        status: game.status,
        dealer: game.dealer,
        vulnerability: game.vulnerability,
        currentSeat: game.currentSeat,
        contract: game.contract,
        declarer: game.declarer,
        dummy: game.dummy,
        dummyRevealed: game.dummyRevealed,
        nsScore: game.nsScore,
        ewScore: game.ewScore,
        players,
        bids: game.bids,
        plays: game.plays,
        trickResults: [],
      }}
    />
  );
}
