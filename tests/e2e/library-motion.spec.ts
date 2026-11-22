import { test, expect, type Page } from '@playwright/test'

async function newCollection(page: Page, name: string) {
  await page.getByRole('button', { name: 'New collection' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
}
async function seed(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub', 'tests/fixtures/plain.cbz'])
  await expect(page.getByTestId('book-card')).toHaveCount(2)
}

test('a new collection tab arrives with a burst of little squares in its colour', async ({ page }) => {
  await seed(page)
  await newCollection(page, 'Holiday')
  const burst = page.getByTestId('tab-burst')
  await expect(burst).toBeVisible()
  await expect(burst.locator('i')).toHaveCount(6)
  await expect(burst).toHaveCount(0, { timeout: 3000 }) // cleans itself up
  await page.reload()
  await expect(page.getByRole('tab', { name: /Holiday/ })).toBeVisible()
  await expect(page.getByTestId('tab-burst')).toHaveCount(0) // existing tabs don't burst on load
})

test('turning on a type chip shrinks the others to dots', async ({ page }) => {
  await seed(page)
  await page.getByRole('checkbox', { name: 'Comic' }).click()
  const off = page.getByRole('checkbox', { name: 'Novel' }).locator('.chip-dot')
  await expect.poll(() => off.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(0.7)
  const on = page.getByRole('checkbox', { name: 'Comic' }).locator('.chip-dot')
  expect(await on.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform === 'none' ? '' : getComputedStyle(el).transform).a)).toBe(1)
})

test('reduced motion: no burst', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page)
  await newCollection(page, 'Quiet')
  await expect(page.getByRole('tab', { name: /Quiet/ })).toBeVisible()
  await expect(page.getByTestId('tab-burst')).toHaveCount(0)
})
