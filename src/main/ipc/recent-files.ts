// Shared recent-files management — used by both file-handlers and main menu

import { app, BrowserWindow, Menu } from 'electron'
import { join, basename } from 'path'
import { writeFileSync, readFileSync, existsSync } from 'fs'

const MAX_RECENT = 10

export interface RecentEntry {
  filePath: string
  name: string
  timestamp: number
}

function getRecentPath(): string {
  return join(app.getPath('userData'), 'recent-files.json')
}

export function loadRecent(): RecentEntry[] {
  try {
    const p = getRecentPath()
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8'))
    }
  } catch { /* ignore corrupt file */ }
  return []
}

export function saveRecent(list: RecentEntry[]): void {
  try {
    writeFileSync(getRecentPath(), JSON.stringify(list, null, 2), 'utf-8')
  } catch { /* ignore write errors */ }
}

export function addRecent(filePath: string): RecentEntry[] {
  const list = loadRecent().filter(e => e.filePath !== filePath)
  list.unshift({ filePath, name: basename(filePath), timestamp: Date.now() })
  const trimmed = list.slice(0, MAX_RECENT)
  saveRecent(trimmed)
  return trimmed
}

// Rebuild the "Open Recent" submenu in the File menu
export function rebuildRecentMenu(menu: Electron.Menu | null): void {
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

  // Find insertion point (before Exit)
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
  submenu.insert(insertIdx, new Menu.buildFromTemplate([
    { type: 'separator', label: 'recent-separator', visible: recent.length > 0 },
    ...(recent.length > 0
      ? recent.map(entry => ({
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
