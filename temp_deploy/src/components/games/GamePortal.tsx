'use client';
// الحاوية الرئيسية للألعاب التعليمية للطالب

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EducationalGame, GameType } from '@/types';
import { saveGameResult } from '@/lib/db';
import { normalizeGameContent } from '@/lib/game-content';
import { X, Trophy, Star, ArrowRight, RotateCcw, Gamepad2, Sparkles, Loader2, PartyPopper, Target } from 'lucide-react';
import { showToast } from '@/lib/toast';

import { Flashcards } from './Flashcards';
import { MatchMaster } from './MatchMaster';
import { SentenceBuilder } from './SentenceBuilder';
import { CategorySort } from './CategorySort';
import { SpeedRun } from './SpeedRun';
import { QuizChallenge } from './QuizChallenge';

const TYPE_LABELS: Record<GameType, string> = {
  flashcards: 'بطاقات تعليمية',
  match: 'مطابقة مصطلحات',
  sentence: 'ترتيب الجمل',
  sort: 'تصنيف',
  tf_run: 'سرعة صح وخطأ',
  quiz: 'تحدي اختيار من متعدد',
};

interface GamePortalProps {
  game: EducationalGame;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

function GameConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 3.7) % 100}%`,
        delay: `${(i % 7) * 0.08}s`,
        duration: `${2.2 + (i % 5) * 0.15}s`,
        hue: (i * 47) % 360,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="game-confetti-piece absolute top-0 h-3 w-2 rounded-sm opacity-90"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: `hsl(${p.hue} 85% 60%)`,
            transform: `rotate(${p.id * 13}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function GamePortal({ game, studentId, studentName, onClose }: GamePortalProps) {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'ended'>('intro');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const normalizedItems = useMemo(
    () => normalizeGameContent(game.type, game.content),
    [game.type, game.content]
  );

  const itemCount = normalizedItems.length;
  const difficultyLabel = itemCount >= 12 ? 'مكثّف' : itemCount >= 7 ? 'متوسط' : 'خفيف';

  const handleGameEnd = useCallback(
    async (finalScore: number, finalTotal: number) => {
      setScore(finalScore);
      setTotal(Math.max(0, finalTotal));
      setGameState('ended');
      if (!finalTotal || finalTotal <= 0) {
        setSaveError(false);
        showToast('لا يوجد محتوى كافٍ لتسجيل نتيجة لهذه الجولة.');
        return;
      }
      setSaving(true);
      setSaveError(false);
      try {
        await saveGameResult({
          gameId: game.id,
          studentId,
          studentName,
          score: finalScore,
          total: finalTotal,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to save game result:', err);
        setSaveError(true);
        showToast('تعذر حفظ النتيجة. يمكنك المحاولة من جديد.');
      } finally {
        setSaving(false);
      }
    },
    [game.id, studentId, studentName]
  );

  const startGame = () => {
    if (itemCount === 0) {
      showToast('محتوى اللعبة غير كافٍ. أبلغ المعلّم لتحديثها.');
      return;
    }
    setGameState('playing');
  };

  const renderGame = () => {
    const items = normalizedItems;
    switch (game.type) {
      case 'flashcards':
        return <Flashcards items={items as any} onComplete={handleGameEnd} />;
      case 'match':
        return <MatchMaster items={items as any} onComplete={handleGameEnd} />;
      case 'sentence':
        return <SentenceBuilder items={items as any} onComplete={handleGameEnd} />;
      case 'sort':
        return <CategorySort items={items as any} onComplete={handleGameEnd} />;
      case 'tf_run':
        return <SpeedRun items={items as any} onComplete={handleGameEnd} />;
      case 'quiz':
        return <QuizChallenge items={items as any} onComplete={handleGameEnd} />;
      default:
        return <div className="p-10 text-center">نوع اللعبة غير مدعوم حالياً</div>;
    }
  };

  const starFilled = total > 0 ? Math.min(5, Math.max(0, Math.round((score / total) * 5))) : 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f172a] text-white flex flex-col overflow-hidden animate-fade-in" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(245,197,24,0.12),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(79,70,229,0.1),transparent_45%)] pointer-events-none z-0" />

      <div className="p-4 flex items-center justify-between border-b border-white/5 bg-black/25 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-gold border border-gold/20 shadow-lg shadow-gold/10 shrink-0"
          >
            <Gamepad2 size={24} />
          </motion.div>
          <div className="min-w-0">
            <h2 className="font-black text-white text-sm sm:text-base truncate">{game.title}</h2>
            <p className="text-[10px] text-text-muted flex items-center gap-1">
              <Target size={10} className="text-gold shrink-0" />
              {TYPE_LABELS[game.type] ?? 'مهمة تعليمية'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all shrink-0"
          aria-label="إغلاق"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 relative overflow-y-auto flex flex-col items-center justify-center p-4 z-[1]">
        <AnimatePresence mode="wait">
          {gameState === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="max-w-md w-full text-center space-y-8"
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  className="w-32 h-32 bg-gold/10 rounded-full flex items-center justify-center mx-auto border-2 border-gold/30 shadow-[0_0_40px_rgba(245,197,24,0.15)]"
                >
                  <Sparkles size={56} className="text-gold" />
                </motion.div>
                <div className="absolute -top-1 -right-1 sm:-right-2 bg-gradient-to-l from-violet-600 to-indigo-600 text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg">
                  جاهز للتحدي
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo">{game.title}</h1>
                <p className="text-text-muted text-sm px-4 leading-relaxed">
                  تمرّن بأسلوب لعب سلس، مع تغذية راجعة فورية وتسجيل للنتيجة لدى المعلّم.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="card-base p-4 border-white/5 bg-white/[0.03] ring-1 ring-white/5">
                  <div className="text-gold font-black text-2xl tabular-nums">{itemCount || '—'}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">عنصر / سؤال</div>
                </div>
                <div className="card-base p-4 border-white/5 bg-white/[0.03] ring-1 ring-white/5">
                  <div className="text-violet-300 font-black text-lg">{difficultyLabel}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">الوتيرة</div>
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={startGame}
                disabled={itemCount === 0}
                className="btn-gold w-full h-14 sm:h-16 text-lg rounded-2xl shadow-xl shadow-gold/25 flex items-center justify-center gap-3 disabled:opacity-40 disabled:grayscale"
              >
                ابدأ الآن <ArrowRight size={22} />
              </motion.button>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full max-w-4xl mx-auto flex flex-col min-h-[50vh]"
            >
              {renderGame()}
            </motion.div>
          )}

          {gameState === 'ended' && (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220 }}
              className="max-w-md w-full text-center space-y-8 relative"
            >
              <GameConfetti />

              <div className="relative z-[1]">
                <motion.div
                  initial={{ rotate: -6, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                  className="w-36 h-36 sm:w-40 sm:h-40 bg-gradient-to-b from-gold/25 to-transparent rounded-full flex items-center justify-center mx-auto border-4 border-gold/40 shadow-2xl shadow-gold/20"
                >
                  <Trophy size={72} className="text-gold" />
                </motion.div>
                <PartyPopper size={100} className="text-white/10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative z-[1] space-y-2">
                <h1 className="text-2xl sm:text-4xl font-black text-white font-cairo">
                  {pct >= 70 ? 'يا بطل! أداء رائع' : pct >= 40 ? 'أحسنت! واصل التقدّم' : 'لا بأس، جرّب مرة أخرى'}
                </h1>
                <p className="text-text-muted text-sm">تم تسجيل نتيجتك — راقب تقدّمك مع معلّمك دائماً.</p>
              </div>

              <div className="card-base p-8 border-gold/20 bg-gold/5 relative overflow-hidden z-[1] ring-1 ring-gold/10">
                <div className="text-text-muted text-xs mb-2 font-bold uppercase tracking-widest">النتيجة</div>
                <div className="text-5xl sm:text-6xl font-black text-white flex items-baseline justify-center gap-2 tabular-nums">
                  <span className="gold-text">{score}</span>
                  <span className="text-xl text-text-muted">/ {total || 1}</span>
                </div>
                <p className="text-[11px] text-text-muted mt-2">{pct}% إتقان تقريبي</p>
                <div className="flex justify-center gap-1 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={24}
                      fill={i < starFilled ? 'var(--gold)' : 'transparent'}
                      className={i < starFilled ? 'text-gold drop-shadow-[0_0_6px_rgba(245,197,24,0.5)]' : 'text-white/10'}
                    />
                  ))}
                </div>

                <div className="mt-6">
                  {saving ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-300">
                      <Loader2 size={14} className="animate-spin" /> جاري حفظ النتيجة...
                    </div>
                  ) : saveError ? (
                    <div className="text-xs text-amber-400 font-bold">⚠ لم يُحمّل الحفظ. يمكنك إعادة فتح اللعبة لاحقاً.</div>
                  ) : (
                    <div className="text-xs text-emerald-400 flex items-center justify-center gap-1 font-bold">✓ تم حفظ النتيجة</div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 relative z-[1]">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setGameState('intro');
                    setSaveError(false);
                  }}
                  className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <RotateCcw size={20} /> مرة أخرى
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 h-14 rounded-2xl bg-gold/10 border border-gold/30 text-gold font-bold flex items-center justify-center gap-2 hover:bg-gold/20 transition-all"
                >
                  الخروج <ArrowRight size={20} />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-gold/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
    </div>
  );
}
