import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Нужно для PowerSync Web Workers
  optimizeDeps: {
    exclude: ['@powersync/web'],
  },
  worker: {
    format: 'es',
  },

  // Tauri specific settings
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}));
