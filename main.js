// Electron main process for Topo — 网络拓扑绘制软件
// Plain JS entry point for direct execution (npm run start)
const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

// ── Database ──────────────────────────────────────────────
let db = null

function getDatabase() {
  if (db) return db
  const dbPath = path.join(app.getPath('userData'), 'topo-devices.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  seedData(db)
  return db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'default',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      logo_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS device_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      description TEXT DEFAULT '',
      ports_info TEXT DEFAULT '',
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      UNIQUE(vendor_id, model)
    );
    CREATE INDEX IF NOT EXISTS idx_device_category ON device_models(category_id);
    CREATE INDEX IF NOT EXISTS idx_device_vendor ON device_models(vendor_id);
  `)
}

function seedData(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get()
  if (count.cnt > 0) return

  const categories = [
    ['防火墙', 'firewall', 1], ['交换机', 'switch', 2],
    ['无线控制器', 'ac', 3], ['无线接入点', 'ap', 4], ['服务器', 'server', 5],
  ]
  const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
  for (const c of categories) insertCat.run(...c)

  const vendors = [
    ['H3C', null], ['Huawei', null], ['Cisco', null], ['Ruijie', null], ['Aruba', null],
  ]
  const insertVendor = db.prepare('INSERT INTO vendors (name, logo_path) VALUES (?, ?)')
  for (const v of vendors) insertVendor.run(...v)

  const devices = [
    [1,1,'SecPath F1000-AK125','H3C 中端防火墙，4Gbps 吞吐量','8×GE+2×SFP'],
    [1,1,'SecPath F100-C-G3','H3C 桌面级防火墙，适合小型分支','5×GE'],
    [1,2,'USG6300F','Huawei 下一代防火墙，6Gbps 吞吐量','8×GE+4×SFP'],
    [1,2,'USG6600F','Huawei 中高端防火墙，20Gbps 吞吐量','12×GE+8×SFP+4×SFP+'],
    [1,3,'Firepower 1120','Cisco NGFW 防火墙，1.5Gbps','8×GE+4×SFP'],
    [2,1,'S5130S-28S-HPWR-EI','H3C 三层 PoE+ 交换机，24口千兆+4口万兆','24×GE PoE++4×SFP+'],
    [2,1,'S5500V2-54S-EI','H3C 三层交换机，48口千兆+6口SFP','48×GE+6×SFP'],
    [2,1,'S6520X-30QC-EI','H3C 数据中心交换机，24口万兆+6口40GE','24×SFP++6×QSFP+'],
    [2,1,'S5560X-54C-EI','H3C 三层交换机，48口千兆/万兆+6口40GE','48×GE/SFP++6×QSFP+'],
    [2,2,'S5735-L24P4XE-A-V2','Huawei 三层交换机，24口千兆PoE+4口万兆','24×GE PoE++4×SFP+'],
    [2,2,'S6730-H48X6C','Huawei 数据中心交换机，48口25GE+6口100GE','48×25GE+6×100GE'],
    [2,3,'Catalyst 9300-48P','Cisco 企业级交换机，48口千兆PoE+','48×GE PoE++4×SFP+'],
    [2,3,'Nexus 93180YC-FX3','Cisco Nexus 数据中心 48×25GE+6×100GE','48×25GE+6×100GE'],
    [2,4,'RG-S5310-48GT4XS','Ruijie 三层交换机，48口千兆+4口万兆','48×GE+4×SFP+'],
    [3,1,'WX3510X','H3C 无线控制器，最大256 AP','2×10GE+2×GE'],
    [3,2,'AC6508','Huawei 无线控制器，最大256 AP','8×GE+2×SFP+'],
    [3,3,'9800-L','Cisco 无线控制器，最大250 AP','4×GE+2×SFP+'],
    [4,1,'WA6638','H3C Wi-Fi 6 AP，三频8空间流','1×5GE+1×GE'],
    [4,2,'AirEngine 6760R-51','Huawei Wi-Fi 6 AP，三频8空间流','1×5GE+1×GE'],
    [4,3,'Catalyst 9130AXI','Cisco Wi-Fi 6 AP，双频8空间流','1×5GE'],
    [4,5,'AP-535','Aruba Wi-Fi 6 AP，双频4空间流','1×2.5GE+1×GE'],
    [5,1,'UniServer R4900 G5','H3C 2U 机架式服务器，双路Intel Xeon','2×10GE+4×GE'],
    [5,2,'FusionServer Pro 2288H V7','Huawei 2U 机架式服务器，双路Intel Xeon','2×25GE+4×GE'],
  ]
  const insertDev = db.prepare(
    'INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)'
  )
  const insertAll = db.transaction(() => { for (const d of devices) insertDev.run(...d) })
  insertAll()
}

// ── IPC Handlers ──────────────────────────────────────────
function registerHandlers() {
  // Device handlers
  ipcMain.handle('db:getCategories', () => getDatabase().prepare('SELECT * FROM categories ORDER BY sort_order').all())
  ipcMain.handle('db:getDevices', (_e, categoryId) => {
    const sql = categoryId
      ? `SELECT d.*, c.name as category_name, v.name as vendor_name FROM device_models d JOIN categories c ON d.category_id=c.id JOIN vendors v ON d.vendor_id=v.id WHERE d.category_id=? ORDER BY v.name, d.model`
      : `SELECT d.*, c.name as category_name, v.name as vendor_name FROM device_models d JOIN categories c ON d.category_id=c.id JOIN vendors v ON d.vendor_id=v.id ORDER BY c.sort_order, v.name, d.model`
    return getDatabase().prepare(sql).all(...(categoryId ? [categoryId] : []))
  })
  ipcMain.handle('db:searchDevices', (_e, query) => {
    const q = `%${query}%`
    return getDatabase().prepare(
      `SELECT d.*, c.name as category_name, v.name as vendor_name FROM device_models d JOIN categories c ON d.category_id=c.id JOIN vendors v ON d.vendor_id=v.id WHERE d.model LIKE ? OR d.description LIKE ? OR v.name LIKE ? OR c.name LIKE ? ORDER BY c.sort_order, v.name, d.model`
    ).all(q, q, q, q)
  })
  ipcMain.handle('db:updateDeviceDescription', (_e, id, desc) => {
    getDatabase().prepare("UPDATE device_models SET description=?, updated_at=datetime('now') WHERE id=?").run(desc, id)
    return { success: true }
  })
  ipcMain.handle('db:addDevice', (_e, dev) => {
    const r = getDatabase().prepare(
      'INSERT INTO device_models (category_id, vendor_id, model, description, ports_info, image_path) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(dev.category_id, dev.vendor_id, dev.model, dev.description || '', dev.ports_info || '', dev.image_path || null)
    return { success: true, id: r.lastInsertRowid }
  })
  ipcMain.handle('db:deleteDevice', (_e, id) => {
    getDatabase().prepare('DELETE FROM device_models WHERE id=?').run(id)
    return { success: true }
  })
  ipcMain.handle('db:getVendors', () => {
    return getDatabase().prepare('SELECT * FROM vendors ORDER BY name').all()
  })
  ipcMain.handle('db:addVendor', (_e, name) => {
    try {
      const r = getDatabase().prepare('INSERT INTO vendors (name) VALUES (?)').run(name)
      return { success: true, id: r.lastInsertRowid }
    } catch { return { success: false, error: '厂商已存在' } }
  })

  // File handlers
  ipcMain.handle('file:save', async (_e, data, filePath) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    let target = filePath
    if (!target) {
      const r = await dialog.showSaveDialog(win, { title: '保存拓扑文件', defaultPath: 'untitled.topo.json', filters: [{ name: 'Topo 拓扑文件', extensions: ['topo.json'] }] })
      if (r.canceled) return { success: false, canceled: true }
      target = r.filePath
    }
    try { fs.writeFileSync(target, data, 'utf-8'); return { success: true, filePath: target } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('file:open', async () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showOpenDialog(win, { title: '打开拓扑文件', filters: [{ name: 'Topo 拓扑文件', extensions: ['topo.json'] }], properties: ['openFile'] })
    if (r.canceled) return { success: false, canceled: true }
    try { return { success: true, filePath: r.filePaths[0], content: fs.readFileSync(r.filePaths[0], 'utf-8') } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('export:png', async (_e, dataUrl) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showSaveDialog(win, { title: '导出 PNG', defaultPath: 'topology.png', filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (r.canceled) return { success: false, canceled: true }
    try { fs.writeFileSync(r.filePath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')); return { success: true, filePath: r.filePath } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('export:pdf', async (_e, dataUrl) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showSaveDialog(win, { title: '导出 PDF', defaultPath: 'topology.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (r.canceled) return { success: false, canceled: true }
    try { fs.writeFileSync(r.filePath, Buffer.from(dataUrl.replace(/^data:application\/pdf;base64,/, ''), 'base64')); return { success: true, filePath: r.filePath } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('export:gif', async (_e, dataUrl) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showSaveDialog(win, { title: '导出动画 GIF', defaultPath: 'topology.gif', filters: [{ name: 'GIF 动图', extensions: ['gif'] }] })
    if (r.canceled) return { success: false, canceled: true }
    try { fs.writeFileSync(r.filePath, Buffer.from(dataUrl.replace(/^data:image\/gif;base64,/, ''), 'base64')); return { success: true, filePath: r.filePath } }
    catch (e) { return { success: false, error: e.message } }
  })
  // Capture a frame using Electron's native page capture (preserves SVG animations)
  ipcMain.handle('capture:frame', async (_e, rect) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return null
    try {
      const opts = rect && rect.width > 0 && rect.height > 0 ? rect : undefined
      const image = await win.webContents.capturePage(opts)
      return image.toDataURL()
    } catch (e) { return null }
  })
}

// ── Menu ───────────────────────────────────────────────────
function sendToRenderer(channel, ...args) {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.send(channel, ...args)
}

const menuTemplate = [
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
          dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
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
          dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
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

// ── Window ────────────────────────────────────────────────
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 768,
    title: 'Topo V0.3.0 - 网络拓扑绘制', show: false, backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'out', 'preload', 'index.js'),
      sandbox: false, contextIsolation: true, nodeIntegration: false,
    },
  })
  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url); return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, 'out', 'renderer', 'index.html'))
  }
}

// ── App ───────────────────────────────────────────────────
registerHandlers()
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
