// src/lib/utils.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getGoogleDocsViewerUrl } from './pdf-viewer';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate random student code (6 chars)
export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Generate unique ID
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Format date in Arabic
export function formatDateAr(date: string | number | Date, short = false): string {
  if (short) {
    return new Date(date).toLocaleDateString('ar-EG', {
      month: 'numeric', day: 'numeric'
    });
  }
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/** عرض مختصر لآخر ظهور (نشاط) بالعربية */
export function formatRelativeLastSeenAr(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'غير متوفر';
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'الآن';
  if (diff < 60_000) return 'منذ لحظات';
  if (diff < 3600_000) return `منذ ${Math.floor(diff / 60_000)} د`;
  if (diff < 86400_000) return `منذ ${Math.floor(diff / 3600_000)} س`;
  if (diff < 604800_000) return `منذ ${Math.floor(diff / 86400_000)} يوم`;
  
  try {
    return new Date(timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  } catch (err) {
    return 'غير متوفر';
  }
}

// Format time remaining (seconds → MM:SS)
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Shuffle array
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Calculate grade color
export function gradeColor(score: number, passing: number): string {
  if (score >= passing) return '#10b981'; // green
  if (score >= passing * 0.7) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

// Get subscription status
export function subStatus(expiry?: number | null): 'active' | 'expired' | 'none' {
  if (!expiry) return 'none';
  return expiry > Date.now() ? 'active' : 'expired';
}

// Arabic number to words (for scores display)
export function scoreLabel(score: number): string {
  if (score >= 90) return 'ممتاز';
  if (score >= 75) return 'جيد جداً';
  if (score >= 65) return 'جيد';
  if (score >= 50) return 'مقبول';
  return 'راسب';
}

// Helper to get viewable URL for files (especially PDFs)
export function getViewerUrl(url: string | undefined): string {
  if (!url) return '';
  return getGoogleDocsViewerUrl(url);
}

// Helper to get download URL (forces attachment for Cloudinary)
export function getDownloadUrl(url: string | undefined, fileName?: string): string {
  if (!url) return '';
  const cleanUrl = url.trim();
  
  // For Cloudinary, we can force attachment
  if (cleanUrl.includes('cloudinary.com')) {
    const isRaw = cleanUrl.includes('/raw/upload/') || cleanUrl.includes('/files/upload/');
    if (!isRaw) {
      const parts = cleanUrl.split('/upload/');
      if (parts.length === 2) {
        let safeName = fileName ? fileName.replace(/[/\\?%*:|"<>]/g, '_') : 'file';
        // Ensure .pdf extension if it's likely a PDF but missing extension in name
        if (cleanUrl.toLowerCase().includes('.pdf') && !safeName.toLowerCase().endsWith('.pdf')) {
          safeName += '.pdf';
        }
        return `${parts[0]}/upload/fl_attachment:${encodeURIComponent(safeName)}/${parts[1]}`;
      }
    }
  }
  
  return cleanUrl;
}

// Get Dynamic API Base URL (Fixes Vercel 404s on Static APKs)
export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return '';
  if (window.location.hostname.includes('vercel.app')) return '';
  // Default to Vercel production
  return 'https://an-academy.vercel.app';
}

/** 
 * Clean phone numbers for WhatsApp API (wa.me/PHONE)
 * Standardizes local Egypt format 01xxxxxxxxx to international 201xxxxxxxxx
 */
export function cleanWhatsAppPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  // Ensure we only have digits
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Local Egypt format: 01012345678 (11 digits) -> 201012345678
  if (digits.startsWith('01') && digits.length === 11) {
    return '2' + digits; 
  }
  // Missing leading zero: 1012345678 (10 digits) -> 201012345678
  if (digits.startsWith('1') && digits.length === 10) {
    return '20' + digits;
  }
  // Already has country code 20
  if (digits.startsWith('20') && digits.length >= 12) {
    return digits;
  }
  // Any other 11-digit number starting with 0: assume Egypt and replace 0 with 2
  if (digits.startsWith('0') && digits.length === 11) {
    return '2' + digits;
  }

  return digits;
}

/**
 * Standardize phone numbers to 11-digit Egypt format (01xxxxxxxxx).
 * This ensures that students are uniquely identified regardless of how their number was typed.
 */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  // Extract only digits
  const d = String(phone).replace(/\D/g, '');
  if (!d) return '';

  // 12 digits starting with 20: 201012345678 -> 01012345678
  if (d.length === 12 && d.startsWith('20')) return '0' + d.slice(2);
  // 10 digits starting with 1: 1012345678 -> 01012345678
  if (d.length === 10 && d.startsWith('1')) return '0' + d;
  // 11 digits starting with 0: 01012345678 (Standard)
  if (d.length === 11 && d.startsWith('0')) return d;

  return d;
}

/**
 * Robust printing function that avoids Next.js/Tailwind layout bugs and popups.
 * It injects a print container into the current page, hides everything else during print, and prints.
 * @param htmlContent The HTML string to print
 * @param title The title of the printed document (optional)
 * @param isReceipt If true, formats for 80mm thermal receipt printer
 */
export function printHtml(htmlContent: string, title: string = 'طباعة', isReceipt: boolean = false) {
  // Save original title
  const originalTitle = document.title;
  if (title) document.title = title;

  // Create print container
  const printContainer = document.createElement('div');
  printContainer.id = 'an-academy-print-container';
  
  // Receipt styling (80mm width) or standard styling
  const pageStyle = isReceipt 
    ? `@page { margin: 0; size: 80mm auto; } #an-academy-print-container { width: 80mm; margin: 0 auto; padding: 10px; background: white; color: black; }` 
    : `@page { margin: 0.5cm; } #an-academy-print-container { padding: 20px; background: white; color: black; }`;

  printContainer.innerHTML = `
    <style>
      ${pageStyle}
      @media print {
        body > *:not(#an-academy-print-container) {
          display: none !important;
        }
        body {
          background: white !important;
          color: black !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #an-academy-print-container {
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        /* CRITICAL: Overrides any global body * { visibility: hidden; } styles */
        #an-academy-print-container, #an-academy-print-container * {
          visibility: visible !important;
        }
        /* Ensure Tailwind hidden classes work in print if needed */
        .print\\:hidden { display: none !important; }
        .print\\:block { display: block !important; }
      }
    </style>
    <div dir="rtl" style="font-family: inherit;">
      ${htmlContent}
    </div>
  `;

  document.body.appendChild(printContainer);

  // Trigger print
  setTimeout(() => {
    window.print();
    // Cleanup after printing
    setTimeout(() => {
      document.body.removeChild(printContainer);
      document.title = originalTitle;
    }, 500);
  }, 100);
}

/**
 * Open a clean, standalone student card page for printing/PDF export.
 * Uses a dedicated page (/student-card) to avoid layout conflicts.
 * The page auto-triggers print dialog and has Tailwind-free styling.
 * 
 * @param student The student object
 * @param teacherName The teacher's name for the card header
 */
export function openStudentCardForPrint(student: {
  name: string;
  code: string;
  grade?: string;
  imageUrl?: string;
}, teacherName: string = 'المنصة التعليمية') {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams({
    name: student.name,
    code: student.code,
    grade: student.grade || '',
    imageUrl: student.imageUrl || '',
    teacherName,
  });

  const url = `/student-card?${params.toString()}`;
  const win = window.open(url, '_blank', 'width=400,height=320,toolbar=no,menubar=no,scrollbars=no,resizable=yes');
  if (win) win.focus();
}

/**
 * Export an HTML element as a PDF using html2pdf.js
 * @param elementId The DOM element ID to capture (must be visible in DOM)
 * @param filename The name of the downloaded file
 */
export async function exportToPdf(elementId: string, filename: string) {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const opt = {
      margin: 5,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
      },
      jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' as const }
    };

    await html2pdf().from(element).set(opt).save();
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}

/**
 * Export multiple elements as a single multi-page PDF using html2pdf.js
 * @param elementId The DOM element ID containing the elements to capture
 * @param filename The name of the downloaded file
 */
export async function exportBulkToPdf(elementId: string, filename: string) {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
      },
      jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await html2pdf().from(element).set(opt).save();
  } catch (error) {
    console.error('Error exporting bulk to PDF:', error);
    throw error;
  }
}

