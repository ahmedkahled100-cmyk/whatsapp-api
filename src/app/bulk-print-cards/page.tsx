'use client';
// src/app/bulk-print-cards/page.tsx

import { useEffect, useState, Suspense } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface CardData {
  name: string;
  code: string;
  grade: string;
  imageUrl: string;
}

interface BulkPrintData {
  students: CardData[];
  teacherName: string;
}

function BulkPrintCardsContent() {
  const [data, setData] = useState<BulkPrintData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('bulkPrintStudents');
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse bulk print data', e);
      }
    }
  }, []);

  useEffect(() => {
    if (data && data.students.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#666' }}>
        جاري تحميل البطاقات المجمعة...
      </div>
    );
  }

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
          background: #f3f4f6;
          font-family: 'Cairo', Arial, sans-serif;
          direction: rtl;
        }

        .page-container {
          max-width: 210mm;
          margin: 0 auto;
          background: white;
          padding: 10mm;
          min-height: 297mm;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10mm 5mm;
        }

        .card-wrapper {
          page-break-inside: avoid;
          display: flex;
          justify-content: center;
        }

        /* Standard ID Card Size: 85.6mm x 54mm */
        .card {
          width: 85.6mm;
          height: 54mm;
          background: white;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px dashed #ccc; /* Cut guide */
          border-radius: 4px;
        }

        .card-header {
          width: 100%;
          height: 18%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-header-text {
          color: #fbbf24;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .card-body {
          width: 100%;
          height: 70%;
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 0 8px;
          gap: 8px;
        }

        .student-photo-container {
          flex-shrink: 0;
        }

        .student-photo {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #fbbf24;
        }

        .student-photo-placeholder {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 900;
          color: white;
          border: 2px solid #fbbf24;
        }

        .student-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }

        .student-name {
          font-size: 12px;
          font-weight: 900;
          color: #1a1a2e;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .student-grade {
          font-size: 9px;
          color: #6b7280;
          font-weight: 600;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .student-code {
          font-size: 10px;
          font-family: 'Courier New', monospace;
          color: #0f3460;
          font-weight: 700;
          background: #f0f9ff;
          padding: 1px 4px;
          border-radius: 4px;
          border: 1px solid #bfdbfe;
          display: inline-block;
          margin-top: 3px;
          direction: ltr;
          text-align: center;
        }

        .qr-container {
          flex-shrink: 0;
          background: white;
          padding: 2px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }

        .card-footer {
          width: 100%;
          height: 12%;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
        }

        .footer-text {
          font-size: 7px;
          color: #1a1a2e;
          font-weight: 700;
        }

        @media print {
          html, body {
            background: white;
          }
          
          @page {
            margin: 10mm;
            size: A4 portrait;
          }

          .page-container {
            padding: 0;
            margin: 0;
            width: 100%;
          }

          .no-print {
            display: none !important;
          }
          
          .card {
            border: 0.5px dashed #ccc;
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

      <div className="page-container">
        <div className="cards-grid">
          {data.students.map((card, idx) => {
            const displayCode = card.code.replace(/-T[A-Z0-9]+$/i, '');
            return (
              <div key={idx} className="card-wrapper">
                <div className="card">
                  {/* Header */}
                  <div className="card-header">
                    <span className="card-header-text">⭐ أكاديمية {data.teacherName} ⭐</span>
                  </div>

                  {/* Body */}
                  <div className="card-body">
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

                    <div className="student-info">
                      <div className="student-name">{card.name}</div>
                      {card.grade && <div className="student-grade">📚 {card.grade}</div>}
                      <div><span className="student-code">{displayCode}</span></div>
                    </div>

                    <div className="qr-container">
                      <QRCodeSVG
                        value={card.code}
                        size={52}
                        level="H"
                        includeMargin={false}
                        fgColor="#0f3460"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="card-footer">
                    <span className="footer-text">بطاقة الطالب الرسمية</span>
                    <span className="footer-text" style={{ fontSize: '8px' }}>★ ★ ★</span>
                    <span className="footer-text">امسح الباركود للحضور</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

export default function BulkPrintCardsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>جاري التحميل...</div>}>
      <BulkPrintCardsContent />
    </Suspense>
  );
}
