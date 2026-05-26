'use client';

import { Trophy, Star } from 'lucide-react';
import type { Student } from '@/types';

interface StudentLeaderboardProps {
  leaderboardStudents: Student[];
  currentStudentId: string;
}

export function StudentLeaderboard({ leaderboardStudents, currentStudentId }: StudentLeaderboardProps) {
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="card-base p-6 bg-gradient-to-br from-gold/20 to-transparent border-gold/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Trophy size={100} />
        </div>
        <h2 className="text-2xl font-black gold-text mb-2 flex items-center gap-2 relative z-10">
          <Trophy size={24} /> لوحة الشرف
        </h2>
        <p className="text-sm text-text-muted relative z-10">الطلاب الأوائل على مستوى الأكاديمية</p>
      </div>
      
      <div className="space-y-3">
        {leaderboardStudents.length === 0 ? (
          <div className="card-base p-8 text-center text-text-muted">لا يوجد طلاب في لوحة الشرف حالياً</div>
        ) : (
          leaderboardStudents.map((s, index) => {
            const isMe = s.id === currentStudentId;
            return (
              <div 
                key={s.id} 
                className={`card-base p-4 flex items-center gap-4 ${index < 3 ? 'border-gold/30 bg-gold/5' : ''}`}
              >
                <div className={`w-10 h-10 flex items-center justify-center font-black rounded-xl ${
                  index === 0 ? 'bg-yellow-500 text-dark text-xl' : 
                  index === 1 ? 'bg-gray-300 text-dark text-lg' : 
                  index === 2 ? 'bg-orange-400 text-dark text-lg' : 
                  'bg-white/5 text-text-muted'
                }`}>
                  {index + 1}
                </div>
                
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                      {s.name[0]}
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className={`font-bold ${isMe ? 'text-gold' : ''}`}>
                    {s.name} {isMe && '(أنت)'}
                  </h3>
                  <div className="text-xs text-text-muted">المستوى {s.level || 1} • {s.grade || 'طالب'}</div>
                </div>
                
                <div className="text-left">
                  <div className="font-black text-gold flex items-center gap-1 justify-end">
                    {s.points || 0} <Star size={14} className="fill-gold" />
                  </div>
                  <div className="text-xs text-text-muted flex gap-1 mt-1 justify-end">
                    {/* Render badge emojis directly if they are strings */}
                    {s.badges?.slice(0, 3).map((b: any, bIdx) => {
                      if (typeof b === 'object' && b !== null) {
                        return <span key={b.id || bIdx} title={b.name}>{b.icon}</span>;
                      }
                      return <span key={bIdx} title={`وسام ${bIdx + 1}`}>{b}</span>;
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
