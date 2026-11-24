import { test, expect, type Browser, type Page } from '@playwright/test'
import { memoryRemote } from '../../src/sync/memoryRemote'

// Two browser contexts = two devices (separate storage). They share one cloud that lives here in the test runner,
// reached through exposed functions; the app's #debug hook swaps Firebase for it. The real Firebase layer is
// covered by tests/emulator (CI).
function cloud() {
  const remote = memoryRemote()
  const users = new Map<string, { pw: string; uid: string }>()
  return {
    remote, users,
    async attach(page: Page) {
      await page.exposeFunction('cloudAuth', (kind: string, email: string, pw: string) => {
        const u = users.get(email.toLowerCase())
        if (kind === 'signUp') { if (u) return { error: 'auth/email-already-in-use' }; if (pw.length < 6) return { error: 'auth/weak-password' }; const nu = { pw, uid: `uid-${users.size + 1}` }; users.set(email.toLowerCase(), nu); return { uid: nu.uid, email } }
        if (!u || u.pw !== pw) return { error: 'auth/invalid-credential' }
        return { uid: u.uid, email }
      })
      await page.exposeFunction('cloudCall', async (op: string, uid: string, col: string, arg: unknown) => {
        try {
          if (op === 'push') return { ok: await remote.pushIfNewer(uid, col, arg as never) }
          return { ok: await remote.pullSince(uid, col, arg as number) }
        } catch (e) { return { error: (e as { code?: string }).code ?? 'unknown' } }
      })
    },
  }
}
async function deviceOn(browser: Browser, c: ReturnType<typeof cloud>, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await c.attach(page)
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly?.fakeSyncReady)
  return page
}
async function signIn(page: Page, email: string, pw: string, create = false) {
  await page.getByTestId('settings-button').click()
  const acct = page.getByRole('group', { name: 'Account & Sync' })
  await acct.getByLabel('Email').fill(email)
  await acct.getByLabel('Password').fill(pw)
  await acct.getByRole('button', { name: create ? 'Create account' : 'Sign in' }).click()
  await expect(acct).toContainText(email)
  await expect(acct.getByTestId('sync-status')).toContainText(/Up to date/, { timeout: 10_000 })
  await page.getByRole('button', { name: 'Done' }).click()
}

test.describe.configure({ mode: 'serial' })
test.beforeEach(() => test.skip(test.info().project.name !== 'laptop', 'two-device flows run once (laptop project)'))

test('sign up on the laptop, sign in on the phone: books, progress and deletes follow you', async ({ browser }) => {
  const c = cloud()
  const laptop = await deviceOn(browser, c)
  await laptop.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub', 'tests/fixtures/plain.cbz'])
  await expect(laptop.getByTestId('book-card')).toHaveCount(2)
  await signIn(laptop, 'justin@example.com', 'secret123', true)

  const phone = await deviceOn(browser, c, { width: 390, height: 844 })
  await signIn(phone, 'justin@example.com', 'secret123')
  // The books arrive as "not on this device" until their files are added here.
  await expect(phone.getByTestId('book-card')).toHaveCount(2, { timeout: 10_000 })
  await expect(phone.getByTestId('book-card').filter({ hasText: 'The Long Road' })).toContainText('Not on this device')
  await phone.screenshot({ path: 'test-results/shots/sync-ghosts-iphone.png' })

  // Adding the same file on the phone restores it, and reading moves the progress on the laptop.
  await phone.getByTestId('book-card').filter({ hasText: 'The Long Road' }).click()
  await phone.getByTestId('relink-input').setInputFiles('tests/fixtures/long.epub')
  await expect(phone.getByTestId('book-card').filter({ hasText: 'The Long Road' })).not.toContainText('Not on this device')
  await phone.getByTestId('book-card').filter({ hasText: 'The Long Road' }).click()
  await phone.locator('[data-testid="novel"][data-cfi]').waitFor({ timeout: 15_000 })
  for (let i = 0; i < 3; i++) { await phone.keyboard.press('ArrowRight'); await phone.waitForTimeout(400) }
  await phone.keyboard.press('Escape')
  await expect(laptop.getByRole('tab', { name: /Reading/ })).toContainText('1', { timeout: 10_000 })

  // Delete on the laptop disappears on the phone.
  await laptop.getByTestId('book-card').filter({ hasText: 'plain' }).click({ button: 'right' })
  await laptop.getByRole('button', { name: 'Delete' }).click()
  await laptop.getByRole('button', { name: 'Delete' }).last().click()
  await expect(phone.getByTestId('book-card')).toHaveCount(1, { timeout: 10_000 })
})

