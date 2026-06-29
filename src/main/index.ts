// Electron main process for Topo — 网络拓扑绘制软件
import { app, BrowserWindow, shell, dialog, Menu } from 'electron'
import { join } from 'path'
import { registerDeviceHandlers } from './ipc/device-handlers'
import { registerFileHandlers } from './ipc/file-handlers'

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.send(channel, ...args)
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
    title: 'Topo V0.3.0 - 网络拓扑绘制',
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
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
