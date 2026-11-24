import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSync } from '../state/sync'
import type { SyncStatus } from '../sync/engine'

const ago = (t?: number) => {
  if (!t) return ''
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`
  return new Date(t).toLocaleDateString()
}
const changes = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'} waiting`
export function statusLine(s: SyncStatus): { text: string; tone: 'ok' | 'busy' | 'warn' } {
  switch (s.state) {
    case 'idle': return s.pending ? { text: `Sending ${changes(s.pending).replace(' waiting', '')}…`, tone: 'busy' } : { text: `Up to date · ${ago(s.lastSyncAt)}`, tone: 'ok' }
    case 'syncing': return { text: 'Syncing…', tone: 'busy' }
    case 'offline': return { text: `Offline · ${s.pending ? changes(s.pending) : 'nothing waiting'}`, tone: 'warn' }
    case 'error': return { text: s.error ?? 'Sync hit a problem and will try again shortly.', tone: 'warn' }
    default: return { text: 'Starting…', tone: 'busy' }
  }
}

/** Settings → Account & Sync. Signed out: a small form. Signed in: who, how sync is doing, Sync now, Sign out. */
export function AccountSync() {
  const { user, status, known, signIn, signUp, resetPassword, signOut, syncNow } = useSync((s) => s)
  const [email, setEmail] = useState(''), [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null), [note, setNote] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t) }, []) // keeps "2 min ago" fresh
  const act = async (fn: () => Promise<void>, ok?: string) => {
    setErr(null); setNote(null); setBusy(true)
    try { await fn(); if (ok) setNote(ok) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const line = statusLine(status)
  return (
    <div className="group card account" role="group" aria-label="Account & Sync">
      {!known ? <div className="row dim">Checking…</div> : user ? (
        <>
          <div className="row"><span>Signed in as</span><span className="dim acct-email">{user.email}</span></div>
          <div className="row persist" data-testid="sync-status">
            <motion.span className={`bead ${line.tone === 'ok' ? 'on' : line.tone === 'warn' ? 'warn' : 'busy'}`} aria-hidden="true"
              animate={line.tone === 'busy' ? { scale: [1, 0.7, 1] } : { scale: 1 }} transition={line.tone === 'busy' ? { repeat: Infinity, duration: 1 } : { duration: 0.2 }} />
            <span>{line.text}</span>
          </div>
          <div className="row acct-actions">
            <button type="button" className="keycap" onClick={() => void act(syncNow)} disabled={busy}>Sync now</button>
            <button type="button" className="keycap ghost" onClick={() => void act(signOut)} disabled={busy}>Sign out</button>
          </div>
          <p className="acct-note">Your library, places, collections and reading look follow you. Book files stay on each device. Signing out keeps everything here.</p>
        </>
      ) : (
        <form className="acct-form" onSubmit={(e) => { e.preventDefault(); void act(() => signIn(email, pw)) }}>
          <p className="acct-note top">Sign in to keep your library, places and collections the same on your laptop and phone.</p>
          <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="field">Password<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} /></label>
          <AnimatePresence>
            {err && <motion.p key="e" role="alert" className="acct-err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{err}</motion.p>}
            {note && <motion.p key="n" role="status" className="acct-ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{note}</motion.p>}
          </AnimatePresence>
          <div className="acct-actions">
            <button type="submit" className="keycap primary" disabled={busy}>Sign in</button>
            <button type="button" className="keycap" disabled={busy} onClick={() => void act(() => signUp(email, pw))}>Create account</button>
            <button type="button" className="link" disabled={busy}
              onClick={() => email ? void act(() => resetPassword(email), `If ${email} has an account, a reset link is on its way.`) : setErr('Type your email first, then tap Forgot password.')}>Forgot password?</button>
          </div>
        </form>
      )}
    </div>
  )
}
