"use client";

import { useState } from "react";
import { GameState, Seat } from "./GameClient";
import Hand from "./Hand";

interface Props {
  game: GameState;
  mySeat: Seat | null;
  dummySeat: Seat | null;
  isMyTurn: boolean;
  onPlayCard: (card: string) => void;
}

const SEAT_LABELS: Record<Seat, string> = {
  NORTH: "North", EAST: "East", SOUTH: "South", WEST: "West",
};

const SUIT_SYMBOLS: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

const HCP_VALUES: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 };
function countHCP(hand: string[]) {
  return hand.reduce((sum, c) => sum + (HCP_VALUES[c.slice(0, -1)] ?? 0), 0);
}

function cardDisplay(card: string) {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === "H" || suit === "D";
  const sym = SUIT_SYMBOLS[suit] ?? suit;
  return { rank: rank === "T" ? "10" : rank, sym, isRed };
}

export default function BridgeTable({ game, mySeat, dummySeat, isMyTurn, onPlayCard }: Props) {
  const [animCard, setAnimCard] = useState<string | null>(null);

  function handlePlay(card: string) {
    setAnimCard(card);
    setTimeout(() => setAnimCard(null), 800);
    onPlayCard(card);
  }

  const getPlayer = (seat: Seat) => game.players.find((p) => p.seat === seat);

  const currentTrickNum = Math.floor(game.plays.length / 4);
  const currentTrickPlays = game.plays.filter((p) => p.trickNum === currentTrickNum);
  const ledSuit = currentTrickPlays.length > 0 ? currentTrickPlays[0].card.slice(-1) : null;

  const trickCardBySeat: Partial<Record<Seat, string>> = {};
  for (const p of currentTrickPlays) {
    trickCardBySeat[p.seat as Seat] = p.card;
  }

  // Last bid per seat
  const lastBidPerSeat: Partial<Record<Seat, string>> = {};
  for (const bid of game.bids) lastBidPerSeat[bid.seat as Seat] = bid.call;

  const renderSeat = (seat: Seat, position: "top" | "bottom" | "left" | "right") => {
    const player = getPlayer(seat);
    const isCurrentTurn = game.currentSeat === seat;
    const isMe = seat === mySeat;
    const isDummyHand = seat === dummySeat && game.dummyRevealed;
    const canSeeHand = isMe || isDummyHand;
    const isPlayable =
      game.status === "PLAYING" &&
      canSeeHand &&
      (isCurrentTurn || (isCurrentTurn && seat === dummySeat && mySeat === game.declarer));
    const hcp = canSeeHand && player?.hand && player.hand.length > 0 ? countHCP(player.hand) : null;
    const lastBid = lastBidPerSeat[seat];
    const isRotated = position === "left" || position === "right";

    return (
      <div className={`flex flex-col items-center gap-1 ${isRotated ? "rotate-90" : ""}`}>
        {/* Player badge — pulsing ring when it's their turn */}
        <div
          className={`
            px-3 py-1 rounded-full text-xs font-semibold border transition-colors
            ${isCurrentTurn && game.status !== "WAITING"
              ? "bg-yellow-400 text-green-900 border-yellow-300 seat-active"
              : "bg-green-800 text-green-200 border-green-600"
            }
          `}
        >
          {player?.username ?? "—"}{" "}
          <span className="opacity-70">({SEAT_LABELS[seat]})</span>
          {isMe && <span className="ml-1 text-yellow-700">★</span>}
          {player?.isBot && <span className="ml-1">🤖</span>}
          {hcp !== null && <span className="ml-1.5 font-bold text-yellow-700">{hcp}pt</span>}
        </div>

        {/* Last bid badge */}
        {lastBid && <BidBadge call={lastBid} />}

        {/* Hand */}
        {canSeeHand && player?.hand && (
          <div className={position === "top" ? "mt-1" : "mb-1"}>
            <Hand
              cards={player.hand}
              playable={isPlayable}
              ledSuit={ledSuit}
              hand={player.hand}
              onPlayCard={
                isPlayable && (isMe || (seat === dummySeat && mySeat === game.declarer))
                  ? handlePlay
                  : undefined
              }
            />
          </div>
        )}

        {/* Hidden hand placeholder */}
        {!canSeeHand && player && (
          <div className="flex gap-0.5 mt-1">
            {Array.from({ length: Math.max(0, 13 - game.plays.filter((p) => p.seat === seat).length) }).map((_, i) => (
              <div key={i} className="w-5 h-8 bg-blue-800 border border-blue-600 rounded" />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-square max-w-5xl mx-auto">
      {/* Green felt */}
      <div className="absolute inset-0 bg-green-700 rounded-2xl border-4 border-green-900 shadow-2xl" />

      {/* ── Compass trick display + contract info ─────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-3 items-center justify-items-center"
          style={{ width: 300, height: 300 }}>

          {/* Row 0 */}
          <div />
          <div className="flex flex-col items-center gap-1">
            {trickCardBySeat.NORTH
              ? <CenterCard card={trickCardBySeat.NORTH} />
              : <EmptySlot />}
            <span className="text-green-400 text-xs font-medium">N</span>
          </div>
          <div />

          {/* Row 1 */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-green-400 text-xs font-medium">W</span>
            {trickCardBySeat.WEST
              ? <CenterCard card={trickCardBySeat.WEST} />
              : <EmptySlot />}
          </div>

          {/* Center info box */}
          <div className="rounded-xl px-3 py-2 text-center bg-green-800 bg-opacity-90 border border-green-600 shadow-lg">
            {game.contract ? (
              <>
                <p className="text-yellow-400 font-bold text-lg leading-none">{game.contract}</p>
                {game.declarer && <p className="text-green-300 text-xs mt-0.5">{game.declarer}</p>}
              </>
            ) : game.status === "BIDDING" ? (
              <p className="text-green-300 text-xs">Bidding…</p>
            ) : (
              <p className="text-green-300 text-xs">{game.players.length}/4</p>
            )}
            {game.status === "PLAYING" && (
              <p className="text-green-400 text-xs mt-0.5">Trick {currentTrickNum + 1}/13</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            {trickCardBySeat.EAST
              ? <CenterCard card={trickCardBySeat.EAST} />
              : <EmptySlot />}
            <span className="text-green-400 text-xs font-medium">E</span>
          </div>

          {/* Row 2 */}
          <div />
          <div className="flex flex-col items-center gap-1">
            <span className="text-green-400 text-xs font-medium">S</span>
            {trickCardBySeat.SOUTH
              ? <CenterCard card={trickCardBySeat.SOUTH} />
              : <EmptySlot />}
          </div>
          <div />
        </div>
      </div>

      {/* ── Play animation overlay ─────────────────────────────────────── */}
      {animCard && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="card-play-anim">
            <BigCard card={animCard} />
          </div>
        </div>
      )}

      {/* ── Seats ──────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        {renderSeat("NORTH", "top")}
      </div>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        {renderSeat("SOUTH", "bottom")}
      </div>
      <div className="absolute left-4 top-0 bottom-0 flex items-center">
        {renderSeat("WEST", "left")}
      </div>
      <div className="absolute right-4 top-0 bottom-0 flex items-center">
        {renderSeat("EAST", "right")}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CenterCard({ card }: { card: string }) {
  const { rank, sym, isRed } = cardDisplay(card);
  return (
    <div className={`flex flex-col items-center justify-center w-14 h-20 rounded-lg border-2 border-gray-200 bg-white shadow-md font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
      <span className="text-lg leading-none">{rank}</span>
      <span className="text-xl leading-none mt-0.5">{sym}</span>
    </div>
  );
}

function EmptySlot() {
  return <div className="w-14 h-20 rounded-lg border-2 border-dashed border-green-600 opacity-30" />;
}

function BigCard({ card }: { card: string }) {
  const { rank, sym, isRed } = cardDisplay(card);
  return (
    <div className={`flex flex-col items-center justify-center w-24 h-36 rounded-2xl border-4 border-yellow-400 bg-white shadow-2xl font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
      <span className="text-4xl leading-none font-extrabold">{rank}</span>
      <span className="text-5xl leading-none mt-1">{sym}</span>
    </div>
  );
}

function BidBadge({ call }: { call: string }) {
  const SUIT_MAP: Record<string, { sym: string; color: string }> = {
    S: { sym: "♠", color: "text-gray-900" }, H: { sym: "♥", color: "text-red-600" },
    D: { sym: "♦", color: "text-red-600" }, C: { sym: "♣", color: "text-gray-900" },
    NT: { sym: "NT", color: "text-yellow-700" },
  };
  if (call === "PASS") return <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full border border-green-400">Pass</span>;
  if (call === "X")    return <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full border border-red-400">X</span>;
  if (call === "XX")   return <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-400">XX</span>;
  const level = call[0];
  const denom = call.slice(1);
  const { sym, color } = SUIT_MAP[denom] ?? { sym: denom, color: "text-gray-900" };
  return (
    <span className={`bg-white text-sm font-bold px-2 py-0.5 rounded-full border border-gray-300 shadow-sm ${color}`}>
      {level}{sym}
    </span>
  );
}
