/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../desktop/src/ui/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          950: '#07090e',
          900: '#0c0f18',
          800: '#10141f',
          700: '#151a28',
          600: '#1a2032',
          500: '#202843',
        },
        ink: {
          950: '#07090e',
        },
        border: {
          subtle: '#161d2e',
          DEFAULT: '#1e2740',
          strong: '#273351',
        },
        brand: {
          DEFAULT: '#3b82f6',
          dim: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in':       'fadeIn 0.35s ease-out',
        'slide-up':      'slideUp 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'count-up':      'countUp 0.6s ease-out',
        'pulse-slow':    'pulse 3s ease-in-out infinite',
        'skeleton':      'skeleton 1.5s ease-in-out infinite',
        'spin-slow':     'spin 3s linear infinite',
        'bar-grow':      'barGrow 0.6s ease-out forwards',
      },
      keyframes: {
        fadeIn:      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:     { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInLeft: { '0%': { transform: 'translateX(-12px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        skeleton:    { '0%, 100%': { opacity: '0.4' }, '50%': { opacity: '0.7' } },
        barGrow:     { '0%': { width: '0%' }, '100%': { width: 'var(--bar-width)' } },
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)',
        'card-hover': '0 4px 16px 0 rgba(0,0,0,0.5), 0 2px 6px -1px rgba(0,0,0,0.4)',
        'glow-blue':  '0 0 20px rgba(59,130,246,0.15)',
        'glow-green': '0 0 20px rgba(16,185,129,0.15)',
        'glow-red':   '0 0 20px rgba(239,68,68,0.15)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
