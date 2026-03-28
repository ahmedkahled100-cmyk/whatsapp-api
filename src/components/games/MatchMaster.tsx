'use client';
// لعبة مطابقة المصطلحات بالتعريفات

import { useState, useEffect, useMemo, useRef } from 'react';
import type { MatchItem } from '@/types';
import { Zap, Check } from 'lucide-react';
import { shuffleArray } from '@/lib/utils';

interface MatchMasterProps {
  items: MatchItem[];
  onComplete: (score: number, total: number) => void;
}

export function MatchMaster({ items, onComplete }: MatchMasterProps) {
  const gameItems = useMemo(
    () =>
      items
        .filter((i) => i.term?.trim() && i.definition?.trim())
        .slice(0, 6),
    [items]
  );

  const [shuffledTerms, setShuffledTerms] = useState<string[]>([]);
  const [shuffledDefs, setShuffledDefs] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [matches, setMatches] = useState<Set<string>>(() => new Set());
  const [wrongMatches, setWrongMatches] = useState<Set<string>>(() => new Set());
  const [score, setScore] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    if (gameItems.length === 0) {
      onComplete(0, 0);
      return;
    }
    setShuffledTerms(shuffleArray(gameItems.map((i) => i.term)));
    setShuffledDefs(shuffleArray(gameItems.map((i) => i.definition)));
    setMatches(new Set());
    setWrongMatches(new Set());
    setSelectedTerm(null);
    setSelectedDef(null);
    setScore(0);
  }, [gameItems, onComplete]);

  useEffect(() => {
    if (gameItems.length === 0 || matches.size < gameItems.length * 2 || finishedRef.current) return;
    finishedRef.current = true;
    const t = setTimeout(() => onComplete(score, gameItems.length), 480);
    return () => clearTimeout(t);
  }, [matches, gameItems.length, score, onComplete]);

  useEffect(() => {
    if (!selectedTerm || !selectedDef || gameItems.length === 0) return;

    const isMatch = gameItems.some((i) => i.term === selectedTerm && i.definition === selectedDef);

    if (isMatch) {
      setMatches((prev) => new Set(prev).add(selectedTerm).add(selectedDef));
      setScore((s) => s + 1);
    } else {
      setWrongMatches(new Set([selectedTerm, selectedDef]));
      setTimeout(() => {
        setWrongMatches(new Set());
      }, 650);
    }

    setSelectedTerm(null);
    setSelectedDef(null);
  }, [selectedTerm, selectedDef, gameItems]);

  if (gameItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted text-sm">
        لا يوجد محتوى مطابقة كافٍ لهذه اللعبة.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto max-w-2xl mx-auto w-full">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-white flex items-center justify-center gap-2">
          <Zap className="text-gold" size={20} /> سيد المطابقة
        </h3>
        <p className="text-[10px] text-text-muted">طابق كل مصطلحاً بتعريفه الصحيح</p>
        <p className="text-[10px] font-bold text-gold/80 tabular-nums">
          {score} / {gameItems.length}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-4">
        <div className="space-y-3">
          <div className="text-[10px] font-black text-gold uppercase text-center mb-2 tracking-widest">المصطلحات</div>
          {shuffledTerms.map((term, i) => {
            const isMatched = matches.has(term);
            const isSelected = selectedTerm === term;
            const isWrong = wrongMatches.has(term);

            return (
              <button
                key={`term-${i}-${term.slice(0, 24)}`}
                type="button"
                disabled={isMatched}
                onClick={() => setSelectedTerm(term)}
                className={`relative w-full p-4 rounded-xl border-2 transition-all text-sm font-bold text-center min-h-20 flex items-center justify-center ${
                  isMatched
                    ? 'bg-green-500/10 border-green-500/50 text-green-400 opacity-50'
                    : isWrong
                      ? 'bg-red-500/10 border-red-500 animate-game-shake'
                      : isSelected
                        ? 'bg-gold/20 border-gold shadow-lg shadow-gold/20 ring-2 ring-gold/30'
                        : 'bg-white/5 border-white/10 hover:border-gold/30 active:scale-[0.98]'
                }`}
              >
                {term}
                {isMatched && <Check size={14} className="absolute top-1 right-1 text-green-400" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="text-[10px] font-black text-blue-400 uppercase text-center mb-2 tracking-widest">التعريفات</div>
          {shuffledDefs.map((def, i) => {
            const isMatched = matches.has(def);
            const isSelected = selectedDef === def;
            const isWrong = wrongMatches.has(def);

            return (
              <button
                key={`def-${i}-${def.slice(0, 20)}`}
                type="button"
                disabled={isMatched}
                onClick={() => setSelectedDef(def)}
                className={`relative w-full p-3 rounded-xl border-2 transition-all text-[11px] font-medium leading-tight text-center min-h-20 flex items-center justify-center ${
                  isMatched
                    ? 'bg-green-500/10 border-green-500/50 text-green-400 opacity-50'
                    : isWrong
                      ? 'bg-red-500/10 border-red-500 animate-game-shake'
                      : isSelected
                        ? 'bg-blue-500/20 border-blue-400 shadow-lg shadow-blue-500/15 ring-2 ring-blue-400/30'
                        : 'bg-white/5 border-white/10 hover:border-blue-500/30 active:scale-[0.98]'
                }`}
              >
                {def}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
