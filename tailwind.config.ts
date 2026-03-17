import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#F5C518',
          light: '#FFD700',
          dark: '#D4A017',
        },
        dark: {
          50: '#1a1a2e',
          100: '#16213e',
          200: '#0f3460',
          300: '#0a0a0f',
          400: '#111118',
          500: '#1a1a25',
          600: '#22223a',
        },
        accent: {
          DEFAULT: '#4f46e5',
          light: '#7c3aed',
        }
      },
      fontFamily: {
        cairo: ['var(--font-cairo)', 'sans-serif'],
        tajawal: ['var(--font-tajawal)', 'sans-serif'],
      },
      animation: {
        'pulse-gold': 'pulseGold 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-up': 'fadeUp 0.3s ease',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(245,197,24,0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(245,197,24,0.8)' },
        },
        slideIn: {
          from: { transform: 'scale(0.8) translateY(30px)', opacity: '0' },
          to: { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
