import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 2803,
    strictPort: true,
    origin: 'http://localhost:2801/remotes/todo',
  },
  preview: {
    port: 2803,
    strictPort: true,
  },
  plugins: [
    react(),
    federation({
      name: 'todo',
      filename: 'remoteEntry.js',
      dts: false,
      shared: {},
      exposes: {
        './mount': './src/mount.tsx',
      },
    }),
  ],
});
