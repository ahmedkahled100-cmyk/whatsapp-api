'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllAssistantProfiles, saveAssistantProfile } from '@/lib/db';
import { AssistantProfile } from '@/types';
import { showToast } from '@/lib/toast';
import { 
  Users, Clock, X, Trash2, Check, FileText, Search, UserCheck, User, 
  Sparkles, Award, GraduationCap, Phone, Info, Loader2 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ASSISTANTS_PROFILES } from '@/lib/db/supabase/hr';

export default function AdminAssistantsPage() {
  const [assistants, setAssistants] = useState<AssistantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // New States for Assistant Details Modal
  const [viewingAssistant, setViewingAssistant] = useState<AssistantProfile | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [subStart, setSubStart] = useState('');
  const [subExpiry, setSubExpiry] = useState('');
  
  // Suspension action states
  const [showSuspensionPrompt, setShowSuspensionPrompt] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');

  const loadData = useCallback(async (showFullLoader = true) => {
    if (showFullLoader) setLoading(true);
    try {
      const data = await getAllAssistantProfiles();
      setAssistants(data);
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء تحميل بيانات المساعدين', 'error');
    } finally {
      if (showFullLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Filter assistant profiles
  const filteredAssistants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = assistants.filter(a => {
      if (activeTab === 'pending') return a.status === 'pending';
      return a.status === 'approved';
    });

    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.code || '').toLowerCase().includes(q) ||
        (a.roleTitle || '').toLowerCase().includes(q)
    );
  }, [assistants, searchQuery, activeTab]);

  const handleApprove = async (ast: AssistantProfile) => {
    if (!confirm(`هل توافق على تفعيل حساب المساعد "${ast.name}"؟`)) return;
    setSaving(true);
    try {
      await saveAssistantProfile({ ...ast, status: 'approved' });
      showToast('✅ تم تفعيل حساب المساعد بنجاح ومنحه الكود الموحد', 'success');
      void loadData(false);
    } catch (e) {
      showToast('فشل تفعيل الحساب', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectOrDelete = async (ast: AssistantProfile) => {
    const isPending = ast.status === 'pending';
    const confirmMsg = isPending
      ? `هل أنت متأكد من رفض وحذف طلب المساعد "${ast.name}"؟`
      : `هل أنت متأكد من حذف حساب المساعد "${ast.name}" نهائياً؟ سيتم إلغاء تعاقداته مع جميع المعلمين.`;

    if (!confirm(confirmMsg)) return;
    setSaving(true);
    try {
      if (!isPending) {
        // Delete all teacher contracts/links first
        await supabase.from('teacher_assistant_links').delete().eq('assistant_id', ast.id);
      }
      const { error } = await supabase.from(ASSISTANTS_PROFILES).delete().eq('id', ast.id);
      if (error) throw error;
      showToast('✅ تم حذف الطلب/الحساب بنجاح', 'success');
      
      if (viewingAssistant?.id === ast.id) {
        setViewingAssistant(null);
      }
      
      void loadData(false);
    } catch (e) {
      showToast('حدث خطأ أثناء الحذف', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCode = async () => {
    if (!viewingAssistant) return;
    if (!editedCode.trim()) {
      showToast('يرجى إدخال كود صحيح', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = { ...viewingAssistant, code: editedCode.trim() };
      await saveAssistantProfile(updated);
      showToast('✅ تم تحديث الكود الموحد للمساعد بنجاح', 'success');
      setViewingAssistant(updated);
      void loadData(false);
    } catch (e: any) {
      console.error(e);
      const msg = e.message || 'حدث خطأ أثناء تحديث الكود';
      showToast(msg, 'error');
      if (msg.includes('الكود') || msg.includes('DUPLICATE_CODE') || msg.includes('مسجل مسبقاً')) {
         setEditedCode(viewingAssistant.code || '');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!viewingAssistant) return;
    setSaving(true);
    try {
      const updated = {
        ...viewingAssistant,
        subStart: subStart ? new Date(subStart).getTime() : undefined,
        subExpiry: subExpiry ? new Date(subExpiry).getTime() : undefined,
      };
      
      // Auto-pause if expiry is in the past
      if (updated.subExpiry && updated.subExpiry < Date.now()) {
        updated.isPausedByAdmin = true;
      } else {
        updated.isPausedByAdmin = false;
      }

      await saveAssistantProfile(updated);
      showToast('✅ تم تحديث بيانات الاشتراك بنجاح', 'success');
      setViewingAssistant(updated);
      void loadData(false);
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء تحديث الاشتراك', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSuspension = async (ast: AssistantProfile) => {
    const willSuspend = !ast.isSuspended;
    
    if (willSuspend) {
      if (!suspensionReason.trim()) {
        showToast('يرجى ذكر سبب إيقاف الحساب لتنبيه المساعد', 'error');
        return;
      }
      setSaving(true);
      try {
        const updated = { 
          ...ast, 
          isSuspended: true, 
          suspensionReason: suspensionReason.trim() 
        };
        await saveAssistantProfile(updated);
        showToast('🔒 تم إيقاف وتجميد حساب المساعد بنجاح', 'success');
        setViewingAssistant(updated);
        setShowSuspensionPrompt(false);
        setSuspensionReason('');
        void loadData(false);
      } catch (e) {
        showToast('فشل إيقاف الحساب', 'error');
      } finally {
        setSaving(false);
      }
    } else {
      if (!confirm(`هل أنت متأكد من إعادة تفعيل حساب المساعد "${ast.name}"؟`)) return;
      setSaving(true);
      try {
        const updated = { 
          ...ast, 
          isSuspended: false, 
          suspensionReason: '' 
        };
        await saveAssistantProfile(updated);
        showToast('🔓 تم إعادة تفعيل وتنشيط الحساب بنجاح', 'success');
        setViewingAssistant(updated);
        void loadData(false);
      } catch (e) {
        showToast('فشل إعادة تفعيل الحساب', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 text-white" dir="rtl">
      <div>
        <h1 className="text-2xl font-black font-cairo gold-text mb-1 flex items-center gap-2">
          <Users className="text-amber-500" size={24} /> إدارة طلبات وحسابات المساعدين
        </h1>
        <p className="text-sm text-text-muted">مراجعة طلبات التسجيل، الاعتماد المهني، وإدارة حسابات المساعدين الموحدة</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-base p-4 flex items-center gap-3 bg-white/5 border border-white/5">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400"><Clock size={20} /></div>
          <div>
            <div className="text-xl font-black">{assistants.filter(a => a.status === 'pending').length}</div>
            <div className="text-xs text-text-muted">طلبات معلقة قيد المراجعة</div>
          </div>
        </div>
        <div className="card-base p-4 flex items-center gap-3 bg-white/5 border border-white/5">
          <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><UserCheck size={20} /></div>
          <div>
            <div className="text-xl font-black">{assistants.filter(a => a.status === 'approved').length}</div>
            <div className="text-xs text-text-muted">مساعدين معتمدين بالمنصة</div>
          </div>
        </div>
        <div className="card-base p-4 flex items-center gap-3 bg-white/5 border border-white/5">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Users size={20} /></div>
          <div>
            <div className="text-xl font-black">{assistants.length}</div>
            <div className="text-xs text-text-muted">إجمالي المساعدين المسجلين</div>
          </div>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 font-bold text-sm transition-all rounded-xl border flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/10'
                : 'border-white/5 text-text-muted hover:text-white'
            }`}
          >
            الطلبات المعلقة ({assistants.filter(a => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 font-bold text-sm transition-all rounded-xl border flex items-center gap-2 ${
              activeTab === 'approved'
                ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/10'
                : 'border-white/5 text-text-muted hover:text-white'
            }`}
          >
            المساعدون المعتمدون ({assistants.filter(a => a.status === 'approved').length})
          </button>
        </div>
        
        <div className="relative max-w-md w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="search" 
            placeholder="ابحث بالاسم، المسمى، الهاتف، الكود..." 
            className="input-base w-full pl-10 text-sm" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center">
            <Loader2 className="animate-spin text-amber-500 mx-auto" size={40} />
          </div>
        ) : filteredAssistants.length === 0 ? (
          <div className="col-span-full card-base p-16 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
            لا يوجد مساعدون في هذا القسم حالياً.
          </div>
        ) : (
          filteredAssistants.map((ast) => (
            <div 
              key={ast.id} 
              className={`card-base p-6 border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between h-full bg-gradient-to-b from-white/5 to-transparent relative group ${
                ast.status === 'pending' ? '!border-amber-500/20 bg-amber-500/5' : ''
              } ${ast.isSuspended ? '!border-red-500/30 bg-red-500/5' : ''}`}
            >
              {ast.status === 'pending' && (
                <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
              )}
              {(ast.isSuspended || ast.isPausedByAdmin) && (
                <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500" />
              )}

              <div>
                <div className="flex items-center gap-3 mb-4">
                  {ast.imageUrl ? (
                    <img loading="lazy" src={ast.imageUrl} alt={ast.name} className="w-14 h-14 rounded-2xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-lg font-black text-amber-400 border border-amber-500/20">
                      {ast.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors text-base truncate">{ast.name}</h3>
                      {ast.isSuspended && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">موقوف</span>
                      )}
                      {ast.isPausedByAdmin && !ast.isSuspended && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/20">اشتراك منتهي</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">@{ast.username}</p>
                  </div>
                </div>

                <div className="space-y-2 py-4 border-t border-white/5 text-xs text-text-muted">
                  <div className="flex justify-between">
                    <span>التخصص المختار:</span>
                    <span className="text-white font-bold">{ast.roleTitle || 'مساعد مادة'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الهاتف:</span>
                    <a href={`tel:${ast.phone}`} className="text-white font-mono font-bold hover:underline flex items-center gap-1">
                      <Phone size={12} /> {ast.phone}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span>طريقة الدفع المفضلة:</span>
                    <span className="text-white font-bold">
                      {ast.salaryPaymentMethod === 'hourly' ? 'بالساعة' :
                       ast.salaryPaymentMethod === 'percentage' ? 'نسبة مئوية' :
                       ast.salaryPaymentMethod === 'flexible' ? 'مرن / بالاتفاق' :
                       'راتب شهري ثابت'}
                    </span>
                  </div>
                  
                  {ast.status === 'approved' && (
                    <div className="flex justify-between items-center">
                      <span>الرمز الموحد:</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-bold">{ast.code}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-white/5 space-y-2">
                <button
                  onClick={() => {
                    setViewingAssistant(ast);
                    setEditedCode(ast.code || '');
                    setSubStart(ast.subStart ? new Date(ast.subStart).toISOString().split('T')[0] : '');
                    setSubExpiry(ast.subExpiry ? new Date(ast.subExpiry).toISOString().split('T')[0] : '');
                    setShowSuspensionPrompt(false);
                    setSuspensionReason('');
                  }}
                  className="w-full bg-white/5 hover:bg-amber-500 hover:text-black text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-white/10 hover:border-amber-500"
                >
                  <Info size={14} /> عرض التفاصيل وإدارة الحساب
                </button>

                <div className="flex gap-2">
                  {ast.status === 'pending' ? (
                    <>
                      <button 
                        onClick={() => handleRejectOrDelete(ast)}
                        disabled={saving}
                        className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition"
                        title="رفض الطلب"
                      >
                        <X size={18} />
                      </button>
                      <button 
                        onClick={() => handleApprove(ast)}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-600 transition flex items-center justify-center gap-1"
                      >
                        <Check size={16} /> تفعيل واعتماد
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleRejectOrDelete(ast)}
                      disabled={saving}
                      className="w-full py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition text-[11px] font-bold flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={13} /> حذف المساعد
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details & Administration Modal */}
      {viewingAssistant && (
        <div className="modal-overlay !z-50"  dir="rtl">
          <div className="modal-content modal-content-lg bg-[#0d1527] border-white/10">
            {/* Modal Header */}
            <div className="modal-header">
              <h3 className="text-lg font-black font-cairo gold-text flex items-center gap-2">
                <User size={20} className="text-amber-500" /> تفاصيل ملف المساعد
              </h3>
              <button 
                onClick={() => setViewingAssistant(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition flex items-center justify-center shrink-0 mr-auto"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body space-y-6 text-right">
              {/* Profile Card Intro */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl">
                {viewingAssistant.imageUrl ? (
                  <img 
                    src={viewingAssistant.imageUrl} 
                    alt={viewingAssistant.name} 
                    className="w-20 h-20 rounded-2xl object-cover border border-white/10 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl font-black text-amber-400 border border-amber-500/20">
                    {viewingAssistant.name[0]}
                  </div>
                )}
                <div className="space-y-1 text-center sm:text-right">
                  <h4 className="text-xl font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                    {viewingAssistant.name}
                    {viewingAssistant.isSuspended && (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/20">موقف</span>
                    )}
                  </h4>
                  <p className="text-xs text-text-muted">@{viewingAssistant.username} | {viewingAssistant.roleTitle || 'مساعد مادة'}</p>
                  <p className="text-xs font-mono font-bold text-gray-400 mt-1 flex items-center gap-1 justify-center sm:justify-start">
                    <Phone size={12} /> {viewingAssistant.phone}
                  </p>
                </div>
              </div>

              {/* Editable Code & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                  <label className="block text-xs text-text-muted font-bold">الرمز الموحد للمساعد (يمكن تعديله)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editedCode} 
                      onChange={e => setEditedCode(e.target.value)} 
                      placeholder="الكود الموحد" 
                      className="input-base flex-1 text-xs font-mono font-bold text-amber-400"
                    />
                    <button 
                      onClick={handleUpdateCode}
                      disabled={saving}
                      className="bg-amber-500 hover:bg-amber-600 text-black px-4 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} تحديث
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                  <label className="block text-xs text-text-muted font-bold">طريقة دفع الراتب المفضلة</label>
                  <span className="block px-3 py-2 rounded-xl bg-white/5 text-white text-xs font-bold border border-white/5 mt-1">
                    {viewingAssistant.salaryPaymentMethod === 'fixed' ? 'راتب شهري ثابت' :
                     viewingAssistant.salaryPaymentMethod === 'hourly' ? 'بالساعة (حسب ساعات العمل)' :
                     viewingAssistant.salaryPaymentMethod === 'percentage' ? 'نسبة مئوية من الدخل' :
                     viewingAssistant.salaryPaymentMethod === 'flexible' ? 'بالاتفاق / مرن' :
                     'راتب شهري ثابت (افتراضي)'}
                  </span>
                </div>
              </div>

              {/* Subscription Details */}
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="block text-sm text-amber-500 font-bold mb-2">تاريخ اشتراك المساعد في المنصة</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">تاريخ البدء</label>
                    <input 
                      type="date" 
                      value={subStart} 
                      onChange={e => setSubStart(e.target.value)} 
                      className="input-base w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">تاريخ الانتهاء</label>
                    <input 
                      type="date" 
                      value={subExpiry} 
                      onChange={e => setSubExpiry(e.target.value)} 
                      className="input-base w-full text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button 
                    onClick={handleUpdateSubscription}
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} حفظ تواريخ الاشتراك
                  </button>
                </div>
              </div>

              {/* Bio, Experience, Education */}
              <div className="space-y-4">
                {viewingAssistant.bio && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-500">النبذة التعريفية:</span>
                    <p className="p-3 bg-white/5 rounded-2xl border border-white/5 text-xs text-gray-200 leading-relaxed italic">
                      "{viewingAssistant.bio}"
                    </p>
                  </div>
                )}

                {viewingAssistant.experience && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                      <Award size={14} /> الخبرات والسابقة:
                    </span>
                    <p className="p-3 bg-white/5 rounded-2xl border border-white/5 text-xs text-gray-200 leading-relaxed whitespace-pre-line">
                      {viewingAssistant.experience}
                    </p>
                  </div>
                )}

                {viewingAssistant.education && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                      <GraduationCap size={14} /> التعليم والدراسة:
                    </span>
                    <p className="p-3 bg-white/5 rounded-2xl border border-white/5 text-xs text-gray-200 leading-relaxed">
                      {viewingAssistant.education}
                    </p>
                  </div>
                )}
              </div>

              {/* CV Preview Section */}
              {viewingAssistant.cvUrl ? (
                <div className="p-4 border border-amber-500/10 bg-amber-500/5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-amber-500" />
                    <div>
                      <span className="block text-xs font-bold text-white">ملف السيرة الذاتية (CV)</span>
                      <p className="text-[10px] text-gray-400">مرفوع بصيغة PDF</p>
                    </div>
                  </div>
                  <a 
                    href={viewingAssistant.cvUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    معاينة وتحميل
                  </a>
                </div>
              ) : (
                <div className="p-4 border border-white/5 bg-white/5 rounded-2xl text-center text-xs text-text-muted italic">
                  لم يرفع سيرة ذاتية.
                </div>
              )}

              {/* Suspension Reason Display */}
              {viewingAssistant.isSuspended && viewingAssistant.suspensionReason && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-1 text-right">
                  <span className="block text-xs font-bold text-red-400">سبب إيقاف الحساب الحالي:</span>
                  <p className="text-xs text-gray-300 italic">"{viewingAssistant.suspensionReason}"</p>
                </div>
              )}

              {/* Suspension Prompt Input */}
              {showSuspensionPrompt && (
                <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-2xl space-y-3 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-red-400 mb-1">سبب إيقاف الحساب مؤقتاً</label>
                    <textarea 
                      value={suspensionReason} 
                      onChange={e => setSuspensionReason(e.target.value)} 
                      placeholder="اذكر سبب تجميد الحساب ليظهر للمساعد عند تسجيل دخوله..." 
                      className="input-base w-full min-h-[70px] text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setShowSuspensionPrompt(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                    <button 
                      onClick={() => handleToggleSuspension(viewingAssistant)}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 text-xs font-bold transition"
                    >
                      تأكيد الإيقاف والتجميد
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="modal-footer bg-black/20 flex-wrap justify-between items-center gap-4">
              <button 
                onClick={() => handleRejectOrDelete(viewingAssistant)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 size={14} /> حذف المساعد نهائياً
              </button>

              <div className="flex gap-2">
                {viewingAssistant.status === 'pending' ? (
                  <button 
                    onClick={() => {
                      handleApprove(viewingAssistant);
                      setViewingAssistant(null);
                    }}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-600 transition flex items-center gap-1.5"
                  >
                    <Check size={16} /> تفعيل واعتماد المساعد
                  </button>
                ) : (
                  <>
                    {viewingAssistant.isSuspended ? (
                      <button 
                        onClick={() => handleToggleSuspension(viewingAssistant)}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl bg-green-600 text-white text-xs font-black hover:bg-green-700 transition flex items-center gap-1.5"
                      >
                        <UserCheck size={16} /> إعادة تنشيط الحساب
                      </button>
                    ) : (
                      !showSuspensionPrompt && (
                        <button 
                          onClick={() => setShowSuspensionPrompt(true)}
                          className="px-6 py-2.5 rounded-xl bg-red-500 text-white text-xs font-black hover:bg-red-600 transition flex items-center gap-1.5"
                        >
                          <X size={16} /> إيقاف حساب المساعد
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
