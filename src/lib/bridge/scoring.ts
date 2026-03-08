import { Denomination, Level, parseContract } from "./bidding";
import { Seat } from "./deck";

export interface ContractResult {
  contract: string;
  declarer: Seat;
  tricksMade: number;
  vulnerable: boolean;
}

export interface ScoreResult {
  declarerPoints: number;
  defenderPoints: number;
  made: boolean;
  overtricks: number;
  undertricks: number;
}

function tricksNeeded(level: Level): number {
  return level + 6;
}

function minorSuitPoints(tricks: number): number {
  return tricks * 20;
}

function majorSuitPoints(tricks: number): number {
  return tricks * 30;
}

function notrumpPoints(tricks: number): number {
  return 40 + (tricks - 1) * 30;
}

function baseScore(level: Level, denom: Denomination): number {
  if (denom === "C" || denom === "D") return level * 20;
  if (denom === "H" || denom === "S") return level * 30;
  return 40 + (level - 1) * 30; // NT
}

export function calculateScore(result: ContractResult): ScoreResult {
  const parsed = parseContract(result.contract);
  if (!parsed) {
    return { declarerPoints: 0, defenderPoints: 0, made: false, overtricks: 0, undertricks: 0 };
  }

  const { level, denom, doubled, redoubled } = parsed;
  const needed = tricksNeeded(level);
  const made = result.tricksMade >= needed;
  const overtricks = Math.max(0, result.tricksMade - needed);
  const undertricks = Math.max(0, needed - result.tricksMade);

  if (!made) {
    // Defeated — defenders score
    let defenderPoints = 0;
    if (!doubled && !redoubled) {
      defenderPoints = result.vulnerable ? undertricks * 100 : undertricks * 50;
    } else if (doubled) {
      if (result.vulnerable) {
        defenderPoints = undertricks === 1 ? 200 : 200 + (undertricks - 1) * 300;
      } else {
        if (undertricks === 1) defenderPoints = 100;
        else if (undertricks === 2) defenderPoints = 300;
        else if (undertricks === 3) defenderPoints = 500;
        else defenderPoints = 500 + (undertricks - 3) * 300;
      }
    } else {
      // Redoubled
      defenderPoints = doubled
        ? 0
        : result.vulnerable
        ? undertricks === 1
          ? 400
          : 400 + (undertricks - 1) * 600
        : undertricks === 1
        ? 200
        : undertricks === 2
        ? 600
        : undertricks === 3
        ? 1000
        : 1000 + (undertricks - 3) * 600;
    }
    return { declarerPoints: 0, defenderPoints, made: false, overtricks: 0, undertricks };
  }

  // Contract made — declarer scores
  let trickScore = baseScore(level, denom);
  if (doubled) trickScore *= 2;
  if (redoubled) trickScore *= 4;

  const gameBonus =
    trickScore >= 100
      ? result.vulnerable
        ? 500
        : 300
      : 50; // Part-score bonus

  const slamBonus =
    level === 6
      ? result.vulnerable
        ? 750
        : 500
      : level === 7
      ? result.vulnerable
        ? 1500
        : 1000
      : 0;

  const doubleBonus = doubled ? 50 : redoubled ? 100 : 0;

  let overtrickPoints = 0;
  if (doubled) {
    overtrickPoints = overtricks * (result.vulnerable ? 200 : 100);
  } else if (redoubled) {
    overtrickPoints = overtricks * (result.vulnerable ? 400 : 200);
  } else {
    overtrickPoints = overtricks * baseScore(1, denom);
  }

  const declarerPoints =
    trickScore + gameBonus + slamBonus + doubleBonus + overtrickPoints;

  return { declarerPoints, defenderPoints: 0, made: true, overtricks, undertricks: 0 };
}

export function isNSSide(seat: Seat): boolean {
  return seat === "NORTH" || seat === "SOUTH";
}
