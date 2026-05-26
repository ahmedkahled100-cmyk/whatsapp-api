import Link from 'next/link';

export default function PlaceholderPage({ title, icon, description }: { title: string, icon: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-fade-in">
      <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6 mx-auto" 
        style={{ background: 'linear-gradient(135deg, rgba(245,197,24,0.1), rgba(245,197,24,0.05))', border: '1px solid rgba(245,197,24,0.2)', boxShadow: '0 0 30px rgba(245,197,24,0.1)' }}>
        {icon}
      </div>
      <h1 className="text-3xl font-cairo font-black gold-text mb-3">{title}</h1>
      <p className="text-lg max-w-lg mx-auto mb-8" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
      <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
        قريباً في التحديث القادم
      </div>
      <Link href="/teacher/dashboard" className="mt-8 text-sm hover:underline" style={{ color: 'var(--gold)' }}>
        العودة للرئيسية
      </Link>
    </div>
  );
}
