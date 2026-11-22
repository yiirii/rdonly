import { test, expect, type Page } from '@playwright/test'

async function setSeries(page: Page, title: string, series: string) {
  const card = page.getByTestId('book-card').filter({ hasText: title })
  if (test.info().project.name === 'laptop') await card.click({ button: 'right' })
  else { const b = (await card.boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + 40); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up() }
  await page.getByRole('button', { name: 'Edit details' }).click()
  await page.getByLabel('Series', { exact: true }).fill(series)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
async function seed(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz', 'tests/fixtures/novel.epub', 'tests/fixtures/doc.pdf'])
  await expect(page.getByTestId('book-card')).toHaveCount(4)
  await setSeries(page, 'plain', 'Heroes')
  await setSeries(page, 'Test Manga', 'Heroes')
  await expect(page.getByTestId('series-card')).toHaveCount(1)
}

test('an opened folder keeps the filter: only the matching volumes show', async ({ page }) => {
  await seed(page)
  await setSeries(page, 'Test Novel', 'Heroes') // 3 volumes: comic, manga, novel
  await expect(page.getByTestId('series-card')).toContainText('3')
  await page.getByRole('checkbox', { name: 'Manga' }).click()
  await page.getByRole('checkbox', { name: 'Comic' }).click()
  await expect(page.getByTestId('series-card')).toContainText('2')
  await page.getByTestId('series-card').click()
  await expect(page.getByTestId('series-screen')).toBeVisible()
  await expect(page.getByTestId('book-card')).toHaveCount(2)
  await expect(page.getByTestId('book-card').filter({ hasText: 'Test Novel' })).toHaveCount(0)
})

test('Shift-click range on the shelf never picks volumes hidden in a folder (laptop)', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone')
  await seed(page)
  // A–Z with a renamed book puts the folder between the two single books: Aardvark · Heroes · Test Doc
  const novel = page.getByTestId('book-card').filter({ hasText: 'Test Novel' })
  await novel.click({ button: 'right' }); await page.getByRole('button', { name: 'Edit details' }).click()
  await page.getByLabel('Title').fill('Aardvark'); await page.getByRole('button', { name: 'Save' }).click()
  await page.getByTestId('sort-button').click(); await page.getByRole('menuitemradio', { name: 'Title A–Z' }).click()
  const cards = page.getByTestId('book-card')
  await expect(cards.first()).toContainText('Aardvark'); await expect(cards.last()).toContainText('Test Doc')
  await cards.first().click({ modifiers: ['Control'] })
  await cards.last().click({ modifiers: ['Shift'] })
  await expect(page.getByTestId('selection-bar')).toContainText('2')
})
