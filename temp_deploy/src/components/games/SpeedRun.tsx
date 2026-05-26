'use client';
// تحدي سرعة الرد - صح أم خطأ مع مؤقت

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Check, X as CloseX, AlertCircle, Zap, ShieldCheck } from 'lucide-react';

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const itemsLen = items.length;
  const currentItem = itemsLen > 0 ? items[Math.min(currentIndex, itemsLen - 1)] : null;

  const handleAnswer = useCallback(
    (answer: boolean | null) => {
      if (!currentItem || lockRef.current || itemsLen === 0) return;
      lockRef.current = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const earned = answer === null ? 0 : answer === currentItem.isTrue ? 1 : 0;
      const finalScore = scoreRef.current + earned;
      const idx = currentIndex;
      const isLast = idx >= itemsLen - 1;

      if (answer === null) setFeedback('timeout');
      else if (earned) {
        setFeedback('correct');
        setScore(finalScore);
      } else setFeedback('wrong');

      window.setTimeout(() => {
        if (!isLast) {
          setCurrentIndex((i) => i + 1);
          setFeedback('none');
          lockRef.current = false;
        } else {
          onComplete(finalScore, itemsLen);
        }
      }, 720);
    },
    [currentIndex, currentItem, itemsLen, onComplete]
  );

  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;

  useEffect(() => {
    if (itemsLen === 0 || !currentItem) return;

    lockRef.current = false;
    setFeedback('none');
    setTimeLeft(5);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          queueMicrotask(() => handleAnswerRef.current(null));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // يُعاد تشغيل المؤقت عند تغيّر الجولة فقط؛ إدراج currentItem يسبب إعادة تعيين زائدة
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentItem?.statement يمثّل الجولة الحالية
  }, [currentIndex, itemsLen, currentItem?.statement]);

  if (itemsLen === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-text-muted text-sm">لا توجد عبارات للّعب.</div>
    );
  }

  if (!currentItem) return null;

  return (
    <div className="flex-1 flex flex-col gap-10 p-6 max-w-xl mx-auto w-full h-full justify-center">
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
        <div className="flex items-center gap-2 text-gold font-black">
          <Zap size={20} /> <span className="text-xl tabular-nums">{score}</span>
        </div>
        <div
          className={`flex items-center gap-2 font-black transition-colors ${timeLeft <= 2 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}
        >
          <Timer size={20} /> <span className="text-2xl font-mono tabular-nums">{timeLeft}s</span>
        </div>
        <div className="text-[10px] font-bold text-white/40 uppercase tabular-nums">
          {currentIndex + 1} / {itemsLen}
        </div>
      </div>

      <div
        className={`relative min-h-[220px] p-8 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden ${
          feedback === 'correct'
            ? 'bg-green-500/10 border-green-500 game-win-pulse'
            : feedback === 'wrong'
              ? 'bg-red-500/10 border-red-500'
              : feedback === 'timeout'
                ? 'bg-yellow-500/10 border-yellow-500'
                : 'bg-white/5 border-white/10'
        }`}
      >
        {feedback === 'correct' && <Check size={80} className="text-green-500/25 absolute animate-bounce" />}
        {feedback === 'wrong' && <CloseX size={80} className="text-red-500/25 absolute animate-game-shake" />}
        {feedback === 'timeout' && <AlertCircle size={80} className="text-yellow-500/20 absolute animate-pulse" />}

        <h3 className="text-2xl sm:text-3xl font-black text-white leading-snug relative z-10 px-2">{currentItem.statement}</h3>
      </div>

      <div className="grid grid-cols-2 gap-6 min-h-28">
        <button
          type="button"
          onClick={() => handleAnswer(true)}
          disabled={feedback !== 'none'}
          className="rounded-3xl bg-green-500 border-b-4 border-green-700 active:border-b-0 active:translate-y-1 text-white font-black text-2xl sm:text-3xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-40 game-btn-press"
        >
          صح <Check size={28} />
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(false)}
          disabled={feedback !== 'none'}
          className="rounded-3xl bg-red-500 border-b-4 border-red-700 active:border-b-0 active:translate-y-1 text-white font-black text-2xl sm:text-3xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-40 game-btn-press"
        >
          خطأ <CloseX size={28} />
        </button>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-widest">
          <ShieldCheck size={14} className="text-gold" /> ركّز وسجّل أكبر عدد من الإجابات الصحيحة
        </div>
      </div>
    </div>
  );
}
