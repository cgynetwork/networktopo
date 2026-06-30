import { ipcMain } from 'electron'
import { getDatabase } from '../database/connection'

export function registerDeviceHandlers(): void {
  // Get all categories
  ipcMain.handle('db:getCategories', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM categories ORDER BY sort_order').all()
  })

  // Get devices by optional category filter
  ipcMain.handle('db:getDevices', (_event, categoryId?: number) => {
    const db = getDatabase()
    let devices
    if (categoryId) {
      devices = db
        .prepare(
          `SELECT d.*, c.name as category_name, v.name as vendor_name
           FROM device_models d
           JOIN categories c ON d.category_id = c.id
           JOIN vendors v ON d.vendor_id = v.id
           WHERE d.category_id = ?
           ORDER BY v.name, d.model`
        )
        .all(categoryId)
    } else {
      devices = db
        .prepare(
          `SELECT d.*, c.name as category_name, v.name as vendor_name
           FROM device_models d
           JOIN categories c ON d.category_id = c.id
           JOIN vendors v ON d.vendor_id = v.id
           ORDER BY c.sort_order, v.name, d.model`
        )
        .all()
    }
    return devices
  })

  // Search devices by query (searches model name, description, vendor, category)
  ipcMain.handle('db:searchDevices', (_event, query: string) => {
    const db = getDatabase()
    const searchTerm = `%${query}%`
    return db
      .prepare(
        `SELECT d.*, c.name as category_name, v.name as vendor_name
         FROM device_models d
         JOIN categories c ON d.category_id = c.id
         JOIN vendors v ON d.vendor_id = v.id
         WHERE d.model LIKE ? OR d.description LIKE ? OR v.name LIKE ? OR c.name LIKE ?
         ORDER BY c.sort_order, v.name, d.model`
      )
      .all(searchTerm, searchTerm, searchTerm, searchTerm)
  })

  // Update device description
  ipcMain.handle(
    'db:updateDeviceDescription',
    (_event, id: number, description: string) => {
      const db = getDatabase()
      db.prepare(
        "UPDATE device_models SET description = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(description, id)
      return { success: true }
    }
  )

  // Add custom device
  ipcMain.handle('db:addDevice', (_event, device: {
    category_id: number
    vendor_id: number
    model: string
    description?: string
    ports_info?: string
    image_path?: string
  }) => {
    const db = getDatabase()
    const result = db
      .prepare(
        `INSERT INTO device_models (category_id, vendor_id, model, description, ports_info, image_path)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        device.category_id,
        device.vendor_id,
        device.model,
        device.description || '',
        device.ports_info || '',
        device.image_path || null
      )
    return { success: true, id: result.lastInsertRowid }
  })

  // Delete device
  ipcMain.handle('db:deleteDevice', (_event, id: number) => {
    const db = getDatabase()
    db.prepare('DELETE FROM device_models WHERE id = ?').run(id)
    return { success: true }
  })

  // Update device fields (general-purpose)
  ipcMain.handle('db:updateDevice', (_event, id: number, updates: Record<string, unknown>) => {
    const db = getDatabase()
    const allowed = ['category_id', 'vendor_id', 'model', 'description', 'ports_info', 'image_path']
    const setClauses: string[] = []
    const values: unknown[] = []

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

  // Get all vendors
  ipcMain.handle('db:getVendors', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM vendors ORDER BY name').all()
  })

  // Add vendor
  ipcMain.handle('db:addVendor', (_event, name: string) => {
    const db = getDatabase()
    try {
      const result = db
        .prepare('INSERT INTO vendors (name) VALUES (?)')
        .run(name)
      return { success: true, id: result.lastInsertRowid }
    } catch {
      return { success: false, error: '厂商已存在' }
    }
  })

  // Update device image path
  ipcMain.handle('db:updateDeviceImage', (_event, id: number, imagePath: string | null) => {
    const db = getDatabase()
    db.prepare(
      "UPDATE device_models SET image_path = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(imagePath, id)
    return { success: true }
  })
}
