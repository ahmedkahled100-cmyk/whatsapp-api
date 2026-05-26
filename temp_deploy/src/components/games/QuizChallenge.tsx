'use client';
// src/components/games/QuizChallenge.tsx
// تحدي الأسئلة - اختبار سريع تفاعلي

import { useState } from 'react';
import { 
  CheckCircle2, XCircle, ChevronLeft, 
  HelpCircle, Sparkles, Zap 
} from 'lucide-react';

interface QuizItem {
  text: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface QuizChallengeProps {
  items: QuizItem[];
  onComplete: (score: number, total: number) => void;
}

export function QuizChallenge({ items, onComplete }: QuizChallengeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');

  const currentItem = items[currentIndex];

  if (!items.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-text-muted text-sm">لا توجد أسئلة في هذا التحدي.</div>
    );
  }

  if (!currentItem?.options?.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-text-muted text-sm">صيغة الأسئلة غير صالحة.</div>
    );
  }

  const handleAnswer = (idx: number) => {
    if (feedback !== 'none') return;
    setSelectedOption(idx);

    const correctIdx = Math.min(
      Math.max(0, Number(currentItem.correct) || 0),
      currentItem.options.length - 1
    );
    const isCorrect = idx === correctIdx;
    if (isCorrect) {
      setFeedback('correct');
      setScore((prev) => prev + 1);
    } else {
      setFeedback('wrong');
    }

    const earned = isCorrect ? 1 : 0;
    const qIndex = currentIndex;
    const baseScore = score;

    window.setTimeout(() => {
      if (qIndex < items.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setFeedback('none');
      } else {
        onComplete(baseScore + earned, items.length);
      }
    }, 1100);
  };

  const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full h-full justify-center">
      <div className="flex items-center justify-between mb-2">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500">
               <HelpCircle size={18} />
            </div>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
               السؤال {currentIndex + 1} من {items.length}
            </span>
         </div>
         <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <Zap size={14} className="text-gold" />
            <span className="text-xs font-black text-white">{score} نقطة</span>
         </div>
      </div>

      <div className="space-y-6">
         {/* Question Text */}
         <div className="card-base p-8 bg-gradient-to-br from-white/5 to-transparent border-white/10 relative overflow-hidden group">
            <h3 className="text-xl sm:text-2xl font-black text-white leading-relaxed text-center relative z-10">
              {currentItem.text}
            </h3>
            <div className="absolute -bottom-4 -left-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
               <Sparkles size={100} />
            </div>
         </div>

         {/* Options */}
         <div className="grid grid-cols-1 gap-3">
            {currentItem.options.map((opt, i) => {
               const isSelected = selectedOption === i;
               const correctIdx = Math.min(
                 Math.max(0, Number(currentItem.correct) || 0),
                 currentItem.options.length - 1
               );
               const isCorrect = correctIdx === i;
               const showAsCorrect = feedback !== 'none' && isCorrect;
               const showAsWrong = feedback === 'wrong' && isSelected;

               return (
                 <button
                   key={i}
                   onClick={() => handleAnswer(i)}
                   disabled={feedback !== 'none'}
                   className={`group relative w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-right shadow-sm ${
                     showAsCorrect ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/10' :
                     showAsWrong ? 'bg-red-500/10 border-red-500 animate-shake' :
                     isSelected ? 'bg-gold/10 border-gold' :
                     'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/[0.07]'
                   }`}
                 >
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${
                     showAsCorrect ? 'bg-green-500 text-white' :
                     showAsWrong ? 'bg-red-500 text-white' :
                     isSelected ? 'bg-gold text-dark' :
                     'bg-white/5 text-text-muted group-hover:text-white'
                   }`}>
                     {ARABIC_LETTERS[i] ?? String(i + 1)}
                   </div>
                   <span className={`text-sm sm:text-base font-bold flex-1 ${showAsCorrect ? 'text-green-400' : showAsWrong ? 'text-red-400' : 'text-white'}`}>
                     {opt}
                   </span>
                   
                   {showAsCorrect && <CheckCircle2 size={24} className="text-green-500" />}
                   {showAsWrong && <XCircle size={24} className="text-red-500" />}
                 </button>
               );
            })}
         </div>
      </div>

      {feedback === 'wrong' && currentItem.explanation && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 animate-slide-up">
           <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1">
              <Sparkles size={14} /> شرح الإجابة الصحيحة:
           </div>
           <p className="text-xs text-blue-200/70">{currentItem.explanation}</p>
        </div>
      )}

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
