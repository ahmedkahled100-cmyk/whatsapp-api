'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { getAssignments, saveAssignment, deleteAssignment, getAssignmentSubmissions, gradeSubmission } from '@/lib/db';
import { Assignment, AssignmentSubmission } from '@/types';
import { showToast } from '@/lib/toast';
import { ClipboardList, PlusCircle, Trash2, Users, CheckCircle, X, Download, Eye, FileText, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { useFilePreview, FilePreviewModal } from '@/components/FilePreviewModal';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';

function AssignmentsPageContent() {
  const { groups, students, user, assignments, setAssignments } = useTeacherStore();
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // AI Generation State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiType, setAiType] = useState<'mcq' | 'tf' | 'essay' | 'mixed'>('mixed');
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiTopic, setAiTopic] = useState('');
  const [showAIOptions, setShowAIOptions] = useState(false);

  // Submissions state
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // File Viewer
  const { openPreview, PreviewModal } = useFilePreview();
  const searchParams = useSearchParams();
  // Grading state
  const [gradingScores, setGradingScores] = useState<Record<string, string>>({});
  const [gradingComments, setGradingComments] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState<string | null>(null);

  const [newAssign, setNewAssign] = useState<Partial<Assignment>>({
    title: '',
    description: '',
    dueDate: '',
    targetGroup: '',
    fileUrl: '',
    maxScore: 10
  });

  const handleAIGenerate = async () => {
    if (!aiTopic && !aiFile) {
      showToast('يرجى إدخال موضوع أو رفع ملف للتحليل');
      return;
    }

    setIsGeneratingAI(true);
    try {
      let fileData = null;
      if (aiFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(aiFile);
        });
        const base64 = await base64Promise;
        fileData = {
          inlineData: base64,
          mimeType: aiFile.type
        };
      }

      const res = await fetch('/api/generate-homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: aiType,
          topic: aiTopic,
          fileData
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setNewAssign(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description
      }));
      
      setShowAIOptions(false);
      showToast('✨ تم توليد الواجب بنجاح!');
    } catch (err: any) {
      console.error(err);
      showToast('فشل توليد الواجب: ' + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getAssignments(user.id);
      setAssignments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  // Handle pre-fill from iLovePDF tools
  useEffect(() => {
    const prefillUrl = searchParams.get('prefillUrl');
    const prefillTitle = searchParams.get('prefillTitle');

    if (prefillUrl) {
      setNewAssign(prev => ({ 
        ...prev, 
        title: prefillTitle || '', 
        fileUrl: prefillUrl 
      }));
      setShowAddForm(true);
      showToast('📥 تم استلام الملف من أدوات PDF بنجاح');
      // Clear params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const handleSave = async () => {
    if (!newAssign.title || !newAssign.dueDate || !newAssign.maxScore) {
      showToast('الرجاء إدخال العنوان والموعد النهائي والدرجة القصوى');
      return;
    }
    if (!user) return;

    setSaving(true);
    const payload: Assignment = {
      id: editingId || crypto.randomUUID(),
      teacherId: user.id,
      title: newAssign.title,
      description: newAssign.description || '',
      dueDate: newAssign.dueDate,
      maxScore: Number(newAssign.maxScore),
      targetGroup: newAssign.targetGroup || '',
      fileUrl: newAssign.fileUrl || '',
      createdAt: editingId ? (assignments.find(a => a.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    // Optimistic Update
    const previous = [...assignments];
    if (editingId) {
      setAssignments(previous.map(a => a.id === editingId ? payload : a));
    } else {
      setAssignments([...previous, payload]);
    }

    try {
      await saveAssignment(payload);
      setShowAddForm(false);
      setEditingId(null);
      setNewAssign({ title: '', description: '', dueDate: '', targetGroup: '', fileUrl: '', maxScore: 10 });
      showToast(editingId ? '🙌 تم تعديل الواجب بنجاح' : '✅ تم إضافة الواجب بنجاح');
    } catch (e) {
      setAssignments(previous);
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟ سيتم حذف إجابات الطلاب المرتبطة به أيضاً.')) return;
    const previous = [...assignments];
    setAssignments(previous.filter(a => a.id !== id));
    try {
      await deleteAssignment(id);
      showToast('✅ تم حذف الواجب');
    } catch (e) {
      setAssignments(previous);
      showToast('حدث خطأ أثناء الحذف');
    }
  };

  const handleViewSubmissions = async (assign: Assignment) => {
    setSelectedAssignment(assign);
    setLoadingSubs(true);
    try {
      const subs = await getAssignmentSubmissions(assign.id);
      setSubmissions(subs);
      
      // Initialize grading state
      const scores: Record<string, string> = {};
      const comments: Record<string, string> = {};
      subs.forEach(s => {
        scores[s.id] = s.score?.toString() || '';
        comments[s.id] = s.teacherComment || '';
      });
      setGradingScores(scores);
      setGradingComments(comments);
    } catch (e) {
      showToast('حدث خطأ أثناء جلب الردود');
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleSaveGrade = async (sub: AssignmentSubmission) => {
    if (!sub.id) {
      showToast('خطأ: معرف التسليم غير موجود');
      return;
    }
    const scoreVal = Number(gradingScores[sub.id]);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > selectedAssignment!.maxScore) {
      showToast(`يرجى إدخال درجة صحيحة من 0 إلى ${selectedAssignment!.maxScore}`);
      return;
    }

    setSavingGrade(sub.id);
    try {
      await gradeSubmission(sub.id, scoreVal, gradingComments[sub.id]);
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, score: scoreVal, teacherComment: gradingComments[sub.id], status: 'graded' } : s));
      showToast('تم حفظ تقييم الطالب');
    } catch (e) {
      showToast('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setSavingGrade(null);
    }
  };

  const handleRequestRedo = async (sub: AssignmentSubmission) => {
    if (!sub.id) return;
    setSavingGrade(sub.id);
    try {
      await gradeSubmission(sub.id, 0, gradingComments[sub.id] || 'يرجى إعادة الواجب مره اخرى', 'redo');
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, score: 0, teacherComment: gradingComments[sub.id] || 'يرجى إعادة الواجب مره اخرى', status: 'redo' as const } : s));
      showToast('تم طلب إرسال الواجب مجدداً من الطالب');
    } catch (e) {
      showToast('حدث خطأ أثناء طلب الإعادة');
    } finally {
      setSavingGrade(null);
    }
  };

  const openVFile = (url: string, fileName?: string) => {
    openPreview(url, fileName);
  };

  return (
    <div className="container-main pb-24">
      {selectedAssignment ? (
        <div className="space-y-6">
        <button onClick={() => setSelectedAssignment(null)} className="btn-outline flex items-center gap-2 mb-4">
          ← رجوع للواجبات
        </button>

        <div className="card-base p-6">
          <h2 className="text-xl font-bold mb-2">ردود الطلاب: {selectedAssignment.title}</h2>
          <p className="text-gray-400 mb-4">حدد درجة لكل طالب من {selectedAssignment.maxScore}</p>

          {loadingSubs ? (
            <div className="text-center py-8 opacity-50">جاري تحميل الردود...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 card-base bg-white/5">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-gray-400">لم يقم أي طالب بتسليم هذا الواجب حتى الآن.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map(sub => (
                <div key={sub.id} className="card-base border border-white/5 p-4 flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-bold text-lg">{sub.studentName}</h3>
                      <span className={`badge ${sub.status === 'graded' ? 'badge-green' : sub.status === 'redo' ? 'badge-danger' : 'badge-gold'}`}>
                        {sub.status === 'graded' ? 'تم التصحيح' : sub.status === 'redo' ? 'مطلوب إعادته' : 'قيد المراجعة'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {sub.textAnswer && (
                        <div className="bg-white/5 p-4 rounded-lg">
                          <h4 className="text-sm text-gray-400 mb-2">الإجابة النصية:</h4>
                          <p className="whitespace-pre-wrap">{sub.textAnswer}</p>
                        </div>
                      )}

                      {sub.fileUrl && (
                        <div className="bg-white/5 p-4 rounded-lg flex items-center justify-between">
                          <span className="text-sm font-bold flex items-center gap-2">
                            <FileText size={16} className="text-gold" />
                            ملف مرفق
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => openVFile(sub.fileUrl!, 'ملف مرفق')} className="btn-outline text-xs px-3 py-1 flex items-center gap-1">
                              <Eye size={12} /> معاينة
                            </button>
                            <a href={sub.fileUrl} target="_blank" rel="noreferrer" download className="btn-gold text-xs px-3 py-1 flex items-center gap-1">
                              <Download size={12} /> تحميل
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grading Interface */}
                  <div className="bg-white/5 p-4 rounded-xl w-full md:w-80 flex-shrink-0">
                    <h4 className="font-bold mb-3 border-b border-white/10 pb-2">التصحيح</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">الدرجة (من {selectedAssignment.maxScore})</label>
                        <input 
                          type="number" 
                          className="input-base w-full p-2"
                          min="0"
                          max={selectedAssignment.maxScore}
                          value={gradingScores[sub.id]}
                          onChange={(e) => setGradingScores(prev => ({...prev, [sub.id]: e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">تعليق المعلم (اختياري)</label>
                        <textarea 
                          className="input-base w-full p-2 text-sm h-20 resize-none"
                          placeholder="ملاحظات على الإجابة..."
                          value={gradingComments[sub.id]}
                          onChange={(e) => setGradingComments(prev => ({...prev, [sub.id]: e.target.value}))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveGrade(sub)}
                          disabled={savingGrade === sub.id}
                          className="btn-gold flex-[2] flex items-center justify-center gap-2"
                        >
                          {savingGrade === sub.id ? 'جاري الحفظ...' : <><CheckCircle size={16} /> حفظ التقييم</>}
                        </button>
                        <button 
                          onClick={() => handleRequestRedo(sub)}
                          disabled={savingGrade === sub.id}
                          className="btn-danger flex-1 flex items-center justify-center gap-1 text-xs px-1"
                          title="اطلب من الطالب تصحيح أو إعادة الواجب"
                        >
                          إعادة
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList size={28} className="text-gold" />
              <h1 className="text-2xl font-cairo font-black gold-text">الواجبات المنزلية</h1>
            </div>
        <button onClick={() => {
          setEditingId(null);
          setNewAssign({ title: '', description: '', dueDate: '', targetGroup: '', fileUrl: '', maxScore: 10 });
          setShowAddForm(!showAddForm);
        }} className="btn-gold flex items-center gap-2">
          {showAddForm ? 'إلغاء' : <><PlusCircle size={18} /> إضافة واجب</>}
        </button>
      </div>

      {showAddForm && (
        <div className="card-base p-6 animate-fade-in border border-yellow-500/30 overflow-hidden relative">
          {/* AI Magic Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <Sparkles size={18} className="text-gold" />
              </div>
              <div>
                <h2 className="font-bold text-lg">إنشاء تكليف {editingId ? 'معدل' : 'جديد'}</h2>
                <p className="text-[10px] text-gray-400">يمكنك كتابة التفاصيل يدوياً أو استخدام الذكاء الاصطناعي</p>
              </div>
            </div>
            {!editingId && (
              <button 
                onClick={() => setShowAIOptions(!showAIOptions)}
                className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${showAIOptions ? 'bg-gold text-black font-bold' : 'bg-white/5 text-gold hover:bg-white/10'}`}
              >
                <Sparkles size={14} /> {showAIOptions ? 'إخفاء خيارات الذكاء الاصطناعي' : 'سحر الذكاء الاصطناعي (AI)'}
              </button>
            )}
          </div>

          {/* AI Magic Options Panel */}
          {showAIOptions && !editingId && (
            <div className="mb-8 p-4 rounded-2xl bg-gold/5 border border-gold/10 animate-slide-down">
              <div className="flex items-center gap-2 mb-4 text-gold">
                <Sparkles size={16} />
                <h3 className="text-sm font-bold">توليد الواجب بالذكاء الاصطناعي</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs mb-1.5 opacity-70">موضوع الدرس أو المادة الدراسية</label>
                  <input 
                    type="text" 
                    className="input-base text-sm h-10" 
                    placeholder="مثال: قوانين نيوتن للحركة - فيزياء"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 opacity-70">نوع الأسئلة</label>
                  <select 
                    className="input-base text-sm h-10"
                    value={aiType}
                    onChange={e => setAiType(e.target.value as any)}
                  >
                    <option value="mixed">أسئلة متنوعة (مختلط)</option>
                    <option value="mcq">اختيار من متعدد (MCQ)</option>
                    <option value="tf">صح أو خطأ</option>
                    <option value="essay">أسئلة مقالية</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs mb-1.5 opacity-70">تحليل ملف الدرس (اختياري - PDF أو صورة)</label>
                  <GlobalFileUpload 
                    accept="application/pdf,image/*"
                    isUploading={isGeneratingAI}
                    label={aiFile ? `تم اختيار: ${aiFile.name}` : "ارفع ملف الدرس للحصول على أسئلة دقيقة"}
                    onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleAIGenerate}
                disabled={isGeneratingAI || (!aiTopic && !aiFile)}
                className="btn-gold w-full mt-4 flex items-center justify-center gap-2 py-3 shadow-glow-gold disabled:opacity-50"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    جاري تحليل المادة وتوليد الأسئلة...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    توليد الواجب الآن
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm mb-1 opacity-70">عنوان الواجب *</label>
              <input 
                type="text" className="input-base w-full" placeholder="مثال: حل صفحة 50 - رياضيات"
                value={newAssign.title} onChange={e => setNewAssign({...newAssign, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">الموعد النهائي (Deadline) *</label>
              <input 
                type="datetime-local" className="input-base w-full"
                value={newAssign.dueDate} onChange={e => setNewAssign({...newAssign, dueDate: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">الدرجة القصوى *</label>
              <input 
                type="number" className="input-base w-full" min="1"
                value={newAssign.maxScore || ''} onChange={e => setNewAssign({...newAssign, maxScore: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">استهداف فئة معينة</label>
              <select 
                className="input-base w-full"
                value={newAssign.targetGroup} onChange={e => setNewAssign({...newAssign, targetGroup: e.target.value})}
              >
                <option value="">جميع الطلاب</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">رابط ملف (اختياري)</label>
              <input 
                type="text" className="input-base w-full" placeholder="رابط Google Drive أو PDF..."
                value={newAssign.fileUrl} onChange={e => setNewAssign({...newAssign, fileUrl: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 opacity-70">تفاصيل الواجب</label>
               <textarea 
                  className="input-base w-full resize-none h-24" placeholder="اكتب التعليمات للطلاب هنا..."
                  value={newAssign.description} onChange={e => setNewAssign({...newAssign, description: e.target.value})}
               />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowAddForm(false); setEditingId(null); }} className="btn-outline px-6">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="btn-gold px-6">
               {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'حفظ التكليف')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 opacity-50">جاري التحميل...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12 card-base">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-gray-400">لم تقم بإضافة أي واجبات حتى الآن.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map(assign => {
             const groupName = groups.find(g => g.id === assign.targetGroup)?.name || 'جميع الطلاب';
             const isExpired = new Date(assign.dueDate).getTime() < Date.now();
             
             return (
               <div key={assign.id} className="card-base p-4 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-lg leading-tight">{assign.title}</h3>
                     <div className="flex gap-2">
                       <button onClick={() => {
                         setEditingId(assign.id);
                         setNewAssign({
                           title: assign.title, description: assign.description,
                           dueDate: assign.dueDate, targetGroup: assign.targetGroup,
                           fileUrl: assign.fileUrl, maxScore: assign.maxScore
                         });
                         setShowAddForm(true);
                         window.scrollTo({ top: 0, behavior: 'smooth' });
                       }} className="text-blue-400 hover:text-blue-300 transition-colors">
                         <ClipboardList size={16} />
                       </button>
                       <button onClick={() => handleDelete(assign.id)} className="text-red-400 hover:text-red-300 transition-colors">
                         <Trash2 size={16} />
                       </button>
                     </div>
                   </div>
                   <p className="text-sm opacity-70 line-clamp-2 mb-4">{assign.description || 'لا يوجد وصف'}</p>
                   
                   <div className="space-y-2 text-xs">
                     <div className="flex items-center gap-2 opacity-80">
                       <Users size={14} className="text-gold" /> مخصص إلى: {groupName}
                     </div>
                     <div className={`flex items-center gap-2 font-medium ${isExpired ? 'text-red-400' : 'text-green-400'}`}>
                       <span>⏰</span> ينتهي: {new Date(assign.dueDate).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                     </div>
                   </div>
                 </div>
                 
                 <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                    {assign.fileUrl && (
                      <div className="flex-1 flex gap-2">
                        <button onClick={() => openVFile(assign.fileUrl!, 'المرفق')} className="btn-outline text-[10px] px-2 py-1 flex-1 flex items-center justify-center gap-1">
                          <Eye size={10} /> معاينة
                        </button>
                        <a href={assign.fileUrl} target="_blank" rel="noreferrer" className="btn-outline text-[10px] px-2 py-1 flex-1 text-center">
                          المرفق
                        </a>
                      </div>
                    )}
                   <button onClick={() => handleViewSubmissions(assign)} className="btn-gold text-xs px-3 py-1 flex-1">
                     تصحيح وعرض الردود
                   </button>
                 </div>
               </div>
             )
          })}
          </div>
        )}
        </div>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center opacity-50">جاري تحميل صفحة الواجبات...</div>}>
      <AssignmentsPageContent />
    </Suspense>
  );
}
