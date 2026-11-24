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

test('series folders show their stacked covers peeking out, not clipped', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz', 'tests/fixtures/novel.epub'])
  await expect(page.getByTestId('book-card')).toHaveCount(3)
  await setSeries(page, 'plain', 'Heroes'); await setSeries(page, 'Test Manga', 'Heroes'); await setSeries(page, 'Test Novel', 'Heroes')
  const folder = page.getByTestId('series-card')
  await page.waitForTimeout(800)
  const peek = await folder.evaluate((el) => {
    const front = el.querySelector('.book-cover.front')!.getBoundingClientRect()
    const back = el.querySelector('.book-cover.stacked')!.getBoundingClientRect()
    // a point on the back cover peeking out above the middle of the front cover (the count badge sits at the corner)
    const x = front.left + front.width * 0.5, y = (back.top + front.top) / 2
    const hit = document.elementFromPoint(x, y)
    return { sticksOut: back.top < front.top && back.right > front.right, visible: !!hit && !!hit.closest('.book-cover.stacked') }
  })
  expect(peek).toEqual({ sticksOut: true, visible: true })
  await page.screenshot({ path: `test-results/shots/series-folder-${test.info().project.name}.png`, clip: (await folder.boundingBox().then((b) => ({ x: b!.x - 20, y: b!.y - 30, width: b!.width + 50, height: b!.height + 40 }))) })
})

test('the cover-size slider resizes covers smoothly, a little at a time', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz', 'tests/fixtures/manga.cbz', 'tests/fixtures/novel.epub', 'tests/fixtures/doc.pdf'])
  await expect(page.getByTestId('book-card')).toHaveCount(4)
  const slider = page.getByRole('slider', { name: 'Cover size' })
  const width = () => page.getByTestId('book-card').first().locator('.book-cover').evaluate((el) => el.getBoundingClientRect().width)
  const widths: number[] = []
  for (const v of [1, 1.02, 1.04, 1.06]) {
    await slider.fill(String(v))
    await page.waitForTimeout(150)
    widths.push(await width())
  }
  for (let i = 1; i < widths.length; i++) expect(widths[i], `widths ${widths}`).toBeGreaterThan(widths[i - 1])
  await page.reload()
  await expect(page.getByRole('slider', { name: 'Cover size' })).toHaveValue('1.06') // remembered
})
