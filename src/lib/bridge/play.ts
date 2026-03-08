import { Card, Seat, Suit, RANK_ORDER, getCardSuit, getCardRank, nextSeat } from "./deck";
import { Denomination, parseContract } from "./bidding";

export interface TrickState {
  trickNum: number;
  leader: Seat;
  plays: Array<{ seat: Seat; card: Card }>;
  complete: boolean;
  winner?: Seat;
}

export function getTrumpSuit(contract: string): Suit | null {
  const parsed = parseContract(contract);
  if (!parsed || parsed.denom === "NT") return null;
  return parsed.denom as Suit;
}

export function canPlayCard(
  card: Card,
  hand: Card[],
  ledSuit: Suit | null
): boolean {
  if (!ledSuit) return true; // Leading — any card
  const cardSuit = getCardSuit(card);
  if (cardSuit === ledSuit) return true;
  // Must follow suit if possible
  const hasSuit = hand.some((c) => getCardSuit(c) === ledSuit);
  return !hasSuit;
}

export function getPlayableCards(hand: Card[], ledSuit: Suit | null): Card[] {
  if (!ledSuit) return hand;
  const suitCards = hand.filter((c) => getCardSuit(c) === ledSuit);
  if (suitCards.length > 0) return suitCards;
  return hand;
}

export function determineTrickWinner(
  trick: Array<{ seat: Seat; card: Card }>,
  trump: Suit | null
): Seat {
  if (trick.length !== 4) throw new Error("Trick must have 4 cards");
  const ledSuit = getCardSuit(trick[0].card);

  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const current = trick[i];
    const currentSuit = getCardSuit(current.card);
    const winnerSuit = getCardSuit(winner.card);

    if (trump) {
      // Trump beats non-trump
      if (currentSuit === trump && winnerSuit !== trump) {
        winner = current;
      } else if (currentSuit === trump && winnerSuit === trump) {
        if (RANK_ORDER[getCardRank(current.card)] > RANK_ORDER[getCardRank(winner.card)]) {
          winner = current;
        }
      } else if (currentSuit !== trump && winnerSuit !== trump) {
        // Both non-trump: higher card in led suit wins
        if (
          currentSuit === ledSuit &&
          RANK_ORDER[getCardRank(current.card)] > RANK_ORDER[getCardRank(winner.card)]
        ) {
          winner = current;
        }
      }
    } else {
      // No trump: higher card in led suit wins
      if (
        currentSuit === ledSuit &&
        RANK_ORDER[getCardRank(current.card)] > RANK_ORDER[getCardRank(winner.card)]
      ) {
        winner = current;
      }
    }
  }
  return winner.seat;
}

export function getNextPlayer(
  currentSeat: Seat,
  declarer: Seat,
  dummy: Seat,
  isDummyTurn: boolean
): Seat {
  if (isDummyTurn) return declarer; // Declarer plays for dummy
  return nextSeat(currentSeat);
}

export function isDummy(seat: Seat, declarer: Seat): Seat {
  const order: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];
  const declarerIdx = order.indexOf(declarer);
  return order[(declarerIdx + 2) % 4];
}

export function getOpeningLeader(declarer: Seat): Seat {
  return nextSeat(declarer);
}
