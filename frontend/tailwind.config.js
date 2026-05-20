/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'qw-podium-rise': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'qw-podium-slot': {
          '0%': { transform: 'translateY(48px) scale(0.85)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'qw-confetti': {
          '0%': { transform: 'translateY(-12vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(105vh) rotate(640deg)', opacity: '0.2' },
        },
        'qw-rank-in': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'qw-gold-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 18px rgba(250,204,21,0.55))' },
          '50%': { filter: 'drop-shadow(0 0 36px rgba(250,204,21,1))' },
        },
        'qw-celebrate-bg': {
          '0%, 100%': { opacity: '0.12' },
          '50%': { opacity: '0.28' },
        },
      },
      animation: {
        'qw-podium-rise': 'qw-podium-rise 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'qw-podium-slot': 'qw-podium-slot 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'qw-confetti': 'qw-confetti linear forwards',
        'qw-rank-in': 'qw-rank-in 0.5s ease-out forwards',
        'qw-gold-glow': 'qw-gold-glow 2.2s ease-in-out infinite',
        'qw-celebrate-bg': 'qw-celebrate-bg 2s ease-in-out infinite',
      },
      colors: {
        // Enhanced dark mode colors
        dark: {
          bg: {
            primary: '#0f172a',      // slate-900
            secondary: '#1e293b',    // slate-800
            tertiary: '#334155',     // slate-700
            card: '#1e293b',         // slate-800
            hover: '#334155',        // slate-700
          },
          text: {
            primary: '#f1f5f9',      // slate-100
            secondary: '#cbd5e1',    // slate-300
            tertiary: '#94a3b8',     // slate-400
          },
          border: {
            primary: '#334155',      // slate-700
            secondary: '#475569',    // slate-600
          }
        }
      }
    },
  },
  plugins: [],
} 