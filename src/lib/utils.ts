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
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'منذ لحظات';
  if (diff < 3600_000) return `منذ ${Math.floor(diff / 60_000)} د`;
  if (diff < 86400_000) return `منذ ${Math.floor(diff / 3600_000)} س`;
  if (diff < 604800_000) return `منذ ${Math.floor(diff / 86400_000)} يوم`;
  return new Date(timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
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
  if (typeof window === 'undefined') return '';
  if (window.location.hostname.includes('vercel.app')) return '';
  // Default to Vercel production
  return 'https://an-academy.vercel.app';
}
