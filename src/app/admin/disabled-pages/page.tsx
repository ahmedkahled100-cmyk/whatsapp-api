'use client';

import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getDisabledPages, saveDisabledPages, DEFAULT_DISABLED_PAGES } from '@/lib/db';
import type { DisabledPageItem } from '@/types';
import {
  ShieldAlert, ShieldCheck, Search, Save, Plus, Trash2,
  RefreshCw, CheckCircle, AlertTriangle, Eye, X, Filter
} from 'lucide-react';
import { showToast } from '@/lib/toast';

export default function AdminDisabledPagesPage() {
  const user = useTeacherStore(state => state.user);
  const [pages, setPages] = useState<DisabledPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'teacher' | 'student' | 'assistant' | 'public' | 'custom'>('all');

  // Custom route modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newCategory, setNewCategory] = useState<'teacher' | 'student' | 'assistant' | 'public' | 'custom'>('teacher');
  const [newReason, setNewReason] = useState('');

  // Preview Modal state
  const [previewItem, setPreviewItem] = useState<DisabledPageItem | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const data = await getDisabledPages();
      setPages(data);
    } catch (err) {
      showToast('فشل تحميل قائمة الصفحات');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string, isDisabled: boolean) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, isDisabled, updatedAt: Date.now(), updatedBy: user?.name } : p));
  };

  const handleReasonChange = (id: string, reason: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, reason } : p));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await saveDisabledPages(pages);
      showToast('تم حفظ إعدادات التعطيل بنجاح');
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomPage = () => {
    if (!newTitle.trim() || !newPath.trim()) {
      showToast('يرجى كتابة اسم الصفحة والمسار بشكل صحيح');
      return;
    }

    const cleanPath = newPath.trim().startsWith('/') ? newPath.trim() : `/${newPath.trim()}`;
    const id = `custom_${Date.now()}`;
    const newItem: DisabledPageItem = {
      id,
      path: cleanPath,
      title: newTitle.trim(),
      category: newCategory,
      isDisabled: true,
      reason: newReason.trim() || 'الصفحة معطلة للتحديث والتطوير.',
      updatedAt: Date.now(),
      updatedBy: user?.name
    };

    setPages(prev => [newItem, ...prev]);
    setShowAddModal(false);
    setNewTitle('');
    setNewPath('');
    setNewReason('');
    showToast('تم إضافة الصفحة المخصصة بنجاح');
  };

  const handleDeletePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
    showToast('تم حذف المسار المخصص');
  };

  const filteredPages = pages.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const disabledCount = pages.filter(p => p.isDisabled).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1e1b4b] via-[#0f172a] to-[#1e293b] rounded-3xl p-6 sm:p-8 border border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
              <ShieldAlert size={14} /> نظام التحكم الصارم بصفحات المنصة
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              إدارة و<span className="text-amber-400">إيقاف صفحات المنصة</span> مؤقتاً
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl">
              تتيح لك هذه الصفحة تجميد أو تعطيل أي صفحة في المنصة مؤقتاً مع إدخال سبب الإيقاف الذي يظهر فوراً للمستخدمين لمنع الوصول إليها أثناء الصيانة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn-gold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-xl shadow-amber-500/20 transition-all hover:scale-105 disabled:opacity-50"
            >
              <Save size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديلات الحالية'}
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-bold px-4 py-3.5 rounded-2xl border border-indigo-500/30 flex items-center gap-2 text-xs transition-colors"
            >
              <Plus size={16} /> إضافة مسار مخصص
            </button>
          </div>
        </div>

        {/* Stats Counter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-black/20 rounded-2xl p-3.5 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-black">
              {pages.length}
            </div>
            <div>
              <p className="text-[10px] text-gray-400">إجمالي الصفحات المسجلة</p>
              <p className="text-xs font-bold text-white">صفحة في النظام</p>
            </div>
          </div>

          <div className="bg-black/20 rounded-2xl p-3.5 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black">
              {disabledCount}
            </div>
            <div>
              <p className="text-[10px] text-gray-400">الصفحات المعطلة حالياً</p>
              <p className="text-xs font-bold text-amber-400">{disabledCount > 0 ? `${disabledCount} صفحات موقوفة` : 'لا توجد صفحات معطلة'}</p>
            </div>
          </div>

          <div className="bg-black/20 rounded-2xl p-3.5 border border-white/5 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black">
              {pages.length - disabledCount}
            </div>
            <div>
              <p className="text-[10px] text-gray-400">الصفحات المتاحة والنشطة</p>
              <p className="text-xs font-bold text-emerald-400">تعمل بشكل طبيعي</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 custom-scrollbar text-xs">
          {[
            { id: 'all', label: 'جميع الصفحات' },
            { id: 'teacher', label: 'صفحات المعلم 👨‍🏫' },
            { id: 'student', label: 'صفحات الطالب 🎓' },
            { id: 'assistant', label: 'المساعدين 💼' },
            { id: 'public', label: 'الصفحات العامة 🌐' },
            { id: 'custom', label: 'مسارات مخصصة 🛠️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 border ${
                activeCategory === tab.id
                  ? 'bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-[#111827] text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="بحث عن صفحة أو مسار..."
            className="input-base has-icon-right w-full text-xs"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Pages List Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 text-sm">جاري تحميل إعدادات الصفحات...</div>
      ) : filteredPages.length === 0 ? (
        <div className="p-12 text-center bg-[#111827] rounded-3xl border border-white/5 text-gray-400 text-xs">
          لا توجد صفحات مطابقة للبحث أو التصنيف المختار.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPages.map(item => {
            return (
              <div
                key={item.id}
                className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between space-y-4 ${
                  item.isDisabled
                    ? 'bg-gradient-to-b from-amber-950/20 to-[#111827] border-amber-500/40 shadow-xl shadow-amber-500/5'
                    : 'bg-[#111827] border-white/5 hover:border-white/10'
                }`}
              >
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.isDisabled ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                      <h3 className="font-black text-sm text-white truncate">{item.title}</h3>
                    </div>
                    <code className="text-[11px] text-gray-400 bg-black/40 px-2 py-0.5 rounded-md inline-block dir-ltr">
                      {item.path}
                    </code>
                  </div>

                  {/* Switch Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewItem(item)}
                      title="معاينة شاشة التعطيل للمستخدمين"
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition"
                    >
                      <Eye size={16} />
                    </button>

                    {item.category === 'custom' && (
                      <button
                        onClick={() => handleDeletePage(item.id)}
                        title="حذف هذا المسار المخصص"
                        className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={item.isDisabled}
                        onChange={e => handleToggle(item.id, e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-bold px-2.5 py-1 rounded-lg border ${
                    item.isDisabled
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {item.isDisabled ? '⚠️ معطلة مؤقتاً' : '✅ متاحة وتعمل'}
                  </span>

                  <span className="text-gray-500 text-[10px]">
                    التصنيف: {item.category === 'teacher' ? 'المعلمين' : (item.category === 'student' ? 'الطلاب' : (item.category === 'assistant' ? 'المساعدين' : 'عام'))}
                  </span>
                </div>

                {/* Reason Input */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-gray-400 flex items-center justify-between">
                    <span>سبب الإيقاف (يظهر للمستخدم عند الدخول):</span>
                    {item.isDisabled && !item.reason && <span className="text-amber-400 text-[10px]">يرجى كتابة السبب!</span>}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: جاري إجراء الصيانة والتحديثات السنوية، وستكون الصفحة متاحة قريباً..."
                    className={`input-base w-full text-xs py-2 px-3 resize-none ${item.isDisabled ? 'border-amber-500/40 bg-amber-950/20' : ''}`}
                    value={item.reason || ''}
                    onChange={e => handleReasonChange(item.id, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Save Button at bottom */}
      <div className="sticky bottom-6 flex justify-end z-20">
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="btn-gold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black px-8 py-4 rounded-2xl flex items-center gap-3 shadow-2xl shadow-amber-500/30 transition-all hover:scale-105 disabled:opacity-50"
        >
          <Save size={20} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديلات الأخيرة 💾'}
        </button>
      </div>

      {/* Modal: Add Custom Route */}
      {showAddModal && (
        <div className="modal-overlay !z-[60]">
          <div className="modal-content modal-content-sm">
            <div className="modal-header">
              <h3 className="font-black text-lg text-amber-400 flex items-center gap-2">
                <Plus size={20} /> إضافة مسار صفحة مخصص
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="label-base">اسم الصفحة / الميزة بالعربية:</label>
                <input
                  type="text"
                  placeholder="مثال: صفحة البث المباشر"
                  className="input-base w-full"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="label-base">مسار الصفحة (URL Route Path):</label>
                <input
                  type="text"
                  placeholder="مثال: /teacher/live"
                  className="input-base w-full text-left dir-ltr"
                  value={newPath}
                  onChange={e => setNewPath(e.target.value)}
                />
              </div>

              <div>
                <label className="label-base">الفئة والتصنيف:</label>
                <select
                  className="input-base w-full"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                >
                  <option value="teacher">صفحات المعلمين (/teacher/...)</option>
                  <option value="student">صفحات الطلاب (/student/...)</option>
                  <option value="assistant">صفحات المساعدين (/assistant/...)</option>
                  <option value="public">الصفحات العامة</option>
                  <option value="custom">مسار مخصص آخر</option>
                </select>
              </div>

              <div>
                <label className="label-base">سبب الإيقاف البدائي:</label>
                <textarea
                  rows={2}
                  placeholder="سبب إيقاف الصفحة المعلن للمستخدمين..."
                  className="input-base w-full text-xs py-2 resize-none"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                />
              </div>

              <button
                onClick={handleAddCustomPage}
                className="w-full btn-gold bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-2xl shadow-lg mt-2"
              >
                تأكيد إضافة وتجميد المسار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Live Preview */}
      {previewItem && (
        <div className="modal-overlay !z-[70]">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h3 className="font-black text-sm text-gray-300 flex items-center gap-2">
                <Eye size={18} className="text-amber-400" /> معاينة شاشة التعطيل للمستخدمين ({previewItem.title})
              </h3>
              <button onClick={() => setPreviewItem(null)} className="text-gray-400 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body p-6 bg-[#0a0f1c]">
              <div className="bg-[#111827] border border-amber-500/30 rounded-3xl p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
                  <ShieldAlert size={36} className="text-amber-400" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">هذه الصفحة <span className="text-amber-400">معطلة مؤقتاً</span></h4>
                  <p className="text-xs text-gray-400 mt-1">تم إيقاف الوصول إلى ({previewItem.title}) بقرار من إدارة المنصة.</p>
                </div>

                <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-3.5 text-right space-y-1">
                  <div className="text-[11px] font-bold text-amber-400">💬 سبب الإيقاف من الإدارة:</div>
                  <p className="text-xs text-gray-200 bg-black/40 p-2.5 rounded-lg border border-white/5">
                    {previewItem.reason && previewItem.reason.trim() ? previewItem.reason : 'جاري إجراء صيانة وتحديثات دورية على هذه الصفحة.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
