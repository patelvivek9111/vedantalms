import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@lms-shared/grading': path.resolve(__dirname, '../shared/grading/index.browser.mjs'),
    },
    // Prefer TypeScript source files when both TSX/JSX exist.
    extensions: ['.mjs', '.js', '.mts', '.ts', '.tsx', '.jsx', '.json'],
  },
  build: {
    sourcemap: false,
    // excelVendor (~940kb) loads only on gradebook export; main entry stays under this limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('exceljs') || id.includes('jszip') || id.includes('archiver')) {
            return 'excelVendor';
          }
          if (id.includes('react-big-calendar') || id.includes('date-fns')) return 'calendarVendor';
          if (id.includes('@tiptap') || id.includes('tinymce')) return 'editorVendor';
          if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('/redux/')) {
            return 'reduxVendor';
          }
          if (id.includes('socket.io')) return 'socketVendor';
          if (id.includes('i18next')) return 'i18nVendor';
          if (id.includes('axios')) return 'httpVendor';
          if (id.includes('@hello-pangea') || id.includes('react-beautiful-dnd')) return 'dndVendor';
          if (id.includes('html5-qrcode') || id.includes('qrcode')) return 'qrVendor';
          if (id.includes('lottie-react') || id.includes('lottie-web')) return 'lottieVendor';
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/')
          ) {
            return 'reactVendor';
          }
          if (id.includes('lucide-react') || id.includes('react-toastify')) return 'uiVendor';
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 30000, // 30 seconds for hooks
    teardownTimeout: 10000, // 10 seconds for teardown
    // threads avoids fork-pool worker hangs on Windows; isolate keeps file-level separation
    pool: 'threads',
    isolate: true,
    maxWorkers: 2,
    sequence: {
      shuffle: false, // Don't shuffle to make debugging easier
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
}) 