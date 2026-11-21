import { test, expect } from '@playwright/test'

test('CBR and CB7 comics import with their details and cover', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/manga.cbr', 'tests/fixtures/manga.cb7'])
  await expect(page.getByTestId('book-card')).toHaveCount(2)
  for (const card of await page.getByTestId('book-card').all()) {
    await expect(card).toContainText('Test Manga Vol. 3')
    await expect(card).toContainText('Manga')
    await expect(card.locator('img')).toBeVisible()
  }
})

test('a folder of images becomes one comic', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone', 'folder import is a laptop feature')
  await page.goto('/')
  const dir = 'tests/fixtures/folder-comic'
  await page.getByTestId('import-folder-input').setInputFiles(dir)
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await expect(page.getByTestId('book-card')).toContainText('folder-comic')
  await expect(page.getByTestId('book-card')).toContainText('Comic')
})
