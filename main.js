// Electron main process for Topo — 网络拓扑绘制软件
// 独立 CommonJS 入口点。与 src/main/*.ts 保持同步，两者互为镜像。
// 为什么不用构建输出：rollup 打包会阻止 better-sqlite3 原生 .node 文件的动态 require()。

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Database = require('better-sqlite3')

// ── Simple i18n for main process ──────────────────────────
let currentLang = 'zh'
const translations = { zh: null, en: null }

function loadTranslations() {
  try {
    // Try built output path first (production)
    const resDir = path.join(__dirname, 'out', 'renderer', 'i18n', 'resources')
    translations.zh = JSON.parse(fs.readFileSync(path.join(resDir, 'zh.json'), 'utf-8'))
    translations.en = JSON.parse(fs.readFileSync(path.join(resDir, 'en.json'), 'utf-8'))
  } catch {
    try {
      // Try source path (dev mode)
      const resDir = path.join(__dirname, 'src', 'renderer', 'i18n', 'resources')
      translations.zh = JSON.parse(fs.readFileSync(path.join(resDir, 'zh.json'), 'utf-8'))
      translations.en = JSON.parse(fs.readFileSync(path.join(resDir, 'en.json'), 'utf-8'))
    } catch {
      // Fallback: empty
      translations.zh = {}
      translations.en = {}
    }
  }
}

function mt(key, params) {
  const resource = translations[currentLang] || translations.zh || {}
  const keys = key.split('.')
  let val = resource
  for (const k of keys) {
    if (val == null) break
    val = val[k]
  }
  if (typeof val !== 'string') return key
  if (params) {
    return val.replace(/\{\{(\w+)\}\}/g, (_, name) => params[name] != null ? params[name] : _)
  }
  return val
}

