import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { createDiskStorage } from './storage'

const storage = createDiskStorage(app.getPath('userData'))
type Area = 'records' | 'files'
const ALLOWED: Record<Area, string[]> = {
  records: ['get', 'put', 'list', 'remove'],
  files: ['put', 'get', 'has', 'remove', 'usage'],
}

ipcMain.handle('rdonly', (_e, area: Area, method: string, args: unknown[]) => {
  if (!ALLOWED[area]?.includes(method)) throw new Error(`Not allowed: ${area}.${method}`)
  const target = storage[area] as unknown as Record<string, (...a: unknown[]) => unknown>
  return target[method](...args)
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 600,
    backgroundColor: '#111214', autoHideMenuBar: true, title: 'Rd Only', show: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.removeMenu()
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  void win.loadFile(join(__dirname, 'app', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
