import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

import { cloudflare } from "@cloudflare/vite-plugin";

function normalizeBasePath(basePath) {
  if (!basePath) return '/'
  const withSlashPrefix = basePath.startsWith('/') ? basePath : `/${basePath}`
  return withSlashPrefix.endsWith('/') ? withSlashPrefix : `${withSlashPrefix}/`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = normalizeBasePath(env.VITE_APP_BASE_PATH || '/')

  return {
    base,
    plugins: [vue(), cloudflare()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets'
    }
  };
})