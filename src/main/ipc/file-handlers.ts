import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync } from 'fs'

export function registerFileHandlers(): void {
  // Save topology file (.topo.json)
  ipcMain.handle('file:save', async (_event, data: string, filePath?: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    let targetPath = filePath
    if (!targetPath) {
      const result = await dialog.showSaveDialog(win, {
        title: '保存拓扑文件',
        defaultPath: 'untitled.topo.json',
        filters: [
          { name: 'Topo 拓扑文件', extensions: ['topo.json'] },
          { name: 'JSON 文件', extensions: ['json'] },
        ],
      })
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }
      targetPath = result.filePath
    }

    try {
      writeFileSync(targetPath, data, 'utf-8')
      return { success: true, filePath: targetPath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Open topology file
  ipcMain.handle('file:open', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const result = await dialog.showOpenDialog(win, {
      title: '打开拓扑文件',
      filters: [
        { name: 'Topo 拓扑文件', extensions: ['topo.json'] },
        { name: 'JSON 文件', extensions: ['json'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      return { success: true, filePath: result.filePaths[0], content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Export PNG (handled in renderer using html-to-image, then saved via this handler)
  ipcMain.handle('export:png', async (_event, dataUrl: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(win, {
      title: '导出 PNG 图片',
      defaultPath: 'topology.png',
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      // Convert data URL to buffer and save
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      writeFileSync(result.filePath, buffer)
      return { success: true, filePath: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Export GIF (rendered and encoded in renderer, saved via this handler)
  ipcMain.handle('export:gif', async (_event, dataUrl: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(win, {
      title: '导出动画 GIF',
      defaultPath: 'topology.gif',
      filters: [{ name: 'GIF 动图', extensions: ['gif'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const base64 = dataUrl.replace(/^data:image\/gif;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      writeFileSync(result.filePath, buffer)
      return { success: true, filePath: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Capture a frame using Electron's native page capture (preserves SVG animations)
  ipcMain.handle('capture:frame', async (_event, rect?: { x: number; y: number; width: number; height: number }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    try {
      const opts = rect && rect.width > 0 && rect.height > 0 ? rect : undefined
      const image = await win.webContents.capturePage(opts)
      return image.toDataURL()
    } catch (err: any) {
      console.error('capture:frame error:', err)
      return null
    }
  })

  // Export PDF (handled in renderer using jspdf, then saved via this handler)
  ipcMain.handle('export:pdf', async (_event, dataUrl: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(win, {
      title: '导出 PDF 文件',
      defaultPath: 'topology.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      writeFileSync(result.filePath, buffer)
      return { success: true, filePath: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
