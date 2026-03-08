"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface GamePlayer {
  seat: string;
  user: { username: string };
}

interface Game {
  id: string;
  status: string;
  createdAt: string;
  players: GamePlayer[];
}

interface Props {
  userId: string;
  username: string;
}

export default function LobbyClient({ userId, username }: Props) {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function fetchGames() {
    const res = await fetch("/api/games");
    if (res.ok) {
      const data = await res.json();
      setGames(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);
  }, []);

  async function createGame() {
    setCreating(true);
    const res = await fetch("/api/games", { method: "POST" });
    if (res.ok) {
      const game = await res.json();
      router.push(`/game/${game.id}`);
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to create game");
      setCreating(false);
    }
  }

  async function joinGame(gameId: string) {
    setJoiningId(gameId);
    const res = await fetch(`/api/games/${gameId}/join`, { method: "POST" });
    if (res.ok) {
      router.push(`/game/${gameId}`);
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to join game");
      setJoiningId(null);
    }
  }

  const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];

  return (
    <div className="min-h-screen bg-green-900 p-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">
              {SUIT_SYMBOLS.map((s, i) => (
                <span
                  key={i}
                  className={i % 2 === 0 ? "text-white" : "text-red-400"}
                >
                  {s}
                </span>
              ))}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-yellow-400">Bridge Lobby</h1>
              <p className="text-green-400 text-sm">Welcome, {username}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createGame}
              disabled={creating}
              className="bg-yellow-500 hover:bg-yellow-400 text-green-900 font-bold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {creating ? "Creating..." : "+ New Game"}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="bg-green-700 hover:bg-green-600 text-green-200 px-4 py-2 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Game List */}
        <div className="bg-green-800 border border-green-600 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-green-200 mb-4">
            Open Games
          </h2>

          {loading ? (
            <p className="text-green-400 text-center py-8">Loading games...</p>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-green-400 text-lg mb-2">No games waiting</p>
              <p className="text-green-500 text-sm">Create a new game to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const isInGame = game.players.some(
                  (p) => p.user?.username === username
                );
                return (
                  <div
                    key={game.id}
                    className="bg-green-900 border border-green-700 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-200 font-medium">
                          Game #{game.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded-full">
                          {game.players.length}/4 players
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {["NORTH", "EAST", "SOUTH", "WEST"].map((seat) => {
                          const player = game.players.find((p) => p.seat === seat);
                          return (
                            <span
                              key={seat}
                              className={`text-xs px-2 py-0.5 rounded ${
                                player
                                  ? "bg-green-600 text-white"
                                  : "bg-green-800 text-green-500"
                              }`}
                            >
                              {seat[0]}: {player ? player.user?.username : "—"}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {isInGame ? (
                      <button
                        onClick={() => router.push(`/game/${game.id}`)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition"
                      >
                        Rejoin
                      </button>
                    ) : game.players.length < 4 ? (
                      <button
                        onClick={() => joinGame(game.id)}
                        disabled={joiningId === game.id}
                        className="bg-yellow-500 hover:bg-yellow-400 text-green-900 font-bold px-4 py-2 rounded-lg transition disabled:opacity-50"
                      >
                        {joiningId === game.id ? "Joining..." : "Join"}
                      </button>
                    ) : (
                      <span className="text-green-500 text-sm">Full</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
