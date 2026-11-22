import { test, expect, type Page, type Frame } from '@playwright/test'

async function open(page: Page, url = '/') {
  await page.goto(url)
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub'])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await page.waitForTimeout(400)
}
const frame = (page: Page): Frame => page.frames().find((f) => f.url().startsWith('blob:'))!
const body = (page: Page, prop: string) => frame(page).evaluate((p) => getComputedStyle(document.body).getPropertyValue(p), prop)
const renderer = (page: Page, attr: string) => page.evaluate((a) => (document.querySelector('foliate-view') as any).renderer.getAttribute(a), attr)
async function openSheet(page: Page) {
  if (await page.getByTestId('reading-settings-button').count() === 0) await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2)
  await page.getByTestId('reading-settings-button').click()
  await expect(page.getByRole('dialog', { name: 'Reading settings' })).toBeVisible()
}

test('all 14 page colours are offered and apply to the page', async ({ page }) => {
  await open(page)
  await openSheet(page)
  await expect(page.locator('[data-testid^="theme-"]')).toHaveCount(14)
  await page.getByTestId('theme-ember').click()
  await expect.poll(() => frame(page).evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(29, 23, 20)')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/shots/aa-sheet-${test.info().project.name}.png` })
})

test('fonts are shown in their own typeface and change the book', async ({ page }) => {
  await open(page)
  await openSheet(page)
  await expect(page.locator('[data-testid^="font-"]:not([data-testid^="font-size"])')).toHaveCount(8)
  expect(await page.getByTestId('font-vollkorn').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Vollkorn')
  await page.getByTestId('font-vollkorn').click()
  await expect.poll(() => body(page, 'font-family')).toContain('Vollkorn')
  await expect.poll(() => frame(page).evaluate(() => document.fonts.check("16px 'Vollkorn'"))).toBe(true)
})

test('line spacing and margins change the page', async ({ page }) => {
  await open(page)
  await openSheet(page)
  await page.getByRole('radio', { name: 'Airy' }).click()
  await expect.poll(async () => parseFloat(await body(page, 'line-height')) / parseFloat(await body(page, 'font-size'))).toBeCloseTo(1.8, 1)
  await page.getByRole('radio', { name: 'Wide' }).click()
  await expect.poll(() => renderer(page, 'gap')).toBe('12%')
  await page.getByRole('radio', { name: 'Narrow' }).click()
  await expect.poll(() => renderer(page, 'gap')).toBe('4%')
})

test('two columns can be switched off on the laptop (and the switch is not on the phone)', async ({ page }) => {
  await open(page)
  await openSheet(page)
  if (test.info().project.name === 'iphone') { await expect(page.getByTestId('columns-switch')).toHaveCount(0); return }
  expect(await renderer(page, 'max-column-count')).toBe('2')
  await page.getByTestId('columns-switch').click()
  await expect.poll(() => renderer(page, 'max-column-count')).toBe('1')
})

test('changing the font keeps your place in the chapter', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350) }
  const before = await page.getByTestId('novel').getAttribute('data-cfi')
  await openSheet(page)
  await page.getByTestId('font-instrument').click()
  await page.waitForTimeout(800)
  const after = await page.getByTestId('novel').getAttribute('data-cfi')
  const chapter = (c: string | null) => c?.match(/^epubcfi\(\/6\/(\d+)!/)?.[1]
  expect(chapter(after)).toBe(chapter(before))
  expect(after).not.toBe('epubcfi(/6/2!/4/2/1:0)')
})

test('a font saved by an older version falls back to Newsreader', async ({ page }) => {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
  await page.evaluate(() => (window as any).__rdonly.records().put('settings', { id: 'font', value: 'literata', updatedAt: 1 }))
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub'])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await expect.poll(() => body(page, 'font-family')).toContain('Newsreader')
})
