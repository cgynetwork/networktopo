/**
 * Generate resources/icon.ico from resources/icon.html using Electron.
 *
 * Usage: npx electron scripts/generate-icon.js
 * (Must run from the repo root with Electron available)
 *
 * The script renders the SVG at 256/48/32/16 px, captures each frame,
 * and packs PNG data into a valid .ico file.
 */

const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const SIZES = [256, 48, 32, 16]
const OUTPUT = path.join(__dirname, '..', 'resources', 'icon.ico')
const HTML = path.join(__dirname, '..', 'resources', 'icon.html')

function createIco(pngs) {
  // pngs: [{size, data: Buffer}], sorted by size descending
  const count = pngs.length
  // ICO header (6 bytes): reserved(2) + type(2: 1=ico) + count(2)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: 1 = ICO
  header.writeUInt16LE(count, 4)

  // Directory entries (16 bytes each): w, h, colors, reserved, planes, bpp, size, offset
  let offset = 6 + count * 16
  const entries = []
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16)
    const w = size >= 256 ? 0 : size // 0 means 256
    const h = size >= 256 ? 0 : size
    entry.writeUInt8(w, 0)           // width
    entry.writeUInt8(h, 1)           // height
    entry.writeUInt8(0, 2)           // color palette (0 = no palette)
    entry.writeUInt8(0, 3)           // reserved
    entry.writeUInt16LE(1, 4)        // color planes
    entry.writeUInt16LE(32, 6)       // bits per pixel
    entry.writeUInt32LE(data.length, 8) // size of image data
    entry.writeUInt32LE(offset, 12)  // offset to image data
    entries.push(entry)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)])
}

async function main() {
  await app.whenReady()

  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    transparent: true,
    webPreferences: { offscreen: true, sandbox: true },
  })

  await win.loadFile(HTML)
  // Wait for layout & paint
  await new Promise(r => setTimeout(r, 800))

  const pngs = []
  for (const size of SIZES) {
    win.setSize(size, size)
    await new Promise(r => setTimeout(r, 300))
    const image = await win.webContents.capturePage()
    const png = image.toPNG()
    pngs.push({ size, data: png })
    console.log(`  Captured ${size}x${size} — ${png.length} bytes`)
  }

  const ico = createIco(pngs)
  fs.writeFileSync(OUTPUT, ico)
  console.log(`\nWritten ${OUTPUT} — ${ico.length} bytes`)

  win.close()
  app.quit()
}

main().catch(err => {
  console.error(err)
  app.quit()
  process.exit(1)
})
