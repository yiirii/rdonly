import { test, expect, type Page } from '@playwright/test'

const isPhone = () => test.info().project.name === 'iphone'
async function setup(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub', 'tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz', 'tests/fixtures/doc.pdf'])
  await expect(page.getByTestId('book-card')).toHaveCount(4)
  await page.getByRole('button', { name: 'New collection' }).click()
  await page.getByLabel('Name').fill('Book club')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('tab', { name: /Book club/ })).toBeVisible()
}
const card = (page: Page, t: string) => page.getByTestId('book-card').filter({ hasText: t })
async function longPress(page: Page, t: string) {
  const c = card(page, t); await c.scrollIntoViewIfNeeded()
  const b = (await c.locator('.book-cover').boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.6); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up()
}

async function tabMenu(page: Page, tab: ReturnType<Page['getByRole']>) {
  if (!isPhone()) return tab.click({ button: 'right' })
  const item = tab.locator('xpath=..') // the reorderable wrapper listens for the press
  await item.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, button: 0 })
  await page.waitForTimeout(700)
  await item.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, button: 0 })
}

test('select several books and add them to a collection in one go', async ({ page }) => {
  await setup(page)
  if (isPhone()) {
    await longPress(page, 'plain')
    await page.getByRole('button', { name: /^Select/ }).click()
    await card(page, 'Test Doc').click()
  } else {
    await card(page, 'plain').click({ modifiers: ['Control'] })
    await card(page, 'Test Doc').click({ modifiers: ['Control'] })
  }
  await expect(page.getByTestId('selection-bar')).toContainText('2')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/shots/selection-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Add to…' }).click()
  await page.getByTestId('selection-bar').getByRole('button', { name: 'Book club' }).click()
  await expect(page.getByTestId('selection-bar')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Book club/ })).toContainText('2')
})

test('Shift-click selects a range; Escape leaves selection (laptop)', async ({ page }) => {
  test.skip(isPhone())
  await setup(page)
  const cards = page.getByTestId('book-card')
  await cards.nth(0).click({ modifiers: ['Control'] })
  await cards.nth(2).click({ modifiers: ['Shift'] })
  await expect(page.getByTestId('selection-bar')).toContainText('3')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('selection-bar')).toHaveCount(0)
  await cards.nth(0).click()
  await expect(page.getByTestId('reader')).toBeVisible() // a plain click opens again
})

test('tag and delete selected books', async ({ page }) => {
  test.skip(isPhone())
  await setup(page)
  await card(page, 'plain').click({ modifiers: ['Control'] })
  await card(page, 'Test Manga').click({ modifiers: ['Control'] })
  await page.getByRole('button', { name: 'Tag' }).click()
  await page.getByLabel('Tag to add').fill('weekend')
  await page.getByRole('button', { name: 'Add tag' }).click()
  await page.getByRole('searchbox').fill('weekend')
  await expect(page.getByTestId('book-card')).toHaveCount(2)
  await page.getByRole('searchbox').fill('')
  await card(page, 'plain').click({ modifiers: ['Control'] })
  await page.getByTestId('selection-bar').getByRole('button', { name: 'Delete' }).click()
  await page.getByTestId('selection-bar').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('book-card')).toHaveCount(3)
})

test('drag a cover onto a collection tab (laptop)', async ({ page }) => {
  test.skip(isPhone())
  await setup(page)
  await card(page, 'Test Novel').dragTo(page.getByRole('tab', { name: /Book club/ }))
  await expect(page.getByRole('tab', { name: /Book club/ })).toContainText('1')
})

test('rename, recolour and delete a collection from its tab', async ({ page }) => {
  await setup(page)
  const t = page.getByRole('tab', { name: /Book club/ })
  await tabMenu(page, t)
  await expect(page.getByRole('dialog', { name: 'Edit Book club' })).toBeVisible()
  await page.getByLabel('Name').fill('Reading group')
  await page.getByRole('radio', { name: '#98c379' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  const t2 = page.getByRole('tab', { name: /Reading group/ })
  await expect(t2).toBeVisible()
  expect(await t2.locator('.tab-dot').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(152, 195, 121)')
  await tabMenu(page, t2)
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete collection' }).click()
  await expect(page.getByRole('tab', { name: /Reading group/ })).toHaveCount(0)
  await expect(page.getByTestId('book-card')).toHaveCount(4)
})

test('drag tabs to reorder them', async ({ page }) => {
  test.skip(isPhone())
  await setup(page)
  await page.getByRole('button', { name: 'New collection' }).click()
  await page.getByLabel('Name').fill('Favourites')
  await page.getByRole('button', { name: 'Create' }).click()
  const names = () => page.locator('.tab-item .tab-text').evaluateAll((els) => els.map((e) => e.textContent?.replace(/\d+$/, '')))
  await expect.poll(names).toEqual(['Book club', 'Favourites'])
  const a = (await page.getByRole('tab', { name: /Favourites/ }).boundingBox())!
  const b = (await page.getByRole('tab', { name: /Book club/ }).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down()
  await page.mouse.move(b.x + 5, b.y + b.height / 2, { steps: 12 }); await page.mouse.up()
  await expect.poll(names).toEqual(['Favourites', 'Book club'])
  await page.reload()
  await expect.poll(names).toEqual(['Favourites', 'Book club'])
})
