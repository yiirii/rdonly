import { test, expect } from '@playwright/test'

test('tap a cover to open the reader; Back returns; reload stays in the book', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub'])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('reader')).toBeVisible()
  await expect(page.getByTestId('reader-title')).toHaveText('Test Novel')
  expect(page.url()).toMatch(/#\/read\/[0-9a-f]{64}$/)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `test-results/shots/reader-shell-${test.info().project.name}.png` })
  await page.reload()
  await expect(page.getByTestId('reader')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('book-card')).toBeVisible()
  await expect(page.getByTestId('reader')).toHaveCount(0)
})

test('the back button in the reader returns to the library', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/manga.cbz'])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('reader')).toBeVisible()
  await page.getByTestId('reader-back').click()
  await expect(page.getByTestId('reader')).toHaveCount(0)
  await expect(page.getByTestId('book-card')).toBeVisible()
})

test('a book whose file is gone explains how to fix it', async ({ page }) => {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub'])
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await page.evaluate(async () => {
    const d = (window as any).__rdonly
    const [b] = await d.records().list('books')
    await d.files().remove(b.id)
  })
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('reader-missing')).toBeVisible()
  await expect(page.getByTestId('reader-missing')).toContainText(/import/i)
  await page.screenshot({ path: `test-results/shots/reader-missing-${test.info().project.name}.png` })
})
