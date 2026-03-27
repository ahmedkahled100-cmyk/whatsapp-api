'use client';
// src/components/games/Flashcards.tsx
// البطاقات التعليمية التفاعلية

import { useState } from 'react';
import { FlashcardItem } from '@/types';
import { 
  ChevronLeft, ChevronRight, Rotate3d, 
  CheckCircle2, HelpCircle 
} from 'lucide-react';

interface FlashcardsProps {
  items: FlashcardItem[];
  onComplete: (score: number, total: number) => void;
}

export function Flashcards({ items, onComplete }: FlashcardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set());

  const currentItem = items[currentIndex];

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      onComplete(masteredCount, items.length);
    }
  };

  const markAsMastered = () => {
    if (!viewedIndices.has(currentIndex)) {
      setMasteredCount(prev => prev + 1);
      setViewedIndices(prev => new Set(prev).add(currentIndex));
    }
    handleNext();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 py-10 px-4">
      {/* Progress Bar */}
      <div className="w-full max-w-md bg-white/5 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-gold h-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
        />
      </div>

      <div className="text-center">
        <span className="text-gold font-bold text-sm tracking-widest uppercase">
          البطاقة {currentIndex + 1} من {items.length}
        </span>
      </div>

      {/* Card Container */}
      <div 
        className="relative w-full max-w-md aspect-[3/4] sm:aspect-video cursor-pointer perspective-1000"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front Side */}
          <div className="absolute inset-0 backface-hidden card-base p-8 flex flex-col items-center justify-center text-center gap-6 border-gold/20 bg-gradient-to-br from-white/5 to-transparent">
             <HelpCircle size={40} className="text-gold/20" />
             <h3 className="text-2xl sm:text-3xl font-black text-white leading-relaxed">
               {currentItem.front}
             </h3>
             <div className="mt-8 flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-tighter animate-pulse">
                <Rotate3d size={14} /> اضغط للقلب والتحقق
             </div>
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 card-base p-8 flex flex-col items-center justify-center text-center gap-6 border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent">
             <CheckCircle2 size={40} className="text-blue-400/20" />
             <p className="text-lg sm:text-xl font-medium text-white leading-relaxed">
               {currentItem.back}
             </p>
             <div className="mt-8 flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-tighter">
                <Rotate3d size={14} /> اضغط للعودة للسؤال
             </div>
          </div>

        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 w-full max-w-md">
         <button 
           onClick={handleNext}
           className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
         >
           تخطي <ChevronLeft size={20} />
         </button>
         <button 
           onClick={markAsMastered}
           className="flex-[2] h-14 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 font-bold hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/5"
         >
           أتقنتها! <CheckCircle2 size={20} />
         </button>
      </div>

      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
