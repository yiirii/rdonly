import { test, expect, type Page } from '@playwright/test'

const GOOD = ['novel.epub', 'bare.epub', 'doc.pdf', 'manga.cbz', 'plain.cbz'].map((n) => `tests/fixtures/${n}`)

async function healthy(page: Page, step: string, errors: string[]) {
  await page.waitForTimeout(450) // let transitions settle
  expect(errors, `console errors after: ${step}`).toEqual([])
  await expect(page.getByRole('dialog'), `stuck dialog after: ${step}`).toHaveCount(0)
  const main = await page.locator('main').evaluate((el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    return { w: r.width, h: r.height, o: Number(s.opacity), v: s.visibility }
  })
  expect(main.w * main.h, `main has no size after: ${step}`).toBeGreaterThan(0)
  expect(main.o, `main invisible after: ${step}`).toBe(1)
  expect(main.v).toBe('visible')
  const scrim = await page.locator('.scrim, .dropzone').count()
  expect(scrim, `overlay left on screen after: ${step}`).toBe(0)
}

test('every screen and main action, no errors or stuck overlays', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await healthy(page, 'open empty library', errors)

  await page.getByTestId('import-input').setInputFiles(GOOD)
  await expect(page.getByTestId('book-card')).toHaveCount(5)
  await healthy(page, 'import all good books', errors)

  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/book.mobi', 'tests/fixtures/broken.cbz'])
  await expect(page.getByRole('status')).toContainText('Couldn’t open')
  await healthy(page, 'import bad files', errors)

  await page.getByTestId('settings-button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await healthy(page, 'open and close settings with Done', errors)

  await page.getByTestId('settings-button').click()
  await page.locator('.scrim').click({ position: { x: 10, y: 10 } })
  await healthy(page, 'close settings by tapping outside', errors)

  await page.getByRole('button', { name: 'Change sort order' }).click()
  await expect(page.getByTestId('book-card').first()).toContainText('bare')
  await healthy(page, 'sort A–Z', errors)
  await page.getByRole('button', { name: 'Change sort order' }).click()
  await healthy(page, 'sort recent', errors)

  await page.reload()
  await expect(page.getByTestId('book-card')).toHaveCount(5)
  await healthy(page, 'reload', errors)
})
