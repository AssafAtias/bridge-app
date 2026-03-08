"use client";

import { GameState, Seat } from "./GameClient";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  game: GameState;
  mySeat: Seat | null;
  onBackToLobby: () => void;
}

export default function ScoreSheet({ game, mySeat, onBackToLobby }: Props) {
  const { t } = useLanguage();
  const isNS = mySeat === "NORTH" || mySeat === "SOUTH";
  const myScore = isNS ? game.nsScore : game.ewScore;
  const oppScore = isNS ? game.ewScore : game.nsScore;
  const won = myScore > oppScore;
  const passed = game.contract === "PASSED";

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-green-800 border border-green-600 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <div className="text-5xl mb-4">
          {passed ? "🤝" : won ? "🏆" : "📊"}
        </div>
        <h1 className="text-2xl font-bold text-yellow-400 mb-2">
          {passed ? t.passedOut : t.gameOver}
        </h1>

        {!passed && game.contract && (
          <div className="bg-green-900 rounded-xl p-4 mb-6">
            <p className="text-green-300 text-sm mb-1">{t.finalContract}</p>
            <p className="text-white text-xl font-bold">{game.contract}</p>
            {game.declarer && (
              <p className="text-green-400 text-sm">{t.declarerLabel}: {game.declarer}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`rounded-xl p-4 border ${
            game.nsScore > game.ewScore ? "bg-yellow-900 border-yellow-600" : "bg-green-900 border-green-700"
          }`}>
            <p className="text-green-300 text-xs mb-1">{t.northSouth}</p>
            <p className="text-white text-3xl font-bold">{game.nsScore}</p>
            {game.nsScore > game.ewScore && <p className="text-yellow-400 text-xs mt-1">{t.winner}</p>}
          </div>
          <div className={`rounded-xl p-4 border ${
            game.ewScore > game.nsScore ? "bg-yellow-900 border-yellow-600" : "bg-green-900 border-green-700"
          }`}>
            <p className="text-green-300 text-xs mb-1">{t.eastWest}</p>
            <p className="text-white text-3xl font-bold">{game.ewScore}</p>
            {game.ewScore > game.nsScore && <p className="text-yellow-400 text-xs mt-1">{t.winner}</p>}
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {game.players.map((p) => (
            <div key={p.seat} className="flex items-center justify-between text-sm">
              <span className="text-green-400">{t.seats[p.seat]}</span>
              <span className="text-white font-medium">{p.username}</span>
              <span className="text-green-400">
                {p.seat === "NORTH" || p.seat === "SOUTH" ? t.ns : t.ew}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onBackToLobby}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-green-900 font-bold rounded-lg px-4 py-3 transition"
        >
          {t.backToLobby}
        </button>
      </div>
    </div>
  );
}
