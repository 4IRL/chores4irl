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
      '@assets': path.resolve(__dirname, './src/assets'),
      '@customTypes': path.resolve(__dirname, '../types'),
      '@src': path.resolve(__dirname, './'),
      '@utils': path.resolve(__dirname, './src/utils')
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000'
    },
  }
})