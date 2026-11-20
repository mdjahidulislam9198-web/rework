import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// base './' + hash routing = works under any GitHub Pages path.
export default defineConfig({ base: './', plugins: [react(), tailwindcss()] });
