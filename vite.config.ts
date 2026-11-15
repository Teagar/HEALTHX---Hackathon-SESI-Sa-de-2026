import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // pdf.js usa top-level await e Promise.withResolvers (ES2022).
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
