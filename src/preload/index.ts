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

  // Recent files
  getRecentFiles: () => ipcRenderer.invoke('file:getRecent'),
  addRecentFile: (filePath: string) => ipcRenderer.invoke('file:addRecent', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('file:clearRecent'),

  // Auto-save
  autoSave: (data: string) => ipcRenderer.invoke('autoSave:write', data),
  checkAutoSave: () => ipcRenderer.invoke('autoSave:check'),
  clearAutoSave: () => ipcRenderer.invoke('autoSave:clear'),

  // Topology templates
  listTemplates: () => ipcRenderer.invoke('template:list'),
  saveTemplate: (name: string, content: string) => ipcRenderer.invoke('template:save', name, content),
  loadTemplate: (name: string) => ipcRenderer.invoke('template:load', name),
  deleteTemplate: (name: string) => ipcRenderer.invoke('template:delete', name),
  importTemplate: () => ipcRenderer.invoke('template:import'),

  // Open file by path (for recent files menu)
  openFileByPath: (filePath: string) => ipcRenderer.invoke('file:openByPath', filePath),

  // Menu action listener (supports both string and object payloads)
  onMenuAction: (callback: (action: string | { action: string; filePath?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string | { action: string; filePath?: string }) => callback(action)
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
  updateDevice: (id: number, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('db:updateDevice', id, updates),
  getVendors: () => ipcRenderer.invoke('db:getVendors'),
  addVendor: (name: string) => ipcRenderer.invoke('db:addVendor', name),

  // Device image management
  pickDeviceImage: () => ipcRenderer.invoke('file:pickDeviceImage'),
  readDeviceImage: (basename: string) => ipcRenderer.invoke('file:readDeviceImage', basename),
  deleteDeviceImage: (basename: string) => ipcRenderer.invoke('file:deleteDeviceImage', basename),
  updateDeviceImage: (id: number, imagePath: string | null) => ipcRenderer.invoke('db:updateDeviceImage', id, imagePath),
})
