'use client';
// src/components/AppHome.tsx
// الصفحة الرئيسية للتطبيق — Slider + Ticker + Categories

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Gift, Zap, Star } from 'lucide-react';
import type { AppHomeSettings, CategoryItem } from '@/lib/db/app-settings';
import Link from 'next/link';
import Image from 'next/image';

interface Props {
  settings: AppHomeSettings;
  onCategoryClick: (cat: CategoryItem) => void;
  examsCount?: number;
  coursesCount?: number;
  assignmentsCount?: number;
  studentName?: string;
}

export function AppHome({ settings, onCategoryClick, examsCount = 0, coursesCount = 0, assignmentsCount = 0, studentName }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef<any>(null);
  const slidersWithContent = settings.sliders.filter(s => s.imageUrl || s.title);

  // Auto-advance slider
  useEffect(() => {
    if (slidersWithContent.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slidersWithContent.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slidersWithContent.length]);

  // Sort categories by order
  const sortedCategories = [...settings.categories].sort((a, b) => a.order - b.order);

  const getCategoryStats = (cat: CategoryItem) => {
    if (cat.targetTab === 'exams') return examsCount;
    if (cat.targetTab === 'courses') return coursesCount;
    if (cat.targetTab === 'assignments') return assignmentsCount;
    return null;
  };

  return (
    <div className="pb-4" dir="rtl">

      {/* ══ Hero Slider ══ */}
      {slidersWithContent.length > 0 && (
        <div className="relative overflow-hidden" style={{ height: '160px' }}>
          {/* Slides */}
          {slidersWithContent.map((slide, i) => (
            <div
              key={slide.id}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: i === currentSlide ? 1 : 0 }}
            >
              {slide.imageUrl ? (
                <Image
                  src={slide.imageUrl}
                  alt={slide.title || ''}
                  className="w-full h-full object-cover"
                  fill
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 50%, #16213e 100%)',
                  }}
                >
                  <div className="text-center">
                    <div className="text-5xl mb-3">🎓</div>
                    <div className="font-cairo font-black text-xl gold-text">{slide.title}</div>
                  </div>
                </div>
              )}
              {/* Overlay gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(10,10,24,0.9) 0%, rgba(10,10,24,0.2) 50%, transparent 100%)',
                }}
              />
              {/* Slide title */}
              {slide.title && slide.imageUrl && (
                <div className="absolute bottom-8 right-4 left-4">
                  <div className="font-cairo font-black text-2xl text-white drop-shadow-lg">{slide.title}</div>
                </div>
              )}
            </div>
          ))}

          {/* Navigation dots */}
          {slidersWithContent.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
              {slidersWithContent.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className="transition-all rounded-full"
                  style={{
                    width: i === currentSlide ? '20px' : '6px',
                    height: '6px',
                    background: i === currentSlide ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Navigation arrows */}
          {slidersWithContent.length > 1 && (
            <>
              <button
                onClick={() => setCurrentSlide(p => (p - 1 + slidersWithContent.length) % slidersWithContent.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center z-10"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <ChevronRight size={18} className="text-white" />
              </button>
              <button
                onClick={() => setCurrentSlide(p => (p + 1) % slidersWithContent.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center z-10"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <ChevronLeft size={18} className="text-white" />
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ News Ticker / Marquee ══ */}
      {settings.ticker && (
        <div
          className="flex items-center gap-3 px-3 py-2 overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, rgba(245,197,24,0.08), rgba(245,197,24,0.03))',
            borderBottom: '1px solid rgba(245,197,24,0.1)',
            borderTop: '1px solid rgba(245,197,24,0.1)',
          }}
        >
          <div className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">
            <Zap size={10} />
            <span>جديد</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div
              className="whitespace-nowrap text-xs text-gray-300 font-medium"
              style={{
                animation: 'ticker 20s linear infinite',
              }}
            >
              {settings.ticker}
            </div>
          </div>
        </div>
      )}

      {/* ══ Daily Reward Banner ══ */}
      {settings.showDailyReward && (
        <div className="mx-4 mt-4">
          <div
            className="flex items-center gap-3 p-3.5 rounded-2xl border"
            style={{
              background: 'linear-gradient(135deg, rgba(245,197,24,0.08), rgba(245,197,24,0.03))',
              borderColor: 'rgba(245,197,24,0.2)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gold), #e6a800)' }}
            >
              <Gift size={20} className="text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-white">المكافأة اليومية</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{settings.dailyRewardText}</div>
            </div>
            <span
              className="text-xs font-black px-2.5 py-1 rounded-xl flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--gold), #e6a800)',
                color: '#000',
              }}
            >
              LIVE
            </span>
          </div>
        </div>
      )}

      {/* ══ Category Grid (like the screenshot) ══ */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-cairo font-black text-base text-white">الأقسام</h2>
          <span className="text-xs text-gold opacity-70">عرض الكل</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {sortedCategories.map((cat) => {
            const stats = getCategoryStats(cat);
            const isGold = cat.color === '#f5c518';
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryClick(cat)}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border transition-all active:scale-95 hover:scale-[1.03]"
                style={{
                  background: `linear-gradient(135deg, ${cat.color}18 0%, ${cat.color}08 100%)`,
                  borderColor: `${cat.color}28`,
                  minHeight: '100px',
                }}
              >
                <span className="text-3xl mb-2 leading-none">{cat.icon}</span>
                <span className="text-xs font-bold text-white text-center leading-tight">{cat.title}</span>
                {stats !== null && stats > 0 && (
                  <span
                    className="mt-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: `${cat.color}30`, color: cat.color }}
                  >
                    {stats}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ Quick Stats Row ══ */}
      <div className="px-4 mt-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'اختبار متاح', value: examsCount, color: '#f5c518', icon: '📋' },
            { label: 'كورس', value: coursesCount, color: '#3b82f6', icon: '📚' },
            { label: 'واجب', value: assignmentsCount, color: '#8b5cf6', icon: '📝' },
          ].map((stat, i) => (
            <div
              key={i}
              className="p-3 rounded-2xl text-center"
              style={{
                background: `${stat.color}0F`,
                border: `1px solid ${stat.color}20`,
              }}
            >
              <div className="text-xl mb-0.5">{stat.icon}</div>
              <div className="font-black text-lg leading-none" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ticker {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
