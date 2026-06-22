'use client';
// src/components/StaffHomeSlider.tsx
// سلايدر وشريط أخبار خاص بلوحة المعلمين والمساعدين

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import type { AppHomeSettings } from '@/lib/db/app-settings';
import Image from 'next/image';

interface Props {
  settings: AppHomeSettings;
}

export function StaffHomeSlider({ settings }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slidersWithContent = settings.sliders.filter(s => s.imageUrl || s.videoUrl || s.title);

  // Auto-advance slider
  useEffect(() => {
    if (slidersWithContent.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slidersWithContent.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slidersWithContent.length]);

  return (
    <div className="space-y-4 mb-6" dir="rtl">
      {/* ══ Hero Slider ══ */}
      {slidersWithContent.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-white/5 shadow-xl" style={{ height: '220px' }}>
          {/* Slides */}
          {slidersWithContent.map((slide, i) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ${slide.link ? 'cursor-pointer' : ''}`}
              style={{ opacity: i === currentSlide ? 1 : 0, zIndex: i === currentSlide ? 1 : 0 }}
              onClick={() => {
                if (slide.link) {
                  window.open(slide.link.startsWith('http') ? slide.link : `https://${slide.link}`, '_blank');
                }
              }}
            >
              {slide.youtubeData ? (
                <div className="w-full h-full flex flex-col bg-[#0f0f0f] text-white">
                  <div className="w-full h-[60%]">
                    <img src={slide.youtubeData.banner || slide.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 px-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-black flex-shrink-0 -mt-8 border-[3px] border-[#0f0f0f]">
                      <img src={slide.youtubeData.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="font-bold text-sm truncate">{slide.youtubeData.title || slide.title}</div>
                      <div className="text-[10px] text-gray-400 truncate">{slide.youtubeData.subs || 'قناة يوتيوب'}</div>
                    </div>
                    <div className="bg-white text-black text-[10px] font-bold px-3 py-1.5 rounded-full flex-shrink-0">
                      اشتراك
                    </div>
                  </div>
                </div>
              ) : slide.videoUrl ? (
                <video
                  src={slide.videoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : slide.imageUrl ? (
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
              {!slide.youtubeData && !slide.videoUrl && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(10,10,24,0.9) 0%, rgba(10,10,24,0.2) 50%, transparent 100%)',
                  }}
                />
              )}
              {/* Slide title */}
              {slide.title && (slide.imageUrl || slide.videoUrl) && !slide.youtubeData && (
                <div className="absolute bottom-6 right-6 left-6">
                  <div className="font-cairo font-black text-2xl text-white drop-shadow-lg">{slide.title}</div>
                </div>
              )}
            </div>
          ))}

          {/* Navigation dots */}
          {slidersWithContent.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
              {slidersWithContent.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                  className="transition-all rounded-full"
                  style={{
                    width: i === currentSlide ? '24px' : '8px',
                    height: '8px',
                    background: i === currentSlide ? 'var(--gold)' : 'rgba(255,255,255,0.4)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Navigation arrows */}
          {slidersWithContent.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentSlide(p => (p - 1 + slidersWithContent.length) % slidersWithContent.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all hover:bg-black/70 hover:scale-105"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <ChevronRight size={20} className="text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentSlide(p => (p + 1) % slidersWithContent.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all hover:bg-black/70 hover:scale-105"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <ChevronLeft size={20} className="text-white" />
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ News Ticker / Marquee ══ */}
      {settings.ticker && (
        <div
          className="flex items-center gap-3 px-4 py-3 overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(90deg, rgba(245,197,24,0.1), rgba(245,197,24,0.02))',
            border: '1px solid rgba(245,197,24,0.15)',
          }}
        >
          <div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/20">
            <Zap size={12} />
            <span>جديد</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div
              className="whitespace-nowrap text-sm text-gray-200 font-medium"
              style={{
                animation: 'ticker 20s linear infinite',
              }}
            >
              {settings.ticker}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes ticker {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
