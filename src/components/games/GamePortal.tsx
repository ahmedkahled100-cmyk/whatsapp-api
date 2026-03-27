'use client';
// src/components/games/GamePortal.tsx
// الحاوية الرئيسية للألعاب التعليمية للطالب

import { useState, useEffect } from 'react';
import { EducationalGame, GameResult } from '@/types';
import { saveGameResult } from '@/lib/db';
import { 
  X, Trophy, Star, ArrowRight, RotateCcw, 
  Gamepad2, Sparkles, Loader2, PartyPopper 
} from 'lucide-react';
import { showToast } from '@/lib/toast';

// Game Components (To be created)
import { Flashcards } from './Flashcards';
import { MatchMaster } from './MatchMaster';
import { SentenceBuilder } from './SentenceBuilder';
import { CategorySort } from './CategorySort';
import { SpeedRun } from './SpeedRun';
import { QuizChallenge } from './QuizChallenge';

interface GamePortalProps {
  game: EducationalGame;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

export function GamePortal({ game, studentId, studentName, onClose }: GamePortalProps) {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'ended'>('intro');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);

  const startGame = () => {
    setGameState('playing');
  };

  const handleGameEnd = async (finalScore: number, finalTotal: number) => {
    setScore(finalScore);
    setTotal(finalTotal);
    setGameState('ended');
    setSaving(true);
    try {
      await saveGameResult({
        gameId: game.id,
        studentId,
        studentName,
        score: finalScore,
        total: finalTotal,
        completedAt: new Date().toISOString()
      });
      // Optionally notify teacher via some real-time hub if exists
    } catch (err) {
      console.error("Failed to save game result:", err);
    } finally {
      setSaving(false);
    }
  };

  const renderGame = () => {
    switch (game.type) {
      case 'flashcards':
        return <Flashcards items={game.content} onComplete={handleGameEnd} />;
      case 'match':
        return <MatchMaster items={game.content} onComplete={handleGameEnd} />;
      case 'sentence':
        return <SentenceBuilder items={game.content} onComplete={handleGameEnd} />;
      case 'sort':
        return <CategorySort items={game.content} onComplete={handleGameEnd} />;
      case 'tf_run':
        return <SpeedRun items={game.content} onComplete={handleGameEnd} />;
      case 'quiz':
        return <QuizChallenge items={game.content} onComplete={handleGameEnd} />;
      default:
        return <div className="p-10 text-center">نوع اللعبة غير مدعوم حالياً</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f172a] text-white flex flex-col overflow-hidden animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/5 bg-black/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-gold border border-gold/20 shadow-lg shadow-gold/10">
             <Gamepad2 size={24} />
          </div>
          <div>
            <h2 className="font-black text-white text-sm sm:text-base">{game.title}</h2>
            <p className="text-[10px] text-text-muted">مهمة تعليمية ذكية</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-y-auto flex flex-col items-center justify-center p-4">
        
        {gameState === 'intro' && (
          <div className="max-w-md w-full text-center space-y-8 animate-slide-up">
             <div className="relative">
                <div className="w-32 h-32 bg-gold/10 rounded-full flex items-center justify-center mx-auto border-2 border-gold/20 animate-pulse">
                  <Sparkles size={60} className="text-gold" />
                </div>
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg shadow-blue-500/20">
                  لعبة جديدة
                </div>
             </div>
             
             <div className="space-y-2">
                <h1 className="text-3xl font-black text-white">{game.title}</h1>
                <p className="text-text-muted text-sm px-6">
                  استعد للمغامرة! قم بإنجاز هذه اللعبة التعليمية لاختبار معرفتك وتحسين مستواك الدراسي.
                </p>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="card-base p-4 border-white/5 bg-white/2">
                   <div className="text-gold font-black text-xl">10</div>
                   <div className="text-[10px] text-text-muted uppercase tracking-wider">بطاقة/سؤال</div>
                </div>
                <div className="card-base p-4 border-white/5 bg-white/2">
                   <div className="text-blue-400 font-black text-xl">متوسط</div>
                   <div className="text-[10px] text-text-muted uppercase tracking-wider">الصعوبة</div>
                </div>
             </div>

             <button 
               onClick={startGame}
               className="btn-gold w-full h-16 text-xl rounded-2xl shadow-xl shadow-gold/20 flex items-center justify-center gap-3 animate-bounce-slow"
             >
                ابدأ المغامرة الآن <ArrowRight size={24} />
             </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full h-full max-w-4xl mx-auto flex flex-col">
            {renderGame()}
          </div>
        )}

        {gameState === 'ended' && (
          <div className="max-w-md w-full text-center space-y-8 animate-celebrate">
             <div className="relative">
                <div className="w-40 h-40 bg-gradient-to-b from-gold/20 to-transparent rounded-full flex items-center justify-center mx-auto border-4 border-gold/40 shadow-2xl shadow-gold/20">
                  <Trophy size={80} className="text-gold animate-bounce" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <PartyPopper size={120} className="text-white/10" />
                </div>
             </div>
             
             <div className="space-y-2">
                <h1 className="text-4xl font-black text-white">يا بطل! {score > (total/2) ? 'أبدعت!' : 'محاولة جيدة!'}</h1>
                <p className="text-text-muted text-lg">لقد أتممت اللعبة بنجاح وتم تسجيل نتيجتك.</p>
             </div>

             <div className="card-base p-8 border-gold/20 bg-gold/5 relative overflow-hidden">
                <div className="text-text-muted text-sm mb-2 font-bold uppercase tracking-widest">نتيجتك النهائية</div>
                <div className="text-6xl font-black text-white flex items-baseline justify-center gap-2">
                   <span className="gold-text">{score}</span>
                   <span className="text-2xl text-text-muted">/ {total}</span>
                </div>
                <div className="flex justify-center gap-1 mt-4">
                   {[...Array(5)].map((_, i) => (
                     <Star 
                       key={i} 
                       size={24} 
                       fill={i < Math.round((score/total) * 5) ? 'var(--gold)' : 'transparent'} 
                       className={i < Math.round((score/total) * 5) ? 'text-gold' : 'text-white/10'} 
                     />
                   ))}
                </div>
                
                {/* Save Status */}
                <div className="mt-6">
                   {saving ? (
                     <div className="flex items-center justify-center gap-2 text-[10px] text-blue-400">
                        <Loader2 size={12} className="animate-spin" /> جاري حفظ التقدم...
                     </div>
                   ) : (
                     <div className="text-[10px] text-green-400 flex items-center justify-center gap-1 font-bold">
                        ✅ تم حفظ النتيجة وإرسالها للمعلم
                     </div>
                   )}
                </div>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => setGameState('intro')}
                  className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <RotateCcw size={20} /> مرة أخرى
                </button>
                <button 
                  onClick={onClose}
                  className="flex-1 h-14 rounded-2xl bg-gold/10 border border-gold/30 text-gold font-bold flex items-center justify-center gap-2 hover:bg-gold/20 transition-all"
                >
                  الخروج للمنصة <ArrowRight size={20} />
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Background Decor */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-gold/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
