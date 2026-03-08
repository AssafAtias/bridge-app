import { Card, Seat, Suit, Rank, RANK_ORDER, SUIT_ORDER, getCardSuit, getCardRank } from "./deck";
import { AuctionState, getLastBid, isHigherBid } from "./bidding";

// ─── HCP & shape ──────────────────────────────────────────────────────────────

export function countHCP(hand: Card[]): number {
  let hcp = 0;
  for (const card of hand) {
    const r = getCardRank(card);
    if (r === "A") hcp += 4;
    else if (r === "K") hcp += 3;
    else if (r === "Q") hcp += 2;
    else if (r === "J") hcp += 1;
  }
  return hcp;
}

function suitCounts(hand: Card[]): Record<Suit, number> {
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of hand) counts[getCardSuit(card)]++;
  return counts;
}

function longestSuit(hand: Card[]): Suit {
  const counts = suitCounts(hand);
  return (["S", "H", "D", "C"] as Suit[]).reduce((best, s) =>
    counts[s] > counts[best] ? s : best
  );
}

function isBalanced(hand: Card[]): boolean {
  const counts = Object.values(suitCounts(hand));
  const voids = counts.filter((c) => c === 0).length;
  const singletons = counts.filter((c) => c === 1).length;
  return voids === 0 && singletons <= 1;
}

// ─── Bidding AI ───────────────────────────────────────────────────────────────

export function chooseBid(hand: Card[], state: AuctionState): string {
  const hcp = countHCP(hand);
  const lastBid = getLastBid(state.calls);

  // Opening bid (no bids yet or all passes before us)
  if (!lastBid) {
    if (hcp >= 22) return "2C";
    if (hcp >= 20) return "2NT";
    if (hcp >= 15 && hcp <= 17 && isBalanced(hand)) return "1NT";
    if (hcp >= 12) {
      const suit = longestSuit(hand);
      return `1${suit}`;
    }
    return "PASS";
  }

  // Simple response logic
  const parsed = parseSimpleBid(lastBid.call);
  if (!parsed) return "PASS";

  // Partner bid — basic raises
  const partnerSeat = getPartner(state.currentSeat);
  const partnerBid = state.calls.find((c) => c.seat === partnerSeat && c.call !== "PASS");

  if (partnerBid && hcp >= 6) {
    const parsedPartner = parseSimpleBid(partnerBid.call);
    if (parsedPartner) {
      // Try to raise partner's suit
      const raisedLevel = parsedPartner.level + 1;
      if (raisedLevel <= 7) {
        const raisedCall = `${raisedLevel}${parsedPartner.denom}`;
        if (isHigherBid(raisedCall, lastBid.call)) return raisedCall;
      }
    }
  }

  return "PASS";
}

function parseSimpleBid(call: string): { level: number; denom: string } | null {
  if (call === "PASS" || call === "X" || call === "XX") return null;
  const level = parseInt(call[0]);
  if (isNaN(level)) return null;
  return { level, denom: call.slice(1) };
}

function getPartner(seat: Seat): Seat {
  const map: Record<Seat, Seat> = {
    NORTH: "SOUTH",
    SOUTH: "NORTH",
    EAST: "WEST",
    WEST: "EAST",
  };
  return map[seat];
}

// ─── Card play AI ─────────────────────────────────────────────────────────────

export function chooseCard(
  hand: Card[],
  ledSuit: Suit | null,
  trump: Suit | null,
  trickPlays: Array<{ seat: Seat; card: Card }>,
  isDefender: boolean
): Card {
  // Filter to legal cards
  const legal = ledSuit
    ? hand.filter((c) => getCardSuit(c) === ledSuit).length > 0
      ? hand.filter((c) => getCardSuit(c) === ledSuit)
      : hand
    : hand;

  if (legal.length === 1) return legal[0];

  // Leading a trick
  if (trickPlays.length === 0) {
    return chooseLead(hand, trump, isDefender);
  }

  // Following — try to win if worthwhile
  const currentWinner = getCurrentWinner(trickPlays, trump);
  const partnerSeat = getPartner(
    trickPlays[trickPlays.length > 1 ? trickPlays.length - 1 : 0].seat
  );
  const partnerIsWinning =
    trickPlays.length >= 2 && currentWinner === partnerSeat;

  if (partnerIsWinning) {
    // Partner is winning — throw low
    return lowestCard(legal);
  }

  // Try to win the trick
  const winning = legal.filter((c) => cardBeats(c, trickPlays, trump, ledSuit!));
  if (winning.length > 0) {
    // Play lowest winning card
    return lowestCard(winning);
  }

  // Can't win — throw lowest
  return lowestCard(legal);
}

function chooseLead(hand: Card[], trump: Suit | null, isDefender: boolean): Card {
  // Lead top of a sequence, or 4th-highest from longest suit
  const suits = (["S", "H", "D", "C"] as Suit[]).filter((s) =>
    hand.some((c) => getCardSuit(c) === s)
  );

  // Avoid leading trump when defending
  const preferredSuits = isDefender && trump
    ? suits.filter((s) => s !== trump)
    : suits;

  const targetSuits = preferredSuits.length > 0 ? preferredSuits : suits;

  // Find longest suit
  const bySuit: Record<string, Card[]> = {};
  for (const s of targetSuits) {
    bySuit[s] = hand
      .filter((c) => getCardSuit(c) === s)
      .sort((a, b) => RANK_ORDER[getCardRank(b)] - RANK_ORDER[getCardRank(a)]);
  }

  const longest = targetSuits.reduce((best, s) =>
    bySuit[s].length > (bySuit[best]?.length ?? 0) ? s : best
  );

  const suitCards = bySuit[longest];

  // Top of sequence
  for (let i = 0; i < suitCards.length - 1; i++) {
    const r1 = RANK_ORDER[getCardRank(suitCards[i])];
    const r2 = RANK_ORDER[getCardRank(suitCards[i + 1])];
    if (r1 - r2 === 1) return suitCards[i]; // top of sequence
  }

  // 4th highest if 4+ cards, otherwise lowest
  if (suitCards.length >= 4) return suitCards[3];
  return suitCards[suitCards.length - 1];
}

function getCurrentWinner(
  plays: Array<{ seat: Seat; card: Card }>,
  trump: Suit | null
): Seat {
  const ledSuit = getCardSuit(plays[0].card);
  let winner = plays[0];
  for (let i = 1; i < plays.length; i++) {
    const current = plays[i];
    const cs = getCardSuit(current.card);
    const ws = getCardSuit(winner.card);
    if (trump) {
      if (cs === trump && ws !== trump) { winner = current; continue; }
      if (cs === trump && ws === trump) {
        if (RANK_ORDER[getCardRank(current.card)] > RANK_ORDER[getCardRank(winner.card)])
          winner = current;
        continue;
      }
    }
    if (cs === ledSuit && RANK_ORDER[getCardRank(current.card)] > RANK_ORDER[getCardRank(winner.card)])
      winner = current;
  }
  return winner.seat;
}

function cardBeats(
  card: Card,
  trickPlays: Array<{ seat: Seat; card: Card }>,
  trump: Suit | null,
  ledSuit: Suit
): boolean {
  const testPlays = [...trickPlays, { seat: "NORTH" as Seat, card }];
  return getCurrentWinner(testPlays, trump) === "NORTH";
}

function lowestCard(cards: Card[]): Card {
  return cards.sort(
    (a, b) => RANK_ORDER[getCardRank(a)] - RANK_ORDER[getCardRank(b)]
  )[0];
}
