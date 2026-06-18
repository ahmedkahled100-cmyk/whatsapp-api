'use client';

import { useState } from 'react';
import { X, DollarSign, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import type { TeacherUser } from '@/types';
import { saveTeacher } from '@/lib/db';
import { showToast } from '@/lib/toast';

interface TeacherLedgerModalProps {
  teacher: TeacherUser;
  onClose: () => void;
  onUpdate: (updatedTeacher: TeacherUser) => void;
}

export function TeacherLedgerModal({ teacher, onClose, onUpdate }: TeacherLedgerModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ amount: string; type: string; date: string }>({
    amount: '',
    type: teacher.subType || 'monthly',
    date: new Date().toISOString().split('T')[0],
  });

  const handleAddPayment = async () => {
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    setSaving(true);
    try {
      const history = [...(teacher.paymentHistory || [])];
      history.push({
        date: new Date(form.date).getTime(),
        amount: amountNum,
        type: form.type
      });
      
      const newTotal = (teacher.totalPaid || 0) + amountNum;
      
      const updatedTeacher = { 
        ...teacher, 
        totalPaid: newTotal, 
        paymentHistory: history 
      };
      
      await saveTeacher(updatedTeacher as any);
      onUpdate(updatedTeacher);
      showToast('✅ تم تسجيل الدفعة بنجاح وإضافتها للمجموع');
      setForm({ ...form, amount: '' }); // Reset amount field
    } catch (e) {
      console.error(e);
      showToast('❌ فشل تسجيل الدفعة');
    } finally {
      setSaving(false);
    }
  };

  const getSubLabel = (type: string) => {
    const m: Record<string, string> = { free: 'مجاني', monthly: 'شهري', yearly: 'سنوي' };
    return m[type] || type || '—';
  };

  return (
    <div className="modal-overlay" >
      <div className="modal-content modal-content-md !p-0 border border-purple-500/30 animate-scale-in flex flex-col max-h-[90vh]" dir="rtl">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-purple-500/5 shrink-0">
          <div className="min-w-0">
            <h3 className="text-xl font-black font-cairo text-white truncate flex items-center gap-2">
              <TrendingUp className="text-purple-400" />
              الدفتر المالي (Ledger)
            </h3>
            <p className="text-sm text-purple-400 mt-0.5 truncate">أكاديمية المعلم: {teacher.name}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-90 shrink-0"
          >
            <X size={20}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Summary Card */}
          <div className="card-base p-6 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-1">إجمالي المدفوعات التراكمية</div>
              <div className="text-3xl font-black text-white">{(teacher.totalPaid || 0).toLocaleString()} <span className="text-sm text-purple-400">ج.م</span></div>
            </div>
            <div className="p-4 bg-purple-500/20 rounded-2xl text-purple-400">
              <DollarSign size={32} />
            </div>
          </div>

          {/* Add Payment Form */}
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" />
              تسجيل دفعة يدوية جديدة
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-bold">المبلغ (ج.م)</label>
                <input 
                  type="number" 
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="مثال: 500"
                  className="input-base w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-bold">نوع الدفعة / الاشتراك</label>
                <select 
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="input-base w-full"
                >
                  <option value="monthly">شهري</option>
                  <option value="yearly">سنوي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-bold">التاريخ</label>
                <input 
                  type="date" 
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="input-base w-full"
                />
              </div>
            </div>
            <button 
              onClick={handleAddPayment}
              disabled={saving || !form.amount}
              className="btn-gold w-full bg-green-600 hover:bg-green-700 border-none text-white shadow-green-900/40 mt-2"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : 'تسجيل وإضافة للمجموع'}
            </button>
          </div>

          {/* Transaction History Table */}
          <div>
            <h4 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-blue-400" />
              سجل الدفعات السابقة
            </h4>
            {teacher.paymentHistory && teacher.paymentHistory.length > 0 ? (
              <div className="card-base overflow-hidden border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-white/5 text-gray-400 text-xs">
                      <tr>
                        <th className="px-4 py-3">التاريخ</th>
                        <th className="px-4 py-3">المبلغ</th>
                        <th className="px-4 py-3">النوع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {teacher.paymentHistory.slice().reverse().map((p, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-mono">{new Date(p.date).toLocaleDateString('ar-EG')}</td>
                          <td className="px-4 py-3 font-black text-green-400">+{p.amount} ج.م</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{getSubLabel(p.type)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/5 text-gray-500 text-sm">
                لا يوجد سجل دفعات سابق لهذا المعلم.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
