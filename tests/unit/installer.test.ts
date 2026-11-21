// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const yml = readFileSync('electron-builder.yml', 'utf8')

describe('Windows installer settings', () => {
  it('never tries to publish from the build (that made CI fail)', () => {
    expect(pkg.scripts['dist:win']).toContain('--publish never')
  })
  it('keeps one stable app id so a new install replaces the old one', () => {
    expect(yml).toMatch(/^appId: com\.justin\.rdonly$/m)
  })
  it('puts an icon on the desktop every time, and in the Start menu', () => {
    expect(yml).toMatch(/createDesktopShortcut: always/)
    expect(yml).toMatch(/createStartMenuShortcut: true/)
  })
  it('is a normal (assisted) installer', () => {
    expect(yml).toMatch(/oneClick: false/)
  })
})

describe('Windows build workflow', () => {
  it('never runs two installer builds at once (avoids a false failure on quick releases)', () => {
    expect(readFileSync('.github/workflows/windows.yml', 'utf8')).toMatch(/concurrency:[\s\S]*group: windows-installer/)
  })
})
