import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const port = Number(env.PORT ?? 2985);
  const bffUrl = (env.REMOTE_BFF_URL ?? 'http://127.0.0.1:2980').replace(/\/$/, '');
  return {
    server: {
      port,
      strictPort: true,
      origin: `${bffUrl}/remotes/todo`,
    },
    preview: {
      port,
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
  };
});
