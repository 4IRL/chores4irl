import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@customTypes': path.resolve(__dirname, '../types')
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000'
    },
  }
})