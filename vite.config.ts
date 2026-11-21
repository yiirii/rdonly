import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'electron' ? './' : (process.env.BASE_PATH ?? '/'),
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
}))
