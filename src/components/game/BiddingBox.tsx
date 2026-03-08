"use client";

import { Seat } from "./GameClient";

interface Props {
  bids: Array<{ seat: Seat; call: string; order: number }>;
  dealer: Seat;
  currentSeat: Seat | null;
  isMyTurn: boolean;
  lastBid: string | null;
  doubled: boolean;
  redoubled: boolean;
  onBid: (call: string) => void;
}

const DENOMINATIONS = ["C", "D", "H", "S", "NT"] as const;
const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

const DENOM_ORDER: Record<string, number> = {
  C: 0, D: 1, H: 2, S: 3, NT: 4,
};

const DENOM_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  C: { symbol: "♣", color: "text-gray-200" },
  D: { symbol: "♦", color: "text-red-400" },
  H: { symbol: "♥", color: "text-red-400" },
  S: { symbol: "♠", color: "text-gray-200" },
  NT: { symbol: "NT", color: "text-yellow-300" },
};

function parseLastBid(lastBid: string | null): { level: number; denomOrder: number } | null {
  if (!lastBid) return null;
  const level = parseInt(lastBid[0]);
  const denom = lastBid.slice(1);
  return { level, denomOrder: DENOM_ORDER[denom] ?? 0 };
}

function isBidAvailable(
  level: number,
  denom: string,
  lastBid: string | null
): boolean {
  const last = parseLastBid(lastBid);
  if (!last) return true;
  if (level > last.level) return true;
  if (level === last.level && DENOM_ORDER[denom] > last.denomOrder) return true;
  return false;
}

export default function BiddingBox({
  currentSeat,
  isMyTurn,
  lastBid,
  doubled,
  redoubled,
  onBid,
}: Props) {
  return (
    <div className="bg-green-800 border border-green-600 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-yellow-400 font-semibold text-sm">Bidding Box</h3>
        {currentSeat && (
          <span className="text-xs text-green-400">
            {isMyTurn ? "Your turn" : `${currentSeat}'s turn`}
          </span>
        )}
      </div>

      {/* Bid grid */}
      <div className="mb-3">
        {LEVELS.map((level) => (
          <div key={level} className="grid grid-cols-5 gap-1 mb-1">
            {DENOMINATIONS.map((denom) => {
              const available = isBidAvailable(level, denom, lastBid);
              const call = `${level}${denom}`;
              const { symbol, color } = DENOM_SYMBOLS[denom];
              return (
                <button
                  key={call}
                  onClick={() => isMyTurn && available && onBid(call)}
                  disabled={!isMyTurn || !available}
                  className={`
                    text-sm py-1.5 px-0.5 rounded font-bold border transition text-center leading-none
                    ${color}
                    ${available && isMyTurn
                      ? "bg-blue-900 border-blue-600 hover:bg-blue-700 cursor-pointer"
                      : "bg-green-900 border-green-700 cursor-not-allowed opacity-40"
                    }
                  `}
                >
                  {level}{symbol}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Special calls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => isMyTurn && onBid("PASS")}
          disabled={!isMyTurn}
          className={`
            py-2 rounded-lg text-sm font-bold border transition
            ${isMyTurn
              ? "bg-green-600 border-green-400 hover:bg-green-500 text-white cursor-pointer"
              : "bg-green-900 border-green-700 text-green-600 cursor-not-allowed opacity-50"
            }
          `}
        >
          PASS
        </button>
        <button
          onClick={() => isMyTurn && !doubled && onBid("X")}
          disabled={!isMyTurn || doubled}
          className={`
            py-2 rounded-lg text-sm font-bold border transition
            ${isMyTurn && !doubled
              ? "bg-red-800 border-red-600 hover:bg-red-700 text-red-200 cursor-pointer"
              : "bg-green-900 border-green-700 text-green-600 cursor-not-allowed opacity-50"
            }
          `}
        >
          X
        </button>
        <button
          onClick={() => isMyTurn && doubled && !redoubled && onBid("XX")}
          disabled={!isMyTurn || !doubled || redoubled}
          className={`
            py-2 rounded-lg text-sm font-bold border transition
            ${isMyTurn && doubled && !redoubled
              ? "bg-blue-800 border-blue-600 hover:bg-blue-700 text-blue-200 cursor-pointer"
              : "bg-green-900 border-green-700 text-green-600 cursor-not-allowed opacity-50"
            }
          `}
        >
          XX
        </button>
      </div>
    </div>
  );
}
