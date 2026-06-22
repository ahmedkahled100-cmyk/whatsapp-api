'use client';
// src/app/admin/staff-settings/page.tsx
// لوحة تخصيص لوحات عمل المعلمين والمساعدين — إدارة السلايدر والأخبار

import { useState, useEffect } from 'react';
import { getStaffHomeSettings, updateStaffHomeSettings } from '@/lib/db/app-settings';
import type { AppHomeSettings, SliderItem } from '@/lib/db/app-settings';
import { showToast } from '@/lib/toast';
import { Smartphone, Image, Rss, Save, Trash2, Plus, Loader2, X } from 'lucide-react';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { uploadFileToStorage } from '@/lib/db';

const generateId = () => Math.random().toString(36).slice(2);

type ActiveSection = 'slider' | 'ticker';

export default function StaffSettingsPage() {
  const [settings, setSettings] = useState<AppHomeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('slider');

  useEffect(() => {
    getStaffHomeSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateStaffHomeSettings(settings);
      showToast('✅ تم حفظ إعدادات لوحات العمل بنجاح');
    } catch {
      showToast('❌ فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  /* ─── Slider helpers ─── */
  const addSlide = () => {
    const newSlide: SliderItem = { id: generateId(), imageUrl: '', videoUrl: '', title: '', link: '', order: settings.sliders.length };
    setSettings(s => s ? { ...s, sliders: [...s.sliders, newSlide] } : s);
  };

  const updateSlide = (id: string, patch: Partial<SliderItem>) => {
    setSettings(s => s ? { ...s, sliders: s.sliders.map(sl => sl.id === id ? { ...sl, ...patch } : sl) } : s);
  };

  const removeSlide = (id: string) => {
    setSettings(s => s ? { ...s, sliders: s.sliders.filter(sl => sl.id !== id) } : s);
  };

  const handleSlideImageUpload = async (file: File, slideId: string) => {
    const url = await uploadFileToStorage(file, `staff-sliders/${Date.now()}_${file.name}`);
    updateSlide(slideId, { imageUrl: url });
  };

  const handleSlideVideoUpload = async (file: File, slideId: string) => {
    const url = await uploadFileToStorage(file, `staff-sliders/videos/${Date.now()}_${file.name}`);
    updateSlide(slideId, { videoUrl: url });
  };

  const SECTIONS: { id: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { id: 'slider',     label: 'السلايدر',     icon: <Image size={16} /> },
    { id: 'ticker',     label: 'شريط الأخبار', icon: <Rss size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Smartphone size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-cairo font-black text-white">تخصيص لوحات العمل</h1>
            <p className="text-xs text-gray-500">تحكم كامل في واجهة المعلمين والمساعدين</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-gold bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ التغييرات
        </button>
      </div>

      {/* Section nav */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeSection === sec.id ? 'bg-purple-600 text-white' : 'card-base border border-white/10 text-gray-400 hover:border-purple-500/30'}`}>
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      {/* ─── Slider Section ─── */}
      {activeSection === 'slider' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2 text-white"><Image size={18} className="text-purple-400" /> إدارة السلايدر ({settings.sliders.length} شرائح)</h2>
            <button onClick={addSlide} className="btn-gold bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 text-sm flex items-center gap-2"><Plus size={16} /> إضافة شريحة</button>
          </div>

          {settings.sliders.map((slide, i) => (
            <div key={slide.id} className="card-base p-4 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-purple-400">الشريحة #{i + 1}</span>
                <button onClick={() => removeSlide(slide.id)} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs mb-1 opacity-70">صورة السلايد</label>
                    {slide.imageUrl ? (
                      <div className="relative">
                        <img loading="lazy" src={slide.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-white/10" />
                        <button onClick={() => updateSlide(slide.id, { imageUrl: '' })}
                          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-red-400">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <GlobalFileUpload accept="image/*"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) await handleSlideImageUpload(f, slide.id); }}
                        variant="normal" label="رفع صورة السلايد" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs mb-1 opacity-70">فيديو السلايد (اختياري)</label>
                    {slide.videoUrl ? (
                      <div className="relative">
                        <video src={slide.videoUrl} controls className="w-full h-32 object-cover rounded-xl border border-white/10" />
                        <button onClick={() => updateSlide(slide.id, { videoUrl: '' })}
                          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-red-400">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <GlobalFileUpload accept="video/*"
                        onChange={async e => { const f = e.target.files?.[0]; if (f) await handleSlideVideoUpload(f, slide.id); }}
                        variant="normal" label="رفع فيديو السلايد" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs mb-1 opacity-70">عنوان الصورة</label>
                    <input className="input-base w-full text-sm" value={slide.title || ''}
                      onChange={e => updateSlide(slide.id, { title: e.target.value })} placeholder="مثال: تحديثات المنصة" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 opacity-70">رابط الضغط (اختياري)</label>
                    <input className="input-base w-full text-sm" value={slide.link || ''}
                      onChange={e => updateSlide(slide.id, { link: e.target.value })} 
                      placeholder="https://..." />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Ticker Section ─── */}
      {activeSection === 'ticker' && (
        <div className="card-base p-6 border border-white/5 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2 text-white"><Rss size={18} className="text-purple-400" /> شريط الأخبار المتحرك</h2>
          <label className="block text-sm mb-1 opacity-70">نص شريط الأخبار</label>
          <textarea className="input-base w-full h-32 resize-none" value={settings.ticker}
            onChange={e => setSettings(s => s ? { ...s, ticker: e.target.value } : s)}
            placeholder="مثال: 🎓 نرجو من السادة المعلمين..." />
          <div className="p-3 rounded-xl overflow-hidden border border-purple-500/20 bg-purple-500/5">
            <p className="text-xs text-purple-400 mb-2">معاينة:</p>
            <div className="overflow-hidden">
              <div className="whitespace-nowrap text-sm text-gray-300 animate-none">{settings.ticker}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
