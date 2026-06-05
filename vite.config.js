import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    base: '/',
    plugins: [react()],
    server: {
      host: true,
      allowedHosts: true,
      proxy: {
        '/users': 'http://localhost:3001',
        '/inquiries': 'http://localhost:3001',
        '/inspections': 'http://localhost:3001',
        '/notices': 'http://localhost:3001',
        '/resources': 'http://localhost:3001',
        '/upload': 'http://localhost:3001',
        '/uploads': 'http://localhost:3001',
        '/settings': 'http://localhost:3001',
        '/item_master': 'http://localhost:3001',
        '/api': 'http://localhost:3001'
      }
    }
  }
})
