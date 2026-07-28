'use client';

import { useState, useEffect } from 'react';
import { 
  getPromoCodes, savePromoCode, deletePromoCode, generateRandomPromoCode 
} from '@/lib/db';
import type { PromoCode } from '@/types';
import { showToast } from '@/lib/toast';
import { 
  Ticket, Plus, Copy, Trash2, CheckCircle, XCircle, RefreshCw, 
  Sparkles, Tag, ShieldCheck, Users, Calendar, Percent, DollarSign, Search, Power
} from 'lucide-react';

export default function AdminPromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: string;
    maxUses: string;
    targetRole: 'all' | 'teacher' | 'student' | 'assistant';
    expiryDate: string;
    isActive: boolean;
  }>({
    code: '',
    discountType: 'percentage',
    discountValue: '20',
    maxUses: '0',
    targetRole: 'all',
    expiryDate: '',
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPromoCodes();
      setPromoCodes(data);
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء تحميل رموز الخصم', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingCode(null);
    setFormData({
      code: generateRandomPromoCode('AN'),
      discountType: 'percentage',
      discountValue: '20',
      maxUses: '0',
      targetRole: 'all',
      expiryDate: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (promo: PromoCode) => {
    setEditingCode(promo);
    setFormData({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      maxUses: promo.maxUses.toString(),
      targetRole: promo.targetRole || 'all',
      expiryDate: promo.expiryDate ? new Date(promo.expiryDate).toISOString().split('T')[0] : '',
      isActive: promo.isActive,
    });
    setShowModal(true);
  };

  const handleGenerateRandom = () => {
    const randomCode = generateRandomPromoCode('AN');
    setFormData(prev => ({ ...prev, code: randomCode }));
    showToast('✨ تم توليد رمز عشوائي جديد');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      showToast('يرجى إدخال رمز الخصم', 'error');
      return;
    }
    const val = Number(formData.discountValue);
    if (isNaN(val) || val <= 0) {
      showToast('يرجى إدخال قيمة خصم صالحة', 'error');
      return;
    }
    if (formData.discountType === 'percentage' && val > 100) {
      showToast('نسبة الخصم لا يمكن أن تتجاوز 100%', 'error');
      return;
    }

    setSaving(true);
    try {
      await savePromoCode({
        id: editingCode?.id,
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        discountValue: val,
        maxUses: Number(formData.maxUses) || 0,
        usedCount: editingCode ? editingCode.usedCount : 0,
        targetRole: formData.targetRole,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate).getTime() : null,
        isActive: formData.isActive,
        createdAt: editingCode ? editingCode.createdAt : Date.now(),
      });

      showToast(editingCode ? '✅ تم تحديث رمز الخصم بنجاح' : '🎉 تم إنشاء رمز الخصم بنجاح');
      setShowModal(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'فشل حفظ رمز الخصم', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: PromoCode) => {
    try {
      await savePromoCode({ ...promo, isActive: !promo.isActive });
      showToast(promo.isActive ? '⏸️ تم إيقاف رمز الخصم' : '▶️ تم تفعيل رمز الخصم');
      loadData();
    } catch (e) {
      showToast('فشل تعديل حالة رمز الخصم', 'error');
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`هل أنت متأكد من حذف رمز الخصم "${code}"؟`)) return;
    try {
      await deletePromoCode(id);
      showToast('🗑️ تم حذف رمز الخصم');
      loadData();
    } catch (e) {
      showToast('فشل حذف الرمز', 'error');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast('📋 تم نسخ الرمز إلى الحافظة');
  };

  // Filtered Codes
  const filteredCodes = promoCodes.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.targetRole?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCodesCount = promoCodes.length;
  const activeCodesCount = promoCodes.filter(c => c.isActive).length;
  const totalUsesCount = promoCodes.reduce((acc, curr) => acc + (curr.usedCount || 0), 0);

  const roleLabels: Record<string, { label: string; bg: string }> = {
    all: { label: 'الجميع 🌐', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    teacher: { label: 'المعلمين 👨‍🏫', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    student: { label: 'الطلاب 👨‍🎓', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    assistant: { label: 'المساعدين 💼', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="card-base p-6 sm:p-8 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-transparent border-amber-500/20 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Ticket size={24} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-cairo text-white">إدارة رموز الخصم والدعوة</h1>
            </div>
            <p className="text-xs sm:text-sm text-text-muted">
              إنشاء رموز خصم ودعوة مخصصة، تحديد نسبة أو مبلغ الخصم، وتحديد عدد مرات الاستخدام والفئات المستهدفة.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="btn-gold flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/10 transition-all hover:scale-105 active:scale-95"
          >
            <Plus size={18} />
            <span>إنشاء رمز خصم جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-base p-5 rounded-2xl flex items-center gap-4 border-white/5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Tag size={22} />
          </div>
          <div>
            <span className="text-xs text-text-muted block">إجمالي الرموز</span>
            <span className="text-2xl font-black text-white">{totalCodesCount}</span>
          </div>
        </div>

        <div className="card-base p-5 rounded-2xl flex items-center gap-4 border-white/5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle size={22} />
          </div>
          <div>
            <span className="text-xs text-text-muted block">الرموز النشطة</span>
            <span className="text-2xl font-black text-white">{activeCodesCount}</span>
          </div>
        </div>

        <div className="card-base p-5 rounded-2xl flex items-center gap-4 border-white/5">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Users size={22} />
          </div>
          <div>
            <span className="text-xs text-text-muted block">إجمالي مرات الاستخدام</span>
            <span className="text-2xl font-black text-white">{totalUsesCount}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card-base p-4 rounded-2xl flex items-center gap-3 border-white/5">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          placeholder="ابحث برمز الخصم أو الفئة المستهدفة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-gray-500"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-gray-400 hover:text-white">
            مسح
          </button>
        )}
      </div>

      {/* Table Section */}
      <div className="card-base p-6 rounded-3xl space-y-4 border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-cairo flex items-center gap-2">
            <span>قائمة رموز الخصم والدعوة</span>
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              {filteredCodes.length} رمز
            </span>
          </h2>

          <button onClick={loadData} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-muted">جاري تحميل رموز الخصم والدعوة...</div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-white/[0.02] rounded-2xl border border-white/5">
            <Ticket size={40} className="mx-auto text-gray-600" />
            <p className="text-sm text-text-muted">لا توجد رموز خصم حالية matching البحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-white/10 text-text-muted text-xs font-semibold">
                  <th className="py-3 px-4">رمز الخصم</th>
                  <th className="py-3 px-4">نوع وقيمة الخصم</th>
                  <th className="py-3 px-4">الفئة المستهدفة</th>
                  <th className="py-3 px-4">مرات الاستخدام</th>
                  <th className="py-3 px-4">تاريخ الانتهاء</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCodes.map((promo) => {
                  const isExpired = promo.expiryDate && promo.expiryDate < Date.now();
                  const roleBadge = roleLabels[promo.targetRole || 'all'] || roleLabels.all;
                  const isLimitReached = promo.maxUses > 0 && promo.usedCount >= promo.maxUses;

                  return (
                    <tr key={promo.id} className="hover:bg-white/[0.02] transition">
                      {/* Code + Copy */}
                      <td className="py-4 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1 rounded-xl text-sm tracking-wider">
                            {promo.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(promo.code)}
                            title="نسخ الرمز"
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>

                      {/* Discount Value */}
                      <td className="py-4 px-4 font-semibold text-emerald-400">
                        {promo.discountType === 'percentage' ? (
                          <span className="flex items-center gap-1">
                            <span>خصم {promo.discountValue}%</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span>خصم {promo.discountValue.toLocaleString('ar-EG')} ج.م</span>
                          </span>
                        )}
                      </td>

                      {/* Target Role */}
                      <td className="py-4 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-xl border ${roleBadge.bg}`}>
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-4 text-gray-300">
                        <div className="space-y-1">
                          <span className="font-semibold text-xs">
                            {promo.usedCount} {promo.maxUses > 0 ? `/ ${promo.maxUses}` : '(غير محدود)'}
                          </span>
                          {isLimitReached && (
                            <span className="block text-[10px] text-red-400 font-bold">مكتمل</span>
                          )}
                        </div>
                      </td>

                      {/* Expiry */}
                      <td className="py-4 px-4 text-xs text-gray-400">
                        {promo.expiryDate ? (
                          <span className={isExpired ? 'text-red-400 font-bold' : ''}>
                            {new Date(promo.expiryDate).toLocaleDateString('ar-EG')}
                            {isExpired && ' (منتهي)'}
                          </span>
                        ) : (
                          <span className="text-gray-500">دائم</span>
                        )}
                      </td>

                      {/* Active Toggle Status */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleActive(promo)}
                          className={`text-xs font-bold px-3 py-1 rounded-xl border transition flex items-center gap-1.5 ${
                            promo.isActive && !isExpired && !isLimitReached
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          <Power size={12} />
                          <span>{promo.isActive ? 'مفعل' : 'معطل'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(promo)}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition"
                            title="تعديل الرمز"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(promo.id, promo.code)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition"
                            title="حذف الرمز"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Promo Code */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
          <div className="card-base max-w-lg w-full p-6 sm:p-8 rounded-3xl border-amber-500/20 bg-[#0f172a] space-y-6 relative shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-xl font-black font-cairo text-white flex items-center gap-2">
                <Ticket className="text-amber-400" size={20} />
                <span>{editingCode ? 'تعديل رمز الخصم' : 'إنشاء رمز خصم ودعوة جديد'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Code Input + Auto Generate Button */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 block">رمز الخصم (Promo Code)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="مثال: SUMMER2026"
                    className="input-field font-mono uppercase text-amber-300 tracking-wider font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRandom}
                    className="p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-2xl transition whitespace-nowrap flex items-center gap-1.5"
                    title="توليد كود عشوائي"
                  >
                    <Sparkles size={14} />
                    <span>توليد تلقائي</span>
                  </button>
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 block">نوع الخصم</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                    className="input-field cursor-pointer"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 block">
                    قيمة الخصم {formData.discountType === 'percentage' ? '(%)' : '(ج.م)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.discountType === 'percentage' ? '100' : '100000'}
                    required
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    placeholder="أدخل القيمة"
                    className="input-field font-bold"
                  />
                </div>
              </div>

              {/* Target Role Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 block">الفئة المسموح لها بالاستخدام</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: 'الجميع' },
                    { id: 'teacher', label: 'المعلمين' },
                    { id: 'student', label: 'الطلاب' },
                    { id: 'assistant', label: 'المساعدين' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, targetRole: item.id as any })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                        formData.targetRole === item.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Usage Limit & Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 block">
                    الحد الأقصى للاستخدام (0 لغير المحدود)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    className="input-field"
                    placeholder="0 = غير محدود"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 block">تاريخ الانتهاء (اختياري)</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-sm font-bold text-gray-200 cursor-pointer">
                  تفعيل رمز الخصم فوراً
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-gold px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/10 flex items-center gap-2"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  <span>{editingCode ? 'حفظ التعديلات' : 'إنشاء الرمز'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
