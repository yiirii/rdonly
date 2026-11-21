// Renders the flat app icon to PNGs with headless Chrome. Run: npx tsx scripts/make-icons.ts
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Full-bleed (no rounded corners: iOS and Android mask the icon themselves).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#111214"/>
  <rect x="96" y="380" width="320" height="30" rx="8" fill="#25282d"/>
  <rect x="96" y="410" width="320" height="12" rx="4" fill="#0b0c0e"/>
  <rect x="122" y="150" width="78" height="230" rx="10" fill="#c8a96a"/><rect x="122" y="150" width="78" height="6" fill="#fff" opacity=".28"/>
  <rect x="212" y="108" width="68" height="272" rx="10" fill="#7aa2f7"/><rect x="212" y="108" width="68" height="6" fill="#fff" opacity=".28"/>
  <rect x="292" y="176" width="84" height="204" rx="10" fill="#e06c75" transform="rotate(9 334 380)"/>
</svg>`
writeFileSync('public/icons/icon.svg', svg)

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['maskable-512.png', 512]] as const) {
  await page.setViewportSize({ width: size, height: size })
  const pad = name.startsWith('maskable') ? 0.12 : 0
  await page.setContent(`<body style="margin:0;background:#111214"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${size * (1 - 2 * pad)}px;margin:${size * pad}px;display:block"></body>`)
  writeFileSync(`public/icons/${name}`, await page.screenshot({ omitBackground: false }))
}
await browser.close()
console.log('icons written')
