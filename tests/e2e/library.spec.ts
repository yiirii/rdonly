import { test, expect } from '@playwright/test'

const fx = (n: string) => `tests/fixtures/${n}`
const shot = (page: import('@playwright/test').Page, name: string) =>
  page.screenshot({ path: `test-results/shots/${name}-${test.info().project.name}.png` })

test('import books, see them as cards, and keep them after reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await page.waitForTimeout(600)
  await shot(page, 'library-empty')

  await page.getByTestId('import-input').setInputFiles([fx('novel.epub'), fx('manga.cbz'), fx('doc.pdf'), fx('bare.epub'), fx('book.mobi')])
  await expect(page.getByTestId('book-card')).toHaveCount(4)
  await expect(page.getByRole('status')).toContainText('book.mobi')
  await expect(page.getByTestId('book-card').filter({ hasText: 'Test Novel' }).locator('img')).toBeVisible()
  await page.waitForTimeout(700)
  await shot(page, 'library-filled')

  await page.reload()
  await expect(page.getByTestId('book-card')).toHaveCount(4)

  await page.getByTestId('settings-button').click()
  await expect(page.getByTestId('storage-persist-status')).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, 'settings')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('importing the same file twice keeps one card', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles([fx('novel.epub')])
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await page.getByTestId('import-input').setInputFiles([fx('novel.epub')])
  await expect(page.getByRole('status')).toContainText('already in your library')
  await expect(page.getByTestId('book-card')).toHaveCount(1)
})
