import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

if (location.hash === '#debug') void import('./debug')
void import('./pwa/register').then((m) => m.setupPwa())
