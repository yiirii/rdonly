import type { Auth, User } from 'firebase/auth'

export interface SyncUser { uid: string; email: string | null }
const toUser = (u: User | null): SyncUser | null => (u ? { uid: u.uid, email: u.email } : null)

/** Email + password only. Every failure comes back as a sentence a person can act on. */
export async function authApi(auth: Auth) {
  const a = await import('firebase/auth')
  const run = async <T>(p: Promise<T>) => { try { return await p } catch (e) { throw new Error(authMessage(e)) } }
  return {
    signIn: (email: string, pw: string) => run(a.signInWithEmailAndPassword(auth, email.trim(), pw)).then((c) => toUser(c.user)!),
    signUp: (email: string, pw: string) => run(a.createUserWithEmailAndPassword(auth, email.trim(), pw)).then((c) => toUser(c.user)!),
    resetPassword: (email: string) => run(a.sendPasswordResetEmail(auth, email.trim())),
    signOut: () => run(a.signOut(auth)),
    onUser: (fn: (u: SyncUser | null) => void) => a.onAuthStateChanged(auth, (u) => fn(toUser(u))),
  }
}

export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const m: Record<string, string> = {
    'auth/invalid-credential': 'That email and password don’t match.',
    'auth/wrong-password': 'That email and password don’t match.',
    'auth/user-not-found': 'That email and password don’t match.',
    'auth/invalid-email': 'That doesn’t look like an email address.',
    'auth/missing-password': 'Enter your password.',
    'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/network-request-failed': 'No connection. Try again when you’re online.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
    'auth/user-disabled': 'This account has been switched off.',
  }
  return m[code] ?? 'Couldn’t sign in just now. Try again in a moment.'
}
