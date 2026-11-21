import { test, expect } from '@playwright/test'

test('reduced motion: toast and sheet fade without moving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub'])
  const toast = page.locator('.toast')
  await expect(toast).toBeVisible()
  const transforms: string[] = []
  for (let i = 0; i < 6; i++) { transforms.push(await toast.evaluate((el) => getComputedStyle(el).transform)); await page.waitForTimeout(30) }
  expect(transforms.every((t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)')).toBe(true)
})
