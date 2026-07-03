// Electron main process for Topo — 网络拓扑绘制软件
import { app, BrowserWindow, shell, dialog, Menu, ipcMain } from 'electron'
import { join, basename } from 'path'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { registerDeviceHandlers } from './ipc/device-handlers'
import { registerFileHandlers } from './ipc/file-handlers'

// ── Recent files management ──────────────────────────────
const RECENT_PATH = join(app.getPath('userData'), 'recent-files.json')
const MAX_RECENT = 10

interface RecentEntry {
  filePath: string
  name: string
  timestamp: number
}

function loadRecent(): RecentEntry[] {
  try {
    if (existsSync(RECENT_PATH)) {
      return JSON.parse(readFileSync(RECENT_PATH, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
}

function saveRecent(list: RecentEntry[]): void {
  try { writeFileSync(RECENT_PATH, JSON.stringify(list, null, 2), 'utf-8') } catch { /* ignore */ }
}

function addRecent(filePath: string): RecentEntry[] {
  const list = loadRecent().filter(e => e.filePath !== filePath)
  list.unshift({ filePath, name: basename(filePath), timestamp: Date.now() })
  const trimmed = list.slice(0, MAX_RECENT)
  saveRecent(trimmed)
  return trimmed
}

function rebuildRecentMenu(menu: Electron.Menu | null): void {
  if (!menu) return
  const recent = loadRecent()
  const fileMenu = menu.items.find(item => item.label === 'File')
  if (!fileMenu?.submenu) return

  const submenu = fileMenu.submenu
  const items = submenu.items

  // Find and remove old recent section
  let recentStartIdx = -1
  let recentEndIdx = -1
  for (let i = 0; i < items.length; i++) {
    if (items[i].label === 'recent-separator') recentStartIdx = i
    if (items[i].label === 'recent-files-end') { recentEndIdx = i; break }
  }
  if (recentStartIdx >= 0 && recentEndIdx >= 0) {
    for (let i = recentEndIdx; i >= recentStartIdx; i--) {
      submenu.removeAt(i)
    }
  }

  // Find insertion point (before the last separator before Exit)
  let exitIdx = -1
  for (let i = 0; i < submenu.items.length; i++) {
    if (submenu.items[i].label === '退出' || submenu.items[i].label === 'Exit') {
      exitIdx = i
      break
    }
  }
  let insertIdx = exitIdx >= 0 ? exitIdx : submenu.items.length
  if (insertIdx > 0 && submenu.items[insertIdx - 1].type === 'separator') {
    insertIdx--
  }

  // Build new recent section
  const recentItems: Electron.MenuItemConstructorOptions[] = [
    { type: 'separator', label: 'recent-separator', visible: recent.length > 0 },
  ]
  if (recent.length > 0) {
    for (const entry of recent) {
      recentItems.push({
        label: `  ${entry.name}`,
        toolTip: entry.filePath,
        click: () => sendToRenderer({ action: 'openRecent', filePath: entry.filePath }),
      })
    }
  } else {
    recentItems.push({ label: '  无最近文件', enabled: false })
  }
  recentItems.push({ type: 'separator', label: 'recent-files-end', visible: false })

  submenu.insert(insertIdx, Menu.buildFromTemplate(recentItems).items[0])
}

// ── Menu action sender (supports both old string and new object payloads) ─
function sendToRenderer(channel: string, action?: string): void
function sendToRenderer(payload: { action: string; filePath?: string }): void
function sendToRenderer(arg1: string | { action: string; filePath?: string }, arg2?: string): void {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return
  if (typeof arg1 === 'object') {
    win.webContents.send('menu:action', arg1)
  } else if (arg2 !== undefined) {
    win.webContents.send(arg1, arg2)
  } else {
    win.webContents.send('menu:action', arg1)
  }
}

// ── Recent files IPC ──────────────────────────────────────
function registerRecentHandlers(): void {
  ipcMain.handle('file:getRecent', () => loadRecent())
  ipcMain.handle('file:addRecent', (_e, filePath: string) => {
    const list = addRecent(filePath)
    rebuildRecentMenu(Menu.getApplicationMenu())
    return list
  })
  ipcMain.handle('file:clearRecent', () => {
    saveRecent([])
    rebuildRecentMenu(Menu.getApplicationMenu())
  })
  ipcMain.handle('file:openByPath', async (_e, filePath: string) => {
    try {
      const content = readFileSync(filePath, 'utf-8')
      addRecent(filePath)
      rebuildRecentMenu(Menu.getApplicationMenu())
      return { success: true, filePath, content }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}

const menuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => sendToRenderer('menu:action', 'new') },
      { label: '打开...', accelerator: 'CmdOrCtrl+O', click: () => sendToRenderer('menu:action', 'open') },
      { type: 'separator' },
      { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('menu:action', 'save') },
      { label: '另存为...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendToRenderer('menu:action', 'saveAs') },
      { type: 'separator' },
      { label: '导出 PNG...', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendToRenderer('menu:action', 'exportPNG') },
      { label: '导出 PDF...', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendToRenderer('menu:action', 'exportPDF') },
      { label: '导出 GIF...', click: () => sendToRenderer('menu:action', 'exportGIF') },
      { type: 'separator' },
      { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => sendToRenderer('menu:action', 'undo') },
      { label: '重做', accelerator: 'CmdOrCtrl+Y', click: () => sendToRenderer('menu:action', 'redo') },
      { type: 'separator' },
      { label: '全选', accelerator: 'CmdOrCtrl+A', click: () => sendToRenderer('menu:action', 'selectAll') },
      { label: '删除', accelerator: 'Delete', click: () => sendToRenderer('menu:action', 'deleteSelected') },
    ],
  },
  {
    label: 'View',
    submenu: [
      { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => sendToRenderer('menu:action', 'zoomIn') },
      { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => sendToRenderer('menu:action', 'zoomOut') },
      { label: '适应窗口', accelerator: 'CmdOrCtrl+0', click: () => sendToRenderer('menu:action', 'fitView') },
      { type: 'separator' },
      { label: '切换设备面板', accelerator: 'CmdOrCtrl+B', click: () => sendToRenderer('menu:action', 'toggleSidebar') },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: '关于 Topo',
        click: () => {
          dialog.showMessageBox(BrowserWindow.getFocusedWindow()!, {
            type: 'info',
            title: '关于 Topo',
            message: 'Topo — 网络拓扑绘制软件',
            detail: `版本: v${app.getVersion()}\n基于 Electron + React + React Flow\n用于快速绘制网络拓扑图，支持设备拖拽、自动连线、PNG/PDF/GIF 导出。`,
          })
        },
      },
      {
        label: '联系信息',
        click: () => {
          dialog.showMessageBox(BrowserWindow.getFocusedWindow()!, {
            type: 'info',
            title: '联系信息',
            message: '📧 联系方式',
            detail: 'Klay\nEmail: cgynetwork@gmail.com',
          })
        },
      },
    ],
  },
]

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Topo V1.1.0 - 网络拓扑绘制',
    show: false,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // In dev mode, load from Vite dev server
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register IPC handlers before app is ready
registerDeviceHandlers()
registerFileHandlers()
registerRecentHandlers()

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
  // Populate recent files in menu on startup
  rebuildRecentMenu(Menu.getApplicationMenu())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
