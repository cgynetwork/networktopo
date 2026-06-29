import Database from 'better-sqlite3'

export function seedData(db: Database.Database): void {
  // Check if data already exists
  const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }
  if (count.cnt > 0) return

  // Insert categories
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)'
  )
  const categories = [
    ['防火墙', 'firewall', 1],
    ['交换机', 'switch', 2],
    ['无线控制器', 'ac', 3],
    ['无线接入点', 'ap', 4],
    ['服务器', 'server', 5],
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
