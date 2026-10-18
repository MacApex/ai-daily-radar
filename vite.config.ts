import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Unique id per build. The running page compares it with the deployed /version.json
// and reloads itself when a newer deploy is live (see src/lib/freshness.ts).
const BUILT_AT = new Date().toISOString()
const SHA = (process.env.GITHUB_SHA ?? 'local').slice(0, 12)
const BUILD_ID = `${BUILT_AT}-${SHA}`

function versionFile(): Plugin {
  return {
    name: 'radar-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, built_at: BUILT_AT, sha: SHA }) + '\n' })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  base: '/ai-daily-radar/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (/node_modules\/framer-motion\//.test(id)) return 'motion'
        },
      },
    },
  },
})
