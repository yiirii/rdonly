import type { BaseRecord } from '../storage/types'

/** JSON with sorted keys, so the same record always serialises the same way on every device. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}

/**
 * Should `incoming` replace `local`? Newest `updatedAt` wins. On an exact tie the larger serialisation wins,
 * so both devices pick the same record and converge. Identical records never "win" (no echo writes).
 */
export function wins(incoming: BaseRecord, local: BaseRecord | undefined): boolean {
  if (!local) return true
  if (incoming.updatedAt !== local.updatedAt) return incoming.updatedAt > local.updatedAt
  return stableJson(incoming) > stableJson(local)
}
