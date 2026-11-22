import { test, expect, type Page } from '@playwright/test'

const isPhone = () => test.info().project.name === 'iphone'
async function menuFor(page: Page, title: string) {
  const card = page.getByTestId('book-card').filter({ hasText: title })
  await card.scrollIntoViewIfNeeded()
  if (!isPhone()) await card.click({ button: 'right' })
  else { const b = (await card.locator('.book-cover').boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.6); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up() }
  await expect(page.getByTestId('book-actions')).toBeVisible()
}
async function setup(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub', 'tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz', 'tests/fixtures/doc.pdf'])
  await expect(page.getByTestId('book-card')).toHaveCount(4)
}
const tab = (page: Page, name: RegExp | string) => page.getByRole('tab', { name })

test('a clear Settings button opens settings', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('the last book you read sits on top as a Continue card, and Resume opens it', async ({ page }) => {
  await setup(page)
  await expect(page.getByTestId('continue-card')).toHaveCount(0)
  await page.getByTestId('book-card').filter({ hasText: 'plain' }).click()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('continue-card')).toContainText('plain')
  await expect(page.getByTestId('book-card').filter({ hasText: 'plain' }).getByTestId('cover-progress')).toBeVisible()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `test-results/shots/library-v2-${test.info().project.name}.png`, fullPage: true })
  await page.getByTestId('continue-card').getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByTestId('reader')).toBeVisible()
})

test('status tabs count and filter automatically; mark as finished moves a book', async ({ page }) => {
  await setup(page)
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub'])
  await expect(page.getByTestId('book-card')).toHaveCount(5)
  await page.getByTestId('book-card').filter({ hasText: 'The Long Road' }).click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await page.keyboard.press('Escape')
  await expect(tab(page, /^Reading/)).toContainText('1')
  await expect(tab(page, /^Not started/)).toContainText('4')
  await tab(page, /^Reading/).click()
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await menuFor(page, 'The Long Road')
  await page.getByRole('button', { name: 'Mark as finished' }).click()
  await tab(page, /^Finished/).click()
  await expect(page.getByTestId('book-card')).toHaveText([/The Long Road/])
  await expect(page.getByTestId('book-card').getByTestId('cover-progress').locator('.done')).toBeVisible()
})

test('type chips, search and sort narrow and order the grid', async ({ page }) => {
  await setup(page)
  await page.getByRole('checkbox', { name: 'Manga' }).click()
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await page.getByRole('checkbox', { name: 'Document' }).click()
  await expect(page.getByTestId('book-card')).toHaveCount(2)
  await page.getByRole('checkbox', { name: 'Manga' }).click(); await page.getByRole('checkbox', { name: 'Document' }).click()
  await page.getByRole('searchbox').fill('writer')
  await expect(page.getByTestId('book-card')).toHaveText([/Test Novel/])
  await page.getByRole('searchbox').fill('zzz')
  await expect(page.getByTestId('no-results')).toBeVisible()
  await page.getByRole('searchbox').fill('')
  await page.getByTestId('sort-button').click()
  await page.getByRole('menuitemradio', { name: 'Title A–Z' }).click()
  const titles = await page.getByTestId('book-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(titles).toEqual(['Open plain', 'Open Test Doc', 'Open Test Manga Vol. 3', 'Open Test Novel'])
})

test('your own tags are searchable', async ({ page }) => {
  await setup(page)
  await menuFor(page, 'Test Doc')
  await page.getByRole('button', { name: 'Edit details' }).click()
  await page.getByLabel('Tags').fill('Field guide, birds')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('searchbox').fill('BIRDS')
  await expect(page.getByTestId('book-card')).toHaveText([/Test Doc/])
})

test('make a collection, add a book from its menu, and see it in the tab', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'New collection' }).click()
  await page.getByLabel('Name').fill('Want to read')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(tab(page, /Want to read/)).toBeVisible()
  await menuFor(page, 'Test Manga')
  await page.getByRole('button', { name: 'Add to collection…' }).click()
  await page.getByRole('checkbox', { name: 'Want to read' }).check()
  await page.keyboard.press('Escape')
  await expect(tab(page, /Want to read/)).toContainText('1')
  await tab(page, /Want to read/).click()
  await expect(page.getByTestId('book-card')).toHaveText([/Test Manga/])
})

test('cover size slider changes the covers', async ({ page }) => {
  await setup(page)
  const w = () => page.getByTestId('book-card').first().evaluate((el) => el.getBoundingClientRect().width)
  const before = await w()
  await page.getByRole('slider', { name: 'Cover size' }).fill('1.4')
  await expect.poll(w).toBeGreaterThan(before * 1.2)
})

test('on the phone, search and tabs stay at the top while scrolling', async ({ page }) => {
  test.skip(!isPhone())
  await setup(page)
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub', 'tests/fixtures/long.pdf', 'tests/fixtures/webtoon.cbz', 'tests/fixtures/bare.epub'])
  await expect(page.getByTestId('book-card')).toHaveCount(8)
  await page.mouse.wheel(0, 900); await page.waitForTimeout(400)
  const y = (await page.getByRole('tablist').boundingBox())!.y
  expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(140)
})
