import { contextBridge, ipcRenderer } from 'electron'

const call = (area: string, method: string) => (...args: unknown[]) => ipcRenderer.invoke('rdonly', area, method, args)

contextBridge.exposeInMainWorld('rdonly', {
  platform: 'electron',
  records: { get: call('records', 'get'), put: call('records', 'put'), list: call('records', 'list'), remove: call('records', 'remove') },
  files: { put: call('files', 'put'), get: call('files', 'get'), has: call('files', 'has'), remove: call('files', 'remove'), usage: call('files', 'usage') },
})
