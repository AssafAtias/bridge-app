"use client";

import { useLanguage } from "@/context/LanguageContext";

interface Props {
  cards: string[];
  playable: boolean;
  ledSuit: string | null;
  hand: string[];
  zoom?: number;
  onPlayCard?: (card: string) => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  S: "♠", H: "♥", D: "♦", C: "♣",
};

const SUIT_ORDER: Record<string, number> = { S: 3, H: 2, D: 1, C: 0 };
const RANK_ORDER: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
};

function sortCards(cards: string[]): string[] {
  return [...cards].sort((a, b) => {
    const suitA = a.slice(-1), suitB = b.slice(-1);
    const rankA = a.slice(0, -1), rankB = b.slice(0, -1);
    if (SUIT_ORDER[suitA] !== SUIT_ORDER[suitB])
      return SUIT_ORDER[suitB] - SUIT_ORDER[suitA];
    return RANK_ORDER[rankB] - RANK_ORDER[rankA];
  });
}

function isCardPlayable(card: string, hand: string[], ledSuit: string | null): boolean {
  if (!ledSuit) return true;
  const cardSuit = card.slice(-1);
  if (cardSuit === ledSuit) return true;
  return !hand.some((c) => c.slice(-1) === ledSuit);
}

const BASE_W = 44;
const BASE_H = 64;
const BASE_STEP = 28;

export default function Hand({ cards, playable, ledSuit, hand, zoom = 1, onPlayCard }: Props) {
  const { t } = useLanguage();
  const sorted = sortCards(cards);

  const cardW = Math.round(BASE_W * zoom);
  const cardH = Math.round(BASE_H * zoom);
  const step = Math.round(BASE_STEP * zoom);
  const fanWidth = cardW + Math.max(0, sorted.length - 1) * step;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: fanWidth, height: cardH }}>
        {sorted.map((card, idx) => {
          const suit = card.slice(-1);
          const rank = card.slice(0, -1);
          const isRed = suit === "H" || suit === "D";
          const displayRank = rank === "T" ? "10" : rank;
          const suitSymbol = SUIT_SYMBOLS[suit];
          const canPlay = playable && isCardPlayable(card, hand, ledSuit);

          return (
            <button
              key={card}
              onDoubleClick={() => canPlay && onPlayCard && onPlayCard(card)}
              disabled={!canPlay || !onPlayCard}
              title={canPlay && onPlayCard ? `${t.doubleClickHint}: ${displayRank}${suitSymbol}` : undefined}
              style={{
                position: "absolute",
                left: idx * step,
                top: 0,
                width: cardW,
                height: cardH,
                zIndex: idx + 1,
              }}
              className={`
                flex flex-col items-center justify-center select-none
                rounded-lg border-2 shadow
                ${isRed ? "text-red-600" : "text-gray-900"}
                ${canPlay && onPlayCard
                  ? "bg-white border-yellow-400 cursor-pointer transition-transform duration-100 hover:bg-yellow-50 hover:border-yellow-300 hover:shadow-2xl hover:-translate-y-5"
                  : "bg-white border-gray-300 cursor-default opacity-90"
                }
              `}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.zIndex = "50"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.zIndex = String(idx + 1); }}
            >
              <span className="font-bold leading-none" style={{ fontSize: Math.round(13 * zoom) }}>{displayRank}</span>
              <span className="leading-none mt-0.5" style={{ fontSize: Math.round(16 * zoom) }}>{suitSymbol}</span>
            </button>
          );
        })}
      </div>
      {playable && onPlayCard && (
        <p className="text-yellow-300 text-xs opacity-70">{t.doubleClickHint}</p>
      )}
    </div>
  );
}
