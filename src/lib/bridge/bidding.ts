import { Seat, nextSeat } from "./deck";

export type Denomination = "C" | "D" | "H" | "S" | "NT";
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type BidCall =
  | `${Level}${"C" | "D" | "H" | "S" | "NT"}`
  | "PASS"
  | "X"
  | "XX";

export interface AuctionState {
  calls: Array<{ seat: Seat; call: string }>;
  currentSeat: Seat;
  dealer: Seat;
  contract: string | null;
  declarer: Seat | null;
  doubled: boolean;
  redoubled: boolean;
  complete: boolean;
}

const DENOM_ORDER: Record<Denomination, number> = {
  C: 0,
  D: 1,
  H: 2,
  S: 3,
  NT: 4,
};

export function parseBid(call: string): { level: Level; denom: Denomination } | null {
  if (call === "PASS" || call === "X" || call === "XX") return null;
  const level = parseInt(call[0]) as Level;
  const denom = call.slice(1) as Denomination;
  if (level < 1 || level > 7) return null;
  if (!["C", "D", "H", "S", "NT"].includes(denom)) return null;
  return { level, denom };
}

export function isHigherBid(
  newCall: string,
  lastBid: string | null
): boolean {
  if (!lastBid) return true;
  const newParsed = parseBid(newCall);
  const lastParsed = parseBid(lastBid);
  if (!newParsed || !lastParsed) return false;
  if (newParsed.level !== lastParsed.level) {
    return newParsed.level > lastParsed.level;
  }
  return DENOM_ORDER[newParsed.denom] > DENOM_ORDER[lastParsed.denom];
}

export function getLastBid(calls: Array<{ seat: Seat; call: string }>): {
  call: string;
  seat: Seat;
} | null {
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].call !== "PASS" && calls[i].call !== "X" && calls[i].call !== "XX") {
      return calls[i];
    }
  }
  return null;
}

export function validateBid(
  call: string,
  state: AuctionState
): { valid: boolean; reason?: string } {
  if (state.complete) return { valid: false, reason: "Auction is complete" };

  if (call === "PASS") return { valid: true };

  const lastBid = getLastBid(state.calls);

  if (call === "X") {
    if (!lastBid) return { valid: false, reason: "Cannot double with no bid" };
    if (lastBid.seat === state.currentSeat) {
      return { valid: false, reason: "Cannot double your own bid" };
    }
    // Check partner didn't make the last bid
    const partnerSeat =
      state.currentSeat === "NORTH"
        ? "SOUTH"
        : state.currentSeat === "SOUTH"
        ? "NORTH"
        : state.currentSeat === "EAST"
        ? "WEST"
        : "EAST";
    if (lastBid.seat === partnerSeat) {
      return { valid: false, reason: "Cannot double partner's bid" };
    }
    if (state.doubled) return { valid: false, reason: "Already doubled" };
    return { valid: true };
  }

  if (call === "XX") {
    if (!state.doubled) return { valid: false, reason: "Can only redouble after a double" };
    if (state.redoubled) return { valid: false, reason: "Already redoubled" };
    return { valid: true };
  }

  if (!isHigherBid(call, lastBid?.call ?? null)) {
    return { valid: false, reason: "Bid must be higher than previous bid" };
  }

  return { valid: true };
}

export function updateAuction(
  state: AuctionState,
  seat: Seat,
  call: string
): AuctionState {
  const newCalls = [...state.calls, { seat, call }];
  let doubled = state.doubled;
  let redoubled = state.redoubled;
  let contract = state.contract;
  let declarer = state.declarer;

  if (call === "X") {
    doubled = true;
    redoubled = false;
  } else if (call === "XX") {
    redoubled = true;
  } else if (call !== "PASS") {
    doubled = false;
    redoubled = false;
  }

  // Check if auction is complete (3 passes after a bid, or 4 passes)
  const complete = isAuctionComplete(newCalls);

  if (complete) {
    const lastBidInfo = getLastBid(newCalls);
    if (lastBidInfo) {
      contract =
        lastBidInfo.call +
        (redoubled ? "XX" : doubled ? "X" : "");
      // Declarer is the first player on the winning side to have bid that denomination
      const parsed = parseBid(lastBidInfo.call);
      if (parsed) {
        const winningSide =
          lastBidInfo.seat === "NORTH" || lastBidInfo.seat === "SOUTH"
            ? ["NORTH", "SOUTH"]
            : ["EAST", "WEST"];
        for (const c of newCalls) {
          const p = parseBid(c.call);
          if (p && p.denom === parsed.denom && winningSide.includes(c.seat)) {
            declarer = c.seat as Seat;
            break;
          }
        }
      }
    }
  }

  return {
    ...state,
    calls: newCalls,
    currentSeat: nextSeat(seat),
    contract,
    declarer,
    doubled,
    redoubled,
    complete,
  };
}

function isAuctionComplete(calls: Array<{ seat: Seat; call: string }>): boolean {
  if (calls.length < 4) return false;

  // All 4 passes = passed out
  if (calls.length === 4 && calls.every((c) => c.call === "PASS")) return true;

  // 3 consecutive passes after a bid
  const lastThree = calls.slice(-3);
  if (
    calls.length >= 4 &&
    lastThree.every((c) => c.call === "PASS") &&
    getLastBid(calls) !== null
  ) {
    return true;
  }

  return false;
}

export function parseContract(contract: string): {
  level: Level;
  denom: Denomination;
  doubled: boolean;
  redoubled: boolean;
} | null {
  const redoubled = contract.endsWith("XX");
  const doubled = !redoubled && contract.endsWith("X");
  const base = contract.replace(/XX?$/, "");
  const parsed = parseBid(base);
  if (!parsed) return null;
  return { ...parsed, doubled, redoubled };
}

export function generateAllBids(): string[] {
  const bids: string[] = [];
  const levels: Level[] = [1, 2, 3, 4, 5, 6, 7];
  const denoms: Denomination[] = ["C", "D", "H", "S", "NT"];
  for (const level of levels) {
    for (const denom of denoms) {
      bids.push(`${level}${denom}`);
    }
  }
  return bids;
}