loadTranslations()

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
    // V1.1.0: Incremental migration — add rack equipment categories if missing
    const rackCount = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name = '配线架'").get()
    if (rackCount.cnt === 0) {
      const migrateCat2 = db.prepare('INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
      migrateCat2.run('配线架', 'patch-panel', 8)
      migrateCat2.run('超融合', 'hyper-converged', 9)
      migrateCat2.run('存储', 'storage', 10)
      migrateCat2.run('运营商光猫', 'ont', 11)
      const migrateDev2 = db.prepare('INSERT OR IGNORE INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const rackDevices = [
        [8, 1, '通用24口配线架', '标准1U 24口超五类网络配线架', '24×GE'],
        [8, 1, '通用48口配线架', '标准2U 48口超五类网络配线架', '48×GE'],
        [8, 2, '通用24口光纤配线架', '标准1U 24口LC双工光纤配线架', '24×SFP'],
        [8, 2, '通用48口光纤配线架', '标准2U 48口LC双工光纤配线架', '48×SFP'],
        [9, 1, 'UIS 3000 G5', 'H3C 2U 超融合一体机，双路Xeon+3节点', '4×25GE+8×GE'],
        [9, 2, 'FusionCube 500', 'Huawei 2U 超融合一体机，双路Xeon+2节点', '2×25GE+4×GE'],
        [9, 1, '通用超融合节点', '通用2U 超融合节点，双路Xeon', '2×25GE+4×GE'],
        [10, 1, 'UniStor CF22000', 'H3C 2U 混合存储阵列，12×3.5"盘位', '4×25GE+8×GE'],
        [10, 2, 'OceanStor 5310', 'Huawei 2U 混合存储阵列，12×3.5"盘位', '4×25GE+8×GE'],
        [10, 1, '通用存储阵列', '通用2U 存储阵列，12×3.5"盘位', '2×25GE+4×GE'],
        [10, 1, '通用全闪存储', '通用2U 全闪存储阵列，24×2.5" NVMe', '4×25GE+8×GE'],
        [11, 2, 'OptiXstar P812E', 'Huawei XGSPON ONT，1×10GE+4×GE', '1×10GE+4×GE'],
        [11, 1, '通用GPON光猫', '通用1U GPON ONT终端，1×GE+1×POTS', '1×GE'],
        [11, 1, '通用XGSPON光猫', '通用1U XGSPON ONT终端，1×10GE+4×GE', '1×10GE+4×GE'],
      ]
      for (const d of rackDevices) migrateDev2.run(...d)
      console.log('V1.1.0 migration: added rack equipment categories and devices')
    }
    // V1.2.0: Merge 5 separate SDWAN categories into single "SDWAN" category
    const sdwanExists = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name = 'SDWAN'").get()
    if (sdwanExists.cnt === 0) {
      // Clean up old V1.2.0 categories if present (previous migration with 5 categories)
      const oldCount = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name IN ('SDWAN节点','互联网网络','公有云','数据中心','SDWAN设备')").get()
      if (oldCount.cnt > 0) {
        db.prepare("DELETE FROM categories WHERE name IN ('SDWAN节点','互联网网络','公有云','数据中心','SDWAN设备')").run()
        // Undo the previous sort_order +5 shift
        db.prepare('UPDATE categories SET sort_order = sort_order - 5 WHERE sort_order > 5').run()
      }
      // Shift existing categories down by 1 for the new SDWAN category
      db.prepare('UPDATE categories SET sort_order = sort_order + 1').run()
      // Insert single SDWAN category at top
      db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)').run('SDWAN', 'sdwan', 1)
      const sdwanCat = db.prepare("SELECT id FROM categories WHERE name = 'SDWAN'").get()
      const migrateDev3 = db.prepare('INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const sdwanDevices = [
        [sdwanCat.id, 1, 'SDWAN Hub Node', 'H3C SDWAN 中心控制节点，策略编排与路由管理', ''],
        [sdwanCat.id, 1, '互联网接入点', 'ISP 互联网接入点，企业出口上联', ''],
        [sdwanCat.id, 1, '阿里云 VPC', '阿里云虚拟私有云，高速弹性网络', ''],
        [sdwanCat.id, 1, '主数据中心', '核心业务数据中心，双路供电+容灾', ''],
        [sdwanCat.id, 2, 'NetEngine AR8140', 'Huawei SDWAN CPE 网关，4×GE+2×SFP', '4×GE+2×SFP'],
      ]
      for (const d of sdwanDevices) migrateDev3.run(...d)
      console.log('V1.2.0 migration: unified SDWAN category with 5 devices')
    }

    // V1.3.0: add domestic/international app devices to SDWAN
    const domesticExists = db.prepare("SELECT COUNT(*) as cnt FROM device_models WHERE model IN ('国内互联网应用', '互联网应用')").get()
    if (domesticExists.cnt === 0) {
      const sdwanCat = db.prepare("SELECT id FROM categories WHERE name = 'SDWAN'").get()
      const migrateDev4 = db.prepare('INSERT OR IGNORE INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const newSdwanDevices = [
        [sdwanCat.id, 1, '国内互联网应用', '微信、百度等国内主流互联网应用接入点', ''],
        [sdwanCat.id, 1, '国际互联网应用', 'OpenAI、Salesforce等国际SaaS应用接入点', ''],
      ]
      for (const d of newSdwanDevices) migrateDev4.run(...d)
      console.log('V1.3.0 migration: added domestic/international app devices to SDWAN')
    }

    // V1.4.0: merge domestic/international app devices into single unified 互联网应用
    const mergedAppExists = db.prepare("SELECT COUNT(*) as cnt FROM device_models WHERE model = '互联网应用'").get()
    if (mergedAppExists.cnt === 0) {
      const sdwanCat = db.prepare("SELECT id FROM categories WHERE name = 'SDWAN'").get()
      db.prepare("DELETE FROM device_models WHERE model IN ('国内互联网应用', '国际互联网应用')").run()
      const migrateDev5 = db.prepare('INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      migrateDev5.run(sdwanCat.id, 1, '互联网应用', '国内外主流互联网应用接入点，支持上传自定义业务图片', '')
      console.log('V1.4.0 migration: merged domestic/international app devices into unified 互联网应用')
    }
    return
  }

  // Categories
  const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
  const categories = [
    ['防火墙', 'firewall', 6],
    ['交换机', 'switch', 7],
    ['无线控制器', 'ac', 8],
    ['无线接入点', 'ap', 9],
    ['服务器', 'server', 10],
    ['终端-PC', 'pc', 11],           // V0.9.3
    ['终端-笔记本', 'laptop', 12],   // V0.9.3
    ['配线架', 'patch-panel', 13],   // V1.1.0
    ['超融合', 'hyper-converged', 14],   // V1.1.0
    ['存储', 'storage', 15],        // V1.1.0
    ['运营商光猫', 'ont', 16],      // V1.1.0
    ['SDWAN', 'sdwan', 1],                     // V1.2.0
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
    // V1.1.0: 配线架 (category_id=8)
    [8, 1, '通用24口配线架', '标准1U 24口超五类网络配线架', '24×GE'],
    [8, 1, '通用48口配线架', '标准2U 48口超五类网络配线架', '48×GE'],
    [8, 2, '通用24口光纤配线架', '标准1U 24口LC双工光纤配线架', '24×SFP'],
    [8, 2, '通用48口光纤配线架', '标准2U 48口LC双工光纤配线架', '48×SFP'],
    // V1.1.0: 超融合 (category_id=9)
    [9, 1, 'UIS 3000 G5', 'H3C 2U 超融合一体机，双路Xeon+3节点', '4×25GE+8×GE'],
    [9, 2, 'FusionCube 500', 'Huawei 2U 超融合一体机，双路Xeon+2节点', '2×25GE+4×GE'],
    [9, 1, '通用超融合节点', '通用2U 超融合节点，双路Xeon', '2×25GE+4×GE'],
    // V1.1.0: 存储 (category_id=10)
    [10, 1, 'UniStor CF22000', 'H3C 2U 混合存储阵列，12×3.5"盘位', '4×25GE+8×GE'],
    [10, 2, 'OceanStor 5310', 'Huawei 2U 混合存储阵列，12×3.5"盘位', '4×25GE+8×GE'],
    [10, 1, '通用存储阵列', '通用2U 存储阵列，12×3.5"盘位', '2×25GE+4×GE'],
    [10, 1, '通用全闪存储', '通用2U 全闪存储阵列，24×2.5" NVMe', '4×25GE+8×GE'],
    // V1.1.0: 运营商光猫 (category_id=11)
    [11, 2, 'OptiXstar P812E', 'Huawei XGSPON ONT，1×10GE+4×GE', '1×10GE+4×GE'],
    [11, 1, '通用GPON光猫', '通用1U GPON ONT终端，1×GE+1×POTS', '1×GE'],
    [11, 1, '通用XGSPON光猫', '通用1U XGSPON ONT终端，1×10GE+4×GE', '1×10GE+4×GE'],
    // V1.2.0: SDWAN (category_id=12) — one device per type
    [12, 1, 'SDWAN Hub Node', 'H3C SDWAN 中心控制节点，策略编排与路由管理', ''],
    [12, 1, '互联网接入点', 'ISP 互联网接入点，企业出口上联', ''],
    [12, 1, '阿里云 VPC', '阿里云虚拟私有云，高速弹性网络', ''],
    [12, 1, '主数据中心', '核心业务数据中心，双路供电+容灾', ''],
    [12, 2, 'NetEngine AR8140', 'Huawei SDWAN CPE 网关，4×GE+2×SFP', '4×GE+2×SFP'],
    // V1.4.0: SDWAN internet application device (unified domestic+international)
    [12, 1, '互联网应用', '国内外主流互联网应用接入点，支持上传自定义业务图片', ''],
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
      const base64 = dataUrl.substring(dataUrl.lastIndexOf(',') + 1)
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

  // Capture canvas for export — uses native page capture.
  // Rect is computed in the renderer at the current zoom level and passed in.
  // No zoomFactor manipulation needed — coordinates are always consistent.
  ipcMain.handle('capture:canvas', async (_e, rect) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    try {
      const opts = rect && rect.width > 10 ? rect : undefined
      const image = await win.webContents.capturePage(opts)
      return image.toDataURL()
    } catch (e) {
      console.error('capture:canvas error:', e)
      return null
    }
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
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp'] }],
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
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' }
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

  // V1.4.0: Pick business image — returns base64 data URL directly (no file storage)
  ipcMain.handle('file:pickAppImage', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }
    const r = await dialog.showOpenDialog(win, {
      title: '选择业务图片',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp'] }],
      properties: ['openFile'],
    })
    if (r.canceled || r.filePaths.length === 0) return { success: false, canceled: true }
    try {
      const stat = fs.statSync(r.filePaths[0])
      if (stat.size > 512 * 1024) return { success: false, error: '图片不能超过 512KB' }
      const buffer = fs.readFileSync(r.filePaths[0])
      const ext = path.extname(r.filePaths[0]).toLowerCase()
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' }
      const mime = mimeMap[ext] || 'image/png'
      return { success: true, dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, fileName: path.basename(r.filePaths[0]) }
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
const MAX_RECENT = 10

function getRecentPath() {
  return path.join(app.getPath('userData'), 'recent-files.json')
}

function loadRecent() {
  try {
    const p = getRecentPath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch (e) { /* ignore */ }
  return []
}

function saveRecent(list) {
  try { fs.writeFileSync(getRecentPath(), JSON.stringify(list, null, 2), 'utf-8') } catch (e) { /* ignore */ }
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

  // Find insertion point before Exit/Quit
  const exitLabels = ['退出', 'Exit', 'Quit']
  let exitIdx = -1
  for (let i = 0; i < submenu.items.length; i++) {
    if (exitLabels.includes(submenu.items[i].label)) { exitIdx = i; break }
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
    recentItems.push({ label: mt('menu.file.noRecent'), enabled: false })
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
function buildMenuTemplate() {
  return [
    {
      label: 'File',
      submenu: [
        { label: mt('menu.file.new'), accelerator: 'CmdOrCtrl+N', click: () => sendToRenderer('menu:action', 'new') },
        { label: mt('menu.file.open'), accelerator: 'CmdOrCtrl+O', click: () => sendToRenderer('menu:action', 'open') },
        { type: 'separator' },
        { label: mt('menu.file.save'), accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('menu:action', 'save') },
        { label: mt('menu.file.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', click: () => sendToRenderer('menu:action', 'saveAs') },
        { type: 'separator' },
        { label: mt('menu.file.exportPNG'), accelerator: 'CmdOrCtrl+Shift+E', click: () => sendToRenderer('menu:action', 'exportPNG') },
        { label: mt('menu.file.exportPDF'), accelerator: 'CmdOrCtrl+Shift+P', click: () => sendToRenderer('menu:action', 'exportPDF') },
        { label: mt('menu.file.exportGIF'), click: () => sendToRenderer('menu:action', 'exportGIF') },
        { type: 'separator' },
        { label: mt('menu.file.quit'), accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: mt('menu.edit.undo'), accelerator: 'CmdOrCtrl+Z', click: () => sendToRenderer('menu:action', 'undo') },
        { label: mt('menu.edit.redo'), accelerator: 'CmdOrCtrl+Y', click: () => sendToRenderer('menu:action', 'redo') },
        { type: 'separator' },
        { label: mt('menu.edit.selectAll'), accelerator: 'CmdOrCtrl+A', click: () => sendToRenderer('menu:action', 'selectAll') },
        { label: mt('menu.edit.delete'), accelerator: 'Delete', click: () => sendToRenderer('menu:action', 'deleteSelected') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: mt('menu.view.zoomIn'), accelerator: 'CmdOrCtrl+=', click: () => sendToRenderer('menu:action', 'zoomIn') },
        { label: mt('menu.view.zoomOut'), accelerator: 'CmdOrCtrl+-', click: () => sendToRenderer('menu:action', 'zoomOut') },
        { label: mt('menu.view.fitView'), accelerator: 'CmdOrCtrl+0', click: () => sendToRenderer('menu:action', 'fitView') },
        { type: 'separator' },
        { label: mt('menu.view.toggleSidebar'), accelerator: 'CmdOrCtrl+B', click: () => sendToRenderer('menu:action', 'toggleSidebar') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: mt('menu.help.about'),
          click: () => {
            dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
              type: 'info', title: mt('menu.help.aboutTitle'), message: mt('menu.help.aboutMessage'),
              detail: mt('menu.help.aboutDetail', { version: app.getVersion() }),
            })
          },
        },
        {
          label: mt('menu.help.contact'),
          click: () => {
            dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
              type: 'info', title: mt('menu.help.contactTitle'), message: mt('menu.help.contactMessage'),
              detail: mt('menu.help.contactDetail'),
            })
          },
        },
      ],
    },
  ]
}

// ── Window ───────────────────────────────────────────────
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 768,
    title: mt('window.title'), show: false, backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'out', 'preload', 'index.js'),
      sandbox: false, contextIsolation: true, nodeIntegration: false,
    },
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
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

// Language change handler — rebuild native menu
ipcMain.handle('lang:changed', (_e, lang) => {
  currentLang = lang
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()))
  rebuildRecentMenu(Menu.getApplicationMenu())
  if (mainWindow) {
    mainWindow.setTitle(mt('window.title'))
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()))
  rebuildRecentMenu(Menu.getApplicationMenu())
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
