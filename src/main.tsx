import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// Sync starts after the debug hook (if any) has had the chance to swap in a test cloud.
const debug = location.hash === '#debug' ? import('./debug') : Promise.resolve()
void debug.then(() => import('./state/sync')).then((m) => m.initSync())
// The reading fonts are also used by the app itself (book titles in Newsreader).
void import('./reader/novel/fonts').then(({ fontFaces }) => {
  const style = document.createElement('style'); style.textContent = fontFaces(); document.head.append(style)
})
// Desktop: save the reading position before the window closes.
void Promise.all([import('./storage/types'), import('./state/flush')]).then(([t, f]) => t.bridge()?.onBeforeClose?.(f.flushAll))
void import('./pwa/register').then((m) => m.setupPwa())
