import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  '#eef7f7',
          100: '#c9e8e8',
          200: '#9dd4d4',
          400: '#4aabaa',
          600: '#0f7c7b',
          700: '#0c6665',
          800: '#0a5251',
          900: '#073938',
        },
        amber: {
          50:  '#fef8ee',
          100: '#fdeacb',
          300: '#f8c06a',
          500: '#e8952a',
          700: '#b86d10',
          900: '#6b3a06',
        },
        slate: {
          50:  '#f8f7f5',
          100: '#eeede9',
          200: '#dddbd4',
          400: '#a8a49b',
          600: '#6b6760',
          800: '#2e2c28',
          900: '#1a1917',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        body:    ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-up':    'slideUp 0.35s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                       to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight:{ from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.6' } },
      },
      boxShadow: {
        'card':  '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06)',
        'sidebar': '4px 0 24px 0 rgba(0,0,0,.08)',
      },
    },
  },
  plugins: [],
};

export default config;
