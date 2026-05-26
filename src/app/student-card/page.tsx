'use client';
// src/app/student-card/page.tsx
// Standalone student card page for clean PDF printing

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

interface CardData {
  name: string;
  code: string;
  grade: string;
  imageUrl: string;
  teacherName: string;
}

function StudentCardContent() {
  const searchParams = useSearchParams();
  const [card, setCard] = useState<CardData | null>(null);

  useEffect(() => {
    const name = searchParams.get('name') || '';
    const code = searchParams.get('code') || '';
    const grade = searchParams.get('grade') || '';
    const imageUrl = searchParams.get('imageUrl') || '';
    const teacherName = searchParams.get('teacherName') || 'المنصة التعليمية';

    if (name && code) {
      setCard({ name, code, grade, imageUrl, teacherName });
    }
  }, [searchParams]);

  // Auto-print when page loads (for PDF export workflow)
  useEffect(() => {
    if (card) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [card]);

  if (!card) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#666' }}>
        جاري تحميل البطاقة...
      </div>
    );
  }

  const displayCode = card.code.replace(/-T[A-Z0-9]+$/i, '');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        html, body {
          width: 85.6mm;
          height: auto;
          background: white;
          font-family: 'Cairo', Arial, sans-serif;
          direction: rtl;
        }

        .card {
          width: 85.6mm;
          min-height: 54mm;
          background: white;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
        }

        .card-header {
          width: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .card-header-text {
          color: #fbbf24;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.5px;
          text-align: center;
        }

        .card-body {
          width: 100%;
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 10px 12px;
          gap: 10px;
          background: white;
        }

        .student-photo-container {
          flex-shrink: 0;
        }

        .student-photo {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #fbbf24;
          display: block;
        }

        .student-photo-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 900;
          color: white;
          border: 2px solid #fbbf24;
          flex-shrink: 0;
        }

        .student-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .student-name {
          font-size: 11px;
          font-weight: 900;
          color: #1a1a2e;
          line-height: 1.3;
        }

        .student-grade {
          font-size: 9px;
          color: #6b7280;
          font-weight: 600;
        }

        .student-code {
          font-size: 9px;
          font-family: 'Courier New', monospace;
          color: #0f3460;
          font-weight: 700;
          background: #f0f9ff;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #bfdbfe;
          display: inline-block;
          margin-top: 2px;
          letter-spacing: 1px;
          direction: ltr;
        }

        .qr-container {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .qr-wrapper {
          background: white;
          padding: 3px;
          border: 1.5px solid #e5e7eb;
          border-radius: 6px;
        }

        .card-footer {
          width: 100%;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          padding: 3px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-text {
          font-size: 7px;
          color: #1a1a2e;
          font-weight: 700;
        }

        .gold-star {
          color: #1a1a2e;
          font-size: 8px;
        }

        @media print {
          html, body {
            width: 85.6mm;
            height: auto;
          }
          
          @page {
            margin: 0;
            size: 85.6mm auto;
          }

          .no-print {
            display: none !important;
          }
        }

        .no-print {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          background: rgba(0,0,0,0.8);
          padding: 10px 16px;
          border-radius: 12px;
          z-index: 999;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-family: 'Cairo', Arial, sans-serif;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: transform 0.1s;
        }

        .btn:hover { transform: scale(1.05); }

        .btn-primary {
          background: #fbbf24;
          color: #1a1a2e;
        }

        .btn-secondary {
          background: #374151;
          color: white;
        }
      `}</style>

      <div className="card">
        {/* Header */}
        <div className="card-header">
          <span className="card-header-text">⭐ أكاديمية {card.teacherName} ⭐</span>
        </div>

        {/* Body */}
        <div className="card-body">
          {/* Photo */}
          <div className="student-photo-container">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                className="student-photo"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="student-photo-placeholder">
                {card.name?.[0] || '؟'}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="student-info">
            <div className="student-name">{card.name}</div>
            {card.grade && <div className="student-grade">📚 {card.grade}</div>}
            <div className="student-code">{displayCode}</div>
          </div>

          {/* QR Code */}
          <div className="qr-container">
            <div className="qr-wrapper">
              <QRCodeSVG
                value={card.code}
                size={60}
                level="H"
                includeMargin={false}
                fgColor="#0f3460"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="card-footer">
          <span className="footer-text">بطاقة الطالب الرسمية</span>
          <span className="gold-star">★ ★ ★</span>
          <span className="footer-text">امسح الباركود للحضور</span>
        </div>
      </div>

      {/* Print/Close buttons - hidden during print */}
      <div className="no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ طباعة / حفظ PDF
        </button>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          ✕ إغلاق
        </button>
      </div>
    </>
  );
}

export default function StudentCardPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>جاري التحميل...</div>}>
      <StudentCardContent />
    </Suspense>
  );
}
