'use client';
import { useState, useEffect } from 'react';
import { getPlatformStats } from '@/lib/db';
import { Users, FileText, BarChart2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalExams: 0,
    totalStudents: 0,
    totalAttempts: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlatformStats().then((data) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-cairo font-black text-purple-400">إحصائيات المنصة الشاملة</h1>
        <p className="text-sm text-gray-400 mt-1">نظرة عامة على جميع بيانات المنصة لكل المعلمين.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/teachers" className="card-base p-6 border border-white/5 hover:-translate-y-1 transition text-center cursor-pointer group hover:border-blue-500/30">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-500/30">
                <Users size={24} />
            </div>
            <div className="text-3xl font-black">{stats.totalTeachers}</div>
            <div className="text-sm text-gray-400 mt-1 font-bold tracking-wider">الأساتذة المسجلين</div>
        </Link>
        <Link href="/admin/students" className="card-base p-6 border border-white/5 hover:-translate-y-1 transition text-center cursor-pointer group hover:border-green-500/30">
            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-3 group-hover:bg-green-500/30">
                <Users size={24} />
            </div>
            <div className="text-3xl font-black">{stats.totalStudents}</div>
            <div className="text-sm text-gray-400 mt-1 font-bold tracking-wider">الطلاب المسجلين</div>
        </Link>
        <div className="card-base p-6 border border-white/5 hover:-translate-y-1 transition text-center opacity-60 cursor-not-allowed">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-3">
                <FileText size={24} />
            </div>
            <div className="text-3xl font-black">{stats.totalExams}</div>
            <div className="text-sm text-gray-400 mt-1 font-bold tracking-wider">الاختبارات المنشأة</div>
        </div>
        <div className="card-base p-6 border border-white/5 hover:-translate-y-1 transition text-center opacity-60 cursor-not-allowed">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={24} />
            </div>
            <div className="text-3xl font-black">{stats.totalAttempts}</div>
            <div className="text-sm text-gray-400 mt-1 font-bold tracking-wider">ردود الطلاب الإجمالية</div>
        </div>
        <div className="card-base p-6 border border-white/5 hover:-translate-y-1 transition text-center cursor-default hover:border-gold/30">
            <div className="w-12 h-12 rounded-full bg-gold/20 text-gold flex items-center justify-center mx-auto mb-3">
                <BarChart2 size={24} />
            </div>
            <div className="text-3xl font-black text-gold">{stats.totalRevenue ? stats.totalRevenue.toLocaleString() : 0} <span className="text-sm font-normal text-gray-400">ج.م</span></div>
            <div className="text-sm text-gray-400 mt-1 font-bold tracking-wider">مجموع مبالغ الاشتراكات</div>
        </div>
      </div>
    </div>
  );
}
