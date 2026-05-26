'use client';
// src/app/teacher/results/page.tsx

import { useState, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { formatDateAr, gradeColor, scoreLabel, getApiBase } from '@/lib/utils';
import { Search, Download, Trash2, Filter, MessageCircle, Loader2, Share2, X, Award, CheckCircle2, TrendingUp, Clock, Calendar, XCircle, ImageIcon } from 'lucide-react';
import { deleteAttempt } from '@/lib/db';
import { showToast } from '@/lib/toast';
import html2canvas from 'html2canvas';

export default function ResultsPage() {
  const { attempts, exams, students, settings, setAttempts } = useTeacherStore();
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [generatingWA, setGeneratingWA] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [resultImagePreview, setResultImagePreview] = useState<{attempt: any, imageUrl: string} | null>(null);

  const completed = useMemo(() =>
    attempts.filter(a => a.completed).sort((a, b) =>
      new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
    ), [attempts]
  );

  const filtered = useMemo(() =>
    completed.filter(a => {
      const matchSearch = a.studentName.toLowerCase().includes(search.toLowerCase()) || a.studentCode.includes(search.toUpperCase());
      const matchExam = !examFilter || a.examId === examFilter;
      const matchStatus = statusFilter === 'all' || (statusFilter === 'pass' ? a.passed : !a.passed);
      return matchSearch && matchExam && matchStatus;
    }), [completed, search, examFilter, statusFilter]
  );

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const points = filtered.map(a => {
      const mcqPoints = (a.mcqScore * a.mcqTotal) / 100;
      const essayPoints = a.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
      return mcqPoints + essayPoints;
    });
    const totals = filtered.map(a => {
      const essayTotal = a.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0;
      return a.mcqTotal + essayTotal;
    });

    const totalPoints = points.reduce((s, v) => s + v, 0);
    const totalMax = totals.reduce((s, v) => s + v, 0);
    const avgPercentage = Math.round((totalPoints / totalMax) * 100) || 0;

    return {
      avg: avgPercentage,
      passRate: Math.round((filtered.filter(a => a.passed).length / filtered.length) * 100),
      rawAvg: `${Math.round(totalPoints / filtered.length * 10) / 10} / ${Math.round(totalMax / filtered.length * 10) / 10}`
    };
  }, [filtered]);

  const exportCSV = () => {
    const headers = ['الاسم', 'الكود', 'الاختبار', 'النتيجة', 'الحالة', 'التاريخ'];
    const rows = filtered.map(a => {
      const mcqPoints = (a.mcqScore * a.mcqTotal) / 100;
      const essayPoints = a.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
      const totalPoints = a.mcqTotal + (a.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
      const rawScore = Math.round((mcqPoints + essayPoints)*10)/10;
      return [
        a.studentName, a.studentCode, a.examTitle,
        `${rawScore} / ${totalPoints} (${a.finalScore ?? a.mcqScore ?? 0}%)`,
        a.passed ? 'ناجح' : 'راسب',
        a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('ar-EG') : '',
      ];
    });
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'نتائج_الاختبارات.csv'; a.click();
  };

  const exportPDF = async () => {
    setExportingPdf(true);
    try {
      const element = document.getElementById('report-container');
      if (!element) return;
      
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin:       [10, 5, 10, 5] as [number, number, number, number],
        filename:     `نتائج_${examFilter ? exams.find(e => e.id === examFilter)?.title : 'مجمعة'}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تصدير PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleWhatsApp = async (attempt: any) => {
    const student = students.find(s => s.id === attempt.studentId);
    if (!student?.parentPhone) {
      showToast('لا يوجد رقم هاتف لولي أمر هذا الطالب');
      return;
    }

    setGeneratingWA(attempt.id);
    try {
      // Generate result image
      const imageUrl = await generateStudentResultImage(attempt);
      setResultImagePreview({ attempt, imageUrl });
    } catch (error) {
      console.error(error);
      showToast('حدث خطأ أثناء توليد صورة النتيجة');
    } finally {
      setGeneratingWA(null);
    }
  };

  const generateStudentResultImage = async (attempt: any): Promise<string> => {
    const exam = exams.find(e => e.id === attempt.examId);
    const student = students.find(s => s.id === attempt.studentId);
    
    let maxScore = 100;
    if (exam) {
      const mcqTotal = exam.questions?.length || 0;
      const essayTotal = exam.essayQuestions?.reduce((acc: number, q: any) => acc + (q.maxScore || 1), 0) || 0;
      maxScore = mcqTotal + essayTotal;
    }
    
    const mcqPoints = attempt.mcqScore * attempt.mcqTotal / 100;
    const essayPoints = attempt.essayAnswers?.reduce((sum: number, ea: any) => sum + (ea.score || 0), 0) || 0;
    const rawScore = Math.round((mcqPoints + essayPoints) * 10) / 10;
    const percentage = attempt.finalScore ?? attempt.mcqScore ?? 0;

    // Create a container for the result card
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: 600px;
      background: linear-gradient(135deg, #1A1A25 0%, #2d2d3a 100%);
      border-radius: 20px;
      padding: 30px;
      color: white;
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 2px solid #d4af37;
    `;

    const logoHtml = settings?.logoUrl 
      ? `<img src="${settings.logoUrl}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 50%; border: 3px solid #d4af37;" />`
      : `<div style="width: 80px; height: 80px; background: linear-gradient(135deg, #d4af37, #b8860b); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; color: #1A1A25;">AN</div>`;

    const passedColor = attempt.passed ? '#10b981' : '#ef4444';
    const passedText = attempt.passed ? 'ناجح' : 'راسب';
    const passedBg = attempt.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 25px;">
        ${logoHtml}
        <h2 style="margin: 15px 0 5px 0; font-size: 24px; font-weight: 900; color: #d4af37;">${settings?.acadName || 'A-N Academy'}</h2>
        <p style="margin: 0; font-size: 14px; color: #9ca3af;">تقرير نتيجة الطالب</p>
      </div>
      
      <div style="background: rgba(255,255,255,0.05); border-radius: 15px; padding: 20px; margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="text-align: center; padding: 10px; background: rgba(212,175,55,0.1); border-radius: 10px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #9ca3af;">اسم الطالب</p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: white;">${student?.name || attempt.studentName}</p>
          </div>
          <div style="text-align: center; padding: 10px; background: rgba(212,175,55,0.1); border-radius: 10px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #9ca3af;">الاختبار</p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: white;">${exam?.title || attempt.examTitle}</p>
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af; font-weight: 600;">الدرجة</p>
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #d4af37;">${rawScore} / ${maxScore}</p>
        </div>
        <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af; font-weight: 600;">النسبة</p>
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #d4af37;">${percentage}%</p>
        </div>
        <div style="text-align: center; padding: 15px; background: ${passedBg}; border-radius: 12px; border: 2px solid ${passedColor};">
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af; font-weight: 600;">الحالة</p>
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: ${passedColor};">${passedText}</p>
        </div>
      </div>
      
      <div style="text-align: center; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 10px; color: #4b5563;">
          ${settings?.acadName || 'A-N Academy'} - منصة الإدارة والامتحانات
        </p>
      </div>
    `;

    document.body.appendChild(container);
    
    try {
      const canvas = await html2canvas(container, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl;
    } finally {
      document.body.removeChild(container);
    }
  };

  const sendWhatsAppWithImage = async () => {
    if (!resultImagePreview) return;

    const { attempt } = resultImagePreview;
    const student = students.find(s => s.id === attempt.studentId);
    if (!student?.parentPhone) {
      showToast('لا يوجد رقم هاتف لولي أمر هذا الطالب');
      return;
    }

    const studentName = student?.name || attempt.studentName || 'الطالب';
    const examTitle = exams.find(e => e.id === attempt.examId)?.title || attempt.examTitle || 'الاختبار';
    const score = typeof attempt.finalScore === 'number' ? attempt.finalScore :
      typeof attempt.mcqScore === 'number' ? attempt.mcqScore : 0;
    const isPassed = attempt.passed ?? false;

    const mcqPoints = (attempt.mcqScore * attempt.mcqTotal) / 100;
    const essayPoints = attempt.essayAnswers?.reduce((sum: number, ea: any) => sum + (ea.score || 0), 0) || 0;
    const rawScore = Math.round((mcqPoints + essayPoints) * 10) / 10;
    const maxScore = attempt.mcqTotal + (attempt.essayAnswers?.reduce((sum: number, ea: any) => sum + (ea.maxScore || 0), 0) || 0);

    try {
      const res = await fetch(`${getApiBase()}/api/generate-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          examTitle,
          score: rawScore,
          maxScore,
          isPassed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate message');

      // Format phone number
      let phone = student.parentPhone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '2' + phone;
      if (!phone.startsWith('20')) phone = '20' + phone;

      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(data.message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error(error);
      showToast('حدث خطأ أثناء توليد الرسالة');
    }
  };

  return (
    <div className="space-y-6 pb-24 w-full overflow-x-hidden">
      {/* Header with improved actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-cairo font-black gold-text flex items-center gap-3">
             نتائج الطلاب <span className="text-sm font-mono opacity-40 bg-white/5 py-1 px-3 rounded-full">{filtered.length} محاولة</span>
          </h1>
          <p className="text-xs text-text-muted mt-1 font-bold">عرض وتحليل نتائج الاختبارات وتصدير التقارير</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={exportPDF} 
            disabled={exportingPdf} 
            className="flex-1 md:flex-none btn-gold py-3 px-6 flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
          >
            {exportingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
            تصدير PDF
          </button>
          <button 
            onClick={exportCSV} 
            className="flex-1 md:flex-none btn-outline py-3 px-6 flex items-center justify-center gap-2"
          >
             تصدير CSV
          </button>
        </div>
      </div>

      {/* Stats Dashboard - Premium Look */}
      {stats && (
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-4">
          {[
            { label: 'متوسط الدرجات', value: `${stats.avg}%`, icon: Award, color: '#f5c518', bg: 'rgba(245,197,24,0.1)' },
            { label: 'نسبة النجاح', value: `${stats.passRate}%`, icon: CheckCircle2, color: stats.passRate >= 50 ? '#10b981' : '#ef4444', bg: stats.passRate >= 50 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' },
            { label: 'الدرجة المتوسطة', value: stats.rawAvg, icon: TrendingUp, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          ].map((s, i) => (
            <div key={i} className="card-base p-4 flex flex-col items-center justify-center relative group overflow-hidden border-white/5 bg-white/5">
              <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.03] group-hover:scale-150 transition-transform duration-500" style={{ color: s.color }}>
                <s.icon size={64} />
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-300" style={{ background: s.bg, color: s.color }}>
                <s.icon size={22} />
              </div>
              <div className="text-2xl font-black font-cairo leading-none mb-1.5" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] font-bold text-text-muted opacity-60 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters Section - Clean & Compact */}
      <div className="card-base p-4 lg:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 right-4 text-gold group-focus-within:scale-110 transition-transform" />
            <input 
              type="text" 
              placeholder="ابحث باسم الطالب أو كوده..."
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="input-base has-icon-right text-sm h-12 sm:h-14 w-full shadow-inner bg-white/[0.03] focus:bg-white/[0.05]" 
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 min-w-[300px] lg:min-w-[450px]">
            <div className="relative flex-1 group">
              <Filter size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gold opacity-60" />
              <select 
                value={examFilter} 
                onChange={e => setExamFilter(e.target.value)} 
                className="input-base has-icon-right text-sm h-12 sm:h-14 w-full appearance-none cursor-pointer"
              >
                <option value="">كل الاختبارات</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide shrink-0 h-12 sm:h-14">
              {(['all', 'pass', 'fail'] as const).map(f => (
                <button 
                  key={f} 
                  onClick={() => setStatusFilter(f)}
                  className={`flex-1 sm:flex-none text-[11px] sm:text-xs px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    statusFilter === f 
                      ? 'bg-gold text-dark shadow-xl shadow-gold/10' 
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f === 'all' ? 'الكل' : f === 'pass' ? <><CheckCircle2 size={12} /> ناجح</> : <><X size={12} /> راسب</>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {filtered.length === 0 ? (
        <div className="card-base p-16 text-center border-dashed border-white/10 bg-white/[0.02] animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <Search size={32} className="text-gold opacity-20" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">لا توجد نتائج مطابقة</h3>
          <p className="text-sm text-text-muted max-w-xs mx-auto">جرب تغيير فلاتر البحث أو التأكد من الاسم والكود لظهور النتائج المطلوبة.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card List (Dashboard Style) */}
          <div className="lg:hidden space-y-4">
            {filtered.map(att => {
              const score = att.finalScore ?? att.mcqScore ?? 0;
              const exam = exams.find(e => e.id === att.examId);
              const mcqPoints = att.mcqScore * att.mcqTotal / 100;
              const essayPoints = att.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
              const totalPoints = att.mcqTotal + (att.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
              const student = students.find(s => s.id === att.studentId);

              return (
                <div key={att.id} className="card-base p-5 border shadow-xl relative group transition-all active:scale-[0.98] border-white/5 bg-white/5">
                   <div className="flex items-center gap-4 mb-4">
                      {/* Student Visual */}
                      <div className="relative">
                        {student?.imageUrl ? (
                          <img src={student.imageUrl} className="w-12 h-12 rounded-2xl object-cover border border-white/10" alt="" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold font-black border border-gold/20">
                            {att.studentName[0]}
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#12121f] flex items-center justify-center ${att.passed ? 'bg-green-500' : 'bg-red-500'}`}>
                           {att.passed ? <CheckCircle2 size={10} color="white" /> : <X size={10} color="white" />}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-base truncate">{att.studentName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-gold font-bold px-1.5 py-0.5 bg-gold/10 rounded">{att.studentCode}</span>
                            <span className="text-[10px] text-muted flex items-center gap-1"><Clock size={10} /> {att.submittedAt ? formatDateAr(att.submittedAt, false) : ''}</span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-[10px] font-bold text-muted uppercase tracking-tighter mb-1">النتيجة</div>
                        <div className="font-cairo font-black text-xl leading-none" style={{ color: gradeColor(score, exam?.passScore || 50) }}>
                            {score}%
                        </div>
                      </div>
                   </div>

                   {/* Progress Visual */}
                   <div className="w-full h-1.5 bg-white/5 rounded-full mb-4 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000" 
                        style={{ 
                          width: `${score}%`, 
                          background: gradeColor(score, exam?.passScore || 50),
                          boxShadow: `0 0 10px ${gradeColor(score, exam?.passScore || 50)}40`
                        }} 
                      />
                   </div>

                   <div className="py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/5 mb-5 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">الاختبار:</span>
                        <span className="text-white font-bold truncate max-w-[150px]">{att.examTitle}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">النقاط:</span>
                        <span className="text-gold font-mono font-bold text-sm">
                          {Math.round((mcqPoints + essayPoints)*10)/10} <span className="text-[10px] opacity-40 font-normal">/ {totalPoints}</span>
                        </span>
                      </div>
                   </div>

                   <div className="flex gap-3">
                      <button 
                          onClick={() => handleWhatsApp(att)} 
                          disabled={generatingWA === att.id}
                          className="flex-1 btn-gold py-3 flex items-center justify-center gap-2 shadow-lg shadow-gold/10 active:scale-95 transition-all text-xs"
                      >
                          {generatingWA === att.id ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={18} />}
                          نتائج واتساب
                      </button>
                      <button 
                          onClick={async () => {
                              if (!confirm('سيتم مسح هذه النتيجة والسماح للطالب بإعادة المحاولة. هل أنت متأكد؟')) return;
                              const prev = [...attempts];
                              setAttempts(attempts.filter(a => a.id !== att.id));
                              try { await deleteAttempt(att.id); showToast('✅ تم حذف النتيجة'); }
                              catch { setAttempts(prev); showToast('❌ فشل الحذف'); }
                          }}
                          className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 border border-red-500/10 flex items-center justify-center active:scale-95 hover:bg-red-500/20 transition-all shrink-0"
                          title="حذف النتيجة"
                      >
                          <Trash2 size={20} />
                      </button>
                   </div>
                </div>
              );
            })}
          </div>

          {/* Table for Desktop - Premium Refinement */}
          <div className="hidden lg:block card-base overflow-hidden border-white/5 bg-white/[0.02]">
            <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-right border-collapse">
                <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted">بيانات الطالب</th>
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted">الاختبار</th>
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">النتيجة النهائية</th>
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">التفاصيل (MCQ)</th>
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">الحالة</th>
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted">التوقيت</th>
                      <th className="py-5 px-6 text-[11px] font-black uppercase tracking-widest text-text-muted text-center">الإجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {filtered.map(att => {
                    const score = att.finalScore ?? att.mcqScore ?? 0;
                    const exam = exams.find(e => e.id === att.examId);
                    const student = students.find(s => s.id === att.studentId);
                    return (
                        <tr key={att.id} className="hover:bg-white/[0.03] transition-all group">
                        <td className="py-5 px-6">
                            <div className="flex items-center gap-3">
                                {student?.imageUrl ? (
                                  <img src={student.imageUrl} className="w-10 h-10 rounded-xl object-cover border border-white/5" alt="" />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gold font-bold border border-white/5">
                                    {att.studentName[0]}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-white text-sm group-hover:text-gold transition-colors">{att.studentName}</div>
                                  <div className="text-[10px] font-mono text-text-muted mt-0.5 bg-white/5 px-1.5 rounded inline-block">{att.studentCode}</div>
                                </div>
                            </div>
                        </td>
                        <td className="py-5 px-6">
                            <div className="text-sm font-medium text-white/80 max-w-[180px] truncate">{att.examTitle}</div>
                        </td>
                        <td className="py-5 px-6 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-cairo font-black text-lg" style={{ color: gradeColor(score, exam?.passScore || 50) }}>
                                {score}%
                              </span>
                              <div className="text-[10px] font-bold text-text-muted opacity-50 uppercase mt-0.5">
                                {(() => {
                                  const mcqPoints = att.mcqScore * att.mcqTotal / 100;
                                  const essayPoints = att.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
                                  const totalPoints = att.mcqTotal + (att.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
                                  return `${Math.round((mcqPoints + essayPoints)*10)/10} / ${totalPoints}`;
                                })()}
                              </div>
                            </div>
                        </td>
                        <td className="py-5 px-6 text-center text-sm font-mono text-text-muted">
                            {att.mcqTotal > 0 ? (
                              <div className="bg-white/5 px-3 py-1 rounded-full border border-white/5 inline-block text-xs font-bold">
                                {Math.round((att.mcqScore * att.mcqTotal / 100)*10)/10} <span className="opacity-40 mx-1">/</span> {att.mcqTotal}
                              </div>
                            ) : '—'}
                        </td>
                        <td className="py-5 px-6 text-center">
                            {att.essayAnswers?.some(ea => ea.pending) ? (
                              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 animate-pulse">⏳ قيد التصحيح</span>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black border flex items-center justify-center gap-1.5 mx-auto w-fit ${
                                att.passed 
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                  {att.passed ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                  {att.passed ? 'ناجح' : 'راسب'}
                              </span>
                            )}
                        </td>
                        <td className="py-5 px-6 text-xs text-text-muted">
                            <div className="flex items-center gap-1.5"><Calendar size={12} className="opacity-40" /> {att.submittedAt ? formatDateAr(att.submittedAt) : '—'}</div>
                        </td>
                        <td className="py-5 px-6">
                            <div className="flex gap-2 items-center justify-center">
                              <button 
                                  onClick={() => handleWhatsApp(att)} disabled={generatingWA === att.id}
                                  className="p-2.5 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 shadow-sm hover:text-dark hover:shadow-green-500/20 border border-green-500/10 transition-all disabled:opacity-50 active:scale-90"
                                  title="إرسال النتيجة لواتساب"
                              >
                                  {generatingWA === att.id ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={18} />}
                              </button>
                              <button 
                                  onClick={async () => {
                                    if (!confirm('سيتم مسح هذه النتيجة والسماح للطالب بإعادة المحاولة. هل أنت متأكد؟')) return;
                                    const prev = [...attempts];
                                    setAttempts(attempts.filter(a => a.id !== att.id));
                                    try { await deleteAttempt(att.id); showToast('✅ تم حذف النتيجة'); }
                                    catch { setAttempts(prev); showToast('❌ فشل الحذف'); }
                                  }}
                                  className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white shadow-sm hover:shadow-red-500/20 border border-red-500/10 transition-all active:scale-90"
                                  title="حذف النتيجة"
                              >
                                  <Trash2 size={18} />
                              </button>
                            </div>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {/* Print-only Layout - Used by html2pdf */}
      <div className="absolute top-[200vh] left-[-9999px]">
        <div id="report-container" className="relative bg-white p-6 text-black font-cairo" style={{ direction: 'rtl', width: '200mm', minHeight: '290mm', boxSizing: 'border-box' }}>
        
        {/* Semi-transparent Watermark */}
        {settings?.logoUrl ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" style={{ top: '20vh', opacity: 0.04 }}>
            <img src={settings.logoUrl} alt="Watermark" className="w-[60%] object-contain grayscale" crossOrigin="anonymous" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" style={{ top: '20vh', opacity: 0.04 }}>
            <span className="text-[120px] font-black opacity-10 rotate-[-30deg] tracking-widest text-[#1A1A25]">
              {settings?.acadName || 'A-N'}
            </span>
          </div>
        )}

        {/* Header with Logo */}
        <div className="relative z-10 w-full mb-6 pb-6" style={{ borderBottom: '2px solid #d4af37' }}>
          <div className="text-center mb-4">
            <h1 className="text-2xl font-black mb-0.5" style={{ color: '#1A1A25' }}>{settings?.acadName || 'A-N Academy'}</h1>
            <h2 className="text-lg font-bold" style={{ color: '#b8860b' }}>تقرير نتائج الطلاب</h2>
          </div>
          <div className="flex justify-center gap-6 mt-3 text-xs font-medium text-gray-700 bg-gray-50 py-1.5 rounded-lg">
            <p><span className="font-bold text-gray-900">الاختبار:</span> {examFilter ? exams.find(e => e.id === examFilter)?.title : 'جميع الاختبارات'}</p>
            <p><span className="font-bold text-gray-900">تاريخ الإصدار:</span> {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        {/* Stats Boxes - 4 Column Grid */}
        <div className="relative z-10 grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'عدد الطلاب', val: filtered.length, color: '#3b82f6' },
            { label: 'متوسط الدرجات', val: `${stats?.avg || 0}%`, color: '#f59e0b' },
            { label: 'نسبة النجاح', val: `${stats?.passRate || 0}%`, color: '#10b981' },
          ].map((s, i) => (
             <div key={i} className="p-3 rounded-xl text-center shadow-sm" style={{ background: '#fff', border: '1px solid #e2e8f0', borderBottom: `3px solid ${s.color}` }}>
               <div className="text-gray-500 text-[10px] font-bold mb-0.5">{s.label}</div>
               <div className="text-xl font-black" style={{ color: '#1f2937' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Results Table */}
        <div className="relative z-10 w-full overflow-hidden rounded-xl shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
          <table className="w-full border-collapse bg-white text-right">
            <thead>
              <tr style={{ background: '#1A1A25', color: '#ffffff' }}>
                <th className="p-2.5 font-bold text-[9px] border-b border-gray-300" style={{ width: '1%', whiteSpace: 'nowrap' }}>الكود</th>
                <th className="p-2.5 font-bold text-[9px] border-b border-gray-300 text-right">اسم الطالب</th>
                <th className="p-2.5 font-bold text-[9px] border-b border-gray-300 text-right">الاختبار</th>
                <th className="p-2.5 text-center font-bold text-[9px] border-b border-gray-300" style={{ width: '1%', whiteSpace: 'nowrap' }}>الدرجة</th>
                <th className="p-2.5 text-center font-bold text-[9px] border-b border-gray-300" style={{ width: '1%', whiteSpace: 'nowrap' }}>النسبة</th>
                <th className="p-2.5 text-center font-bold text-[9px] border-b border-gray-300" style={{ width: '1%', whiteSpace: 'nowrap' }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((att, i) => {
                const mcqP = att.mcqScore * att.mcqTotal / 100;
                const essayP = att.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
                const totalP = att.mcqTotal + (att.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
                const isEven = i % 2 === 0;
                
                return (
                  <tr key={att.id} style={{ background: isEven ? '#ffffff' : '#f8fafc' }}>
                    <td className="p-2.5 font-mono text-[9px] text-gray-500 border-b border-gray-100" style={{ whiteSpace: 'nowrap' }}>{att.studentCode}</td>
                    <td className="p-2.5 font-bold text-[10px] text-gray-900 border-b border-gray-100 leading-tight">{att.studentName}</td>
                    <td className="p-2.5 text-[9px] text-gray-700 border-b border-gray-100 leading-tight">{att.examTitle}</td>
                    <td className="p-2.5 text-center font-bold text-[9px] border-b border-gray-100" style={{ color: '#b8860b', whiteSpace: 'nowrap' }}>
                      <span dir="ltr">{Math.round((mcqP + essayP)*10)/10}/{totalP}</span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-[10px] border-b border-gray-100" dir="ltr" style={{ whiteSpace: 'nowrap' }}>{att.finalScore ?? att.mcqScore}%</td>
                    <td className="p-2.5 text-center border-b border-gray-100">
                       <span style={{ 
                         color: att.passed ? '#059669' : '#dc2626', 
                         fontWeight: 'bold',
                         fontSize: '8px',
                         padding: '2px 6px',
                         borderRadius: '4px',
                         background: att.passed ? '#d1fae5' : '#fee2e2',
                         display: 'inline-block'
                       }}>
                         {att.passed ? 'ناجح' : 'راسب'}
                       </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


        {/* Footer */}
        <div className="relative z-10 mt-8 pt-4 text-center text-xs text-gray-400" style={{ borderTop: '1px solid #e2e8f0' }}>
           تم التصدير آلياً بواسطة نظام {settings?.acadName || 'A-N Academy'} | منصة الإدارة والامتحانات
        </div>
      </div>
     </div>

      {/* Result Image Preview Modal */}
      {resultImagePreview && (
        <div className="modal-overlay" onClick={() => setResultImagePreview(null)}>
          <div className="modal-content modal-content-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-xl font-bold gold-text flex items-center gap-2">
                <ImageIcon size={20} /> صورة نتيجة الطالب
              </h3>
              <button 
                onClick={() => setResultImagePreview(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body py-6">
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20 shadow-2xl">
                <img 
                  src={resultImagePreview.imageUrl} 
                  alt="نتيجة الطالب" 
                  className="w-full h-auto"
                />
              </div>
              <p className="text-[10px] text-gray-500 text-center mt-4 font-bold uppercase tracking-widest">
                يمكنك تحميل الصورة ثم إرفاقها يدوياً أو الإرسال المباشر
              </p>
            </div>
            
            <div className="modal-footer bg-white/[0.02]">
              <button 
                onClick={() => setResultImagePreview(null)}
                className="flex-1 btn-outline py-3"
              >
                إغلاق
              </button>
              <a 
                href={resultImagePreview.imageUrl}
                download={`result_${resultImagePreview.attempt.studentCode}.png`}
                className="flex-1 btn-outline py-3 flex items-center justify-center gap-2"
              >
                <Download size={18} /> تحميل
              </a>
              <button 
                onClick={sendWhatsAppWithImage}
                className="flex-[2] btn-gold py-3 flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
              >
                <MessageCircle size={18} /> إرسال واتساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

