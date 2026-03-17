'use client';
// src/app/teacher/results/page.tsx

import { useState, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { formatDateAr, gradeColor, scoreLabel } from '@/lib/utils';
import { Search, Download, Trash2, Filter, MessageCircle, Loader2, Share2, X } from 'lucide-react';
import { deleteAttempt } from '@/lib/db';
import html2canvas from 'html2canvas';

export default function ResultsPage() {
  const { attempts, exams, students, settings } = useTeacherStore();
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
        margin:       10,
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
    if (!student?.parentPhone) return;

    try {
      const res = await fetch('/api/generate-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          examTitle: exams.find(e => e.id === attempt.examId)?.title || attempt.examTitle,
          score: attempt.finalScore ?? attempt.mcqScore ?? 0,
          isPassed: attempt.passed,
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
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-cairo font-black gold-text">📊 النتائج ({filtered.length})</h1>
        <div className="flex gap-2">
          <button onClick={exportPDF} disabled={exportingPdf} className="btn-gold text-sm py-2 px-3 flex items-center gap-2">
            {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
            تصدير PDF
          </button>
          <button onClick={exportCSV} className="btn-outline text-sm py-2 px-3">
             تصدير CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'المتوسط (نقاط)', value: stats.rawAvg, color: 'var(--gold)' },
            { label: 'المتوسط (%)', value: `${stats.avg}%`, color: gradeColor(stats.avg, 50) },
            { label: 'نسبة النجاح', value: `${stats.passRate}%`, color: stats.passRate >= 50 ? 'var(--green)' : 'var(--red)' },
          ].map((s, i) => (
            <div key={i} className="stat-card text-center py-3">
              <div className="text-2xl font-cairo font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card-base p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
          <input type="text" placeholder="بحث بالاسم أو الكود..."
            value={search} onChange={e => setSearch(e.target.value)} className="input-base pr-11 text-sm" />
        </div>
        <select value={examFilter} onChange={e => setExamFilter(e.target.value)} className="input-base text-sm" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">كل الاختبارات</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(['all', 'pass', 'fail'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === f ? 'btn-gold py-1.5' : 'btn-outline py-1.5'}`}>
              {f === 'all' ? 'الكل' : f === 'pass' ? '✅ ناجح' : '❌ راسب'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card-base p-12 text-center">
          <div className="text-5xl mb-2">📊</div>
          <p style={{ color: 'var(--text-muted)' }}>لا توجد نتائج</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-right min-w-[700px]">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الاختبار</th>
                  <th>النتيجة</th>
                  <th>MCQ</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(att => {
                  const score = att.finalScore ?? att.mcqScore ?? 0;
                  const exam = exams.find(e => e.id === att.examId);
                  return (
                    <tr key={att.id}>
                      <td>
                        <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{att.studentName}</div>
                        <code className="text-xs" style={{ color: 'var(--text-muted)' }}>{att.studentCode}</code>
                      </td>
                      <td className="max-w-32 truncate text-sm">{att.examTitle}</td>
                      <td>
                        <span className="font-cairo font-black text-base" style={{ color: gradeColor(score, exam?.passScore || 50) }}>
                          {(() => {
                            const mcqPoints = att.mcqScore * att.mcqTotal / 100;
                            const essayPoints = att.essayAnswers?.reduce((sum, ea) => sum + (ea.score || 0), 0) || 0;
                            const totalPoints = att.mcqTotal + (att.essayAnswers?.reduce((sum, ea) => sum + (ea.maxScore || 0), 0) || 0);
                            return `${Math.round((mcqPoints + essayPoints)*10)/10} / ${totalPoints}`;
                          })()}
                        </span>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{score}% — {scoreLabel(score)}</div>
                      </td>
                      <td className="text-sm">
                        {att.mcqTotal > 0 ? `${Math.round((att.mcqScore * att.mcqTotal / 100)*10)/10} / ${att.mcqTotal}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${att.passed ? 'badge-green' : 'badge-red'}`}>
                          {att.passed ? '✅ ناجح' : '❌ راسب'}
                        </span>
                      </td>
                      <td className="text-xs">{att.submittedAt ? formatDateAr(att.submittedAt) : '—'}</td>
                      <td>
                        <div className="flex gap-2 items-center">
                          <button 
                            onClick={() => handleWhatsApp(att)} 
                            disabled={generatingWA === att.id}
                            title="رسالة واتس آب ذكية لولي الأمر"
                            className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-xs p-1.5 rounded transition-colors disabled:opacity-50"
                          >
                            {generatingWA === att.id ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                          </button>
                          
                          <button onClick={async () => {
                            if (!confirm('سيتم مسح هذه النتيجة والسماح للطالب بإعادة المحاولة. هل أنت متأكد؟')) return;
                            await deleteAttempt(att.id);
                          }} className="btn-danger text-xs py-1 px-2 flex items-center gap-1" title="إلغاء المحاولة لإعادة الامتحان">
                            <Trash2 size={11} /> إعادة محاولة
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
      )}

      {/* Print-only Layout - Used by html2pdf */}
      <div className="absolute top-[200vh] left-[-9999px]">
        <div id="report-container" className="relative bg-white p-8 text-black font-cairo" style={{ direction: 'rtl', width: '210mm', minHeight: '297mm' }}>
        
        {/* Semi-transparent Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" style={{ top: '20vh', opacity: 0.04 }}>
          <img src={settings?.logoUrl || '/logo.png'} alt="Watermark" className="w-[60%] object-contain grayscale" crossOrigin="anonymous" />
        </div>

        {/* Header with Logo */}
        <div className="relative z-10 w-full mb-6 pb-6" style={{ borderBottom: '2px solid #d4af37' }}>
          <div className="text-center mb-4">
            <img 
              src={settings?.logoUrl || '/logo.png'} 
              alt="Logo" 
              className="w-28 h-28 object-contain mx-auto mb-3" 
              crossOrigin="anonymous" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <h1 className="text-3xl font-black mb-1" style={{ color: '#1A1A25' }}>{settings?.acadName || 'A-N Academy'}</h1>
            <h2 className="text-xl font-bold" style={{ color: '#b8860b' }}>تقرير نتائج الطلاب</h2>
          </div>
          <div className="flex justify-center gap-8 mt-4 text-sm font-medium text-gray-700 bg-gray-50 py-2 rounded-lg">
            <p><span className="font-bold text-gray-900">الاختبار:</span> {examFilter ? exams.find(e => e.id === examFilter)?.title : 'جميع الاختبارات'}</p>
            <p><span className="font-bold text-gray-900">تاريخ الإصدار:</span> {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        {/* Stats Boxes - 4 Column Grid */}
        <div className="relative z-10 grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'عدد الطلاب', val: filtered.length, color: '#3b82f6' },
            { label: 'متوسط الدرجات', val: `${stats?.avg || 0}%`, color: '#f59e0b' },
            { label: 'نسبة النجاح', val: `${stats?.passRate || 0}%`, color: '#10b981' },
            { label: 'متوسط النقاط', val: stats?.rawAvg || '0', color: '#6366f1' }
          ].map((s, i) => (
             <div key={i} className="p-4 rounded-xl text-center shadow-sm" style={{ background: '#fff', border: '1px solid #e2e8f0', borderBottom: `3px solid ${s.color}` }}>
               <div className="text-gray-500 text-sm font-bold mb-1">{s.label}</div>
               <div className="text-2xl font-black" style={{ color: '#1f2937' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Results Table */}
        <div className="relative z-10 w-full overflow-hidden rounded-xl shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
          <table className="w-full border-collapse bg-white text-right" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#1A1A25', color: '#ffffff' }}>
                <th className="p-3 font-bold text-xs border-b border-gray-300 whitespace-nowrap" style={{ width: '1%', minWidth: '60px' }}>كود الطالب</th>
                <th className="p-3 font-bold text-xs border-b border-gray-300" style={{ minWidth: '120px' }}>اسم الطالب</th>
                <th className="p-3 font-bold text-xs border-b border-gray-300" style={{ minWidth: '140px' }}>الاختبار</th>
                <th className="p-3 text-center font-bold text-xs border-b border-gray-300 whitespace-nowrap" style={{ width: '1%', minWidth: '80px' }}>الدرجة</th>
                <th className="p-3 text-center font-bold text-xs border-b border-gray-300 whitespace-nowrap" style={{ width: '1%', minWidth: '60px' }}>النسبة</th>
                <th className="p-3 text-center font-bold text-xs border-b border-gray-300 whitespace-nowrap" style={{ width: '1%', minWidth: '70px' }}>الحالة</th>
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
                    <td className="p-3 font-mono text-xs text-gray-500 border-b border-gray-100 whitespace-nowrap">{att.studentCode}</td>
                    <td className="p-3 font-bold text-sm text-gray-900 border-b border-gray-100 leading-tight">{att.studentName}</td>
                    <td className="p-3 text-sm text-gray-700 border-b border-gray-100 leading-tight">{att.examTitle}</td>
                    <td className="p-3 text-center font-bold text-xs border-b border-gray-100 whitespace-nowrap" style={{ color: '#b8860b' }}>
                      <span dir="ltr">{Math.round((mcqP + essayP)*10)/10} / {totalP}</span>
                    </td>
                    <td className="p-3 text-center font-bold text-xs border-b border-gray-100 whitespace-nowrap" dir="ltr">{att.finalScore ?? att.mcqScore}%</td>
                    <td className="p-3 text-center border-b border-gray-100 whitespace-nowrap">
                       <span style={{ 
                         color: att.passed ? '#059669' : '#dc2626', 
                         fontWeight: 'bold',
                         fontSize: '11px',
                         padding: '3px 8px',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark2 border border-gold/30 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setResultImagePreview(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            <h3 className="text-xl font-bold mb-4 text-center gold-text">صورة نتيجة الطالب</h3>
            
            <div className="rounded-xl overflow-hidden border border-white/10 mb-4">
              <img 
                src={resultImagePreview.imageUrl} 
                alt="نتيجة الطالب" 
                className="w-full h-auto"
              />
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={sendWhatsAppWithImage}
                className="flex-1 btn-gold flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} />
                إرسال عبر الواتساب
              </button>
              <a 
                href={resultImagePreview.imageUrl}
                download={`result_${resultImagePreview.attempt.studentCode}.png`}
                className="flex-1 btn-outline flex items-center justify-center gap-2"
              >
                <Download size={18} />
                تحميل الصورة
              </a>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-3">
              يمكنك تحميل الصورة ثم إرفاقها يدوياً مع رسالة الواتساب
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

