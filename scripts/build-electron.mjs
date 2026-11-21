// Bundles the Electron main/preload and builds the renderer with relative paths into dist-electron/app.
import { build } from 'esbuild'
import { execSync } from 'node:child_process'

execSync('npx vite build --mode electron --outDir dist-electron/app --emptyOutDir', { stdio: 'inherit' })
const common = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron'], sourcemap: false }
await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' })
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' })
console.log('electron bundle ready')
