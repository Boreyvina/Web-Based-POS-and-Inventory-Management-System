import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Lets you open the POS on a phone/tablet on the same wifi:
    // run `npm run dev -- --host` and use your computer's LAN IP.
    host: true,
  },
});
