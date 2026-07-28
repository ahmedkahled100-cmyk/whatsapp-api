// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Alexandria, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { FileProcessingCenter } from '@/components/FileProcessingCenter';

const alexandria = Alexandria({
  subsets: ['arabic'],
  variable: '--font-alexandria',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const ibmPlex = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-ibm-plex',
  weight: ['300', '400', '500', '600', '700'],
});

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'A-N Academy - منصة التعليم الذكي',
  description: 'منصة اختبارات ومتابعة الطلاب',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${alexandria.variable} ${ibmPlex.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('an-academy-theme') || 'dark';
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.remove('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-tajawal overflow-x-hidden w-full max-w-full m-0 p-0 flex flex-col min-h-screen">
        {children}
        <ToastProvider />
        <FileProcessingCenter />
      </body>
    </html>
  );
}
