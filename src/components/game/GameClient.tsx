"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import BridgeTable from "./BridgeTable";
import BiddingBox from "./BiddingBox";
import ScoreSheet from "./ScoreSheet";
import { useLanguage } from "@/context/LanguageContext";

export type Seat = "NORTH" | "EAST" | "SOUTH" | "WEST";
export type GameStatus = "WAITING" | "BIDDING" | "PLAYING" | "FINISHED";

export interface PlayerInfo {
  seat: Seat;
  username: string;
  userId: string;
  isBot?: boolean;
  hand: string[] | null;
}

export interface BidRecord {
  seat: Seat;
  call: string;
  order: number;
}

export interface PlayRecord {
  seat: Seat;
  card: string;
  trickNum: number;
  order: number;
}

export interface TrickResult {
  trickNum: number;
  winner: Seat;
}

export interface GameState {
  id: string;
  status: GameStatus;
  dealer: Seat;
  vulnerability: string;
  currentSeat: Seat | null;
  contract: string | null;
  declarer: Seat | null;
  dummy: Seat | null;
  dummyRevealed: boolean;
  nsScore: number;
  ewScore: number;
  players: PlayerInfo[];
  bids: BidRecord[];
  plays: PlayRecord[];
  trickResults: TrickResult[];
}

interface Props {
  gameId: string;
  userId: string;
  username: string;
  initialGame: GameState;
}

