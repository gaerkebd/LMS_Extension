import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifestJson from './manifest.json';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  // In dev mode, the service-worker-loader.js imports from the Vite dev server
  // (http://localhost:5173/...). Chrome blocks those fetches unless the extension
  // has host_permissions for that origin.
  const manifest = isDev
    ? {
        ...manifestJson,
        host_permissions: [
          ...manifestJson.host_permissions,
          'http://localhost:5173/*',
        ],
      }
    : manifestJson;

  const inputs: Record<string, string> = {
    popup: resolve(__dirname, 'src/popup/index.html'),
    options: resolve(__dirname, 'src/options/index.html'),
  };

  if (isDev) {
    inputs.debug = resolve(__dirname, 'src/debug/index.html');
  }

  return {
    plugins: [
      react(),
      crx({ manifest }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: inputs,
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Allow requests from chrome-extension:// origins so the service worker
      // loader can import @vite/env and the service worker script from localhost.
      cors: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      },
    },
    legacy: {
      skipWebSocketTokenCheck: true,
    },
  };
});
