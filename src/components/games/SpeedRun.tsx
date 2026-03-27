'use client';
// src/components/games/SpeedRun.tsx
// تحدي سرعة الرد - صح أم خطأ مع مؤقت سريع

import { useState, useEffect, useRef } from 'react';
import { 
  Timer, Check, X as CloseX, 
  AlertCircle, Zap, ShieldCheck 
} from 'lucide-react';

interface SpeedItem {
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

interface SpeedRunProps {
  items: SpeedItem[];
  onComplete: (score: number, total: number) => void;
}

export function SpeedRun({ items, onComplete }: SpeedRunProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong' | 'timeout'>('none');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentItem = items[currentIndex];

  useEffect(() => {
    if (currentIndex < items.length && feedback === 'none') {
      setTimeLeft(5);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAnswer(null); // Timeout
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, feedback]);

  const handleAnswer = (answer: boolean | null) => {
    if (feedback !== 'none') return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (answer === null) {
      setFeedback('timeout');
    } else if (answer === currentItem.isTrue) {
      setFeedback('correct');
      setScore(prev => prev + 1);
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      if (currentIndex < items.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setFeedback('none');
      } else {
        onComplete(score + (answer === currentItem.isTrue ? 1 : 0), items.length);
      }
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col gap-10 p-6 max-w-xl mx-auto w-full h-full justify-center">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
         <div className="flex items-center gap-2 text-gold font-black">
            <Zap size={20} /> <span className="text-xl">{score}</span>
         </div>
         <div className={`flex items-center gap-2 font-black transition-colors ${timeLeft <= 2 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
            <Timer size={20} /> <span className="text-2xl font-mono">{timeLeft}s</span>
         </div>
         <div className="text-[10px] font-bold text-white/40 uppercase">
            {currentIndex + 1} / {items.length}
         </div>
      </div>

      {/* Statement Card */}
      <div className={`relative min-h-[220px] p-8 rounded-3xl border-2 transition-all flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden ${
        feedback === 'correct' ? 'bg-green-500/10 border-green-500' :
        feedback === 'wrong' ? 'bg-red-500/10 border-red-500' :
        feedback === 'timeout' ? 'bg-yellow-500/10 border-yellow-500' :
        'bg-white/5 border-white/10'
      }`}>
         {/* Feedback Overlays */}
         {feedback === 'correct' && <Check size={80} className="text-green-500 animate-bounce absolute opacity-20" />}
         {feedback === 'wrong' && <CloseX size={80} className="text-red-500 animate-shake absolute opacity-20" />}
         {feedback === 'timeout' && <AlertCircle size={80} className="text-yellow-500 animate-pulse absolute opacity-20" />}

         <h3 className="text-2xl sm:text-3xl font-black text-white leading-snug relative z-10">
           {currentItem.statement}
         </h3>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-6 h-28">
         <button 
           onClick={() => handleAnswer(true)}
           disabled={feedback !== 'none'}
           className="rounded-3xl bg-green-500 border-b-8 border-green-700 active:border-b-0 active:translate-y-2 text-white font-black text-3xl shadow-lg transition-all flex items-center justify-center gap-3"
         >
           صح <Check size={32} />
         </button>
         <button 
           onClick={() => handleAnswer(false)}
           disabled={feedback !== 'none'}
           className="rounded-3xl bg-red-500 border-b-8 border-red-700 active:border-b-0 active:translate-y-2 text-white font-black text-3xl shadow-lg transition-all flex items-center justify-center gap-3"
         >
           خطأ <CloseX size={32} />
         </button>
      </div>

      <div className="text-center">
         <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-widest">
            <ShieldCheck size={14} className="text-gold" /> هل أنت سريع بما يكفي؟
         </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}
