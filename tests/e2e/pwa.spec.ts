import { test, expect } from '@playwright/test'

test('installable: manifest, apple touch icon and theme colour', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const m = await (await request.get(href!)).json()
  expect(m.name).toBe('Rd Only')
  expect(m.display).toBe('standalone')
  expect(m.background_color).toBe('#111214')
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  expect((await request.get(touch!)).headers()['content-type']).toBe('image/png')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
})

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // now controlled by the service worker
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await context.setOffline(false)
})

test('version check always goes to the network', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  const ok = await page.evaluate(async () => {
    try { await fetch('version.json', { cache: 'no-store' }); return true } catch { return false }
  })
  expect(ok).toBe(false) // never answered from cache
  await context.setOffline(false)
  const v = await page.evaluate(async () => (await fetch('version.json', { cache: 'no-store' })).json())
  expect(v.version).toMatch(/^\d+\.\d+\.\d+$/)
})
