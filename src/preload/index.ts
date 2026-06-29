import { contextBridge, ipcRenderer } from 'electron'

// Expose protected APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (data: string, filePath?: string) =>
    ipcRenderer.invoke('file:save', data, filePath),
  openFile: () => ipcRenderer.invoke('file:open'),
  exportPNG: (dataUrl: string) => ipcRenderer.invoke('export:png', dataUrl),
  exportPDF: (dataUrl: string) => ipcRenderer.invoke('export:pdf', dataUrl),
  exportGIF: (dataUrl: string) => ipcRenderer.invoke('export:gif', dataUrl),
  captureFrame: (rect?: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('capture:frame', rect),

  // Menu action listener
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },

  // Device database operations (Phase 2)
  getDevices: (categoryId?: number) =>
    ipcRenderer.invoke('db:getDevices', categoryId),
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  searchDevices: (query: string) =>
    ipcRenderer.invoke('db:searchDevices', query),
  updateDeviceDescription: (id: number, description: string) =>
    ipcRenderer.invoke('db:updateDeviceDescription', id, description),
  addDevice: (device: any) => ipcRenderer.invoke('db:addDevice', device),
  deleteDevice: (id: number) => ipcRenderer.invoke('db:deleteDevice', id),
  getVendors: () => ipcRenderer.invoke('db:getVendors'),
  addVendor: (name: string) => ipcRenderer.invoke('db:addVendor', name),
})
