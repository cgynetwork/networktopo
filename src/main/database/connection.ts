import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { initSchema } from './schema'
import { seedData } from './seed'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'topo-devices.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  seedData(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
