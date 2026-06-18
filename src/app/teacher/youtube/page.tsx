'use client';

import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { saveMaterial, deleteMaterial, dispatchNotification } from '@/lib/db';
import { saveSettings } from '@/lib/db/supabase/settings';
import { showToast } from '@/lib/toast';
import {
  Youtube, Trash2, PlusCircle, Link as LinkIcon, Search, Globe, Lock, PlayCircle, Settings2, X
} from 'lucide-react';
import { CourseMaterial } from '@/types';
import Select from 'react-select';
import { YoutubeChannelCard } from '@/components/YoutubeChannelCard';

const customSelectStyles = {
  control: (base: any) => ({
    ...base,
    background: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    color: 'white',
    minHeight: '42px',
    boxShadow: 'none',
    '&:hover': { borderColor: 'rgba(255,0,0,0.3)' }
  }),
  menu: (base: any) => ({
    ...base,
    background: '#1a1a25',
    border: '1px solid rgba(255,255,255,0.1)',
    zIndex: 100,
  }),
  option: (base: any, state: any) => ({
    ...base,
    background: state.isFocused ? 'rgba(255,0,0,0.1)' : 'transparent',
    color: state.isFocused ? '#ff4444' : 'white',
    cursor: 'pointer'
  }),
  multiValue: (base: any) => ({
    ...base,
    background: 'rgba(255,0,0,0.2)',
    borderRadius: '4px',
  }),
  multiValueLabel: (base: any) => ({ ...base, color: '#ff4444' }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#ff4444',
    ':hover': { backgroundColor: 'rgba(255,0,0,0.3)', color: 'white' },
  }),
  singleValue: (base: any) => ({ ...base, color: 'white' }),
  input: (base: any) => ({ ...base, color: 'white' }),
  placeholder: (base: any) => ({ ...base, color: 'rgba(255,255,255,0.3)' }),
};

const EMPTY_FORM: Partial<CourseMaterial> = {
  type: 'youtube',
  title: '',
  url: '',
  subject: 'قناة اليوتيوب',
  targetGroups: [],
  sequence: 1,
  isFree: true,
  exceptionalStudents: [],
};

