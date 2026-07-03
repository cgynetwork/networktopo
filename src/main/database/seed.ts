import Database from 'better-sqlite3'

export function seedData(db: Database.Database): void {
  // Check if data already exists
  const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }
  if (count.cnt > 0) {
    // V0.9.3: Incremental migration — add new categories if missing
    const pcCount = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name = '终端-PC'").get() as { cnt: number }
    if (pcCount.cnt === 0) {
      const migrateCat = db.prepare('INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
      migrateCat.run('终端-PC', 'pc', 6)
      migrateCat.run('终端-笔记本', 'laptop', 7)
      const migrateVendor = db.prepare('INSERT OR IGNORE INTO vendors (name, logo_path) VALUES (?, ?)')
      migrateVendor.run('Lenovo', null)
      migrateVendor.run('Dell', null)
      migrateVendor.run('HP', null)
      migrateVendor.run('Apple', null)
      // Insert new device models
      const migrateDevice = db.prepare('INSERT OR IGNORE INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const newDevices: Array<[number, number, string, string, string]> = [
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
      for (const d of newDevices) {
        migrateDevice.run(...d)
      }
      console.log('V0.9.3 migration: added PC/Laptop categories and devices')
    }
    // V1.1.0: Incremental migration — add rack equipment categories
    const rackCatCount = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name = '配线架'").get() as { cnt: number }
    if (rackCatCount.cnt === 0) {
      const migrateCat2 = db.prepare('INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES (?, ?, ?)')
      migrateCat2.run('配线架', 'patch-panel', 8)
      migrateCat2.run('超融合', 'hyper-converged', 9)
      migrateCat2.run('存储', 'storage', 10)
      migrateCat2.run('运营商光猫', 'ont', 11)
      const migrateDevice2 = db.prepare('INSERT OR IGNORE INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const rackDevices: Array<[number, number, string, string, string]> = [
        // 配线架 (category_id=8)
        [8, 1, '通用24口配线架', '标准1U 24口超五类网络配线架', '24×GE'],
        [8, 1, '通用48口配线架', '标准2U 48口超五类网络配线架', '48×GE'],
        [8, 2, '通用24口光纤配线架', '标准1U 24口LC双工光纤配线架', '24×SFP'],
        [8, 2, '通用48口光纤配线架', '标准2U 48口LC双工光纤配线架', '48×SFP'],
        // 超融合 (category_id=9)
        [9, 1, 'UIS 3000 G5', 'H3C 2U 超融合一体机，双路Xeon+3节点', '4×25GE+8×GE'],
        [9, 2, 'FusionCube 500', 'Huawei 2U 超融合一体机，双路Xeon+2节点', '2×25GE+4×GE'],
        [9, 1, '通用超融合节点', '通用2U 超融合节点，双路Xeon', '2×25GE+4×GE'],
        // 存储 (category_id=10)
        [10, 1, 'UniStor CF22000', 'H3C 2U 混合存储阵列，12×3.5"盘位', '4×25GE+8×GE'],
        [10, 2, 'OceanStor 5310', 'Huawei 2U 混合存储阵列，12×3.5"盘位', '4×25GE+8×GE'],
        [10, 1, '通用存储阵列', '通用2U 存储阵列，12×3.5"盘位', '2×25GE+4×GE'],
        [10, 1, '通用全闪存储', '通用2U 全闪存储阵列，24×2.5" NVMe', '4×25GE+8×GE'],
        // 运营商光猫 (category_id=11)
        [11, 2, 'OptiXstar P812E', 'Huawei XGSPON ONT，1×10GE+4×GE', '1×10GE+4×GE'],
        [11, 1, '通用GPON光猫', '通用1U GPON ONT终端，1×GE+1×POTS', '1×GE'],
        [11, 1, '通用XGSPON光猫', '通用1U XGSPON ONT终端，1×10GE+4×GE', '1×10GE+4×GE'],
      ]
      for (const d of rackDevices) {
        migrateDevice2.run(...d)
      }
      console.log('V1.1.0 migration: added rack equipment categories and devices')
    }
    // V1.2.0: Merge 5 separate SDWAN categories into single "SDWAN" category
    const sdwanExists = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name = 'SDWAN'").get() as { cnt: number }
    if (sdwanExists.cnt === 0) {
      // Clean up old V1.2.0 categories if present
      const oldCount = db.prepare("SELECT COUNT(*) as cnt FROM categories WHERE name IN ('SDWAN节点','互联网网络','公有云','数据中心','SDWAN设备')").get() as { cnt: number }
      if (oldCount.cnt > 0) {
        db.prepare("DELETE FROM categories WHERE name IN ('SDWAN节点','互联网网络','公有云','数据中心','SDWAN设备')").run()
        db.prepare('UPDATE categories SET sort_order = sort_order - 5 WHERE sort_order > 5').run()
      }
      // Shift existing categories down by 1 for the new SDWAN category
      db.prepare('UPDATE categories SET sort_order = sort_order + 1').run()
      db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)').run('SDWAN', 'sdwan', 1)
      const sdwanCat = db.prepare("SELECT id FROM categories WHERE name = 'SDWAN'").get() as { id: number }
      const migrateDevice3 = db.prepare('INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const sdwanDevices: Array<[number, number, string, string, string]> = [
        [sdwanCat.id, 1, 'SDWAN Hub Node', 'H3C SDWAN 中心控制节点，策略编排与路由管理', ''],
        [sdwanCat.id, 1, '互联网接入点', 'ISP 互联网接入点，企业出口上联', ''],
        [sdwanCat.id, 1, '阿里云 VPC', '阿里云虚拟私有云，高速弹性网络', ''],
        [sdwanCat.id, 1, '主数据中心', '核心业务数据中心，双路供电+容灾', ''],
        [sdwanCat.id, 2, 'NetEngine AR8140', 'Huawei SDWAN CPE 网关，4×GE+2×SFP', '4×GE+2×SFP'],
      ]
      for (const d of sdwanDevices) {
        migrateDevice3.run(...d)
      }
      console.log('V1.2.0 migration: unified SDWAN category with 5 devices')
    }

    // V1.3.0: add domestic/international app devices to SDWAN
    const domesticExists = db.prepare("SELECT COUNT(*) as cnt FROM device_models WHERE model IN ('国内互联网应用', '互联网应用')").get() as { cnt: number }
    if (domesticExists.cnt === 0) {
      const sdwanCat = db.prepare("SELECT id FROM categories WHERE name = 'SDWAN'").get() as { id: number }
      const migrateDevice4 = db.prepare('INSERT OR IGNORE INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      const newSdwanDevices = [
        [sdwanCat.id, 1, '国内互联网应用', '微信、百度等国内主流互联网应用接入点', ''],
        [sdwanCat.id, 1, '国际互联网应用', 'OpenAI、Salesforce等国际SaaS应用接入点', ''],
      ]
      for (const d of newSdwanDevices) {
        migrateDevice4.run(...d)
      }
      console.log('V1.3.0 migration: added domestic/international app devices to SDWAN')
    }

    // V1.4.0: merge domestic/international app devices into single unified 互联网应用
    const mergedAppExists = db.prepare("SELECT COUNT(*) as cnt FROM device_models WHERE model = '互联网应用'").get() as { cnt: number }
    if (mergedAppExists.cnt === 0) {
      const sdwanCat = db.prepare("SELECT id FROM categories WHERE name = 'SDWAN'").get() as { id: number }
      db.prepare("DELETE FROM device_models WHERE model IN ('国内互联网应用', '国际互联网应用')").run()
      const migrateDevice5 = db.prepare('INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)')
      migrateDevice5.run(sdwanCat.id, 1, '互联网应用', '国内外主流互联网应用接入点，支持上传自定义业务图片', '')
      console.log('V1.4.0 migration: merged domestic/international app devices into unified 互联网应用')
    }
    return
  }

  // Insert categories
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)'
  )
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
  for (const cat of categories) {
    insertCategory.run(...cat)
  }

  // Insert vendors
  const insertVendor = db.prepare('INSERT INTO vendors (name, logo_path) VALUES (?, ?)')
  const vendors = [
    ['H3C', null],
    ['Huawei', null],
    ['Cisco', null],
    ['Ruijie', null],
    ['Aruba', null],
    ['Lenovo', null],    // V0.9.3
    ['Dell', null],      // V0.9.3
    ['HP', null],        // V0.9.3
    ['Apple', null],     // V0.9.3
  ]
  for (const vendor of vendors) {
    insertVendor.run(...vendor)
  }

  // Insert device models (real common models used by Chinese network engineers)
  const deviceModels: Array<[number, number, string, string, string]> = [
    // 防火墙 (category_id=1)
    [1, 1, 'SecPath F1000-AK125', 'H3C 中端防火墙，支持 4Gbps 吞吐量', '8×GE+2×SFP'],
    [1, 1, 'SecPath F100-C-G3', 'H3C 桌面级防火墙，适合小型分支', '5×GE'],
    [1, 2, 'USG6300F', 'Huawei 下一代防火墙，6Gbps 吞吐量', '8×GE+4×SFP'],
    [1, 2, 'USG6600F', 'Huawei 中高端防火墙，20Gbps 吞吐量', '12×GE+8×SFP+4×SFP+'],
    [1, 3, 'Firepower 1120', 'Cisco NGFW 防火墙，1.5Gbps 吞吐量', '8×GE+4×SFP'],
    [1, 3, 'ASA 5508-X', 'Cisco ASA 防火墙，1Gbps 吞吐量', '8×GE'],

    // 交换机 (category_id=2)
    [2, 1, 'S5130S-28S-HPWR-EI', 'H3C 三层 PoE+ 交换机，24 口千兆+4 口万兆 SFP+', '24×GE PoE++4×SFP+'],
    [2, 1, 'S5500V2-54S-EI', 'H3C 三层交换机，48 口千兆+6 口 SFP', '48×GE+6×SFP'],
    [2, 1, 'S6520X-30QC-EI', 'H3C 数据中心交换机，24 口万兆+6 口 40GE', '24×SFP++6×QSFP+'],
    [2, 1, 'S5560X-54C-EI', 'H3C 三层交换机，48 口千兆/万兆+6 口 40GE', '48×GE/SFP++6×QSFP+'],
    [2, 2, 'S5735-L24P4XE-A-V2', 'Huawei 三层交换机，24 口千兆 PoE+ 4 口万兆', '24×GE PoE++4×SFP+'],
    [2, 2, 'S6730-H48X6C', 'Huawei 数据中心交换机，48 口 25GE+6 口 100GE', '48×25GE+6×100GE'],
    [2, 2, 'S6735-S48X6C', 'Huawei 数据中心交换机，48 口 10GE+6 口 100GE', '48×SFP++6×QSFP28'],
    [2, 3, 'Catalyst 9300-48P', 'Cisco 企业级交换机，48 口千兆 PoE+', '48×GE PoE++4×SFP+'],
    [2, 3, 'Catalyst 9200-24T', 'Cisco 接入交换机，24 口千兆', '24×GE+4×SFP'],
    [2, 3, 'Nexus 93180YC-FX3', 'Cisco Nexus 数据中心交换机，48×25GE+6×100GE', '48×25GE+6×100GE'],
    [2, 4, 'RG-S5310-48GT4XS', 'Ruijie 三层交换机，48 口千兆+4 口万兆', '48×GE+4×SFP+'],

    // 无线控制器 (category_id=3)
    [3, 1, 'WX3510X', 'H3C 无线控制器，最大管理 256 AP', '2×10GE+2×GE'],
    [3, 1, 'WX3540X', 'H3C 高性能无线控制器，最大管理 1024 AP', '4×10GE+4×GE'],
    [3, 2, 'AC6508', 'Huawei 无线控制器，最大管理 256 AP', '8×GE+2×SFP+'],
    [3, 2, 'AC6805', 'Huawei 高性能无线控制器，最大管理 1024 AP', '4×10GE+4×GE'],
    [3, 3, '9800-L', 'Cisco 无线控制器，最大管理 250 AP', '4×GE+2×SFP+'],
    [3, 4, 'RG-WS6008', 'Ruijie 无线控制器，最大管理 256 AP', '8×GE+2×SFP+'],

    // 无线接入点 (category_id=4)
    [4, 1, 'WA6638', 'H3C Wi-Fi 6 AP，三频 8 空间流', '1×5GE+1×GE'],
    [4, 1, 'WA6330', 'H3C Wi-Fi 6 AP，双频 4 空间流', '1×2.5GE'],
    [4, 1, 'WA6322', 'H3C Wi-Fi 6 面板 AP，双频 2 空间流', '1×GE'],
    [4, 2, 'AirEngine 6760R-51', 'Huawei Wi-Fi 6 AP，三频 8 空间流', '1×5GE+1×GE'],
    [4, 2, 'AirEngine 5761-21', 'Huawei Wi-Fi 6 AP，双频 4 空间流', '1×2.5GE'],
    [4, 3, 'Catalyst 9130AXI', 'Cisco Wi-Fi 6 AP，双频 8 空间流', '1×5GE'],
    [4, 3, 'Catalyst 9120AXI', 'Cisco Wi-Fi 6 AP，双频 4 空间流', '1×2.5GE'],
    [4, 4, 'RG-AP880-I', 'Ruijie Wi-Fi 6 AP，三频 8 空间流', '1×5GE+1×GE'],
    [4, 5, 'AP-535', 'Aruba Wi-Fi 6 AP，双频 4 空间流', '1×2.5GE+1×GE'],

    // 服务器 (category_id=5)
    [5, 1, 'UniServer R4900 G5', 'H3C 2U 机架式服务器，双路 Intel Xeon', '2×10GE+4×GE'],
    [5, 1, 'UniServer R2700 G5', 'H3C 1U 机架式服务器，双路 Intel Xeon', '2×10GE+2×GE'],
    [5, 2, 'FusionServer Pro 2288H V7', 'Huawei 2U 机架式服务器，双路 Intel Xeon', '2×25GE+4×GE'],
    [5, 2, 'KunLun 2280', 'Huawei 2U ARM 服务器，双路 Kunpeng 920', '2×25GE+4×GE'],
    [5, 3, 'UCS C220 M7', 'Cisco 1U 机架式服务器，双路 Intel Xeon', '2×25GE+2×GE'],
    [5, 4, 'RG-RCD4500 V3', 'Ruijie 云桌面服务器，双路 Intel Xeon', '2×10GE+2×GE'],

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
    // V0.9.3: 通用终端（无厂商）
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

  const insertDevice = db.prepare(
    'INSERT INTO device_models (category_id, vendor_id, model, description, ports_info) VALUES (?, ?, ?, ?, ?)'
  )

  const insertMany = db.transaction(() => {
    for (const device of deviceModels) {
      insertDevice.run(...device)
    }
  })
  insertMany()

  console.log(`Seeded ${categories.length} categories, ${vendors.length} vendors, ${deviceModels.length} device models`)
}
