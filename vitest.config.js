import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Konfigurasi terpisah dari vite.config.js agar tes tidak menjalankan
// plugin Laravel (fonts/refresh) — cukup lingkungan DOM (jsdom) untuk
// unit test helper dan tes interaksi komponen React.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['tests/js/**/*.{js,jsx}'],
    },
});
