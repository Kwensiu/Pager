import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// 读取 package.json 中的版本号
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
const appVersion = packageJson.version

export default defineConfig({
  main: {
    plugins: []
  },
  preload: {
    plugins: []
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, './src/renderer'),
        '@renderer': resolve(__dirname, './src/renderer'),
        '@shared': resolve(__dirname, './src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['electron', 'fs', 'path']
      }
    },
    plugins: [react()],
    css: {
      postcss: resolve(__dirname, 'postcss.config.js')
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion)
    }
  }
})
