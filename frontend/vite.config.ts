import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer TypeScript source files when both TSX/JSX exist.
    extensions: ['.mjs', '.js', '.mts', '.ts', '.tsx', '.jsx', '.json'],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-big-calendar') || id.includes('date-fns')) return 'calendarVendor';
          if (id.includes('@tiptap') || id.includes('tinymce')) return 'editorVendor';
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
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          // Proxy configuration
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 30000, // 30 seconds for hooks
    teardownTimeout: 10000, // 10 seconds for teardown
    pool: 'forks', // Use forks instead of threads for better isolation
    forks: {
      singleFork: false,
      isolate: true,
    },
    maxWorkers: 2, // Limit workers to prevent resource exhaustion
    minWorkers: 1,
    sequence: {
      shuffle: false, // Don't shuffle to make debugging easier
    },
  },
}) 