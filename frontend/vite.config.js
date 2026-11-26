import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.trycloudflare.com','localhost'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://uap-backend:5000',
        changeOrigin: true,
        xfwd: true,
        ws: true,
      },
      '/uploads': {
        target: process.env.VITE_API_TARGET || 'http://uap-backend:5000',
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'editor': ['react-quill'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
});
