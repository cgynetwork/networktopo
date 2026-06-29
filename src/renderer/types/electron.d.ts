import type { CategoryRow, DeviceRow, VendorRow } from './index'

export interface ElectronAPI {
  // File operations
  saveFile: (data: string, filePath?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  openFile: () => Promise<{ success: boolean; filePath?: string; content?: string; canceled?: boolean; error?: string }>
  exportPNG: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  exportPDF: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  exportGIF: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  captureFrame: (rect?: { x: number; y: number; width: number; height: number }) => Promise<string | null>

  // Menu action listener
  onMenuAction: (callback: (action: string) => void) => () => void

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
  getVendors: () => Promise<VendorRow[]>
  addVendor: (name: string) => Promise<{ success: boolean; id?: number; error?: string }>
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
