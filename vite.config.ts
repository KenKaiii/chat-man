import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
    watch: {
      // Ignore data directory to prevent HMR reload when RAG files change
      ignored: ['**/data/**', '**/node_modules/**', '**/.git/**'],
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});
