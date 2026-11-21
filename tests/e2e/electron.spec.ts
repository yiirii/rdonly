import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('desktop app imports a book and still has it after relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'rdonly-e2e-'))
  const launch = () => electron.launch({ args: ['.', `--user-data-dir=${userData}`, '--no-sandbox'], env: { ...process.env, RDONLY_TEST: '1' } })

  let app = await launch()
  let win = await app.firstWindow()
  await expect(win.getByTestId('empty-state')).toBeVisible()
  expect(await win.evaluate(() => (window as any).rdonly?.platform)).toBe('electron')
  await win.getByTestId('import-input').setInputFiles(['tests/fixtures/novel.epub'])
  await expect(win.getByTestId('book-card')).toHaveCount(1)
  await win.screenshot({ path: 'test-results/shots/electron-library.png' })
  await app.close()

  app = await launch()
  win = await app.firstWindow()
  await expect(win.getByTestId('book-card')).toHaveCount(1)
  await win.getByTestId('settings-button').click()
  await expect(win.getByTestId('storage-persist-status')).toContainText('saved on this computer')
  await app.close()
})

test('closing the desktop window straight after turning pages keeps your place', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'rdonly-e2e-'))
  const launch = () => electron.launch({ args: ['.', `--user-data-dir=${userData}`, '--no-sandbox'] })
  let app = await launch()
  let win = await app.firstWindow()
  await win.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz'])
  await win.getByTestId('book-card').click()
  await expect(win.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await win.waitForTimeout(500)
  await win.keyboard.press('ArrowRight'); await win.waitForTimeout(150)
  await win.keyboard.press('ArrowRight'); await win.waitForTimeout(150)
  const at = await win.locator('[data-testid="comic-spread"][data-current="true"] [data-testid="comic-page"]').first().getAttribute('data-page')
  expect(at).not.toBe('0')
  const closed = app.waitForEvent('close')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()) // same as the window's close button
  await closed
  app = await launch()
  win = await app.firstWindow()
  await win.getByTestId('book-card').click()
  await expect(win.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await expect.poll(() => win.locator('[data-testid="comic-spread"][data-current="true"] [data-testid="comic-page"]').first().getAttribute('data-page')).toBe(at)
  await app.close()
})
