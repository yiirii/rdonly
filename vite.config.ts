import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string

/** Writes version.json and sw.js (with a precache list of every built file) after the build. */
function pwaFiles(): Plugin {
  let outDir = 'dist'
  return {
    name: 'rdonly-pwa',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    closeBundle() {
      const walk = (d: string): string[] => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])
      const files = walk(outDir).map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => !['sw.js', 'version.json'].includes(f) && !f.endsWith('.map') && !f.startsWith('icons/maskable'))
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ version }))
      const sw = readFileSync('src/pwa/sw-template.js', 'utf8').replaceAll('__VERSION__', version).replaceAll('__PRECACHE__', JSON.stringify(['./', ...files]))
      writeFileSync(join(outDir, 'sw.js'), sw)
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'electron' ? './' : (process.env.BASE_PATH ?? '/'),
  plugins: [react(), ...(mode === 'electron' ? [] : [pwaFiles()])],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2022', outDir: 'dist' },
}))
