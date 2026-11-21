import { test, expect, type Page } from '@playwright/test'

async function setSeries(page: Page, title: string, series: string, newTitle?: string) {
  const card = page.getByTestId('book-card').filter({ hasText: title })
  if (test.info().project.name === 'laptop') await card.click({ button: 'right' })
  else { const b = (await card.boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + 40); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up() }
  await page.getByRole('button', { name: 'Edit details' }).click()
  if (newTitle) await page.getByLabel('Title').fill(newTitle)
  await page.getByLabel('Series').fill(series)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('books with the same series become one stacked folder, sorted inside', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz', 'tests/fixtures/novel.epub'])
  await expect(page.getByTestId('book-card')).toHaveCount(3)
  await setSeries(page, 'plain', 'Heroes', 'Heroes Vol 10')
  await setSeries(page, 'Test Manga', 'heroes ', 'Heroes Vol 2')
  await expect(page.getByTestId('series-card')).toHaveCount(1)
  await expect(page.getByTestId('series-card')).toContainText('Heroes')
  await expect(page.getByTestId('series-card')).toContainText('2')
  await expect(page.getByTestId('book-card')).toHaveCount(1) // the novel
  await page.waitForTimeout(500)
  await page.screenshot({ path: `test-results/shots/series-stack-${test.info().project.name}.png` })

  await page.getByTestId('series-card').click()
  await expect(page.getByTestId('series-screen')).toBeVisible()
  await expect(page.getByTestId('book-card')).toHaveCount(2)
  const titles = await page.getByTestId('book-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(titles).toEqual(['Open Heroes Vol 2', 'Open Heroes Vol 10'])
  await page.waitForTimeout(500)
  await page.screenshot({ path: `test-results/shots/series-open-${test.info().project.name}.png` })

  // open a volume and come back to the series
  await page.getByTestId('book-card').first().click()
  await expect(page.getByTestId('reader')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('series-screen')).toBeVisible()

  await page.getByTestId('series-back').click()
  await expect(page.getByTestId('series-card')).toBeVisible()
})

test('deleting a volume so only one is left turns the folder back into a book', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz'])
  await expect(page.getByTestId('book-card')).toHaveCount(2)
  await setSeries(page, 'plain', 'Heroes')
  await setSeries(page, 'Test Manga', 'Heroes')
  await page.getByTestId('series-card').click()
  const card = page.getByTestId('book-card').first()
  if (test.info().project.name === 'laptop') await card.click({ button: 'right' })
  else { const b = (await card.boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + 40); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up() }
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete book' }).click()
  // no longer a folder: you're taken back to the library on your own
  await expect(page.getByTestId('series-screen')).toHaveCount(0)
  await expect(page.getByTestId('series-card')).toHaveCount(0)
  await expect(page.getByTestId('book-card')).toHaveCount(1)
})
