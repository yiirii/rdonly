import { test, expect, type Page } from '@playwright/test'

const GOOD = ['novel.epub', 'bare.epub', 'doc.pdf', 'manga.cbz', 'plain.cbz'].map((n) => `tests/fixtures/${n}`)
const READS = ['long.epub', 'manga.cbz', 'webtoon.cbz', 'long.pdf', 'plain.cbz']

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

  await page.getByTestId('sort-button').click()
  await page.getByRole('menuitemradio', { name: 'Title A–Z' }).click()
  await expect(page.getByTestId('book-card').first()).toContainText('bare')
  await healthy(page, 'sort A–Z', errors)
  await page.getByTestId('sort-button').click()
  await page.getByRole('menuitemradio', { name: 'Recently added' }).click()
  await healthy(page, 'sort recent', errors)

  for (const name of [/Not started/, /Reading/, /Finished/, /^All/]) await page.getByRole('tab', { name }).click()
  await healthy(page, 'status tabs', errors)
  await page.getByRole('checkbox', { name: 'Comic' }).click()
  await page.getByRole('checkbox', { name: 'Comic' }).click()
  await page.getByRole('searchbox').fill('zzz-nothing')
  await expect(page.getByTestId('book-card')).toHaveCount(0)
  await page.getByRole('searchbox').fill('')
  await healthy(page, 'chips and search', errors)
  await page.getByRole('button', { name: 'New collection' }).click()
  await page.getByLabel('Name').fill('Smoke')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('tab', { name: /Smoke/ }).click()
  await page.getByRole('tab', { name: /^All/ }).click()
  await healthy(page, 'new collection', errors)

  await page.reload()
  await expect(page.getByTestId('book-card')).toHaveCount(5)
  await healthy(page, 'reload', errors)
})

test('open every kind of book, turn pages, use every control, leave cleanly', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(READS.map((n) => `tests/fixtures/${n}`))
  await expect(page.getByTestId('book-card')).toHaveCount(READS.length)
  const vp = page.viewportSize()!
  for (let i = 0; i < READS.length; i++) {
    const card = page.getByTestId('book-card').nth(i)
    const title = await card.getAttribute('aria-label')
    await card.click()
    await expect(page.getByTestId('reader')).toBeVisible()
    await page.waitForTimeout(1200)
    expect(await page.locator('.reader-note h2').count(), `${title}: error screen`).toBe(0)
    for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250) }
    await page.mouse.wheel(0, 600); await page.waitForTimeout(250)
    if (await page.getByTestId('reader-back').count() === 0) await page.mouse.click(vp.width / 2, vp.height / 2)
    await expect(page.getByTestId('reader-back')).toBeVisible()
    if (await page.getByTestId('reading-settings-button').count()) {
      await page.getByTestId('reading-settings-button').click()
      await page.getByTestId('theme-paper').click()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    if (await page.getByTestId('reader-mode-button').count()) {
      await page.getByTestId('reader-mode-button').click()
      await expect(page.getByRole('menu')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(page.getByTestId('reader'), 'Escape closed the menu, not the book').toBeVisible()
    }
    await page.getByTestId('reader-back').click()
    await expect(page.getByTestId('reader')).toHaveCount(0)
    await healthy(page, `read ${title}`, errors)
  }
  // a CBR in the same series as manga.cbz: they become a folder; read the CBR from inside it
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/manga.cbr'])
  await page.getByTestId('series-card').click()
  await expect(page.getByTestId('series-screen')).toBeVisible()
  const cbr = page.getByTestId('book-card').nth(1)
  await cbr.click()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible({ timeout: 10000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('series-screen')).toBeVisible()
  await page.getByTestId('series-back').click()
  await healthy(page, 'series folder with a CBR', errors)

  // long-press actions open and close cleanly
  const card = page.getByTestId('book-card').first()
  await card.click({ button: 'right' })
  await expect(page.getByTestId('book-actions')).toBeVisible()
  await page.keyboard.press('Escape')
  await healthy(page, 'book actions', errors)
})
