import { test, expect, type Page } from '@playwright/test'

async function importThenBreak(page: Page, fixture: string) {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
  await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  // Replace the stored file with junk so the reader can't open it.
  await page.evaluate(async () => {
    const d = (window as any).__rdonly
    const [b] = await d.records().list('books')
    await d.files().put(b.id, b.format, new Uint8Array(4096).fill(7))
  })
}

for (const fixture of ['long.epub', 'plain.cbz', 'long.pdf']) {
  test(`a book that can't be opened (${fixture}) says so and keeps a way back`, async ({ page }) => {
    await importThenBreak(page, fixture)
    await page.getByTestId('book-card').click()
    await expect(page.getByTestId('reader-error')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(3500) // past the bars' auto-hide
    await expect(page.getByTestId('reader-back')).toBeVisible()
    await page.getByTestId('reader-back').click()
    await expect(page.getByTestId('reader')).toHaveCount(0)
  })
}

test('changing a novel to Manga still opens it as a novel', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub'])
  await page.getByTestId('book-card').click({ button: 'right' })
  await page.getByRole('button', { name: 'Change type' }).click()
  await page.getByRole('radio', { name: 'Manga' }).click()
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
})
