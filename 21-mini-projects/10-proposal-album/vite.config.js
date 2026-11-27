import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bits': fileURLToPath(new URL('./src/react-bits', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4000,
    strictPort: true,
    allowedHosts: ['dodonet.iptime.org'],
    fs: {
      allow: [fileURLToPath(new URL('.', import.meta.url))],
    },
  },
});
