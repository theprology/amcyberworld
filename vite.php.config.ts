import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(projectRoot, 'static'),
  publicDir: path.join(projectRoot, 'public'),
  resolve: {
    alias: {
      'next/image': path.join(projectRoot, 'static', 'shims', 'NextImage.tsx'),
      'next/link': path.join(projectRoot, 'static', 'shims', 'NextLink.tsx'),
    },
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: {
    outDir: path.join(projectRoot, 'php-package'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: path.join(projectRoot, 'static', 'index.html'),
        agent: path.join(projectRoot, 'static', 'agent', 'index.html'),
      },
    },
  },
});
