import { test, expect } from '@playwright/test'

// 60 books: only the first rows are on screen. Covers below the fold appear instantly (nobody sees them animate);
// covers on screen still get their full drop-and-tilt.
test('switching tabs animates only the covers you can see', async ({ page }) => {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
  await page.evaluate(async () => {
    const d = (window as any).__rdonly; const records = d.records()
    for (let i = 0; i < 60; i++) await records.put('books', { id: `b${i}`, title: `Book ${String(i).padStart(3, '0')}`, format: 'epub', tag: 'novel', fileName: `b${i}.epub`, fileSize: 1, addedAt: 1000 + i, updatedAt: 1000 + i })
    await records.put('progress', { id: 'b0', locator: '', percent: 0.3, mode: 'novel', updatedAt: 3000 })
    await d.library().getState().load()
  })
  await expect(page.getByTestId('book-card')).toHaveCount(60)
  await page.waitForTimeout(1200)
  await page.getByRole('tab', { name: /Reading/ }).click() // the shelf stays, with one book
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await page.waitForTimeout(600)
  await page.getByRole('tab', { name: /^All/ }).click()
  await page.waitForTimeout(120)
  // Book 000 was already showing on the Reading tab; its glide to the new spot starts on screen, so it stays animated.
  const state = await page.getByTestId('book-card').filter({ hasNotText: 'Book 000' }).evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect(); return { on: r.top < innerHeight && r.bottom > 0, t: getComputedStyle(el).transform, o: +getComputedStyle(el).opacity }
  }))
  const off = state.filter((s) => !s.on), on = state.filter((s) => s.on)
  expect(off.length).toBeGreaterThan(20)
  expect(off.every((s) => s.o === 1 && (s.t === 'none' || s.t === 'matrix(1, 0, 0, 1, 0, 0)')), 'off-screen covers are already settled').toBe(true)
  expect(on.some((s) => s.o < 1 || (s.t !== 'none' && s.t !== 'matrix(1, 0, 0, 1, 0, 0)')), 'on-screen covers are still animating').toBe(true)
})
