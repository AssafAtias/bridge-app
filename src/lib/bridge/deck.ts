export type Suit = "S" | "H" | "D" | "C";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";
export type Card = `${Rank}${Suit}`;
export type Seat = "NORTH" | "EAST" | "SOUTH" | "WEST";

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
];
export const SUIT_ORDER: Record<Suit, number> = { S: 3, H: 2, D: 1, C: 0 };
export const RANK_ORDER: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealHands(): Record<Seat, Card[]> {
  const deck = shuffleDeck(createDeck());
  const seats: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];
  const hands: Record<Seat, Card[]> = {
    NORTH: [],
    EAST: [],
    SOUTH: [],
    WEST: [],
  };
  deck.forEach((card, i) => {
    hands[seats[i % 4]].push(card);
  });
  return hands;
}

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const suitA = a.slice(-1) as Suit;
    const suitB = b.slice(-1) as Suit;
    const rankA = a.slice(0, -1) as Rank;
    const rankB = b.slice(0, -1) as Rank;
    if (SUIT_ORDER[suitA] !== SUIT_ORDER[suitB]) {
      return SUIT_ORDER[suitB] - SUIT_ORDER[suitA];
    }
    return RANK_ORDER[rankB] - RANK_ORDER[rankA];
  });
}

export function getCardSuit(card: Card): Suit {
  return card.slice(-1) as Suit;
}

export function getCardRank(card: Card): Rank {
  return card.slice(0, -1) as Rank;
}

export const SEAT_ORDER: Seat[] = ["NORTH", "EAST", "SOUTH", "WEST"];

export function nextSeat(seat: Seat): Seat {
  const idx = SEAT_ORDER.indexOf(seat);
  return SEAT_ORDER[(idx + 1) % 4];
}
