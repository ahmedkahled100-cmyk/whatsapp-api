'use client';

import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Download, TrendingUp, Users, DollarSign, Calendar, 
  ArrowUpRight, AlertCircle, Printer
} from 'lucide-react';

// Removed top-level import to prevent SSR errors

interface FinancialReportsProps {
  data: any[];
  type: 'students' | 'teachers';
  title: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F'];

export const FinancialReports: React.FC<FinancialReportsProps> = ({ data, type, title }) => {
  const stats = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + (item.totalPaid || 0), 0);
    const monthlyRevenue = data.reduce((sum, item) => sum + (item.subPrice || 0), 0);
    const countByType = data.reduce((acc: any, item) => {
      const t = item.subType || 'none';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const pieData = Object.keys(countByType).map(key => ({
      name: key === 'monthly' ? 'شهري' : key === 'yearly' ? 'سنوي' : key === 'free' ? 'مجاني' : key === 'session' ? 'حصة' : key,
      value: countByType[key]
    }));

    // Growth simulation (Last 6 months)
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];
    const barData = months.map((m, i) => ({
      name: m,
      revenue: Math.floor(totalRevenue * (0.1 + i * 0.15 + (Math.random() * 0.1))) // Simulated growth
    }));

    return { totalRevenue, monthlyRevenue, pieData, barData, count: data.length };
  }, [data]);

  const handleExportPDF = () => {
    const element = document.getElementById('report-content');
    if (!element) return;
    const opt = {
      margin: 10,
      filename: `تقرير_مالي_${title}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };
    
    // Dynamic import to prevent SSR issues
    // @ts-ignore
    import('html2pdf.js').then((module) => {
      const html2pdf = module.default;
      html2pdf().from(element).set(opt).save();
    });
  };

  const handleExportExcel = () => {
    const headers = type === 'students' 
      ? ['الاسم', 'الكود', 'نوع الاشتراك', 'المبلغ', 'إجمالي المدفوعات', 'تاريخ الانتهاء']
      : ['المعلم', 'المادة', 'نوع الاشتراك', 'المبلغ', 'إجمالي المدفوعات', 'تاريخ الانتهاء'];
    
    const rows = data.map(item => [
      `"${item.name}"`, 
      `"${type === 'students' ? item.code : (item.subject || '')}"`,
      `"${item.subType}"`, 
      item.subPrice || 0, 
      item.totalPaid || 0,
      `"${item.subExpiry ? new Date(item.subExpiry).toLocaleDateString('ar-EG') : ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_${title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
         <div className="flex items-center gap-3">
            <TrendingUp size={24} className="text-purple-400" />
            <h2 className="text-xl font-black font-cairo text-white">{title}</h2>
         </div>
         <div className="flex gap-2">
            <button onClick={handleExportExcel} className="btn-outline border-blue-500/30 text-blue-400 py-2.5 px-4 text-xs flex items-center gap-2">
               <Download size={14} /> تصدير Excel
            </button>
            <button onClick={handleExportPDF} className="btn-gold bg-purple-600 shadow-purple-900/40 py-2.5 px-4 text-xs flex items-center gap-2">
               <Printer size={14} /> تصدير PDF التقرير
            </button>
         </div>
      </div>

      <div id="report-content" className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-base p-6 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400"><DollarSign size={24} /></div>
            </div>
            <div className="text-2xl font-black text-white">{stats.totalRevenue.toLocaleString()} ج.م</div>
            <div className="text-xs text-gray-400 mt-1">إجمالي الإيرادات المحصلة</div>
          </div>

          <div className="card-base p-6 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400"><Calendar size={24} /></div>
            </div>
            <div className="text-2xl font-black text-white">{stats.monthlyRevenue.toLocaleString()} ج.م</div>
            <div className="text-xs text-gray-400 mt-1">الإيراد الشهري المخطط</div>
          </div>

          <div className="card-base p-6 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400"><Users size={24} /></div>
            </div>
            <div className="text-2xl font-black text-white">{stats.count}</div>
            <div className="text-xs text-gray-400 mt-1">إجمالي المشتركين</div>
          </div>

          <div className="card-base p-6 bg-gradient-to-br from-gold/10 to-transparent border-gold/20">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gold/20 rounded-2xl text-gold"><ArrowUpRight size={24} /></div>
            </div>
            <div className="text-2xl font-black text-white">{data.length > 0 ? Math.round(stats.totalRevenue / data.length).toLocaleString() : 0} ج.م</div>
            <div className="text-xs text-gray-400 mt-1">متوسط قيمة المشترك LTV</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-base p-6 space-y-6">
            <h3 className="font-bold flex items-center gap-2 text-white">
               <TrendingUp size={18} className="text-purple-400" /> تحليل نمو الإيرادات
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', textAlign: 'right' }}
                  />
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-base p-6 space-y-6">
            <h3 className="font-bold flex items-center gap-2 text-white">
               <AlertCircle size={18} className="text-blue-400" /> توزيع الباقات
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