export default function YoutubePage() {
  const { materials, groups, students, settings, setSettings, user } = useTeacherStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  const [channelUrl, setChannelUrl] = useState(settings?.youtubeChannelUrl || '');
  const [savingSettings, setSavingSettings] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setChannelUrl(settings.youtubeChannelUrl || '');
    }
  }, [settings]);

  const groupOptions = groups.map(g => ({ value: g.id, label: g.name }));
  const studentOptions = students.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const youtubeMaterials = materials.filter(m => m.type === 'youtube');

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const openAdd = () => {
    const nextSeq = youtubeMaterials.length > 0 ? Math.max(...youtubeMaterials.map(m => m.sequence)) + 1 : 1;
    setForm({ ...EMPTY_FORM, sequence: nextSeq });
    setEditingId(null);
    setShowAddForm(true);
  };

  const openEdit = (m: CourseMaterial) => {
    setForm({ ...m });
    setEditingId(m.id);
    setShowAddForm(true);
  };

  const handleSaveChannel = async () => {
    if (!user?.id) return;
    setSavingSettings(true);
    try {
      const updatedSettings = { 
        ...(settings || { teacherId: user.id, acadName: 'أكاديمية', teacherName: 'معلم', primaryColor: '#ef4444' }), 
        youtubeChannelUrl: channelUrl 
      } as any;
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      showToast('✅ تم حفظ رابط القناة الرئيسي بنجاح');
    } catch (err) {
      showToast('❌ حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!form.title?.trim() || !form.url?.trim()) {
      showToast('يرجى إدخال عنوان الدرس ورابط اليوتيوب');
      return;
    }
    
    // Quick validation for YouTube URL
    if (!form.url.includes('youtube.com') && !form.url.includes('youtu.be')) {
       showToast('يرجى التأكد من إدخال رابط يوتيوب صحيح');
       return;
    }

    setLoading(true);
    const materialData: CourseMaterial = {
      id: editingId || crypto.randomUUID(),
      teacherId: user?.id || '',
      title: form.title!,
      type: 'youtube',
      url: form.url,
      grade: '',
      targetGroups: form.targetGroups || [],
      subject: form.subject || 'قناة اليوتيوب',
      sequence: Number(form.sequence) || 1,
      isFree: form.isFree || false,
      exceptionalStudents: form.exceptionalStudents || [],
      createdAt: editingId ? (form.createdAt || Date.now()) : Date.now(),
    };

    const previousMaterials = [...materials];
    if (editingId) {
      useTeacherStore.getState().setMaterials(previousMaterials.map(m => m.id === editingId ? materialData : m));
    } else {
      useTeacherStore.getState().setMaterials([...previousMaterials, materialData]);
    }

    try {
      await saveMaterial(materialData);
      
      if (!editingId && !materialData.isFree) {
        await dispatchNotification({
          teacherId: materialData.teacherId,
          msg: `تم إضافة فيديو جديد في القناة: ${materialData.title}`,
          targetRoles: ['student'],
          targetGroups: materialData.targetGroups && materialData.targetGroups.length > 0 ? materialData.targetGroups : undefined,
          actionPath: '/student',
          channels: { inApp: true, whatsapp: false }
        });
      }

      setShowAddForm(false);
      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      showToast('✅ تم حفظ الفيديو بنجاح');
    } catch (e) {
      useTeacherStore.getState().setMaterials(previousMaterials);
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الفيديو من القائمة؟')) return;
    const previousMaterials = [...materials];
    useTeacherStore.getState().setMaterials(previousMaterials.filter(m => m.id !== id));
    try { 
      await deleteMaterial(id); 
      showToast('✅ تم حذف الفيديو');
    } catch { 
      useTeacherStore.getState().setMaterials(previousMaterials);
      showToast('حدث خطأ أثناء الحذف'); 
    }
  };

  const filtered = youtubeMaterials.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.sequence - b.sequence);

  // Helper to extract Youtube video ID for thumbnail
  const getYoutubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
             <Youtube size={26} />
          </div>
          <div>
             <h1 className="text-2xl font-cairo font-black text-white">إدارة قناة اليوتيوب</h1>
             <p className="text-sm text-gray-400 mt-1">شارك مقاطعك ودروسك بشكل احترافي ومنظم</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(239,68,68,0.3)] border-0 flex items-center gap-2">
          <PlusCircle size={18} /> أضف فيديو جديد
        </button>
      </div>

      {/* Main Channel Link Setup */}
      <div className="card-base p-6 border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] -z-10 rounded-full" />
         <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2 text-red-400">
            <Settings2 size={18} /> الرابط الرئيسي لقناتك
         </h2>
         <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="url"
              className="input-base flex-1 focus:border-red-500/50 focus:ring-red-500/20"
              placeholder="مثال: https://www.youtube.com/@teacher-channel"
              dir="ltr"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
            />
            <button 
               onClick={handleSaveChannel}
               disabled={savingSettings || channelUrl === settings?.youtubeChannelUrl}
               className="btn-primary bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/40 disabled:opacity-50"
            >
               {savingSettings ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
         </div>
         <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <Globe size={12} /> سيظهر هذا الرابط للطلاب للدخول مباشرة على قناتك والاشتراك بها.
         </p>
         {settings?.youtubeChannelUrl && (
           <div className="mt-6 border-t border-white/5 pt-6">
              <YoutubeChannelCard url={settings.youtubeChannelUrl} />
           </div>
         )}
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <div className="card-base p-6 border border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.1)] animate-scale-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-800" />
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
              <Youtube size={20} className="text-red-500" /> {editingId ? 'تعديل بيانات الفيديو' : 'إضافة فيديو جديد للقائمة'}
            </h2>
            <button onClick={() => { setShowAddForm(false); setForm({ ...EMPTY_FORM }); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-400">عنوان الدرس / الفيديو *</label>
                <input
                  className="input-base w-full focus:border-red-500/50 focus:ring-red-500/20"
                  placeholder="مثال: شرح الباب الأول - الجزء الأول"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">رابط الفيديو (YouTube) *</label>
                <input
                  type="url"
                  dir="ltr"
                  className="input-base w-full focus:border-red-500/50 focus:ring-red-500/20"
                  placeholder="https://youtu.be/..."
                  value={form.url}
                  onChange={e => update('url', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm mb-1 text-gray-400">ترتيب العرض</label>
                 <input
                   type="number"
                   className="input-base w-full focus:border-red-500/50 focus:ring-red-500/20"
                   min="1"
                   value={form.sequence}
                   onChange={e => update('sequence', Number(e.target.value))}
                 />
               </div>
               <div>
                 <label className="block text-sm mb-1 text-gray-400">تخصيص لمجموعات محددة (اختياري)</label>
                 <Select
                   isMulti
                   options={groupOptions}
                   value={groupOptions.filter(opt => form.targetGroups?.includes(opt.value))}
                   onChange={(sel: any) => update('targetGroups', sel.map((s: any) => s.value))}
                   placeholder="الكل يرى الفيديو..."
                   styles={customSelectStyles}
                   noOptionsMessage={() => 'لا يوجد مجموعات'}
                 />
               </div>
            </div>

            <div className="card-base p-4 bg-black/20 border-white/5">
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                  <input type="checkbox" className="w-4 h-4 rounded accent-red-500"
                    checked={form.isFree}
                    onChange={e => update('isFree', e.target.checked)}
                  />
                  <span className={form.isFree ? 'text-green-400' : 'text-gray-400'}>
                    🌍 فيديو مجاني (متاح لجميع الطلاب)
                  </span>
                </label>
                {!form.isFree && <span className="text-xs text-red-400 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20"><Lock size={12} /> للمشتركين فقط</span>}
              </div>
              {!form.isFree && (
                <div>
                  <label className="block text-sm mb-1 text-gray-400">سماح استثنائي للطلاب التاليين:</label>
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

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
            <button onClick={() => { setShowAddForm(false); setForm({ ...EMPTY_FORM }); }} className="btn-outline px-6 hover:bg-white/5">إلغاء</button>
            <button
              disabled={loading}
              onClick={handleSaveLesson}
              className="btn-primary bg-red-600 hover:bg-red-700 border-0 px-8 font-bold disabled:opacity-60"
            >
              {loading ? '⏳ جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'نشر الفيديو')}
            </button>
          </div>
        </div>
      )}

      {/* List / Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-4 text-red-500/50" />
        <input
          type="text"
          placeholder="ابحث في الدروس المضافة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-base text-sm w-full pl-4 pr-10 border-white/10 focus:border-red-500/30 focus:ring-red-500/10 bg-black/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-16 text-center border-dashed border-2 border-white/5 bg-black/10">
          <div className="w-20 h-20 bg-red-500/5 rounded-full flex items-center justify-center mx-auto mb-4">
             <Youtube size={32} className="text-red-500/30" />
          </div>
          <h3 className="text-lg font-bold text-gray-300 mb-2">لا يوجد مقاطع يوتيوب مضافة</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">قم بإضافة دروسك من اليوتيوب لترتيبها وعرضها لطلابك بشكل احترافي ومباشر عبر المنصة.</p>
          <button onClick={openAdd} className="btn-primary bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 mx-auto flex items-center gap-2">
            <PlusCircle size={16} /> أضف أول فيديو
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(material => {
            const videoId = getYoutubeVideoId(material.url || '');
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

            return (
              <div key={material.id} className="card-base overflow-hidden group hover:border-red-500/30 transition-all hover:-translate-y-1 shadow-lg bg-black/20 flex flex-col">
                 {/* Thumbnail */}
                 <div className="w-full h-40 bg-black relative border-b border-white/5 flex-shrink-0">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt={material.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900">
                         <Youtube size={40} className="text-gray-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    
                    {/* Play Overlay */}
                    <a href={material.url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/40 backdrop-blur-sm">
                       <PlayCircle size={48} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                    </a>

                    {/* Sequence Badge */}
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center text-sm font-black shadow-lg">
                       {material.sequence}
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex gap-1">
                       {material.isFree ? (
                         <span className="bg-green-500/80 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1 shadow-lg">
                           <Globe size={10} /> مجاني
                         </span>
                       ) : (
                         <span className="bg-black/70 backdrop-blur-md text-red-400 border border-red-500/30 text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1 shadow-lg">
                           <Lock size={10} /> للمشتركين
                         </span>
                       )}
                    </div>
                 </div>

                 <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-100 mb-2 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors" title={material.title}>{material.title}</h3>
                    
                    {material.targetGroups && material.targetGroups.length > 0 && (
                      <div className="mb-3">
                         <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-full text-gray-400">
                           مخصص لـ {material.targetGroups.length} مجموعات
                         </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                       <a href={material.url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                         <LinkIcon size={12} /> فتح باليوتيوب
                       </a>
                       <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(material)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 flex items-center justify-center transition-colors">
                             ✏️
                          </button>
                          <button onClick={() => handleDelete(material.id)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors">
                             <Trash2 size={14} />
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
