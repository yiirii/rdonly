import { createStore, useStore } from 'zustand'
import { getRecordStore } from '../storage/select'
import type { BaseRecord } from '../storage/types'

export interface Settings {
  theme: 'paper' | 'sepia' | 'night' | 'oled'
  font: 'literata' | 'lora' | 'atkinson' | 'book'
  /** percent of the book's normal size */
  fontSize: number
}
export const DEFAULT_SETTINGS: Settings = { theme: 'night', font: 'literata', fontSize: 100 }

/** Settings that only make sense on this device and must never sync. */
export const LOCAL_ONLY_SETTINGS = ['fontSize', 'pageTurn', 'haptics', 'windowBounds', 'deviceId'] as const
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
    set({ ...next, loaded: true })
  },
  set(k, v) {
    set({ [k]: v } as Partial<SettingsState>)
    if (isLocal(k)) { try { localStorage.setItem(LOCAL_PREFIX + k, JSON.stringify(v)) } catch { /* ignore */ } }
    else void getRecordStore().put<SettingRecord>('settings', { id: k, value: v, updatedAt: Date.now() })
  },
}))
export const useSettings = <T,>(sel: (s: SettingsState) => T) => useStore(settingsStore, sel)
