'use client';

import { useState } from 'react';
import { checkRegistrationStatusByPhone, type RegistrationStatusResult } from '@/lib/db';
import { Search, Phone, CheckCircle2, Clock, XCircle, Loader2, X, User, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface CheckStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
}

export function CheckStatusModal({ isOpen, onClose, defaultPhone = '' }: CheckStatusModalProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RegistrationStatusResult[]>([]);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await checkRegistrationStatusByPhone(phone);
      setResults(res);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'teacher': return { label: 'معلم', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'assistant': return { label: 'مساعد', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      default: return { label: 'طالب', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }
  };

  const getSubPlanLabel = (type?: string) => {
    switch (type) {
      case 'monthly': return 'اشتراك شهري';
      case 'yearly': return 'اشتراك سنوي';
      case 'halfYearly': return 'نصف سنوي';
      case 'course': return 'كورس كامل';
      case 'session': return 'بالحصة';
      default: return type || '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="card-base max-w-lg w-full p-6 sm:p-8 rounded-3xl border-white/10 bg-[#0f172a] space-y-6 relative shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Search size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black font-cairo text-white">الاستعلام عن حالة الطلب</h3>
              <p className="text-xs text-gray-400">ادخل رقم الهاتف المتربط بطلب التسجيل</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="text-xs font-bold text-gray-300 block px-1">رقم الهاتف (واتساب)</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="input-base has-icon-right bg-[#1e293b] text-white font-bold tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shadow-lg disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>بحث</span>
            </button>
          </div>
        </form>

        {/* Search Results Area */}
        {searched && (
          <div className="space-y-4 pt-2">
            {loading ? (
              <div className="py-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-amber-400" />
                <span className="text-xs font-bold">جاري البحث عن طلبك في النظام...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center space-y-2 bg-white/[0.02] rounded-2xl border border-white/5">
                <XCircle size={36} className="mx-auto text-gray-500 opacity-60" />
                <p className="text-sm font-bold text-gray-300">لم يتم العثور على طلب تسجيل</p>
                <p className="text-xs text-gray-500">تأكد من كتابة رقم الهاتف الصحيح الذي أدخلته أثناء التسجيل.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {results.map((res) => {
                  const roleBadge = getRoleLabel(res.role);
                  return (
                    <div
                      key={res.id}
                      className="p-4 rounded-2xl border transition-all space-y-3 bg-white/[0.02] border-white/10 hover:border-white/20"
                    >
                      {/* Top Bar: Name + Role + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{res.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                              {roleBadge.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                            <span>{res.phone}</span>
                            {res.subject && <span>• المادة: {res.subject}</span>}
                            {res.roleTitle && <span>• الدور: {res.roleTitle}</span>}
                            {res.subType && <span>• الباقة: {getSubPlanLabel(res.subType)}</span>}
                          </div>
                        </div>

                        {/* Status Badge */}
                        {res.status === 'pending' && (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                            <Clock size={14} />
                            قيد المراجعة
                          </span>
                        )}

                        {res.status === 'approved' && (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
                            <CheckCircle2 size={14} />
                            تم القبول
                          </span>
                        )}

                        {res.status === 'rejected' && (
                          <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-xl">
                            <XCircle size={14} />
                            مرفوض
                          </span>
                        )}
                      </div>

                      {/* Status Explanation Message */}
                      <div className="pt-2 border-t border-white/5 text-xs leading-relaxed">
                        {res.status === 'pending' && (
                          <p className="text-amber-200/90 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                            ⏳ طلبك قيد الفحص والتدقيق من قبل الإدارة حالياً. يتم التواصل وإرسال بيانات التفعيل فور الاعتماد.
                          </p>
                        )}

                        {res.status === 'approved' && (
                          <div className="space-y-2 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                            <p className="text-emerald-300 font-bold flex items-center gap-1.5">
                              <Sparkles size={14} />
                              مبروك! تم قبول طلبك وتفعيل الحساب بنجاح.
                            </p>
                            {res.code && (
                              <div className="text-xs text-gray-300 font-mono">
                                الكود الخاص بك: <span className="text-amber-300 font-bold bg-white/5 px-2 py-0.5 rounded">{res.code}</span>
                              </div>
                            )}
                            <div className="pt-1">
                              <Link
                                href="/auth"
                                onClick={onClose}
                                className="btn-gold inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                              >
                                <span>تسجيل الدخول الآن</span>
                                <ArrowLeft size={14} />
                              </Link>
                            </div>
                          </div>
                        )}

                        {res.status === 'rejected' && (
                          <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/10 text-red-300 space-y-1">
                            <p className="font-bold">❌ نعتذر، لم يتم قبول الطلب.</p>
                            {res.rejectionReason && (
                              <p className="text-[11px] opacity-90">السبب: {res.rejectionReason}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
