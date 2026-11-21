import { test, expect } from '@playwright/test'

test('laptop: Import offers books or a folder of images, explained plainly', async ({ page }) => {
  test.skip(test.info().project.name !== 'laptop')
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub'])
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  await expect(page.getByTestId('import-folder-button')).toHaveCount(0) // no mystery "Folder" button
  await page.getByTestId('import-button').click()
  await expect(page.getByRole('menuitem', { name: /Books/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Folder of images/ })).toContainText('one comic')
  await page.screenshot({ path: 'test-results/shots/import-menu-laptop.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('phone: Import goes straight to the file picker', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub'])
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('import-button').click()
  await chooser
  await expect(page.getByRole('menu')).toHaveCount(0)
})
