import { defineConfig } from 'vitest/config'
// Runs only in CI, inside `firebase emulators:exec` (Google hosts are unreachable from the dev sandbox).
export default defineConfig({ test: { include: ['tests/emulator/**/*.test.ts'], environment: 'node', testTimeout: 30_000, fileParallelism: false } })
