/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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