import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Componentele stau in ../../web/src/backoffice (in afara acestui folder):
// - fs.allow lasa serverul de dev sa le citeasca
// - dedupe face ca "react" importat de acolo sa vina din node_modules de aici
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: ['../..'] } },
});
