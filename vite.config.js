import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/', // Ensure this is exactly like this
  build: {
    outDir: 'dist',
    emptyOutDir: true // Clears dist folder on each build
  }
})