export default function GameClient({ gameId, userId, username, initialGame }: Props) {
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();
  const [game, setGame] = useState<GameState>(initialGame);
  const [actionError, setActionError] = useState("");
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== "undefined") {
      return parseFloat(localStorage.getItem("bridge-zoom") ?? "1") || 1;
    }
    return 1;
  });

  function adjustZoom(delta: number) {
    setZoom((prev) => {
      const next = Math.max(0.6, Math.min(1.6, Math.round((prev + delta) * 10) / 10));
      localStorage.setItem("bridge-zoom", String(next));
      return next;
    });
  }

  const myPlayer = game.players.find((p) => p.userId === userId);
  const mySeat = myPlayer?.seat ?? null;

  // Determine dummy seat from declarer
  const dummySeat = game.declarer
    ? (["NORTH", "EAST", "SOUTH", "WEST"][
        (["NORTH", "EAST", "SOUTH", "WEST"].indexOf(game.declarer) + 2) % 4
      ] as Seat)
    : null;

  // Current trick plays — deduplicate by seat (keep latest order)
  const currentTrickNum = Math.floor(game.plays.length / 4);
  const currentTrickPlaysRaw = game.plays.filter((p) => p.trickNum === currentTrickNum);
  const seenSeats = new Set<string>();
  const currentTrickPlays = currentTrickPlaysRaw
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((p) => {
      if (seenSeats.has(p.seat)) return false;
      seenSeats.add(p.seat);
      return true;
    });

  // Count tricks per side
  let nsTricks = 0;
  let ewTricks = 0;
  const completedTricks = Math.floor(game.plays.length / 4);
  for (let t = 0; t < completedTricks; t++) {
    const trick = game.plays.filter((p) => p.trickNum === t);
    if (trick.length === 4) {
      // We don't recalculate winner on client — use last trick state
    }
  }

  // Is it my turn?
  const isMyTurn =
    game.currentSeat === mySeat ||
    // Declarer plays for dummy
    (game.currentSeat === dummySeat && mySeat === game.declarer);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-game-${gameId}`);

    channel.bind("player-joined", (data: { seat: Seat; username: string; isBot?: boolean }) => {
      setGame((prev) => ({
        ...prev,
        players: prev.players.some((p) => p.seat === data.seat)
          ? prev.players.map((p) =>
              p.seat === data.seat ? { ...p, username: data.username, isBot: data.isBot } : p
            )
          : [
              ...prev.players,
              {
                seat: data.seat,
                username: data.username,
                userId: "",
                isBot: data.isBot,
                hand: null,
              },
            ],
      }));
    });

    channel.bind(
      "game-started",
      (data: {
        dealer: Seat;
        vulnerability: string;
        hands: Record<string, string[]>;
        seat: Seat;
        userId: string;
      }) => {
        if (data.userId === userId) {
          setGame((prev) => ({
            ...prev,
            status: "BIDDING",
            dealer: data.dealer,
            vulnerability: data.vulnerability,
            currentSeat: data.dealer,
            players: prev.players.map((p) =>
              p.seat === data.seat ? { ...p, hand: data.hands[data.seat] } : p
            ),
          }));
        }
      }
    );

    channel.bind(
      "game-state",
      (data: {
        status: GameStatus;
        dealer: Seat;
        currentSeat: Seat;
        vulnerability: string;
        players: Array<{ seat: Seat; username: string; userId: string; isBot?: boolean }>;
      }) => {
        setGame((prev) => ({
          ...prev,
          status: data.status,
          dealer: data.dealer,
          currentSeat: data.currentSeat,
          vulnerability: data.vulnerability,
          players: prev.players.map((p) => {
            const updated = data.players.find((dp) => dp.seat === p.seat);
            return updated ? { ...p, username: updated.username, userId: updated.userId, isBot: updated.isBot } : p;
          }),
        }));
      }
    );

    channel.bind(
      "bid-made",
      (data: { seat: Seat; call: string; nextSeat: Seat }) => {
        setGame((prev) => ({
          ...prev,
          currentSeat: data.nextSeat,
          bids: [
            ...prev.bids,
            { seat: data.seat, call: data.call, order: prev.bids.length },
          ],
        }));
      }
    );

    channel.bind(
      "auction-complete",
      (data: {
        contract: string;
        declarer: Seat | null;
        openingLeader?: Seat;
        passedOut: boolean;
      }) => {
        if (data.passedOut) {
          setGame((prev) => ({
            ...prev,
            status: "FINISHED",
            contract: "PASSED",
            currentSeat: null,
          }));
        } else {
          const declarer = data.declarer!;
          const dummy =
            (["NORTH", "EAST", "SOUTH", "WEST"][
              (["NORTH", "EAST", "SOUTH", "WEST"].indexOf(declarer) + 2) % 4
            ] as Seat);
          setGame((prev) => ({
            ...prev,
            status: "PLAYING",
            contract: data.contract,
            declarer,
            dummy,
            currentSeat: data.openingLeader ?? null,
          }));
        }
      }
    );

    channel.bind(
      "card-played",
      (data: { seat: Seat; card: string; trickNum: number; nextSeat: Seat | null }) => {
        setGame((prev) => {
          const newPlays = [
            ...prev.plays,
            { seat: data.seat, card: data.card, trickNum: data.trickNum, order: prev.plays.filter((p) => p.trickNum === data.trickNum).length },
          ];
          const newPlayers = prev.players.map((p) =>
            p.seat === data.seat && p.hand
              ? { ...p, hand: p.hand.filter((c) => c !== data.card) }
              : p
          );
          return {
            ...prev,
            plays: newPlays,
            players: newPlayers,
            // Advance currentSeat within the trick; trick-complete will override for the 4th card
            ...(data.nextSeat ? { currentSeat: data.nextSeat } : {}),
          };
        });
      }
    );

    channel.bind(
      "dummy-revealed",
      (data: { dummySeat: Seat; dummyHand: string[] }) => {
        setGame((prev) => ({
          ...prev,
          dummyRevealed: true,
          dummy: data.dummySeat,
          players: prev.players.map((p) =>
            p.seat === data.dummySeat ? { ...p, hand: data.dummyHand } : p
          ),
        }));
      }
    );

    channel.bind(
      "trick-complete",
      (data: {
        winner: Seat;
        trickNum: number;
        nsTricks: number;
        ewTricks: number;
      }) => {
        setGame((prev) => ({
          ...prev,
          currentSeat: data.winner,
          trickResults: [
            ...prev.trickResults.filter((t) => t.trickNum !== data.trickNum),
            { trickNum: data.trickNum, winner: data.winner },
          ],
        }));
      }
    );

    channel.bind(
      "game-ended",
      (data: {
        finalScore: { ns: number; ew: number };
        result: {
          contract: string;
          declarer: Seat;
          tricksMade: number;
          made: boolean;
          overtricks: number;
          undertricks: number;
        };
      }) => {
        setGame((prev) => ({
          ...prev,
          status: "FINISHED",
          nsScore: data.finalScore.ns,
          ewScore: data.finalScore.ew,
          currentSeat: null,
        }));
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-game-${gameId}`);
    };
  }, [gameId, userId]);

  async function makeBid(call: string) {
    setActionError("");
    const res = await fetch(`/api/games/${gameId}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call }),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Failed to bid");
    }
  }

  async function fillWithBots() {
    setActionError("");
    const res = await fetch(`/api/games/${gameId}/add-bot`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Failed to add bots");
    }
  }

  async function playCard(card: string) {
    setActionError("");
    const res = await fetch(`/api/games/${gameId}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card }),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Failed to play card");
    }
  }

  if (game.status === "FINISHED") {
    return (
      <ScoreSheet
        game={game}
        mySeat={mySeat}
        onBackToLobby={() => router.push("/lobby")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      {/* ── Top menu bar ─────────────────────────────────────────────────── */}
      <div className="bg-green-950 border-b border-green-700 px-4 py-2 flex items-center justify-between gap-4">
        {/* Left: logo + contract */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-yellow-400 font-bold shrink-0">♠ {t.appName}</span>
          {game.contract && (
            <span className="text-white text-sm truncate">
              {t.contract}: <strong className="text-yellow-300">{game.contract}</strong>
              {game.declarer && <span className="text-green-400"> {t.by} {game.declarer}</span>}
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0 text-sm">
          {/* Scores */}
          <span className="text-green-400 hidden sm:inline">
            {t.ns}: <strong className="text-white">{game.nsScore}</strong>
          </span>
          <span className="text-green-400 hidden sm:inline">
            {t.ew}: <strong className="text-white">{game.ewScore}</strong>
          </span>

          {/* Divider */}
          <span className="text-green-700 hidden sm:inline">|</span>

          {/* Logged-in user */}
          <span className="text-green-300 font-medium">👤 {username}</span>

          {/* Divider */}
          <span className="text-green-700">|</span>

          {/* Zoom out */}
          <button
            onClick={() => adjustZoom(-0.1)}
            disabled={zoom <= 0.6}
            title={t.zoomOut}
            className="bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white font-bold px-2 py-1 rounded text-sm transition"
          >
            {t.zoomOut}
          </button>

          {/* Zoom level */}
          <span className="text-green-400 text-xs w-8 text-center">{Math.round(zoom * 100)}%</span>

          {/* Zoom in */}
          <button
            onClick={() => adjustZoom(0.1)}
            disabled={zoom >= 1.6}
            title={t.zoomIn}
            className="bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white font-bold px-2 py-1 rounded text-sm transition"
          >
            {t.zoomIn}
          </button>

          {/* Divider */}
          <span className="text-green-700">|</span>

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            title="Toggle language / החלף שפה"
            className="bg-green-800 hover:bg-green-700 text-green-200 font-bold px-2 py-1 rounded text-sm transition"
          >
            {lang === "en" ? "עב" : "EN"}
          </button>

          {/* Divider */}
          <span className="text-green-700">|</span>

          {/* New game */}
          <button
            onClick={() => router.push("/lobby")}
            className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-1 rounded text-sm transition"
          >
            {t.newGame}
          </button>

          {/* Exit */}
          <button
            onClick={() => router.push("/lobby")}
            className="bg-green-700 hover:bg-green-600 text-green-200 font-bold px-3 py-1 rounded text-sm transition"
          >
            {t.exitGame}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">
        {/* Main table */}
        <div className="flex-1">
          <BridgeTable
            game={game}
            mySeat={mySeat}
            dummySeat={dummySeat}
            isMyTurn={isMyTurn}
            zoom={zoom}
            onPlayCard={playCard}
          />
        </div>

        {/* Side panel */}
        <div className="lg:w-96 space-y-4">
          {game.status === "WAITING" && (
            <div className="bg-green-800 border border-green-600 rounded-xl p-4">
              <h3 className="text-yellow-400 font-semibold mb-2">{t.waitingForPlayers}</h3>
              <p className="text-green-400 text-sm mb-4">{t.playersJoined(game.players.length)}</p>
              <button
                onClick={fillWithBots}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg px-4 py-2 transition text-sm"
              >
                {t.fillWithAI}
              </button>
            </div>
          )}

          {game.status === "BIDDING" && (
            <BiddingBox
              bids={game.bids}
              dealer={game.dealer}
              currentSeat={game.currentSeat}
              isMyTurn={game.currentSeat === mySeat}
              lastBid={
                game.bids
                  .filter((b) => b.call !== "PASS" && b.call !== "X" && b.call !== "XX")
                  .slice(-1)[0]?.call ?? null
              }
              doubled={game.bids.slice(-1)[0]?.call === "X"}
              redoubled={game.bids.slice(-1)[0]?.call === "XX"}
              onBid={makeBid}
            />
          )}

          {game.status === "PLAYING" && (
            <div className={`rounded-xl p-3 border text-center ${
              isMyTurn ? "bg-yellow-600 border-yellow-400 animate-pulse" : "bg-green-800 border-green-600"
            }`}>
              {isMyTurn
                ? <p className="text-white font-bold">{t.yourTurnPlay}</p>
                : <p className="text-green-300 text-sm font-medium">{t.waitingFor(game.currentSeat ?? "")}</p>
              }
            </div>
          )}

          {game.status === "PLAYING" && game.trickResults.length > 0 && (
            <div className="bg-green-800 border border-green-600 rounded-xl p-4">
              <h3 className="text-yellow-400 font-semibold mb-3 text-base">
                {t.tricks(
                  game.trickResults.filter(tr => isNSSeat(tr.winner)).length,
                  game.trickResults.filter(tr => !isNSSeat(tr.winner)).length
                )}
              </h3>
              <div className="overflow-y-auto max-h-48 space-y-1">
                {[...game.trickResults].sort((a, b) => b.trickNum - a.trickNum).map((tr) => {
                  const trickPlays = game.plays.filter((p) => p.trickNum === tr.trickNum);
                  const byOrder = [...trickPlays].sort((a, b) => a.order - b.order);
                  return (
                    <div key={tr.trickNum} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
                      isNSSeat(tr.winner) ? "bg-blue-900 bg-opacity-50" : "bg-red-900 bg-opacity-50"
                    }`}>
                      <span className="text-green-400 font-bold w-5">#{tr.trickNum + 1}</span>
                      <div className="flex gap-1 flex-wrap flex-1">
                        {byOrder.map((p, i) => {
                          const { rank, sym, isRed } = cardInfo(p.card);
                          return (
                            <span key={i} className={`font-bold ${isRed ? "text-red-400" : "text-white"}`}>
                              {p.seat[0]}:{rank}{sym}
                            </span>
                          );
                        })}
                      </div>
                      <span className={`font-bold shrink-0 ${isNSSeat(tr.winner) ? "text-blue-300" : "text-red-300"}`}>
                        {tr.winner}✓
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {game.bids.length > 0 && (
            <div className="bg-green-800 border border-green-600 rounded-xl p-4">
              <h3 className="text-yellow-400 font-semibold mb-3 text-base">{t.bidHistory}</h3>
              <BidHistory bids={game.bids} dealer={game.dealer} />
            </div>
          )}

          {actionError && (
            <div className="bg-red-900 border border-red-600 rounded-lg p-3">
              <p className="text-red-300 text-sm">{actionError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const NS_SEATS = new Set<Seat>(["NORTH", "SOUTH"]);
function isNSSeat(seat: Seat) { return NS_SEATS.has(seat); }

function cardInfo(card: string) {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === "H" || suit === "D";
  const sym = { S: "♠", H: "♥", D: "♦", C: "♣" }[suit] ?? suit;
  return { rank: rank === "T" ? "10" : rank, sym, isRed };
}

function TrickCard({ card }: { card: string }) {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === "H" || suit === "D";
  const suitSymbol = { S: "♠", H: "♥", D: "♦", C: "♣" }[suit] ?? suit;
  return (
    <div className={`flex flex-col items-center justify-center w-10 h-14 rounded-lg border-2 border-gray-200 bg-white shadow font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
      <span className="text-sm leading-none">{rank === "T" ? "10" : rank}</span>
      <span className="text-base leading-none mt-0.5">{suitSymbol}</span>
    </div>
  );
}

function BidHistory({
  bids,
  dealer,
}: {
  bids: BidRecord[];
  dealer: Seat;
}) {
  const seats: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];
  const dealerIdx = seats.indexOf(dealer);
  const orderedSeats = [
    seats[dealerIdx],
    seats[(dealerIdx + 1) % 4],
    seats[(dealerIdx + 2) % 4],
    seats[(dealerIdx + 3) % 4],
  ];

  const rows: (BidRecord | null)[][] = [];
  let currentRow: (BidRecord | null)[] = new Array(dealerIdx).fill(null);

  for (const bid of bids) {
    currentRow.push(bid);
    if (currentRow.length === 4) {
      rows.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {orderedSeats.map((s) => (
              <th key={s} className="text-green-300 font-bold px-2 py-1 text-center text-sm">
                {s[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {Array.from({ length: 4 }, (_, j) => {
                const bid = row[j];
                return (
                  <td key={j} className="px-2 py-1 text-center text-base font-semibold">
                    {bid ? (
                      <BidCallDisplay call={bid.call} />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BidCallDisplay({ call }: { call: string }) {
  if (call === "PASS") return <span className="text-green-400">Pass</span>;
  if (call === "X") return <span className="text-red-400">X</span>;
  if (call === "XX") return <span className="text-blue-400">XX</span>;

  const level = call[0];
  const denom = call.slice(1);
  const suitColors: Record<string, string> = {
    C: "text-white",
    D: "text-red-400",
    H: "text-red-400",
    S: "text-white",
    NT: "text-yellow-300",
  };
  const suitSymbols: Record<string, string> = {
    C: "♣",
    D: "♦",
    H: "♥",
    S: "♠",
    NT: "NT",
  };
  return (
    <span className={suitColors[denom] ?? "text-white"}>
      {level}{suitSymbols[denom] ?? denom}
    </span>
  );
}
