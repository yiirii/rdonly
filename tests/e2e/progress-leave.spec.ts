import { test, expect, type Page } from '@playwright/test'

const shown = (page: Page) => page.locator('[data-testid="comic-spread"][data-current="true"] [data-testid="comic-page"]').first().getAttribute('data-page')

async function openAndTurn(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/webtoon.cbz'])
  await page.getByTestId('book-card').click({ button: 'right' })
  await page.getByRole('button', { name: 'Change type' }).click()
  await page.getByRole('radio', { name: 'Comic' }).click()
  await page.getByTestId('book-card').click()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await page.waitForTimeout(400)
  for (let i = 0; i < 5; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150) }
  await page.waitForTimeout(300)
  return shown(page)
}

test('switching away from the app keeps your place', async ({ page }) => {
  const at = await openAndTurn(page)
  expect(at).not.toBe('0')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(300)
  await page.reload()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await expect.poll(() => shown(page)).toBe(at)
})

test('reloading or closing straight after turning pages keeps your place', async ({ page }) => {
  const at = await openAndTurn(page)
  expect(at).not.toBe('0')
  await page.reload()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await expect.poll(() => shown(page)).toBe(at)
})
