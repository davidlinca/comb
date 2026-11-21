import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Calea locală a proiectului conține ":" (BANK:RUPT), care strică verificarea fs.allow din Vite.
    // Fără strict, dev-server-ul servește fișierele normal. Nu afectează build-ul de producție.
    fs: { strict: false },
  },
});
