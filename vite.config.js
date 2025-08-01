import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue' // Add this line

export default defineConfig({
  plugins: [vue()], // Add this line
  server: {
    host: true,
    allowedHosts: ['eiylmyk8s2.loclx.io']
  }
})