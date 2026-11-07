import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// PORT and BASE_PATH are injected by Replit workflows/deployment.
// For local builds and generic deployments, we fall back to sensible defaults
// so `pnpm run build` doesn't crash when env vars are absent. At runtime,
// `server` still uses these values for `vite --host` dev server binding.
const port = Number(process.env.PORT ?? '5173');
const basePath = process.env.BASE_PATH ?? '/';

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // During `pnpm --filter @workspace/toolstack run dev` the API runs
    // separately (e.g. on 5001). Proxy `/api` so the frontend can call the
    // backend without CORS issues in local dev.
    proxy: process.env.API_URL
      ? { '/api': { target: process.env.API_URL, changeOrigin: true } }
      : undefined,
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
