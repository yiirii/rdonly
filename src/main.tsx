import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

if (location.hash === '#debug') void import('./debug')
// Desktop: save the reading position before the window closes.
void Promise.all([import('./storage/types'), import('./state/flush')]).then(([t, f]) => t.bridge()?.onBeforeClose?.(f.flushAll))
void import('./pwa/register').then((m) => m.setupPwa())
