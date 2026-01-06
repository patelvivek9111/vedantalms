import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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