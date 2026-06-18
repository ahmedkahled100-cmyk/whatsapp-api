'use client';
import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getTransactions, saveTransaction, deleteTransaction } from '@/lib/db';
import { Transaction } from '@/types';
import { showToast } from '@/lib/toast';
import { DollarSign, PlusCircle, TrendingUp, TrendingDown, Trash2, Printer, Filter } from 'lucide-react';

export default function FinancesPage() {
  const user = useTeacherStore(state => state.user);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  const [form, setForm] = useState<Partial<Transaction>>({
    type: 'income',
    category: 'اشتراكات',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTransactions(user.id);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.amount || form.amount <= 0 || !form.description) {
      showToast('يرجى إدخال المبلغ والوصف بشكل صحيح', 'error');
      return;
    }
    
    const tempId = crypto.randomUUID();
    const newTransaction = {
      ...form,
      id: tempId,
      teacherId: user.id,
      createdAt: Date.now()
    } as Transaction;
    
    // Optimistic UI update
    setTransactions(prev => [newTransaction, ...prev]);
    setShowModal(false);
    showToast('تم حفظ المعاملة بنجاح', 'success');

    try {
      const realId = await saveTransaction(newTransaction);
      // Optional: Update with real ID in background if needed
      setTransactions(prev => prev.map(t => t.id === tempId ? { ...t, id: realId } : t));
    } catch (err) {
      setTransactions(prev => prev.filter(t => t.id !== tempId));
      showToast('فشل حفظ المعاملة', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) return;
    
    // Optimistic UI update
    const previous = [...transactions];
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('تم الحذف', 'success');
    
    try {
      await deleteTransaction(id);
    } catch (err) {
      setTransactions(previous);
      showToast('فشل الحذف', 'error');
    }
  };

  const handlePrintReceipt = (t: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>إيصال استلام</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; color: #333; }
            .receipt { border: 2px dashed #ccc; padding: 20px; max-width: 400px; margin: 0 auto; text-align: center; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #000; }
            .amount { font-size: 32px; font-weight: bold; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; }
            .footer { margin-top: 20px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">أكاديمية أ. ${user?.name || 'المعلم'}</div>
            <h2>إيصال ${t.type === 'income' ? 'استلام نقدية' : 'صرف نقدية'}</h2>
            <div class="amount">${t.amount} ج.م</div>
            <div class="row"><span>التاريخ:</span> <span>${t.date}</span></div>
            <div class="row"><span>القسم:</span> <span>${t.category}</span></div>
            <div class="row"><span>الوصف:</span> <span>${t.description}</span></div>
            <div class="footer">شكراً لثقتكم بنا. تم طباعة هذا الإيصال عبر نظام AN-Academy.</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = transactions.filter(t => filterType === 'all' || t.type === filterType);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-cairo gold-text mb-1 flex items-center gap-2">
            <DollarSign size={24} /> الإدارة المالية
          </h1>
          <p className="text-sm text-text-muted">متابعة الإيرادات والمصروفات والأرباح</p>
        </div>
        <button onClick={() => { setForm({ type: 'income', category: 'اشتراكات', amount: 0, description: '', date: new Date().toISOString().split('T')[0] }); setShowModal(true); }} className="btn-gold">
          <PlusCircle size={18} /> إضافة معاملة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base p-6 border-green-500/30 bg-green-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={80} className="text-green-500" /></div>
          <h3 className="text-text-muted font-bold text-sm mb-2">إجمالي الإيرادات</h3>
          <div className="text-3xl font-black text-green-400 font-mono">{totalIncome} <span className="text-sm font-normal text-text-muted">ج.م</span></div>
        </div>
        <div className="card-base p-6 border-red-500/30 bg-red-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingDown size={80} className="text-red-500" /></div>
          <h3 className="text-text-muted font-bold text-sm mb-2">إجمالي المصروفات</h3>
          <div className="text-3xl font-black text-red-400 font-mono">{totalExpense} <span className="text-sm font-normal text-text-muted">ج.م</span></div>
        </div>
        <div className="card-base p-6 border-gold/30 bg-gold/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80} className="text-gold" /></div>
          <h3 className="text-text-muted font-bold text-sm mb-2">صافي الربح</h3>
          <div className={`text-3xl font-black font-mono ${balance >= 0 ? 'text-gold' : 'text-red-400'}`}>{balance} <span className="text-sm font-normal text-text-muted">ج.م</span></div>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center flex-wrap gap-4">
          <h3 className="font-bold flex items-center gap-2"><Filter size={16} /> سجل المعاملات</h3>
          <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
            <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>الكل</button>
            <button onClick={() => setFilterType('income')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'income' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}>الإيرادات</button>
            <button onClick={() => setFilterType('expense')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}>المصروفات</button>
          </div>
        </div>
        <div className="table-container max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto"></div></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-text-muted">لا توجد معاملات مسجلة</div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-sm">
                <thead className="bg-black/20 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3">الوصف</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id}>
                      <td className="p-3">{t.date}</td>
                      <td className="p-3">
                        <span className={`badge ${t.type === 'income' ? 'badge-green' : 'badge-red'}`}>
                          {t.type === 'income' ? 'إيراد' : 'مصروف'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">{t.category}</td>
                      <td className="p-3 max-w-[200px] truncate">{t.description}</td>
                      <td className={`p-3 font-mono font-bold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{t.amount}
                      </td>
                      <td className="p-3 flex gap-2">
                        <button onClick={() => handlePrintReceipt(t)} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="طباعة الإيصال">
                          <Printer size={16} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20" title="حذف">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" >
          <div className="modal-content modal-content-sm">
            <div className="modal-header">
              <h3 className="font-bold text-lg gold-text flex items-center gap-2">
                <DollarSign size={20} /> إضافة معاملة مالية
              </h3>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button onClick={() => setForm({ ...form, type: 'income', category: 'اشتراكات' })} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.type === 'income' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-gray-400 hover:text-white'}`}>إيراد</button>
                <button onClick={() => setForm({ ...form, type: 'expense', category: 'رواتب' })} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.type === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}>مصروف</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">المبلغ (ج.م)</label>
                  <input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="input-base w-full font-mono text-lg py-3 text-center" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">التاريخ</label>
                  <input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="input-base w-full py-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">القسم</label>
                <select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="input-base w-full">
                  {form.type === 'income' ? (
                    <>
                      <option value="اشتراكات">اشتراكات شهرية</option>
                      <option value="كورسات">مبيعات كورسات</option>
                      <option value="مذكرات">مبيعات مذكرات</option>
                      <option value="أخرى">إيرادات أخرى</option>
                    </>
                  ) : (
                    <>
                      <option value="رواتب">رواتب مساعدين</option>
                      <option value="إيجار">إيجار المقر</option>
                      <option value="طباعة">مصاريف طباعة ورق</option>
                      <option value="تسويق">إعلانات وتسويق</option>
                      <option value="أخرى">مصروفات أخرى</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">الوصف (مثال: سداد اشتراك الطالب أحمد، أو راتب شهر مارس)</label>
                <input type="text" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="input-base w-full" placeholder="اكتب تفاصيل المعاملة..." />
              </div>

            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSave} className="btn-gold flex-[2] justify-center text-black">
                حفظ {form.type === 'income' ? 'الإيراد' : 'المصروف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
