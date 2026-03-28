'use client';
// src/app/teacher/essays/page.tsx

import { useState } from 'react';
import { useTeacherStore } from '@/lib/store';
import { formatDateAr } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { Attempt, EssayAnswer } from '@/types';
import { useFilePreview, FilePreviewModal } from '@/components/FilePreviewModal';
import { Eye, FileText, ClipboardList, Check, X } from 'lucide-react';
import { saveAttempt, dispatchNotification } from '@/lib/db';

export default function EssaysPage() {
  const { exams, attempts } = useTeacherStore();
  const [activeAttempt, setActiveAttempt] = useState<string | null>(null);
  const { openPreview, PreviewModal } = useFilePreview();

  const pendingAttempts = attempts.filter(a => a.essayAnswers?.some(ea => ea.pending));

  const handleGrade = async (attempt: Attempt, answerIndex: number, score: number, isCorrect: boolean) => {
    // We clone the attempt to safely modify it
    const updatedAttempt = { ...attempt };
    const essays = updatedAttempt.essayAnswers || [];
    
    // Update the specific answer
    essays[answerIndex].score = score;
    essays[answerIndex].pending = false;
    updatedAttempt.essayAnswers = essays;

    // Check if there are any pending essays left
    const stillPending = essays.some(ea => ea.pending);

    if (!stillPending) {
      // Calculate final score as a percentage of total possible points
      const mcqPoints = (attempt.mcqScore * attempt.mcqTotal) / 100;
      const currentEssayPoints = essays.reduce((acc, ea) => acc + (ea.score || 0), 0);
      const totalEssayMax = essays.reduce((acc, ea) => acc + (ea.maxScore || 10), 0);
      
      const totalPoints = attempt.mcqTotal + totalEssayMax;
      
      if (totalPoints > 0) {
        updatedAttempt.finalScore = Math.round(((mcqPoints + currentEssayPoints) / totalPoints) * 100);
      } else {
        updatedAttempt.finalScore = 0;
      }
      
      const examObj = exams.find(e => e.id === attempt.examId);
      if (examObj) {
        updatedAttempt.passed = updatedAttempt.finalScore >= examObj.passScore;
      }
      updatedAttempt.completed = true;

      // Notification logic
      await dispatchNotification({
        teacherId: attempt.teacherId,
        msg: `تم تصحيح اختبارك: ${examObj?.title || 'اختبار'}. نتيجتك النهائية: ${updatedAttempt.finalScore}%`,
        targetUsers: [attempt.studentId],
        actionPath: '/student',
        channels: { inApp: true, whatsapp: false }
      });
    }

    try {
      await saveAttempt(updatedAttempt);
      // showToast('تم رصد الدرجة بنجاح');
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء رصد الدرجة');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList size={28} className="text-gold" />
        <h1 className="text-2xl font-cairo font-black gold-text">الأسئلة المقالية</h1>
      </div>

      {pendingAttempts.length === 0 ? (
        <div className="card-base p-12 text-center text-gray-400">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
          <p>لا توجد إجابات مقالية بانتظار التصحيح حالياً.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingAttempts.map(attempt => {
            const exam = exams.find(e => e.id === attempt.examId);
            const pendingAnswers = attempt.essayAnswers?.filter(ea => ea.pending) || [];
            
            return (
              <div key={attempt.id} className="card-base p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{exam?.title || 'اختبار غير معروف'}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      الطالب: <span className="text-gold">{attempt.studentName}</span> • 
                      التاريخ: {attempt.submittedAt ? formatDateAr(attempt.submittedAt) : '—'}
                    </p>
                  </div>
                  <div className="badge badge-purple">
                    {pendingAnswers.length} أسئلة
                  </div>
                </div>

                <div className="space-y-4">
                  {pendingAnswers.map((answer, index) => {
                    const question = exam?.questions.find(q => q.id === answer.questionId);
                    const qText = question?.text || answer.questionText || 'نص السؤال غير متوفر';
                    const actualIndex = attempt.essayAnswers?.findIndex(ea => ea.questionId === answer.questionId) ?? -1;
                    
                    if (actualIndex === -1) return null;

                    return (
                      <div key={answer.questionId} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="mb-2 font-medium">سؤال {index + 1}: {qText}</div>
                        <div className="p-3 rounded-lg mb-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                          <span className="text-sm opacity-60 block mb-1">إجابة الطالب:</span>
                          <p className="whitespace-pre-wrap mb-3">{answer.text}</p>
                          
                          {answer.fileUrls && answer.fileUrls.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                              {answer.fileUrls.map((url, i) => {
                                const isImg = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)/);
                                return (
                                  <div key={i} className="flex flex-col gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-2">
                                      {isImg ? (
                                        <img src={url} alt="Student upload" className="w-10 h-10 object-cover rounded" />
                                      ) : (
                                        <div className="w-10 h-10 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded">
                                          <FileText size={18} />
                                        </div>
                                      )}
                                      <div className="text-xs flex-1">
                                        <div className="gold-text">ملف مرفق {i + 1}</div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => openPreview(url, `إجابة الطالب - ملف ${i+1}`)} className="btn-gold text-[10px] py-1 px-3 flex-1 flex items-center justify-center gap-1 font-bold">
                                        <Eye size={10} /> معاينة الإجابة
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleGrade(attempt, actualIndex, answer.maxScore, true)} className="btn-outline text-sm py-1.5 px-3 border-green-500/30 hover:bg-green-500/10 text-green-400">
                            <Check size={16} /> إجابة صحيحة ({answer.maxScore})
                          </button>
                          <button onClick={() => handleGrade(attempt, actualIndex, 0, false)} className="btn-outline text-sm py-1.5 px-3 border-red-500/30 hover:bg-red-500/10 text-red-400">
                            <X size={16} /> إجابة خاطئة (0)
                          </button>
                          <button onClick={() => {
                            const val = prompt(`أدخل الدرجة الجزئية من ${answer.maxScore}:`, '1');
                            if (val !== null && !isNaN(Number(val))) {
                              handleGrade(attempt, actualIndex, Number(val), Number(val) > 0);
                            }
                          }} className="btn-outline text-sm py-1.5 px-3">
                            درجة مخصصة
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {PreviewModal}
    </div>
  );
}
