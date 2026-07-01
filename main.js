// Electron main process for Topo — 网络拓扑绘制软件
// 独立 CommonJS 入口点。与 src/main/*.ts 保持同步，两者互为镜像。
// 为什么不用构建输出：rollup 打包会阻止 better-sqlite3 原生 .node 文件的动态 require()。

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
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
  if (count.cnt > 0) {
    // V0.9.3: Incremental migration — add new categories if missing
    const pcCount = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name = '终端-PC'").get()
    if (pcCount.cnt === 0) {
      const migrateCat = db.prepare('INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
      migrateCat.run('终端-PC', 'pc', 6)
      migrateCat.run('终端-笔记本', 'laptop', 7)
      const migrateVendor = db.prepare('INSERT OR IGNORE INTO vendors (name, logo_path) VALUES (?, ?)')
      migrateVendor.run('Lenovo', null)
      migrateVendor.run('Dell', null)
      migrateVendor.run('HP', null)
      migrateVendor.run('Apple', null)
      const migrateDev = db.prepare('INSERT OR IGNORE INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const newDevices = [
        [6, 6, 'ThinkCentre M70t', 'Lenovo 商用台式机，i5/16GB/512GB', '1×WLAN+1×GE'],
        [6, 6, 'ThinkCentre M90t', 'Lenovo 高端台式机，i7/32GB/1TB', '1×WLAN+1×GE'],
        [6, 7, 'OptiPlex 7000', 'Dell 商用台式机，i7/32GB/512GB', '1×WLAN+1×GE'],
        [6, 8, 'EliteDesk 800 G9', 'HP 商用台式机，i5/16GB/256GB', '1×WLAN+1×GE'],
        [7, 6, 'ThinkPad X1 Carbon', 'Lenovo 商务旗舰笔记本', '1×WLAN+1×GE'],
        [7, 6, 'ThinkPad T14', 'Lenovo 商用笔记本', '1×WLAN+1×GE'],
        [7, 7, 'Latitude 7440', 'Dell 商务笔记本', '1×WLAN+1×GE'],
        [7, 8, 'EliteBook 840 G10', 'HP 商务笔记本', '1×WLAN+1×GE'],
        [7, 9, 'MacBook Pro 14', 'Apple 商务笔记本', '1×WLAN+1×GE'],
        [6, 1, '通用PC终端', '通用桌面PC终端，固定1无线+1网络', '1×WLAN+1×GE'],
        [7, 1, '通用笔记本终端', '通用笔记本终端，固定1无线+1网络', '1×WLAN+1×GE'],
      ]
      for (const d of newDevices) migrateDev.run(...d)
      console.log('V0.9.3 migration: added PC/Laptop categories and devices')
    }
    return
  }

  // Categories
  const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
  const categories = [
    ['防火墙', 'firewall', 1],
    ['交换机', 'switch', 2],
    ['无线控制器', 'ac', 3],
    ['无线接入点', 'ap', 4],
    ['服务器', 'server', 5],
    ['终端-PC', 'pc', 6],           // V0.9.3
    ['终端-笔记本', 'laptop', 7],   // V0.9.3
  ]
  for (const c of categories) insertCat.run(...c)

  // Vendors
  const insertVendor = db.prepare('INSERT INTO vendors (name, logo_path) VALUES (?, ?)')
  const vendors = [
    ['H3C', null], ['Huawei', null], ['Cisco', null], ['Ruijie', null], ['Aruba', null],
    ['Lenovo', null], ['Dell', null], ['HP', null], ['Apple', null],  // V0.9.3
  ]
  for (const v of vendors) insertVendor.run(...v)

  // Device models — 28 款真实网络设备
  const insertDev = db.prepare(
    'INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)'
  )
  const devices = [
    // 防火墙 (category_id=1)
    [1, 1, 'SecPath F1000-AK125', 'H3C 中端防火墙，4Gbps 吞吐量', '8×GE+2×SFP'],
    [1, 1, 'SecPath F100-C-G3', 'H3C 桌面级防火墙，适合小型分支', '5×GE'],
    [1, 2, 'USG6300F', 'Huawei 下一代防火墙，6Gbps 吞吐量', '8×GE+4×SFP'],
    [1, 2, 'USG6600F', 'Huawei 中高端防火墙，20Gbps 吞吐量', '12×GE+8×SFP+4×SFP+'],
    [1, 3, 'Firepower 1120', 'Cisco NGFW 防火墙，1.5Gbps', '8×GE+4×SFP'],
    [1, 3, 'ASA 5508-X', 'Cisco ASA 防火墙，1Gbps 吞吐量', '8×GE'],
    // 交换机 (category_id=2)
    [2, 1, 'S5130S-28S-HPWR-EI', 'H3C 三层 PoE+ 交换机，24口千兆+4口万兆', '24×GE PoE++4×SFP+'],
    [2, 1, 'S5500V2-54S-EI', 'H3C 三层交换机，48口千兆+6口SFP', '48×GE+6×SFP'],
    [2, 1, 'S6520X-30QC-EI', 'H3C 数据中心交换机，24口万兆+6口40GE', '24×SFP++6×QSFP+'],
    [2, 1, 'S5560X-54C-EI', 'H3C 三层交换机，48口千兆/万兆+6口40GE', '48×GE/SFP++6×QSFP+'],
    [2, 2, 'S5735-L24P4XE-A-V2', 'Huawei 三层交换机，24口千兆PoE+4口万兆', '24×GE PoE++4×SFP+'],
    [2, 2, 'S6730-H48X6C', 'Huawei 数据中心交换机，48口25GE+6口100GE', '48×25GE+6×100GE'],
    [2, 2, 'S6735-S48X6C', 'Huawei 数据中心交换机，48口10GE+6口100GE', '48×SFP++6×QSFP28'],
    [2, 3, 'Catalyst 9300-48P', 'Cisco 企业级交换机，48口千兆PoE+', '48×GE PoE++4×SFP+'],
    [2, 3, 'Catalyst 9200-24T', 'Cisco 接入交换机，24口千兆', '24×GE+4×SFP'],
    [2, 3, 'Nexus 93180YC-FX3', 'Cisco Nexus 数据中心 48×25GE+6×100GE', '48×25GE+6×100GE'],
    [2, 4, 'RG-S5310-48GT4XS', 'Ruijie 三层交换机，48口千兆+4口万兆', '48×GE+4×SFP+'],
    // 无线控制器 (category_id=3)
    [3, 1, 'WX3510X', 'H3C 无线控制器，最大256 AP', '2×10GE+2×GE'],
    [3, 1, 'WX3540X', 'H3C 高性能无线控制器，最大1024 AP', '4×10GE+4×GE'],
    [3, 2, 'AC6508', 'Huawei 无线控制器，最大256 AP', '8×GE+2×SFP+'],
    [3, 2, 'AC6805', 'Huawei 高性能无线控制器，最大1024 AP', '4×10GE+4×GE'],
    [3, 3, '9800-L', 'Cisco 无线控制器，最大250 AP', '4×GE+2×SFP+'],
    [3, 4, 'RG-WS6008', 'Ruijie 无线控制器，最大256 AP', '8×GE+2×SFP+'],
    // 无线接入点 (category_id=4)
    [4, 1, 'WA6638', 'H3C Wi-Fi 6 AP，三频8空间流', '1×5GE+1×GE'],
    [4, 1, 'WA6330', 'H3C Wi-Fi 6 AP，双频4空间流', '1×2.5GE'],
    [4, 1, 'WA6322', 'H3C Wi-Fi 6 面板AP，双频2空间流', '1×GE'],
    [4, 2, 'AirEngine 6760R-51', 'Huawei Wi-Fi 6 AP，三频8空间流', '1×5GE+1×GE'],
    [4, 2, 'AirEngine 5761-21', 'Huawei Wi-Fi 6 AP，双频4空间流', '1×2.5GE'],
    [4, 3, 'Catalyst 9130AXI', 'Cisco Wi-Fi 6 AP，双频8空间流', '1×5GE'],
    [4, 3, 'Catalyst 9120AXI', 'Cisco Wi-Fi 6 AP，双频4空间流', '1×2.5GE'],
    [4, 4, 'RG-AP880-I', 'Ruijie Wi-Fi 6 AP，三频8空间流', '1×5GE+1×GE'],
    [4, 5, 'AP-535', 'Aruba Wi-Fi 6 AP，双频4空间流', '1×2.5GE+1×GE'],
    // 服务器 (category_id=5)
    [5, 1, 'UniServer R4900 G5', 'H3C 2U 机架式服务器，双路Intel Xeon', '2×10GE+4×GE'],
    [5, 1, 'UniServer R2700 G5', 'H3C 1U 机架式服务器，双路Intel Xeon', '2×10GE+2×GE'],
    [5, 2, 'FusionServer Pro 2288H V7', 'Huawei 2U 机架式服务器，双路Intel Xeon', '2×25GE+4×GE'],
    [5, 2, 'KunLun 2280', 'Huawei 2U ARM 服务器，双路Kunpeng 920', '2×25GE+4×GE'],
    [5, 3, 'UCS C220 M7', 'Cisco 1U 机架式服务器，双路Intel Xeon', '2×25GE+2×GE'],
    [5, 4, 'RG-RCD4500 V3', 'Ruijie 云桌面服务器，双路Intel Xeon', '2×10GE+2×GE'],
    // V0.9.3: 终端-PC (category_id=6)
    [6, 6, 'ThinkCentre M70t', 'Lenovo 商用台式机，i5/16GB/512GB', '1×WLAN+1×GE'],
    [6, 6, 'ThinkCentre M90t', 'Lenovo 高端台式机，i7/32GB/1TB', '1×WLAN+1×GE'],
    [6, 7, 'OptiPlex 7000', 'Dell 商用台式机，i7/32GB/512GB', '1×WLAN+1×GE'],
    [6, 8, 'EliteDesk 800 G9', 'HP 商用台式机，i5/16GB/256GB', '1×WLAN+1×GE'],
    // V0.9.3: 终端-笔记本 (category_id=7)
    [7, 6, 'ThinkPad X1 Carbon', 'Lenovo 商务旗舰笔记本', '1×WLAN+1×GE'],
    [7, 6, 'ThinkPad T14', 'Lenovo 商用笔记本', '1×WLAN+1×GE'],
    [7, 7, 'Latitude 7440', 'Dell 商务笔记本', '1×WLAN+1×GE'],
    [7, 8, 'EliteBook 840 G10', 'HP 商务笔记本', '1×WLAN+1×GE'],
    [7, 9, 'MacBook Pro 14', 'Apple 商务笔记本', '1×WLAN+1×GE'],
    // V0.9.3: 通用终端
    [6, 1, '通用PC终端', '通用桌面PC终端，固定1无线+1网络', '1×WLAN+1×GE'],
    [7, 1, '通用笔记本终端', '通用笔记本终端，固定1无线+1网络', '1×WLAN+1×GE'],
  ]
  const insertAll = db.transaction(() => { for (const d of devices) insertDev.run(...d) })
  insertAll()
}

