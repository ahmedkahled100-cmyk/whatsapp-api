// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Cairo, Tajawal } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { FileProcessingCenter } from '@/components/FileProcessingCenter';

const cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-cairo',
  weight: ['300', '400', '600', '700', '900'],
});

const tajawal = Tajawal({
  subsets: ['arabic'],
  variable: '--font-tajawal',
  weight: ['300', '400', '500', '700', '800', '900'],
});

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'A-N Academy - منصة التعليم الذكي',
  description: 'منصة اختبارات ومتابعة الطلاب - الأستاذ أحمد خالد',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`}>
      <body className="font-tajawal">
        {children}
        <ToastProvider />
        <FileProcessingCenter />
      </body>
    </html>
  );
}
