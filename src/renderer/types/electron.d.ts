import type { CategoryRow, DeviceRow, VendorRow } from './index'

export interface RecentFileEntry {
  filePath: string
  name: string
  timestamp: number
}

export interface ElectronAPI {
  // File operations
  saveFile: (data: string, filePath?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  openFile: () => Promise<{ success: boolean; filePath?: string; content?: string; canceled?: boolean; error?: string }>
  exportPNG: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  exportPDF: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  exportGIF: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  captureFrame: (rect?: { x: number; y: number; width: number; height: number }) => Promise<string | null>

  // Recent files
  getRecentFiles: () => Promise<RecentFileEntry[]>
  addRecentFile: (filePath: string) => Promise<RecentFileEntry[]>
  clearRecentFiles: () => Promise<void>

  // Auto-save
  autoSave: (data: string) => Promise<{ success: boolean }>
  checkAutoSave: () => Promise<{ exists: boolean; content?: string }>
  clearAutoSave: () => Promise<{ success: boolean }>

  // Topology templates
  listTemplates: () => Promise<{ name: string; file: string }[]>
  saveTemplate: (name: string, content: string) => Promise<{ success: boolean; name?: string; error?: string }>
  loadTemplate: (name: string) => Promise<string>
  deleteTemplate: (name: string) => Promise<{ success: boolean; error?: string }>
  importTemplate: () => Promise<{ success: boolean; name?: string; canceled?: boolean; error?: string }>

  // Open file by path (for recent files menu)
  openFileByPath: (filePath: string) => Promise<{ success: boolean; filePath?: string; content?: string; error?: string }>

  // Menu action listener (supports both string and object payloads)
  onMenuAction: (callback: (action: string | { action: string; filePath?: string }) => void) => () => void

  // Device database
  getCategories: () => Promise<CategoryRow[]>
  getDevices: (categoryId?: number) => Promise<DeviceRow[]>
  searchDevices: (query: string) => Promise<DeviceRow[]>
  updateDeviceDescription: (id: number, description: string) => Promise<{ success: boolean }>
  addDevice: (device: {
    category_id: number
    vendor_id: number
    model: string
    description?: string
    ports_info?: string
    image_path?: string
  }) => Promise<{ success: boolean; id?: number }>
  deleteDevice: (id: number) => Promise<{ success: boolean }>
  updateDevice: (id: number, updates: {
    category_id?: number
    vendor_id?: number
    model?: string
    description?: string
    ports_info?: string
    image_path?: string | null
  }) => Promise<{ success: boolean; error?: string }>
  getVendors: () => Promise<VendorRow[]>
  addVendor: (name: string) => Promise<{ success: boolean; id?: number; error?: string }>

  // Device image management
  pickDeviceImage: () => Promise<{ success: boolean; originalName?: string; storedPath?: string; canceled?: boolean; error?: string }>
  // V1.4.0: Pick app business image (returns base64 data URL directly)
  pickAppImage: () => Promise<{ success: boolean; dataUrl?: string; fileName?: string; canceled?: boolean; error?: string }>
  readDeviceImage: (basename: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
  deleteDeviceImage: (basename: string) => Promise<{ success: boolean; error?: string }>
  updateDeviceImage: (id: number, imagePath: string | null) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// gif.js type declarations
declare module 'gif.js' {
  interface GIFOptions {
    workers?: number
    quality?: number
    width?: number
    height?: number
    workerScript?: string
    repeat?: number
    background?: string
    transparent?: string | null
    dither?: boolean
    debug?: boolean
  }

  interface GIFFrameOptions {
    delay?: number
    copy?: boolean
    dispose?: number
  }

  class GIF {
    constructor(options: GIFOptions)
    addFrame(image: CanvasImageSource, options?: GIFFrameOptions): void
    on(event: 'finished', callback: (blob: Blob) => void): void
    on(event: 'progress', callback: (progress: number) => void): void
    on(event: 'error', callback: (error: Error) => void): void
    render(): void
    abort(): void
  }

  export default GIF
}

declare module 'gif.js/dist/gif.worker.js?url' {
  const url: string
  export default url
}

// Electron WebkitAppRegion — enables window dragging from non-titlebar areas
declare namespace React {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
