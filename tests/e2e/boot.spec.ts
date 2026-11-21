import { test, expect } from '@playwright/test'

test('app boots to the library with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await page.screenshot({ path: `test-results/shots/boot-${test.info().project.name}.png` })
  expect(errors).toEqual([])
})
