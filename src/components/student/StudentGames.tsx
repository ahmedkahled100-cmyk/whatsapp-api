'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Gamepad2, Layers, Trophy, Languages, Brain, Zap, GraduationCap, ChevronRight } from 'lucide-react';
import type { EducationalGame, Student } from '@/types';

const GamePortal = dynamic(() => import('@/components/games/GamePortal').then((m) => m.GamePortal), {
  ssr: false,
  loading: () => null,
});

interface StudentGamesProps {
  games: EducationalGame[];
  student: Student;
}

export function StudentGames({ games, student }: StudentGamesProps) {
  const [selectedGame, setSelectedGame] = useState<EducationalGame | null>(null);

  return (
    <div className="space-y-4 animate-slide-up pb-20">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white flex items-center gap-2">
          <Gamepad2 size={24} className="text-gold" /> الألعاب التعليمية
        </h3>
        <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">
          مهمات ذكية
        </span>
      </div>

      {games.length === 0 ? (
        <div className="card-base p-16 text-center space-y-4 border-dashed border-white/10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20">
            <Gamepad2 size={32} />
          </div>
          <p className="text-xs text-text-muted">لا توجد ألعاب تعليمية مفعلة لك حالياً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="card-base p-4 text-right flex items-center gap-4 group active:scale-95 transition-all bg-gradient-to-l from-white/5 to-transparent border-white/10 hover:border-gold/30 relative z-10 cursor-pointer w-full"
            >
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-dark transition-all shrink-0">
                {game.type === 'flashcards' ? (
                  <Layers size={28} />
                ) : game.type === 'match' ? (
                  <Trophy size={28} />
                ) : game.type === 'sentence' ? (
                  <Languages size={28} />
                ) : game.type === 'sort' ? (
                  <Brain size={28} />
                ) : game.type === 'tf_run' ? (
                  <Zap size={28} />
                ) : (
                  <GraduationCap size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white group-hover:gold-text transition-all truncate">
                  {game.title}
                </h4>
                <p className="text-[10px] text-text-muted mt-1 uppercase tracking-tighter">
                  {game.type === 'flashcards'
                    ? 'بطاقات تعليمية'
                    : game.type === 'match'
                    ? 'مطابقة المصطلحات'
                    : game.type === 'sentence'
                    ? 'ترتيب الجمل'
                    : game.type === 'sort'
                    ? 'تصنيف المواد'
                    : game.type === 'tf_run'
                    ? 'سرعة الرد'
                    : 'تحدي الأسئلة'}
                </p>
              </div>
              <ChevronRight size={20} className="text-white/20 group-hover:text-gold shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Render the GamePortal modal overlay if a game is selected */}
      {selectedGame && student && (
        <GamePortal
          game={selectedGame}
          studentId={student.id}
          studentName={student.name}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
