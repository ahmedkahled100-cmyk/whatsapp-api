'use client';
// src/app/admin/app-settings/page.tsx
// لوحة تخصيص التطبيق — إدارة السلايدر والأقسام والأخبار

import { useState, useEffect } from 'react';
import { getAppHomeSettings, updateAppHomeSettings } from '@/lib/db/app-settings';
import type { AppHomeSettings, SliderItem, CategoryItem } from '@/lib/db/app-settings';
import { showToast } from '@/lib/toast';
import { Smartphone, Image, LayoutGrid, Rss, Save, Trash2, Plus, MoveUp, MoveDown, Eye, Loader2, Edit2, X, Check } from 'lucide-react';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { uploadFileToStorage } from '@/lib/db';

/* ─────────────────── helpers ─────────────────── */
const generateId = () => Math.random().toString(36).slice(2);

const ICON_OPTIONS = [
  '📋','📚','📝','✅','💬','📊','🎓','⭐','🔬','📐','💡','🎯',
  '🏆','📖','🖊️','📌','🔑','🎪','🎨','💎','🚀','⚡','🌟','🎁',
];

type ActiveSection = 'slider' | 'ticker' | 'categories' | 'general';

export default function AppSettingsPage() {
  const [settings, setSettings] = useState<AppHomeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('general');
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);

  useEffect(() => {
    getAppHomeSettings().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateAppHomeSettings(settings);
      showToast('✅ تم حفظ إعدادات التطبيق بنجاح');
    } catch {
      showToast('❌ فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="text-gold animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  /* ─── Slider helpers ─── */
  const addSlide = () => {
    const newSlide: SliderItem = { id: generateId(), imageUrl: '', title: '', link: '', order: settings.sliders.length };
    setSettings(s => s ? { ...s, sliders: [...s.sliders, newSlide] } : s);
  };

  const updateSlide = (id: string, patch: Partial<SliderItem>) => {
    setSettings(s => s ? { ...s, sliders: s.sliders.map(sl => sl.id === id ? { ...sl, ...patch } : sl) } : s);
  };

  const removeSlide = (id: string) => {
    setSettings(s => s ? { ...s, sliders: s.sliders.filter(sl => sl.id !== id) } : s);
  };

  const handleSlideImageUpload = async (file: File, slideId: string) => {
    const url = await uploadFileToStorage(file, `app-sliders/${Date.now()}_${file.name}`);
    updateSlide(slideId, { imageUrl: url });
  };

  /* ─── Category helpers ─── */
  const addCategory = () => {
    const newCat: CategoryItem = {
      id: generateId(), title: 'قسم جديد', icon: '📋',
      color: '#f5c518', targetTab: 'exams', order: settings.categories.length,
    };
    setSettings(s => s ? { ...s, categories: [...s.categories, newCat] } : s);
    setEditingCat(newCat);
  };

  const updateCategory = (cat: CategoryItem) => {
    setSettings(s => s ? { ...s, categories: s.categories.map(c => c.id === cat.id ? cat : c) } : s);
    setEditingCat(null);
  };

  const removeCategory = (id: string) => {
    setSettings(s => s ? { ...s, categories: s.categories.filter(c => c.id !== id) } : s);
  };

  const moveCat = (id: string, dir: -1 | 1) => {
    setSettings(s => {
      if (!s) return s;
      const cats = [...s.categories].sort((a, b) => a.order - b.order);
      const idx = cats.findIndex(c => c.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= cats.length) return s;
      [cats[idx].order, cats[newIdx].order] = [cats[newIdx].order, cats[idx].order];
      return { ...s, categories: cats };
    });
  };

  const COLOR_OPTIONS = ['#f5c518','#3b82f6','#8b5cf6','#10b981','#ec4899','#f97316','#ef4444','#06b6d4'];

  const SECTIONS: { id: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { id: 'general',    label: 'عام',          icon: <Smartphone size={16} /> },
    { id: 'slider',     label: 'السلايدر',     icon: <Image size={16} /> },
    { id: 'ticker',     label: 'شريط الأخبار', icon: <Rss size={16} /> },
    { id: 'categories', label: 'الأقسام',      icon: <LayoutGrid size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20">
            <Smartphone size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-cairo font-black gold-text">تخصيص التطبيق</h1>
            <p className="text-xs text-gray-500">تحكم كامل في واجهة تطبيق الطلاب</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-gold flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ التغييرات
        </button>
      </div>

      {/* Section nav */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(sec => (
          <button key={sec.id} onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeSection === sec.id ? 'bg-gold text-black' : 'card-base border border-white/10 text-gray-400 hover:border-gold/30'}`}>
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      {/* ─── General Section ─── */}
      {activeSection === 'general' && (
        <div className="card-base p-6 space-y-4 border border-white/5">
          <h2 className="font-bold text-lg flex items-center gap-2"><Smartphone size={18} className="text-gold" /> الإعدادات العامة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 opacity-70">اسم التطبيق</label>
              <input className="input-base w-full" value={settings.appName}
                onChange={e => setSettings(s => s ? { ...s, appName: e.target.value } : s)} />
            </div>
            <div>
              <label className="block text-sm mb-1 opacity-70">رسالة الترحيب</label>
              <input className="input-base w-full" value={settings.welcomeMessage || ''}
                onChange={e => setSettings(s => s ? { ...s, welcomeMessage: e.target.value } : s)} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <input type="checkbox" id="dailyReward" checked={settings.showDailyReward}
              onChange={e => setSettings(s => s ? { ...s, showDailyReward: e.target.checked } : s)}
              className="w-4 h-4" />
            <label htmlFor="dailyReward" className="text-sm font-bold cursor-pointer">إظهار بانر المكافأة اليومية</label>
          </div>
          {settings.showDailyReward && (
            <div>
              <label className="block text-sm mb-1 opacity-70">نص المكافأة اليومية</label>
              <input className="input-base w-full" value={settings.dailyRewardText || ''}
                onChange={e => setSettings(s => s ? { ...s, dailyRewardText: e.target.value } : s)} />
            </div>
          )}
        </div>
      )}

      {/* ─── Slider Section ─── */}
      {activeSection === 'slider' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2"><Image size={18} className="text-gold" /> إدارة السلايدر ({settings.sliders.length} صور)</h2>
            <button onClick={addSlide} className="btn-gold text-sm flex items-center gap-2"><Plus size={16} /> إضافة صورة</button>
          </div>

          {settings.sliders.map((slide, i) => (
            <div key={slide.id} className="card-base p-4 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gold">الصورة #{i + 1}</span>
                <button onClick={() => removeSlide(slide.id)} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs mb-1 opacity-70">عنوان الصورة</label>
                    <input className="input-base w-full text-sm" value={slide.title || ''}
                      onChange={e => updateSlide(slide.id, { title: e.target.value })} placeholder="مثال: كورسات الصيف" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 opacity-70">رابط الضغط (اختياري)</label>
                    <input className="input-base w-full text-sm" value={slide.link || ''}
                      onChange={e => updateSlide(slide.id, { link: e.target.value })} 
                      onBlur={async (e) => {
                        const val = e.target.value;
                        if (!val) return; // Allow updating if they changed the link
                        
                        if (val.includes('youtube.com') || val.includes('youtu.be')) {
                          const videoIdMatch = val.match(/(?:v=|youtu\.be\/)([^&]+)/);
                          if (videoIdMatch && videoIdMatch[1]) {
                            updateSlide(slide.id, { imageUrl: `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg` });
                            return;
                          }
                          
                          try {
                            const res = await fetch(`/api/youtube?url=${encodeURIComponent(val)}`);
                            if (res.ok) {
                              const data = await res.json();
                              const highResAvatar = data.avatar ? data.avatar.replace(/=s\d+-c-/, '=s1080-c-').replace(/=s\d+-c$/, '=s1080-c') : undefined;
                              updateSlide(slide.id, { 
                                imageUrl: data.banner || highResAvatar || slide.imageUrl,
                                youtubeData: {
                                  banner: data.banner,
                                  avatar: highResAvatar,
                                  title: data.title,
                                  subs: data.subs
                                }
                              });
                            }
                          } catch (err) {
                            console.error('Failed to fetch channel data', err);
                          }
                        }
                      }}
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
          <h2 className="font-bold text-lg flex items-center gap-2"><Rss size={18} className="text-gold" /> شريط الأخبار المتحرك</h2>
          <label className="block text-sm mb-1 opacity-70">نص شريط الأخبار</label>
          <textarea className="input-base w-full h-32 resize-none" value={settings.ticker}
            onChange={e => setSettings(s => s ? { ...s, ticker: e.target.value } : s)}
            placeholder="مثال: 🎓 مرحباً بكم في AN Academy..." />
          <div className="p-3 rounded-xl overflow-hidden border border-gold/20 bg-gold/5">
            <p className="text-xs text-gold mb-2">معاينة:</p>
            <div className="overflow-hidden">
              <div className="whitespace-nowrap text-sm text-gray-300 animate-none">{settings.ticker}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Categories Section ─── */}
      {activeSection === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2"><LayoutGrid size={18} className="text-gold" /> إدارة الأقسام ({settings.categories.length})</h2>
            <button onClick={addCategory} className="btn-gold text-sm flex items-center gap-2"><Plus size={16} /> إضافة قسم</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...settings.categories].sort((a, b) => a.order - b.order).map((cat, i, arr) => (
              <div key={cat.id} className="card-base p-4 border border-white/5" style={{ borderLeftColor: cat.color, borderLeftWidth: '3px' }}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{cat.title}</div>
                    <div className="text-xs text-gray-500">{cat.targetTab}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveCat(cat.id, -1)} disabled={i === 0}
                      className="p-1 rounded hover:bg-white/5 disabled:opacity-30"><MoveUp size={14} /></button>
                    <button onClick={() => moveCat(cat.id, 1)} disabled={i === arr.length - 1}
                      className="p-1 rounded hover:bg-white/5 disabled:opacity-30"><MoveDown size={14} /></button>
                    <button onClick={() => setEditingCat(cat)}
                      className="p-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Edit2 size={14} /></button>
                    <button onClick={() => removeCategory(cat.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Edit Category Modal ─── */}
      {editingCat && (
        <div className="modal-overlay" >
          <div className="modal-content modal-content-sm border border-gold/30 p-6 space-y-4" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-xl font-bold font-cairo">تعديل القسم</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 opacity-70">الاسم</label>
                <input className="input-base w-full text-sm" value={editingCat.title}
                  onChange={e => setEditingCat(c => c ? { ...c, title: e.target.value } : c)} />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-70">التبويب المستهدف</label>
                <select className="input-base w-full text-sm" value={editingCat.targetTab}
                  onChange={e => setEditingCat(c => c ? { ...c, targetTab: e.target.value as any } : c)}>
                  <option value="exams">اختباراتي</option>
                  <option value="courses">الكورسات</option>
                  <option value="youtube">اليوتيوب</option>
                  <option value="assignments">الواجبات</option>
                  <option value="results">نتائجي</option>
                  <option value="messages">الرسائل</option>
                  <option value="games">الألعاب التعليمية</option>
                  <option value="link">رابط خارجي</option>
                </select>
              </div>
            </div>

            {editingCat.targetTab === 'link' && (
              <div>
                <label className="block text-xs mb-1 opacity-70">الرابط</label>
                <input className="input-base w-full text-sm" value={editingCat.link || ''}
                  onChange={e => setEditingCat(c => c ? { ...c, link: e.target.value } : c)} placeholder="https://..." />
              </div>
            )}

            <div>
              <label className="block text-xs mb-2 opacity-70">الأيقونة</label>
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_OPTIONS.map(icon => (
                  <button key={icon} onClick={() => setEditingCat(c => c ? { ...c, icon } : c)}
                    className={`text-xl p-1.5 rounded-xl transition-all ${editingCat.icon === icon ? 'bg-gold/20 border border-gold/40' : 'hover:bg-white/5'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs mb-2 opacity-70">اللون</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map(color => (
                  <button key={color} onClick={() => setEditingCat(c => c ? { ...c, color } : c)}
                    className="w-8 h-8 rounded-full border-2 transition-all"
                    style={{
                      background: color,
                      borderColor: editingCat.color === color ? '#fff' : 'transparent',
                      transform: editingCat.color === color ? 'scale(1.2)' : 'scale(1)',
                    }} />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingCat(null)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={() => updateCategory(editingCat)} className="btn-gold flex-1 flex items-center justify-center gap-2">
                <Check size={16} /> حفظ القسم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