test('collections and reading settings sync; text size stays per device', async ({ browser }) => {
  const c = cloud()
  const a = await deviceOn(browser, c), b = await deviceOn(browser, c)
  await a.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz'])
  await signIn(a, 'j@example.com', 'secret123', true); await signIn(b, 'j@example.com', 'secret123')
  await expect(b.getByTestId('book-card')).toHaveCount(1, { timeout: 10_000 })
  await a.getByRole('button', { name: 'New collection' }).click()
  await a.getByLabel('Name').fill('Book club'); await a.getByRole('button', { name: 'Create' }).click()
  await expect(b.getByRole('tab', { name: /Book club/ })).toBeVisible({ timeout: 10_000 })
  const a1 = await a.evaluate(() => { const s = (window as any).__rdonly.settings(); s.getState().set('theme', 'sepia'); s.getState().set('fontSize', 150); return true })
  expect(a1).toBe(true)
  await expect.poll(() => b.evaluate(() => (window as any).__rdonly.settings().getState().theme), { timeout: 10_000 }).toBe('sepia')
  expect(await b.evaluate(() => (window as any).__rdonly.settings().getState().fontSize)).not.toBe(150)
})

test('offline: changes wait and go up when the connection returns', async ({ browser }) => {
  const c = cloud()
  const a = await deviceOn(browser, c), b = await deviceOn(browser, c)
  await a.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz'])
  await signIn(a, 'o@example.com', 'secret123', true); await signIn(b, 'o@example.com', 'secret123')
  await expect(b.getByTestId('book-card')).toHaveCount(1, { timeout: 10_000 })
  c.remote.offline = true
  await a.getByRole('button', { name: 'New collection' }).click()
  await a.getByLabel('Name').fill('Made offline'); await a.getByRole('button', { name: 'Create' }).click()
  await a.getByTestId('settings-button').click()
  await expect(a.getByTestId('sync-status')).toContainText(/Offline.*1 change waiting/, { timeout: 10_000 })
  await a.screenshot({ path: 'test-results/shots/sync-offline-laptop.png' })
  c.remote.offline = false
  await a.getByRole('button', { name: 'Sync now' }).click()
  await expect(a.getByTestId('sync-status')).toContainText(/Up to date/, { timeout: 10_000 })
  await expect(b.getByRole('tab', { name: /Made offline/ })).toBeVisible({ timeout: 10_000 })
})

test('wrong password and taken email are explained; sign out keeps the library', async ({ browser }) => {
  const c = cloud()
  const a = await deviceOn(browser, c)
  await a.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz'])
  await signIn(a, 'k@example.com', 'secret123', true)
  const b = await deviceOn(browser, c)
  await b.getByTestId('settings-button').click()
  const acct = b.getByRole('group', { name: 'Account & Sync' })
  await acct.getByLabel('Email').fill('k@example.com'); await acct.getByLabel('Password').fill('nope-nope')
  await acct.getByRole('button', { name: 'Sign in' }).click()
  await expect(acct.getByRole('alert')).toHaveText('That email and password don’t match.')
  await acct.getByRole('button', { name: 'Create account' }).click()
  await expect(acct.getByRole('alert')).toHaveText('There’s already an account with that email. Sign in instead.')
  await b.screenshot({ path: 'test-results/shots/sync-signin-laptop.png' })

  await a.getByTestId('settings-button').click()
  await a.getByRole('button', { name: 'Sign out' }).click()
  await expect(a.getByRole('group', { name: 'Account & Sync' }).getByRole('button', { name: 'Sign in' })).toBeVisible()
  await a.getByRole('button', { name: 'Done' }).click()
  await expect(a.getByTestId('book-card')).toHaveCount(1)
})

test('signing in with a different account asks before adding this device’s library to it', async ({ browser }) => {
  const c = cloud()
  const a = await deviceOn(browser, c)
  await a.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz'])
  await signIn(a, 'first@example.com', 'secret123', true)
  await a.getByTestId('settings-button').click()
  await a.getByRole('button', { name: 'Sign out' }).click()
  const acct = a.getByRole('group', { name: 'Account & Sync' })
  await acct.getByLabel('Email').fill('typo@example.com'); await acct.getByLabel('Password').fill('secret123')
  await acct.getByRole('button', { name: 'Create account' }).click()
  const ask = a.getByRole('alertdialog', { name: /another account/ })
  await expect(ask).toContainText('typo@example.com')
  await a.screenshot({ path: 'test-results/shots/sync-switch-laptop.png' })
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(acct.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await a.waitForTimeout(800)
  expect(c.remote.uidsWritten()).toEqual(['uid-1']) // nothing went to the stray account
  // Choosing to add it does upload.
  await acct.getByLabel('Email').fill('typo@example.com'); await acct.getByLabel('Password').fill('secret123')
  await acct.getByRole('button', { name: 'Sign in' }).click()
  await a.getByRole('alertdialog', { name: /another account/ }).getByRole('button', { name: 'Add my library' }).click()
  await expect(acct.getByTestId('sync-status')).toContainText(/Up to date/, { timeout: 10_000 })
  expect(c.remote.uidsWritten()).toEqual(['uid-1', 'uid-2'])
})
