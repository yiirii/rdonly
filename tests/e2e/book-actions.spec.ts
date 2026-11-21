import { test, expect, type Page } from '@playwright/test'

async function importBook(page: Page, fixture: string) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
  await expect(page.getByTestId('book-card')).toHaveCount(1)
}
/** Long-press on the phone, right-click on the laptop. */
async function openActions(page: Page) {
  const card = page.getByTestId('book-card')
  if (test.info().project.name === 'laptop') await card.click({ button: 'right' })
  else {
    const b = (await card.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
    await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up()
  }
  await expect(page.getByTestId('book-actions')).toBeVisible()
  await expect(page.getByTestId('reader')).toHaveCount(0) // the press didn't also open the book
}

test('edit a book’s details', async ({ page }) => {
  await importBook(page, 'plain.cbz')
  await openActions(page)
  await page.screenshot({ path: `test-results/shots/book-actions-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Edit details' }).click()
  await page.getByLabel('Title').fill('My Comic')
  await page.getByLabel('Series').fill('Heroes')
  await page.getByLabel('Volume').fill('4')
  await page.screenshot({ path: `test-results/shots/edit-book-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('book-card')).toContainText('My Comic')
  await page.reload()
  await expect(page.getByTestId('book-card')).toContainText('My Comic')
})

test('change type to Webtoon and it opens as a strip', async ({ page }) => {
  await importBook(page, 'plain.cbz')
  await openActions(page)
  await page.getByRole('button', { name: 'Change type' }).click()
  await page.getByRole('radio', { name: 'Webtoon' }).click()
  await expect(page.getByTestId('book-card')).toContainText('Webtoon')
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('webtoon')).toBeVisible()
})

test('delete a book after confirming', async ({ page }) => {
  await importBook(page, 'novel.epub')
  await openActions(page)
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('book-actions')).toContainText('Delete Test Novel?')
  await page.getByRole('button', { name: 'Delete book' }).click()
  await expect(page.getByTestId('book-card')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('empty-state')).toBeVisible()
})

test('switch a manga to left-to-right from inside the reader, and it sticks', async ({ page }) => {
  await importBook(page, 'manga.cbz')
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('comic')).toHaveAttribute('data-dir', 'rtl')
  if (await page.getByTestId('reader-mode-button').count() === 0) await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2)
  await page.getByTestId('reader-mode-button').click()
  await page.getByRole('menuitemradio', { name: 'Comic (left to right)' }).click()
  await expect(page.getByTestId('comic')).toHaveAttribute('data-dir', 'ltr')
  await page.keyboard.press('Escape')
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('comic')).toHaveAttribute('data-dir', 'ltr')
})

test('switching between paged and strip keeps your page', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await importBook(page, 'plain.cbz')
  await page.getByTestId('book-card').click()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400)
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400)
  if (await page.getByTestId('reader-mode-button').count() === 0) await page.mouse.click(195, 422)
  await page.getByTestId('reader-mode-button').click()
  await page.getByRole('menuitemradio', { name: 'Webtoon (scroll)' }).click()
  await expect(page.getByTestId('webtoon')).toBeVisible()
  await expect(page.getByTestId('reader-progress')).toHaveText('3 / 3')
})
