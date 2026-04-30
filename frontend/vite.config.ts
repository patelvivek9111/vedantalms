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
        manualChunks: {
          reactVendor: ['react', 'react-dom', 'react-router-dom'],
          editorVendor: ['@tiptap/react', '@tiptap/starter-kit', '@tinymce/tinymce-react'],
          uiVendor: ['lucide-react', 'react-toastify', 'react-big-calendar'],
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