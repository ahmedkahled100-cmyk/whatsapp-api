'use client';
// src/components/games/SentenceBuilder.tsx
// لعبة ترتيب الكلمات لتكوين جمل صحيحة

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertCircle, RefreshCw, 
  ArrowLeft, MousePointer2, Sparkles 
} from 'lucide-react';

interface SentenceItem {
  correct: string;
  scrambled: string[];
}

interface SentenceBuilderProps {
  items: SentenceItem[];
  onComplete: (score: number, total: number) => void;
}

export function SentenceBuilder({ items, onComplete }: SentenceBuilderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [builtWords, setBuiltWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');

  const currentItem = items[currentIndex];

  useEffect(() => {
    if (currentItem) {
      setAvailableWords([...currentItem.scrambled].sort(() => Math.random() - 0.5));
      setBuiltWords([]);
      setFeedback('none');
    }
  }, [currentIndex]);

  const addWord = (word: string, index: number) => {
    if (feedback !== 'none') return;
    setBuiltWords(prev => [...prev, word]);
    setAvailableWords(prev => prev.filter((_, i) => i !== index));
  };

  const removeWord = (word: string, index: number) => {
    if (feedback !== 'none') return;
    setAvailableWords(prev => [...prev, word]);
    setBuiltWords(prev => prev.filter((_, i) => i !== index));
  };

  const checkSentence = () => {
    const isCorrect = builtWords.join(' ') === currentItem.correct;
    if (isCorrect) {
      setFeedback('correct');
      setScore(prev => prev + 1);
      setTimeout(handleNext, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback('none'), 1000);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete(score + 1, items.length);
    }
  };

  const resetSentence = () => {
    setAvailableWords([...currentItem.scrambled].sort(() => Math.random() - 0.5));
    setBuiltWords([]);
    setFeedback('none');
  };

  return (
    <div className="flex-1 flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full h-full justify-center">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black text-white flex items-center justify-center gap-2">
           <Sparkles className="text-gold" size={24} /> ترتيب الجملة
        </h3>
        <p className="text-sm text-text-muted">اضغط على الكلمات بالترتيب الصحيح لتكوين الجملة</p>
      </div>

      {/* Progress */}
      <div className="flex justify-center gap-1">
        {items.map((_, i) => (
          <div 
            key={i} 
            className={`h-1 flex-1 max-w-[40px] rounded-full transition-all ${i === currentIndex ? 'bg-gold' : i < currentIndex ? 'bg-green-500' : 'bg-white/10'}`} 
          />
        ))}
      </div>

      {/* Built Sentence Area */}
      <div className={`min-h-[120px] p-6 rounded-3xl border-2 border-dashed transition-all flex flex-wrap gap-2 items-center justify-center content-center ${
        feedback === 'correct' ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/10' :
        feedback === 'wrong' ? 'bg-red-500/10 border-red-500 animate-shake' :
        'bg-white/5 border-white/10'
      }`}>
        {builtWords.length === 0 ? (
          <span className="text-white/20 text-sm font-medium italic">ستظهر الكلمات هنا...</span>
        ) : (
          builtWords.map((word, i) => (
            <button
              key={i}
              onClick={() => removeWord(word, i)}
              className="px-4 py-2 bg-gold/20 border border-gold/30 rounded-xl text-gold font-bold text-lg hover:bg-gold/30 transition-all flex items-center gap-2 group"
            >
              {word}
            </button>
          ))
        )}
      </div>

      {/* Available Words Area */}
      <div className="flex flex-wrap gap-3 justify-center">
        {availableWords.map((word, i) => (
          <button
            key={i}
            onClick={() => addWord(word, i)}
            className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-medium text-lg hover:border-gold/50 hover:bg-white/10 transition-all active:scale-95 shadow-sm"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-4">
         <button 
           onClick={resetSentence}
           className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
           title="إعادة الترتيب"
         >
           <RefreshCw size={24} />
         </button>
         <button 
           onClick={checkSentence}
           disabled={builtWords.length !== currentItem.scrambled.length || feedback !== 'none'}
           className="flex-1 h-16 rounded-2xl bg-gold text-dark font-black text-xl shadow-lg shadow-gold/20 disabled:opacity-30 disabled:shadow-none transition-all flex items-center justify-center gap-2"
         >
           تحقق من الجملة <CheckCircle2 size={24} />
         </button>
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
