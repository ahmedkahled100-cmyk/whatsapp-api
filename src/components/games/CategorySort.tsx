'use client';
// src/components/games/CategorySort.tsx
// لعبة تصنيف المواد في المجموعات الصحيحة

import { useState, useEffect } from 'react';
import { 
  FolderDown, CheckCircle, XCircle, 
  ArrowRight, Layers, Sparkles 
} from 'lucide-react';

interface SortItem {
  item: string;
  category: string;
}

interface CategorySortProps {
  items: SortItem[];
  onComplete: (score: number, total: number) => void;
}

export function CategorySort({ items, onComplete }: CategorySortProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');

  const currentItem = items[currentIndex];

  useEffect(() => {
    // Extract unique categories
    const uniqueCats = Array.from(new Set(items.map(i => i.category)));
    setCategories(uniqueCats);
  }, [items]);

  const handleSort = (selectedCat: string) => {
    if (feedback !== 'none') return;

    if (selectedCat === currentItem.category) {
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
        onComplete(score + (selectedCat === currentItem.category ? 1 : 0), items.length);
      }
    }, 1000);
  };

  return (
    <div className="flex-1 flex flex-col gap-8 p-6 max-w-2xl mx-auto w-full h-full justify-center">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black text-white flex items-center justify-center gap-2">
           <Layers className="text-gold" size={24} /> صنّف بذكاء
        </h3>
        <p className="text-sm text-text-muted">ضع العنصر الظاهر في المجموعه الصحيحة له</p>
      </div>

      {/* Progress */}
      <div className="text-center text-[10px] font-black tracking-widest text-gold uppercase">
         العنصر {currentIndex + 1} من {items.length}
      </div>

      {/* Current Item Card */}
      <div className={`relative min-h-[160px] p-8 rounded-3xl border-2 transition-all flex items-center justify-center text-center shadow-2xl ${
        feedback === 'correct' ? 'bg-green-500/10 border-green-500 shadow-green-500/10' :
        feedback === 'wrong' ? 'bg-red-500/10 border-red-500 animate-shake' :
        'bg-white/5 border-gold/30 gold-shadow'
      }`}>
        <div className="space-y-4">
           {feedback === 'correct' && <CheckCircle size={40} className="text-green-500 mx-auto animate-bounce" />}
           {feedback === 'wrong' && <XCircle size={40} className="text-red-500 mx-auto" />}
           
           {feedback === 'none' && (
             <>
               <span className="text-3xl font-black text-white">{currentItem.item}</span>
               <div className="text-[10px] text-gold/40 flex items-center justify-center gap-1 uppercase font-bold">
                 <ArrowRight size={12} className="rotate-90" /> اختر المجموعة أدناه
               </div>
             </>
           )}
        </div>
      </div>

      {/* Category Buckets */}
      <div className="grid grid-cols-2 gap-4">
        {categories.map((cat, i) => (
          <button
            key={i}
            onClick={() => handleSort(cat)}
            disabled={feedback !== 'none'}
            className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-gold/50 hover:bg-gold/5 transition-all text-sm font-bold text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
               <FolderDown size={40} />
            </div>
            <span className="relative z-10 text-white group-hover:text-gold">{cat}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .gold-shadow { box-shadow: 0 10px 40px -10px rgba(245,197,24,0.15); }
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
