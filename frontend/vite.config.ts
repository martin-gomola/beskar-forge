import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

function collectDistFiles(dir: string, rootDir = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return []

    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return collectDistFiles(absolutePath, rootDir)
    }

    return [path.relative(rootDir, absolutePath).split(path.sep).join('/')]
  })
}

/**
 * Injects build metadata into sw.js after Vite emits the final dist files.
 * This keeps the template framework-agnostic while still precaching the real
 * hashed production assets that a browser needs after deploy.
 */
function swMetadataPlugin(): Plugin {
  return {
    name: 'sw-metadata',
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      const swPath = path.resolve(outDir, 'sw.js')
      if (fs.existsSync(swPath)) {
        const precacheUrls = collectDistFiles(outDir)
          .filter((fileName) => fileName !== 'sw.js' && !fileName.endsWith('.map'))
          .map((fileName) => `/${fileName}`)

        const content = fs.readFileSync(swPath, 'utf-8')
        fs.writeFileSync(
          swPath,
          content
            .replaceAll('__BUILD_VERSION__', Date.now().toString())
            .replaceAll('__PRECACHE_URLS__', JSON.stringify(precacheUrls, null, 2)),
        )
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    swMetadataPlugin(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || '0.1.0'),
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    host: true,
    watch: process.env.VITE_USE_POLLING === 'true'
      ? { usePolling: true, interval: Number(process.env.CHOKIDAR_INTERVAL || 300) }
      : undefined,
    hmr: (process.env.VITE_HMR_HOST || process.env.VITE_HMR_CLIENT_PORT)
      ? {
          host: process.env.VITE_HMR_HOST || 'localhost',
          clientPort: Number(process.env.VITE_HMR_CLIENT_PORT || 3021),
        }
      : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8060',
        changeOrigin: true,
      },
    },
    headers: {
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  },
})
