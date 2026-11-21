import { test, expect, type Page } from '@playwright/test'

test.skip(({ isMobile }) => isMobile, 'hover is a mouse thing')

async function openAndWaitHidden(page: Page, fixture: string, ready: string) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
  await page.getByTestId('book-card').click()
  await page.locator(ready).first().waitFor({ timeout: 15000 })
  await page.mouse.move(720, 450)
  await expect(page.getByTestId('reader-back')).toHaveCount(0, { timeout: 6000 })
}

for (const [fixture, ready] of [['plain.cbz', '[data-testid="comic-page"] img'], ['long.epub', '[data-testid="novel"][data-cfi]']] as const) {
  test(`moving the mouse to the top or bottom edge shows the bars (${fixture})`, async ({ page }) => {
    await openAndWaitHidden(page, fixture, ready)
    await page.mouse.move(720, 20, { steps: 4 })
    await expect(page.getByTestId('reader-back')).toBeVisible()
    await page.mouse.move(720, 450, { steps: 4 })
    await expect(page.getByTestId('reader-back')).toHaveCount(0, { timeout: 6000 })
    await page.mouse.move(720, 885, { steps: 4 })
    await expect(page.getByTestId('reader-progress')).toBeVisible()
  })
}

test('bars stay up while the mouse rests on them', async ({ page }) => {
  await openAndWaitHidden(page, 'plain.cbz', '[data-testid="comic-page"] img')
  await page.mouse.move(720, 20, { steps: 4 })
  await expect(page.getByTestId('reader-back')).toBeVisible()
  await page.waitForTimeout(4500)
  await expect(page.getByTestId('reader-back')).toBeVisible()
})

test('bars still auto-hide after being hidden while the mouse was on them', async ({ page }) => {
  await openAndWaitHidden(page, 'plain.cbz', '[data-testid="comic-page"] img')
  await page.mouse.move(720, 20, { steps: 4 })          // rest on the top bar
  await expect(page.getByTestId('reader-back')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.mouse.click(720, 450)                       // middle click hides the bars under the cursor's old spot
  await expect(page.getByTestId('reader-back')).toHaveCount(0)
  await page.mouse.move(720, 885, { steps: 4 })          // bring them back at the bottom…
  await expect(page.getByTestId('reader-progress')).toBeVisible()
  await page.mouse.move(720, 450, { steps: 4 })          // …and move away: they must hide again
  await expect(page.getByTestId('reader-back')).toHaveCount(0, { timeout: 6000 })
})
