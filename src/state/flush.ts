/** Things that must be saved before the app goes away (e.g. reading position). */
const flushers = new Set<() => Promise<void>>()
export function registerFlush(fn: () => Promise<void>) { flushers.add(fn); return () => { flushers.delete(fn) } }
export async function flushAll() { await Promise.allSettled([...flushers].map((f) => f())) }
