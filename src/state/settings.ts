import { createStore, useStore } from 'zustand'
import { getRecordStore } from '../storage/select'
import type { BaseRecord } from '../storage/types'

import { FONTS, type FontId } from '../reader/novel/fontList'
import { READING_THEMES } from '../reader/novel/themes'

export type PageTurn = 'glide' | 'fold' | 'scroll'
export type Margins = 'narrow' | 'normal' | 'wide'
export interface Settings {
  theme: string
  font: FontId
  /** percent of the book's normal size */
  fontSize: number
  lineHeight: 1.4 | 1.6 | 1.8
  margins: Margins
  /** two columns side by side on wide screens */
  columns: boolean
  pageTurn: PageTurn
}
export const DEFAULT_SETTINGS: Settings = { theme: 'night', font: 'newsreader', fontSize: 100, lineHeight: 1.6, margins: 'normal', columns: true, pageTurn: 'glide' }

/** Settings that only make sense on this device and must never sync. */
export const LOCAL_ONLY_SETTINGS = ['fontSize', 'pageTurn', 'columns', 'haptics', 'windowBounds', 'deviceId'] as const

/** Anything unknown (older versions, other devices) falls back to the default. */
export function normalizeSettings(raw: Partial<Record<keyof Settings, unknown>>): Partial<Settings> {
  const out: Partial<Settings> = {}
  const ok = <K extends keyof Settings>(k: K, valid: (v: unknown) => boolean) => {
    if (raw[k] === undefined) return
    out[k] = (valid(raw[k]) ? raw[k] : DEFAULT_SETTINGS[k]) as Settings[K]
  }
  ok('theme', (v) => READING_THEMES.some((t) => t.id === v))
  ok('font', (v) => FONTS.some((f) => f.id === v))
  ok('fontSize', (v) => typeof v === 'number' && v >= 70 && v <= 200)
  ok('lineHeight', (v) => v === 1.4 || v === 1.6 || v === 1.8)
  ok('margins', (v) => v === 'narrow' || v === 'normal' || v === 'wide')
  ok('columns', (v) => typeof v === 'boolean')
  ok('pageTurn', (v) => v === 'glide' || v === 'fold' || v === 'scroll')
  return out
}
const isLocal = (k: string) => (LOCAL_ONLY_SETTINGS as readonly string[]).includes(k)

interface SettingRecord extends BaseRecord { value: unknown }
const LOCAL_PREFIX = 'rdonly.local.'

interface SettingsState extends Settings { loaded: boolean; load(): Promise<void>; set<K extends keyof Settings>(k: K, v: Settings[K]): void }

export const settingsStore = createStore<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const synced = await getRecordStore().list<SettingRecord>('settings')
    const next: Partial<Settings> = {}
    for (const r of synced) if (r.id in DEFAULT_SETTINGS && !isLocal(r.id)) (next as Record<string, unknown>)[r.id] = r.value
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (!isLocal(k)) continue
      try { const v = localStorage.getItem(LOCAL_PREFIX + k); if (v !== null) (next as Record<string, unknown>)[k] = JSON.parse(v) } catch { /* ignore */ }
    }
    set({ ...normalizeSettings(next), loaded: true })
  },
  set(k, v) {
    set({ [k]: v } as Partial<SettingsState>)
    if (isLocal(k)) { try { localStorage.setItem(LOCAL_PREFIX + k, JSON.stringify(v)) } catch { /* ignore */ } }
    else void getRecordStore().put<SettingRecord>('settings', { id: k, value: v, updatedAt: Date.now() })
  },
}))
export const useSettings = <T,>(sel: (s: SettingsState) => T) => useStore(settingsStore, sel)
