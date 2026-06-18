'use client';
// src/app/teacher/courses/page.tsx

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTeacherStore } from '@/lib/store';
import { saveMaterial, deleteMaterial, uploadFileToStorage, dispatchNotification } from '@/lib/db';
import { showToast } from '@/lib/toast';
import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';
import {
  Link as LinkIcon, Lock, Globe, Trash2, Upload,
  Loader2, Plus, X, BookOpen, ClipboardList, ChevronDown, ChevronUp, FolderPlus,
  Video, FileText, Search, BookMarked, PlusCircle, Image as ImageIcon
} from 'lucide-react';
import { CourseMaterial } from '@/types';
import Select from 'react-select';
import { FileProcessor } from '@/lib/file-processor';
import { useFileProcessingStore } from '@/lib/store';
import { PDFCompressionModal } from '@/components/PDFCompressionModal';
import { useFilePreview } from '@/components/FilePreviewModal';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';

const GRADES = [
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"
];

const customSelectStyles = {
  control: (base: any) => ({
    ...base,
    background: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    color: 'white',
    minHeight: '42px',
    boxShadow: 'none',
    '&:hover': { borderColor: 'rgba(245,197,24,0.3)' }
  }),
  menu: (base: any) => ({
    ...base,
    background: '#1a1a25',
    border: '1px solid rgba(255,255,255,0.1)',
    zIndex: 100,
  }),
  option: (base: any, state: any) => ({
    ...base,
    background: state.isFocused ? 'rgba(245,197,24,0.1)' : 'transparent',
    color: state.isFocused ? '#F5C518' : 'white',
    cursor: 'pointer'
  }),
  multiValue: (base: any) => ({
    ...base,
    background: 'rgba(245,197,24,0.2)',
    borderRadius: '4px',
  }),
  multiValueLabel: (base: any) => ({ ...base, color: '#F5C518' }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#F5C518',
    ':hover': { backgroundColor: 'rgba(245,197,24,0.3)', color: 'white' },
  }),
  singleValue: (base: any) => ({ ...base, color: 'white' }),
  input: (base: any) => ({ ...base, color: 'white' }),
  placeholder: (base: any) => ({ ...base, color: 'rgba(255,255,255,0.3)' }),
};

const EMPTY_FORM: Partial<CourseMaterial> & { uploadFile?: File | null; newLinkLabel?: string; newLinkUrl?: string } = {
  type: 'video',
  title: '',
  url: '',
  grade: '',
  targetGroups: [],
  subject: '',
  sequence: 1,
  isFree: false,
  exceptionalStudents: [],
  additionalLinks: [],
  linkedExamId: '',
  linkedAssignmentId: '',
  uploadFile: null,
  newLinkLabel: '',
  newLinkUrl: '',
};

