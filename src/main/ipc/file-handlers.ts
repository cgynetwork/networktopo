import { ipcMain, dialog, BrowserWindow, app, Menu } from 'electron'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join, basename } from 'path'

// ── Recent files management ──────────────────────────────
const MAX_RECENT = 10

interface RecentEntry {
  filePath: string
  name: string
  timestamp: number
}

function getRecentPath(): string {
  return join(app.getPath('userData'), 'recent-files.json')
}

function loadRecent(): RecentEntry[] {
  try {
    const p = getRecentPath()
    if (existsSync(p)) {
      const data = readFileSync(p, 'utf-8')
      return JSON.parse(data)
    }
  } catch { /* ignore corrupt file */ }
  return []
}

function saveRecent(list: RecentEntry[]): void {
  try {
    writeFileSync(getRecentPath(), JSON.stringify(list, null, 2), 'utf-8')
  } catch { /* ignore write errors */ }
}

function addRecent(filePath: string): RecentEntry[] {
  const list = loadRecent().filter(e => e.filePath !== filePath)
  list.unshift({ filePath, name: basename(filePath), timestamp: Date.now() })
  const trimmed = list.slice(0, MAX_RECENT)
  saveRecent(trimmed)
  return trimmed
}

// Rebuild the "Open Recent" submenu in the File menu
function rebuildRecentMenu(menu: Electron.Menu | null): void {
  if (!menu) return
  const recent = loadRecent()
  const fileMenu = menu.items.find(item => item.label === 'File')
  if (!fileMenu?.submenu) return

  // Remove old recent-files items (between the separator and Exit)
  const submenu = fileMenu.submenu
  const items = fileMenu.submenu.items

  // Find the separator before recent items (after Save As)
  let recentStartIdx = -1
  let recentEndIdx = -1
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.label === 'recent-separator') {
      recentStartIdx = i
    } else if (item.label === 'recent-files-end') {
      recentEndIdx = i
      break
    }
  }

  // Remove old recent section if exists
  if (recentStartIdx >= 0 && recentEndIdx >= 0) {
    for (let i = recentEndIdx; i >= recentStartIdx; i--) {
      submenu.removeAt(i)
    }
  }

  // Find the "Exit" item to insert before
  let exitIdx = -1
  for (let i = 0; i < submenu.items.length; i++) {
    if (submenu.items[i].label === '退出' || submenu.items[i].label === 'Exit') {
      exitIdx = i
      break
    }
  }
  // Find the last separator before Exit
  let insertIdx = exitIdx >= 0 ? exitIdx : submenu.items.length
  // Move back past the separator before Exit
  if (insertIdx > 0 && submenu.items[insertIdx - 1].type === 'separator') {
    insertIdx--
  }

  // Insert separator + recent items + end marker
  submenu.insert(insertIdx, new Menu.buildFromTemplate([
    { type: 'separator', label: 'recent-separator', visible: recent.length === 0 ? false : true },
    ...(recent.length > 0
      ? recent.map((entry, i) => ({
          label: `  ${entry.name}`,
          toolTip: entry.filePath,
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:action', { action: 'openRecent', filePath: entry.filePath })
          },
        }))
      : [{ label: '  无最近文件', enabled: false }]),
    { type: 'separator', label: 'recent-files-end', visible: false },
  ]).items[0])
}

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
      // Auto-add to recent files
      addRecent(targetPath)
      // Refresh menu
      rebuildRecentMenu(Menu.getApplicationMenu())
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
      // Auto-add to recent files
      addRecent(result.filePaths[0])
      rebuildRecentMenu(Menu.getApplicationMenu())
      return { success: true, filePath: result.filePaths[0], content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // NOTE: Recent-file IPC handlers (file:getRecent, file:addRecent, file:clearRecent,
  // file:openByPath) are registered in src/main/index.ts → registerRecentHandlers()
  // to avoid double-registration. The loadRecent/saveRecent/addRecent helpers below
  // are still used by file:save and file:open handlers.

  // Auto-save (silent, no dialog)
  ipcMain.handle('autoSave:write', async (_e, data: string) => {
    const autoSavePath = join(app.getPath('userData'), 'autosave.topo.json')
    try {
      writeFileSync(autoSavePath, data, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Check for auto-save file on startup
  ipcMain.handle('autoSave:check', () => {
    const autoSavePath = join(app.getPath('userData'), 'autosave.topo.json')
    if (existsSync(autoSavePath)) {
      try {
        const content = readFileSync(autoSavePath, 'utf-8')
        return { exists: true, content }
      } catch { return { exists: false } }
    }
    return { exists: false }
  })

  // Delete auto-save file (e.g., after user saves or dismisses)
  ipcMain.handle('autoSave:clear', () => {
    const autoSavePath = join(app.getPath('userData'), 'autosave.topo.json')
    try {
      if (existsSync(autoSavePath)) {
        const fs = require('fs')
        fs.unlinkSync(autoSavePath)
      }
      return { success: true }
    } catch { return { success: false } }
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
