'use client';
// src/components/games/MatchMaster.tsx
// لعبة مطابقة المصطلحات بالتعريفات

import { useState, useEffect } from 'react';
import { MatchItem } from '@/types';
import { Trophy, Check, X as CloseX, Zap } from 'lucide-react';

interface MatchMasterProps {
  items: MatchItem[];
  onComplete: (score: number, total: number) => void;
}

export function MatchMaster({ items, onComplete }: MatchMasterProps) {
  const [shuffledTerms, setShuffledTerms] = useState<string[]>([]);
  const [shuffledDefs, setShuffledDefs] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [matches, setMatches] = useState<Set<string>>(new Set());
  const [wrongMatches, setWrongMatches] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Limit to 6 items at a time for better mobile UI
    const gameItems = items.slice(0, 6);
    setShuffledTerms([...gameItems.map(i => i.term)].sort(() => Math.random() - 0.5));
    setShuffledDefs([...gameItems.map(i => i.definition)].sort(() => Math.random() - 0.5));
  }, [items]);

  useEffect(() => {
    if (selectedTerm && selectedDef) {
      const isMatch = items.find(i => i.term === selectedTerm && i.definition === selectedDef);
      
      if (isMatch) {
        setMatches(prev => new Set(prev).add(selectedTerm).add(selectedDef));
        setScore(prev => prev + 1);
        setSelectedTerm(null);
        setSelectedDef(null);
        
        // Check if all matched
        if (matches.size + 2 >= (items.slice(0, 6).length * 2)) {
          setTimeout(() => onComplete(score + 1, items.slice(0, 6).length), 1000);
        }
      } else {
        // Shaking effect or visual feedback
        setWrongMatches(prev => new Set(prev).add(selectedTerm).add(selectedDef));
        setTimeout(() => {
          setSelectedTerm(null);
          setSelectedDef(null);
          setWrongMatches(new Set());
        }, 800);
      }
    }
  }, [selectedTerm, selectedDef]);

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto max-w-2xl mx-auto w-full">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-white flex items-center justify-center gap-2">
           <Zap className="text-gold" size={20} /> سيد المطابقة
        </h3>
        <p className="text-[10px] text-text-muted">طابق كل مصطلح بتعريفه الصحيح بالأسفل</p>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-4">
        {/* Terms Column */}
        <div className="space-y-3">
          <div className="text-[10px] font-black text-gold uppercase text-center mb-2 tracking-widest">المصطلحات</div>
          {shuffledTerms.map((term, i) => {
            const isMatched = matches.has(term);
            const isSelected = selectedTerm === term;
            const isWrong = wrongMatches.has(term);
            
            return (
              <button
                key={i}
                disabled={isMatched}
                onClick={() => setSelectedTerm(term)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-sm font-bold text-center h-20 flex items-center justify-center ${
                  isMatched ? 'bg-green-500/10 border-green-500/50 text-green-400 opacity-40' :
                  isWrong ? 'bg-red-500/10 border-red-500 animate-shake' :
                  isSelected ? 'bg-gold/20 border-gold shadow-lg shadow-gold/10' :
                  'bg-white/5 border-white/10 hover:border-gold/30'
                }`}
              >
                {term}
                {isMatched && <Check size={14} className="absolute top-1 right-1" />}
              </button>
            );
          })}
        </div>

        {/* Definitions Column */}
        <div className="space-y-3">
          <div className="text-[10px] font-black text-blue-400 uppercase text-center mb-2 tracking-widest">التعريفات</div>
          {shuffledDefs.map((def, i) => {
            const isMatched = matches.has(def);
            const isSelected = selectedDef === def;
            const isWrong = wrongMatches.has(def);

            return (
              <button
                key={i}
                disabled={isMatched}
                onClick={() => setSelectedDef(def)}
                className={`w-full p-3 rounded-xl border-2 transition-all text-[11px] font-medium leading-tight text-center h-20 flex items-center justify-center ${
                  isMatched ? 'bg-green-500/10 border-green-500/50 text-green-400 opacity-40' :
                  isWrong ? 'bg-red-500/10 border-red-500 animate-shake' :
                  isSelected ? 'bg-blue-500/20 border-blue-400 shadow-lg shadow-blue-500/10' :
                  'bg-white/5 border-white/10 hover:border-blue-500/30'
                }`}
              >
                {def}
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}