function CoursesPageContent() {
  const { queue } = useFileProcessingStore();
  const { materials, groups, students, exams, assignments } = useTeacherStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const { openPreview, PreviewModal } = useFilePreview();
  const searchParams = useSearchParams();
  
  // PDF Compression state
  const [compressionModal, setCompressionModal] = useState<{
    isOpen: boolean;
    file: File | null;
    onComplete?: (blob: Blob, url: string, stats: { originalSize: number; compressedSize: number }) => void;
  }>({ isOpen: false, file: null });

  // Listen for background upload completion
  useEffect(() => {
    const handleUploaded = (e: any) => {
      const { url, path, fileName } = e.detail;
      // Only update if the file belongs to this form (we can check path or filename)
      if (path.startsWith('materials/')) {
        update('fileUrl', url);
        update('url', url);
        if (e.detail.stats) {
          const { originalSize, compressedSize } = e.detail.stats;
          const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          showToast(`✅ تم الضغط والرفع: ${fileName} (قل بنسبة ${reduction}%)`);
        } else {
          showToast(`تم اكتمال رفع ملف: ${fileName}`);
        }
      }
    };
    window.addEventListener('fileUploaded', handleUploaded);
    return () => window.removeEventListener('fileUploaded', handleUploaded);
  }, []);

  // Handle pre-fill from iLovePDF tools
  useEffect(() => {
    const prefillUrl = searchParams.get('prefillUrl');
    const prefillName = searchParams.get('prefillName');
    const prefillType = searchParams.get('prefillType');

    if (prefillUrl) {
      setForm({ 
        ...EMPTY_FORM, 
        title: prefillName || '', 
        url: prefillUrl, 
        fileUrl: prefillUrl,
        type: (prefillType as any) || 'pdf'
      });
      setShowAddForm(true);
      showToast('📥 تم استلام الملف من أدوات PDF بنجاح');
      // Clear URL params without refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // Known subjects from existing materials for autocomplete
  const knownSubjects = Array.from(new Set(materials.map(m => m.subject).filter(Boolean)));
  const groupOptions = groups.map(g => ({ value: g.id, label: g.name }));

  const studentOptions = students.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const examOptions = [
    { value: '', label: '— لا يوجد اختبار مرتبط —' },
    ...exams.map(e => ({ value: e.id, label: e.title }))
  ];
  const assignmentOptions = [
    { value: '', label: '— لا يوجد واجب مرتبط —' },
    ...(assignments || []).map(a => ({ value: a.id, label: a.title }))
  ];

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const openAdd = (subjectName = '') => {
    const nextSeq = materials.filter(m => m.subject === subjectName).length + 1;
    setForm({ ...EMPTY_FORM, subject: subjectName, sequence: nextSeq });
    setEditingId(null);
    setShowAddForm(true);
  };

  const openEdit = (m: CourseMaterial) => {
    setForm({ ...m, uploadFile: null, newLinkLabel: '', newLinkUrl: '' });
    setEditingId(m.id);
    setShowAddForm(true);
  };

  const addLink = () => {
    if (!form.newLinkUrl?.trim()) return;
    const newLink = { label: form.newLinkLabel || form.newLinkUrl, url: form.newLinkUrl };
    update('additionalLinks', [...(form.additionalLinks || []), newLink]);
    setForm(f => ({ ...f, newLinkLabel: '', newLinkUrl: '' }));
  };

  const removeLink = (idx: number) =>
    update('additionalLinks', (form.additionalLinks || []).filter((_: any, i: number) => i !== idx));

  const handleSave = async () => {
    if (!form.title?.trim() || !form.subject?.trim()) {
      showToast('يرجى إدخال عنوان الدرس والمادة الدراسية');
      return;
    }
    const hasContent = form.url?.trim() || form.fileUrl?.trim();
    if (!hasContent && !form.uploadFile) {
      showToast('يرجى إدخال رابط أو رفع ملف');
      return;
    }
    if (form.uploadFile && !form.fileUrl) {
      showToast('⏳ يرجى الانتظار حتى يكتمل حفظ ورفع الملف أولاً');
      return;
    }

    setLoading(true);
    const tempId = editingId || crypto.randomUUID();
    const materialData: CourseMaterial = {
      id: tempId,
      teacherId: useTeacherStore.getState().user?.id || '',
      title: form.title!,
      type: form.type as any || 'link',
      url: form.url || form.fileUrl || '',
      fileUrl: form.fileUrl || undefined,
      additionalLinks: (form.additionalLinks || []).filter((l: any) => l.url),
      grade: form.grade || '',
      targetGroups: form.targetGroups || [],
      subject: form.subject!,
      sequence: Number(form.sequence) || 1,
      isFree: form.isFree || false,
      exceptionalStudents: form.exceptionalStudents || [],
      linkedExamId: form.linkedExamId || undefined,
      linkedAssignmentId: form.linkedAssignmentId || undefined,
      createdAt: editingId ? (form.createdAt || Date.now()) : Date.now(),
    };

    // Optimistic Update
    const previousMaterials = [...useTeacherStore.getState().materials];
    if (editingId) {
      useTeacherStore.getState().setMaterials(previousMaterials.map(m => m.id === editingId ? materialData : m));
    } else {
      useTeacherStore.getState().setMaterials([...previousMaterials, materialData]);
    }

    setShowAddForm(false);
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    showToast('✅ تم حفظ الدرس بنجاح');

    try {
      const realId = await saveMaterial(materialData);
      if (!editingId && realId !== tempId) {
        useTeacherStore.getState().setMaterials(useTeacherStore.getState().materials.map(m => m.id === tempId ? { ...m, id: realId } : m));
      }

      // Notification logic
      if (!editingId) { // Only notify for NEW materials
        await dispatchNotification({
          teacherId: materialData.teacherId,
          msg: `تم إضافة درس جديد: ${materialData.title} (${materialData.subject})`,
          targetRoles: ['student'],
          targetGroups: materialData.targetGroups && materialData.targetGroups.length > 0 ? materialData.targetGroups : undefined,
          actionPath: '/student',
          channels: { inApp: true, whatsapp: false }
        });
      }

      setShowAddForm(false);
      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      showToast('✅ تم حفظ الدرس بنجاح');
    } catch (e) {
      useTeacherStore.getState().setMaterials(previousMaterials);
      console.error(e);
      showToast('حدث خطأ أثناء الحفظ');
      setShowAddForm(true); // Optional: re-open if failed
    } finally {
      setLoading(false);
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
    const previousMaterials = [...useTeacherStore.getState().materials];
    useTeacherStore.getState().setMaterials(previousMaterials.filter(m => m.id !== id));
    showToast('✅ تم حذف الدرس');
    try { 
      await deleteMaterial(id); 
    } catch { 
      useTeacherStore.getState().setMaterials(previousMaterials);
      showToast('حدث خطأ أثناء الحذف'); 
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold">🎬 فيديو</span>;
      case 'pdf': return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold">📄 ملف PDF</span>;
      case 'file': return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 text-[10px] font-bold">📁 ملف عام</span>;
      case 'image': return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">🖼️ صورة</span>;
      default: return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400 text-[10px] font-bold">🔗 رابط</span>;
    }
  };

  const filtered = materials.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.subject.toLowerCase().includes(search.toLowerCase())
  );

  // Group by subject
  const grouped = filtered.reduce((acc, m) => {
    const subj = m.subject || 'بدون مادة';
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(m);
    return acc;
  }, {} as Record<string, CourseMaterial[]>);

  const toggleSubject = (subj: string) =>
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      next.has(subj) ? next.delete(subj) : next.add(subj);
      return next;
    });

  // Initialize all subjects as expanded on first load
  useEffect(() => {
    setExpandedSubjects(new Set(Object.keys(grouped)));
  }, [materials.length]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BookMarked size={26} className="text-gold" />
          <h1 className="text-2xl font-cairo font-black gold-text">المناهج والدروس</h1>
          <span className="badge bg-white/10">{materials.length} درس</span>
        </div>
        <button
          onClick={() => openAdd()}
          className="btn-gold flex items-center gap-2"
        >
          <PlusCircle size={16} /> إضافة درس جديد
        </button>
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <div className="card-base p-6 border border-yellow-500/30 animate-scale-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-cairo font-bold text-lg" style={{ color: 'var(--gold)' }}>
              {editingId ? '✏️ تعديل الدرس' : '➕ إضافة درس جديد'}
            </h2>
            <button onClick={() => { setShowAddForm(false); setForm({ ...EMPTY_FORM }); }} className="opacity-40 hover:opacity-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Row 1: Type + Title */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1 text-gray-400">نوع المحتوى</label>
                <select className="input-base w-full" value={form.type} onChange={e => update('type', e.target.value)}>
                  <option value="video">🎬 مقطع فيديو</option>
                  <option value="pdf">📄 ملف PDF / ملزمة</option>
                  <option value="image">🖼️ صورة</option>
                  <option value="link">🔗 رابط خارجي</option>
                  <option value="file">📁 ملف عام مرفوع</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 text-gray-400">عنوان الدرس *</label>
                <input
                  className="input-base w-full"
                  placeholder="مثال: الدرس الأول - مقدمة في الجبر"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Subject + Grade + Sequence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1 text-gray-400">المادة الدراسية *</label>
                <input
                  className="input-base w-full"
                  placeholder="مثال: الرياضيات"
                  value={form.subject}
                  onChange={e => update('subject', e.target.value)}
                  list="subjects-list"
                />
                <datalist id="subjects-list">
                  {knownSubjects.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">الفئات المستهدفة (المجموعات)</label>
                <Select
                  isMulti
                  options={groupOptions}
                  value={groupOptions.filter(opt => form.targetGroups?.includes(opt.value))}
                  onChange={(sel: any) => update('targetGroups', sel.map((s: any) => s.value))}
                  placeholder="جميع المجموعات..."
                  styles={customSelectStyles}
                  noOptionsMessage={() => 'لا يوجد مجموعات'}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">رقم الدرس (الترتيب)</label>
                <input
                  type="number"
                  className="input-base w-full"
                  min="1"
                  value={form.sequence}
                  onChange={e => update('sequence', Number(e.target.value))}
                />
              </div>
            </div>

            {/* Row 3: Main URL or File Upload */}
            <div>
              <label className="block text-sm mb-1 text-gray-400">
                {['file', 'pdf', 'image', 'video'].includes(form.type || '') ? '📁 رفع الملف (أو ضع رابط مباشر أدناه)' : '🔗 الرابط الأساسي'}
              </label>
              {['file', 'pdf', 'image', 'video'].includes(form.type || '') ? (
                <div className="space-y-3">
                  <GlobalFileUpload
                      accept="application/pdf,image/jpeg,image/png,video/mp4,video/quicktime"
                      isUploading={uploadingFile}
                      uploadProgress={uploadProgress}
                      currentFile={form.uploadFile || undefined}
                      label={form.uploadFile ? form.uploadFile.name : (form.fileUrl ? 'ملف محفوظ - اختر ملف جديد' : 'اختر ملفاً للرفع')}
                      onChange={async (e) => {
                        const fileRaw = e.target.files?.[0];
                        if (!fileRaw) return;

                        // 1. Format Validation
                        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
                        if (!allowedTypes.includes(fileRaw.type) && !fileRaw.name.toLowerCase().endsWith('.pdf')) {
                          showToast('نوع الملف غير مدعوم. يرجى رفع ملفات PDF، صور، أو فيديوهات فقط.');
                          e.target.value = '';
                          return;
                        }

                        // 2. Check if PDF > 10MB - Show compression modal
                        const TEN_MB = 10 * 1024 * 1024;
                        const isPdf = fileRaw.type === 'application/pdf' || fileRaw.name.toLowerCase().endsWith('.pdf');
                        
                        if (isPdf && fileRaw.size > TEN_MB) {
                          // Show compression modal
                          setCompressionModal({
                            isOpen: true,
                            file: fileRaw,
                            onComplete: async (compressedBlob, cloudinaryUrl, stats) => {
                              try {
                                const path = `materials/${Date.now()}_${fileRaw.name}`;
                                
                                // Dispatch event to update the UI
                                window.dispatchEvent(new CustomEvent('fileUploaded', {
                                  detail: { 
                                    url: cloudinaryUrl, 
                                    path, 
                                    fileName: fileRaw.name,
                                    stats
                                  }
                                }));

                                update('uploadFile', new File([compressedBlob], fileRaw.name, { type: 'application/pdf' }));
                                setCompressionModal({ isOpen: false, file: null });
                              } catch (err: any) {
                                console.error('Handoff Error:', err);
                                showToast('حدث خطأ أثناء استلام الملف المضغوط');
                              }
                            }
                          });
                          e.target.value = '';
                          return;
                        }

                        try {
                          // Queue the file for background processing and upload
                          const path = `materials/${Date.now()}_${fileRaw.name}`;
                          await FileProcessor.queueFile(fileRaw, path);
                          showToast('بدأت عملية معالجة الملف في الخلفية. يمكنك متابعة التقدم في مركز المعالجة بالأسفل.');
                          
                          // We don't wait for completion here, the listener will handle it
                          update('uploadFile', fileRaw); // Just for local UI name display
                        } catch (err: any) {
                          console.error('Queue Error:', err);
                          showToast(err.message || 'فشل إضافة الملف لمركز المعالجة.');
                        }
                      }}
                  />
                  
                  {form.fileUrl && !uploadingFile && (
                    <p className="text-xs text-green-400 px-1 flex items-center gap-1">
                      <span>✅</span>
                      <span>تم رفع الملف بنجاح</span>
                      <a href={form.fileUrl} target="_blank" rel="noreferrer" className="text-gold hover:underline mr-1">(عرض الملف)</a>
                    </p>
                  )}


                  <div className="text-xs text-gray-500 px-1">أو يمكنك وضع رابط مباشر لملف خارجي هنا:</div>
                  <input
                    type="url"
                    className="input-base w-full text-sm"
                    dir="ltr"
                    placeholder="https://..."
                    value={form.url}
                    onChange={e => update('url', e.target.value)}
                  />
                </div>
              ) : (
                <input
                  type="url"
                  className="input-base w-full"
                  dir="ltr"
                  placeholder="https://..."
                  value={form.url}
                  onChange={e => update('url', e.target.value)}
                />
              )}
            </div>

            {/* Additional Links */}
            <div className="card-base p-4 bg-white/3 border-white/5">
              <label className="block text-sm mb-2 font-medium text-gray-300">🔗 روابط إضافية (اختياري)</label>
              {(form.additionalLinks || []).map((link: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2 bg-white/5 p-2 rounded-lg">
                  <LinkIcon size={13} className="text-gold flex-shrink-0" />
                  <span className="text-sm flex-1 truncate">{link.label || link.url}</span>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex-shrink-0">فتح</a>
                  <button onClick={() => removeLink(i)} className="text-red-400 hover:text-red-300 flex-shrink-0"><X size={14} /></button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  className="input-base text-sm flex-1"
                  placeholder="وصف الرابط (مثال: ملف PDF التمارين)"
                  value={form.newLinkLabel}
                  onChange={e => update('newLinkLabel', e.target.value)}
                />
                <input
                  className="input-base text-sm flex-1"
                  dir="ltr"
                  placeholder="https://..."
                  value={form.newLinkUrl}
                  onChange={e => update('newLinkUrl', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLink()}
                />
                <button onClick={addLink} className="btn-outline px-3 flex-shrink-0">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Linked Exam + Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1 text-gray-400 flex items-center gap-1">
                  <BookOpen size={13} className="text-gold" /> ربط اختبار بهذا الدرس
                </label>
                <select
                  className="input-base w-full"
                  value={form.linkedExamId || ''}
                  onChange={e => update('linkedExamId', e.target.value)}
                >
                  {examOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400 flex items-center gap-1">
                  <ClipboardList size={13} className="text-gold" /> ربط واجب بهذا الدرس
                </label>
                <select
                  className="input-base w-full"
                  value={form.linkedAssignmentId || ''}
                  onChange={e => update('linkedAssignmentId', e.target.value)}
                >
                  {assignmentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Access Control */}
            <div className="card-base p-4 bg-white/3 border-white/5">
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" className="w-4 h-4 rounded accent-green-500"
                    checked={form.isFree}
                    onChange={e => update('isFree', e.target.checked)}
                  />
                  <span className={form.isFree ? 'text-green-400' : 'text-gray-400'}>
                    🌍 محتوى مجاني (متاح لجميع الطلاب)
                  </span>
                </label>
                {!form.isFree && <span className="text-xs text-gold flex items-center gap-1"><Lock size={12} /> للمشتركين فقط</span>}
              </div>
              {!form.isFree && (
                <div>
                  <label className="block text-sm mb-1 text-gray-400">طلاب استثنائيون (وصول مجاني خاص لهم)</label>
                  <Select
                    isMulti
                    options={studentOptions}
                    value={studentOptions.filter(opt => form.exceptionalStudents?.includes(opt.value))}
                    onChange={(sel: any) => update('exceptionalStudents', sel.map((s: any) => s.value))}
                    placeholder="ابحث عن طالب..."
                    styles={customSelectStyles}
                    noOptionsMessage={() => 'لا يوجد طلاب'}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => { setShowAddForm(false); setForm({ ...EMPTY_FORM }); }} className="btn-outline px-6">إلغاء</button>
            {queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('materials/')) && (
              <p className="text-xs text-orange-400 self-center">⏳ جاري معالجة الملف في الخلفية...</p>
            )}
            <button
              disabled={loading || queue.some(f => f.status !== 'completed' && f.status !== 'failed' && f.path.startsWith('materials/'))}
              onClick={handleSave}
              className="btn-gold px-6 disabled:opacity-60"
            >
              {loading ? '⏳ جاري الحفظ...' : (editingId ? '✅ حفظ التعديلات' : '✅ نشر الدرس')}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 opacity-50" />
        <input
          type="text"
          placeholder="ابحث في الدروس والمواد..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base has-icon-right text-sm w-full"
        />
      </div>

      {/* Materials grouped by subject */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card-base p-14 text-center">
          <BookMarked size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-gray-400 mb-4">{search ? 'لا توجد نتائج للبحث' : 'لا توجد مواد تعليمية مضافة حالياً.'}</p>
          {!search && (
            <button onClick={() => openAdd()} className="btn-gold">
              <PlusCircle size={16} /> أضف أول درس
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b, 'ar'))
            .map(([subject, mats]) => {
              const isExpanded = expandedSubjects.has(subject);
              const sortedMats = [...mats].sort((a, b) => a.sequence - b.sequence);
              return (
                <div key={subject} className="card-base overflow-hidden border border-white/5">
                  {/* Subject Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.04)', borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                    onClick={() => toggleSubject(subject)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,var(--gold),var(--accent))' }}>
                        <BookMarked size={17} color="#000" />
                      </div>
                      <div>
                        <div className="font-cairo font-bold">{subject}</div>
                        <div className="text-xs text-gray-400">{mats.length} درس</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); openAdd(subject); }}
                        className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                        title="إضافة درس لهذه المادة"
                      >
                        <Plus size={13} /> درس جديد
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="opacity-50" /> : <ChevronDown size={16} className="opacity-50" />}
                    </div>
                  </div>

                  {/* Lessons List */}
                  {isExpanded && (
                    <div className="divide-y divide-white/5">
                      {sortedMats.map(material => {
                        const linkedExam = exams.find(e => e.id === material.linkedExamId);
                        const linkedAssignment = (assignments || []).find(a => a.id === material.linkedAssignmentId);
                        return (
                          <div key={material.id} className="p-4 hover:bg-white/3 transition-colors">
                            <div className="flex items-start gap-3">
                              {/* Sequence Badge */}
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: 'rgba(245,197,24,0.12)', color: 'var(--gold)' }}>
                                {material.sequence}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getIcon(material.type)}
                                  <span className="font-bold text-sm text-gray-100">{material.title}</span>
                                  {material.isFree
                                    ? <span className="badge badge-green text-[10px] py-0.5"><Globe size={9} /> مجاني</span>
                                    : <span className="badge badge-red text-[10px] py-0.5"><Lock size={9} /> مشتركون</span>
                                  }
                                  {material.targetGroups && material.targetGroups.length > 0 && (
                                    <span className="badge bg-blue-500/10 text-blue-400 text-[10px] py-0.5">
                                      {material.targetGroups.length} مجموعات
                                    </span>
                                  )}
                                </div>

                                {/* Links row */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {(material.url || material.fileUrl) && (
                                    <div className="flex gap-3">
                                      <button 
                                        onClick={() => openPreview(material.url || material.fileUrl || '', material.title)}
                                        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                                      >
                                        <Search size={10} /> معاينة
                                      </button>
                                      <a href={material.url || material.fileUrl} target="_blank" rel="noreferrer"
                                        className="text-xs text-gold hover:underline flex items-center gap-1">
                                        <LinkIcon size={10} /> الرابط الرئيسي
                                      </a>
                                    </div>
                                  )}
                                  {(material.additionalLinks || []).map((lnk: any, i: number) => (
                                    <a key={i} href={lnk.url} target="_blank" rel="noreferrer"
                                      className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                      <LinkIcon size={10} /> {lnk.label}
                                    </a>
                                  ))}
                                </div>

                                {/* Linked exam/assignment */}
                                {(linkedExam || linkedAssignment) && (
                                  <div className="flex gap-2 mt-1.5 flex-wrap">
                                    {linkedExam && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                                        style={{ background: 'rgba(245,197,24,0.1)', color: 'var(--gold)' }}>
                                        <BookOpen size={10} /> {linkedExam.title}
                                      </span>
                                    )}
                                    {linkedAssignment && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                                        style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                                        <ClipboardList size={10} /> {linkedAssignment.title}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => openEdit(material)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-500/20 text-blue-400/70 hover:text-blue-400 transition-colors">
                                  ✏️
                                </button>
                                <button onClick={() => handleDelete(material.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-500/70 hover:text-red-500 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {PreviewModal}

      {/* PDF Compression Modal */}
      {compressionModal.isOpen && compressionModal.file && (
        <PDFCompressionModal
          file={compressionModal.file}
          showSelection={true}
          onClose={() => setCompressionModal({ isOpen: false, file: null })}
          onComplete={(blob, url, stats) => {
            compressionModal.onComplete?.(blob, url, stats);
            setCompressionModal({ isOpen: false, file: null });
          }}
          onCancel={() => {
            setCompressionModal({ isOpen: false, file: null });
          }}
        />
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center opacity-50">جاري تحميل صفحة المناهج...</div>}>
      <CoursesPageContent />
    </Suspense>
  );
}