// ── IPC Handlers ──────────────────────────────────────────

// --- Device handlers ---
function registerDeviceHandlers() {
  ipcMain.handle('db:getCategories', () =>
    getDatabase().prepare('SELECT * FROM categories ORDER BY sort_order').all())

  ipcMain.handle('db:getDevices', (_e, categoryId) => {
    if (categoryId) {
      return getDatabase().prepare(
        `SELECT d.*, c.name as category_name, v.name as vendor_name
         FROM device_models d JOIN categories c ON d.category_id=c.id
         JOIN vendors v ON d.vendor_id=v.id WHERE d.category_id=?
         ORDER BY v.name, d.model`
      ).all(categoryId)
    }
    return getDatabase().prepare(
      `SELECT d.*, c.name as category_name, v.name as vendor_name
       FROM device_models d JOIN categories c ON d.category_id=c.id
       JOIN vendors v ON d.vendor_id=v.id
       ORDER BY c.sort_order, v.name, d.model`
    ).all()
  })

  ipcMain.handle('db:searchDevices', (_e, query) => {
    const q = `%${query}%`
    return getDatabase().prepare(
      `SELECT d.*, c.name as category_name, v.name as vendor_name
       FROM device_models d JOIN categories c ON d.category_id=c.id
       JOIN vendors v ON d.vendor_id=v.id
       WHERE d.model LIKE ? OR d.description LIKE ? OR v.name LIKE ? OR c.name LIKE ?
       ORDER BY c.sort_order, v.name, d.model`
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

  ipcMain.handle('db:updateDevice', (_e, id, updates) => {
    const db = getDatabase()
    const allowed = ['category_id', 'vendor_id', 'model', 'description', 'ports_info', 'image_path']
    const setClauses = []
    const values = []
    for (const key of allowed) {
      if (key in updates) {
        setClauses.push(`${key} = ?`)
        values.push(updates[key])
      }
    }
    if (setClauses.length === 0) return { success: false, error: 'No fields to update' }
    setClauses.push("updated_at = datetime('now')")
    values.push(id)
    db.prepare(`UPDATE device_models SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  ipcMain.handle('db:getVendors', () =>
    getDatabase().prepare('SELECT * FROM vendors ORDER BY name').all())

  ipcMain.handle('db:addVendor', (_e, name) => {
    try {
      const r = getDatabase().prepare('INSERT INTO vendors (name) VALUES (?)').run(name)
      return { success: true, id: r.lastInsertRowid }
    } catch { return { success: false, error: '厂商已存在' } }
  })

  ipcMain.handle('db:updateDeviceImage', (_e, id, imagePath) => {
    getDatabase().prepare("UPDATE device_models SET image_path=?, updated_at=datetime('now') WHERE id=?").run(imagePath, id)
    return { success: true }
  })
}

// --- File handlers ---
function registerFileHandlers() {
  ipcMain.handle('file:save', async (_e, data, filePath) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    let target = filePath
    if (!target) {
      const r = await dialog.showSaveDialog(win, {
        title: '保存拓扑文件', defaultPath: 'untitled.topo.json',
        filters: [{ name: 'Topo 拓扑文件', extensions: ['topo.json'] }]
      })
      if (r.canceled) return { success: false, canceled: true }
      target = r.filePath
    }
    try {
      fs.writeFileSync(target, data, 'utf-8')
      addRecent(target)
      rebuildRecentMenu(Menu.getApplicationMenu())
      return { success: true, filePath: target }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('file:open', async () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showOpenDialog(win, {
      title: '打开拓扑文件',
      filters: [{ name: 'Topo 拓扑文件', extensions: ['topo.json'] }],
      properties: ['openFile']
    })
    if (r.canceled) return { success: false, canceled: true }
    try {
      const content = fs.readFileSync(r.filePaths[0], 'utf-8')
      addRecent(r.filePaths[0])
      rebuildRecentMenu(Menu.getApplicationMenu())
      return { success: true, filePath: r.filePaths[0], content }
    } catch (e) { return { success: false, error: e.message } }
  })

  // Export handlers
  const exportFile = async (dataUrl, title, defaultPath, filters) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showSaveDialog(win, { title, defaultPath, filters })
    if (r.canceled) return { success: false, canceled: true }
    try {
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
      fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'))
      return { success: true, filePath: r.filePath }
    } catch (e) { return { success: false, error: e.message } }
  }

  ipcMain.handle('export:png', (_e, dataUrl) =>
    exportFile(dataUrl, '导出 PNG', 'topology.png', [{ name: 'PNG', extensions: ['png'] }]))
  ipcMain.handle('export:pdf', (_e, dataUrl) =>
    exportFile(dataUrl, '导出 PDF', 'topology.pdf', [{ name: 'PDF', extensions: ['pdf'] }]))
  ipcMain.handle('export:gif', (_e, dataUrl) =>
    exportFile(dataUrl, '导出动画 GIF', 'topology.gif', [{ name: 'GIF 动图', extensions: ['gif'] }]))

  // Capture frame via Electron native API (preserves SVG animations)
  ipcMain.handle('capture:frame', async (_e, rect) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return null
    try {
      const opts = rect && rect.width > 0 && rect.height > 0 ? rect : undefined
      const image = await win.webContents.capturePage(opts)
      return image.toDataURL()
    } catch (e) { return null }
  })

  // ── Device image management ──────────────────────────────
  const deviceImagesDir = path.join(app.getPath('userData'), 'device-images')

  function ensureDeviceImagesDir() {
    if (!fs.existsSync(deviceImagesDir)) {
      fs.mkdirSync(deviceImagesDir, { recursive: true })
    }
  }

  ipcMain.handle('file:pickDeviceImage', async () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false, error: 'No active window' }
    const r = await dialog.showOpenDialog(win, {
      title: '选择设备图片',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    })
    if (r.canceled || r.filePaths.length === 0) return { success: false, canceled: true }
    try {
      ensureDeviceImagesDir()
      const ext = path.extname(r.filePaths[0]).toLowerCase() || '.png'
      const storedName = `${crypto.randomUUID()}${ext}`
      fs.copyFileSync(r.filePaths[0], path.join(deviceImagesDir, storedName))
      return { success: true, originalName: path.basename(r.filePaths[0]), storedPath: storedName }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('file:readDeviceImage', async (_e, basename) => {
    try {
      if (!/^[a-zA-Z0-9_.-]+$/.test(basename)) return { success: false, error: 'Invalid filename' }
      ensureDeviceImagesDir()
      const fp = path.join(deviceImagesDir, basename)
      const dir = deviceImagesDir.replace(/\\/g, '/') + '/'
      const target = fp.replace(/\\/g, '/')
      if (!target.startsWith(dir)) return { success: false, error: 'Access denied' }
      if (!fs.existsSync(fp)) return { success: false, error: 'File not found' }
      const buffer = fs.readFileSync(fp)
      const ext = path.extname(basename).toLowerCase()
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
      const mime = mimeMap[ext] || 'image/png'
      return { success: true, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('file:deleteDeviceImage', async (_e, basename) => {
    try {
      if (!/^[a-zA-Z0-9_.-]+$/.test(basename)) return { success: false, error: 'Invalid filename' }
      ensureDeviceImagesDir()
      const fp = path.join(deviceImagesDir, basename)
      const dir = deviceImagesDir.replace(/\\/g, '/') + '/'
      const target = fp.replace(/\\/g, '/')
      if (!target.startsWith(dir)) return { success: false, error: 'Access denied' }
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
      return { success: true }
    } catch (e) { return { success: false, error: e.message } }
  })
}

// --- Recent files IPC ---
function registerRecentHandlers() {
  ipcMain.handle('file:getRecent', () => loadRecent())
  ipcMain.handle('file:addRecent', (_e, filePath) => {
    const list = addRecent(filePath)
    rebuildRecentMenu(Menu.getApplicationMenu())
    return list
  })
  ipcMain.handle('file:clearRecent', () => {
    saveRecent([])
    rebuildRecentMenu(Menu.getApplicationMenu())
  })
  ipcMain.handle('file:openByPath', async (_e, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      addRecent(filePath)
      rebuildRecentMenu(Menu.getApplicationMenu())
      return { success: true, filePath, content }
    } catch (e) { return { success: false, error: e.message } }
  })
}

// --- Auto-save IPC ---
function registerAutoSaveHandlers() {
  const AUTO_SAVE_PATH = path.join(app.getPath('userData'), 'autosave.topo.json')
  ipcMain.handle('autoSave:write', async (_e, data) => {
    try { fs.writeFileSync(AUTO_SAVE_PATH, data, 'utf-8'); return { success: true } }
    catch (e) { return { success: false, error: e.message } }
  })
  ipcMain.handle('autoSave:check', () => {
    if (fs.existsSync(AUTO_SAVE_PATH)) {
      try { return { exists: true, content: fs.readFileSync(AUTO_SAVE_PATH, 'utf-8') } }
      catch { return { exists: false } }
    }
    return { exists: false }
  })
  ipcMain.handle('autoSave:clear', () => {
    try { if (fs.existsSync(AUTO_SAVE_PATH)) fs.unlinkSync(AUTO_SAVE_PATH); return { success: true } }
    catch { return { success: false } }
  })
}

// ── Recent files management ──────────────────────────────
const RECENT_PATH = path.join(app.getPath('userData'), 'recent-files.json')
const MAX_RECENT = 10

function loadRecent() {
  try {
    if (fs.existsSync(RECENT_PATH)) return JSON.parse(fs.readFileSync(RECENT_PATH, 'utf-8'))
  } catch (e) { /* ignore */ }
  return []
}

function saveRecent(list) {
  try { fs.writeFileSync(RECENT_PATH, JSON.stringify(list, null, 2), 'utf-8') } catch (e) { /* ignore */ }
}

function addRecent(filePath) {
  const list = loadRecent().filter(e => e.filePath !== filePath)
  list.unshift({ filePath, name: path.basename(filePath), timestamp: Date.now() })
  const trimmed = list.slice(0, MAX_RECENT)
  saveRecent(trimmed)
  return trimmed
}

function rebuildRecentMenu(menu) {
  if (!menu) return
  const recent = loadRecent()
  const fileMenu = menu.items.find(item => item.label === 'File')
  if (!fileMenu || !fileMenu.submenu) return

  const submenu = fileMenu.submenu
  const items = submenu.items

  // Remove old recent section
  let recentStartIdx = -1, recentEndIdx = -1
  for (let i = 0; i < items.length; i++) {
    if (items[i].label === 'recent-separator') recentStartIdx = i
    if (items[i].label === 'recent-files-end') { recentEndIdx = i; break }
  }
  if (recentStartIdx >= 0 && recentEndIdx >= 0) {
    for (let i = recentEndIdx; i >= recentStartIdx; i--) submenu.removeAt(i)
  }

  // Find insertion point before Exit
  let exitIdx = -1
  for (let i = 0; i < submenu.items.length; i++) {
    if (submenu.items[i].label === '退出' || submenu.items[i].label === 'Exit') { exitIdx = i; break }
  }
  let insertIdx = exitIdx >= 0 ? exitIdx : submenu.items.length
  if (insertIdx > 0 && submenu.items[insertIdx - 1].type === 'separator') insertIdx--

  // Build recent section
  const recentItems = [
    { type: 'separator', label: 'recent-separator', visible: recent.length > 0 },
  ]
  if (recent.length > 0) {
    for (const entry of recent) {
      recentItems.push({
        label: '  ' + entry.name,
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

// ── Menu action sender ───────────────────────────────────
function sendToRenderer(arg1, arg2) {
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

// ── Menu ──────────────────────────────────────────────────
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
            type: 'info', title: '关于 Topo', message: 'Topo — 网络拓扑绘制软件',
            detail: `版本: v${app.getVersion()}\n基于 Electron + React + React Flow\n用于快速绘制网络拓扑图，支持设备拖拽、自动连线、PNG/PDF/GIF 导出。`,
          })
        },
      },
      {
        label: '联系信息',
        click: () => {
          dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
            type: 'info', title: '联系信息', message: '📧 联系方式',
            detail: 'Klay\nEmail: cgynetwork@gmail.com',
          })
        },
      },
    ],
  },
]

// ── Window ───────────────────────────────────────────────
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 768,
    title: 'Topo V1.0.0 - 网络拓扑绘制', show: false, backgroundColor: '#FFFFFF',
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

// ── Topology template management ───────────────────────────
function registerTemplateHandlers() {
  const TEMPLATE_DIR = path.join(app.getPath('userData'), 'templates')

  ipcMain.handle('template:list', () => {
    try {
      if (!fs.existsSync(TEMPLATE_DIR)) return []
      return fs.readdirSync(TEMPLATE_DIR)
        .filter(f => f.endsWith('.topo.json'))
        .map(f => ({ name: f.replace('.topo.json', ''), file: f }))
    } catch { return [] }
  })

  ipcMain.handle('template:save', (_e, name, content) => {
    try {
      fs.mkdirSync(TEMPLATE_DIR, { recursive: true })
      const safeName = name.replace(/[<>:"/\\|?*]/g, '_')
      fs.writeFileSync(path.join(TEMPLATE_DIR, `${safeName}.topo.json`), content, 'utf-8')
      return { success: true, name: safeName }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('template:load', (_e, name) => {
    const filePath = path.join(TEMPLATE_DIR, `${name}.topo.json`)
    if (!fs.existsSync(filePath)) throw new Error('模板文件不存在')
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('template:delete', (_e, name) => {
    try {
      const filePath = path.join(TEMPLATE_DIR, `${name}.topo.json`)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return { success: true }
    } catch (e) { return { success: false, error: e.message } }
  })

  ipcMain.handle('template:import', async () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const r = await dialog.showOpenDialog(win, {
      title: '导入拓扑模板',
      filters: [{ name: 'Topo 模板文件', extensions: ['topo.json'] }],
      properties: ['openFile'],
    })
    if (r.canceled) return { success: false, canceled: true }
    try {
      const content = fs.readFileSync(r.filePaths[0], 'utf-8')
      // Validate it's a valid topo file
      JSON.parse(content)
      const baseName = path.basename(r.filePaths[0], '.topo.json')
      const safeName = baseName.replace(/[<>:"/\\|?*]/g, '_')
      fs.mkdirSync(TEMPLATE_DIR, { recursive: true })
      fs.writeFileSync(path.join(TEMPLATE_DIR, `${safeName}.topo.json`), content, 'utf-8')
      return { success: true, name: safeName }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })
}

// ── App ───────────────────────────────────────────────────
registerDeviceHandlers()
registerFileHandlers()
registerAutoSaveHandlers()
registerRecentHandlers()
registerTemplateHandlers()
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
  rebuildRecentMenu(Menu.getApplicationMenu())
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
