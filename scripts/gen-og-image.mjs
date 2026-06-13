#!/usr/bin/env node
// Generates public/og-image.png — 1200x630 Ukrainian flag
import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'

const W = 1200, H = 630

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length)
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

const stride = W * 3 + 1  // filter byte + RGB
const raw = Buffer.allocUnsafe(H * stride)

for (let y = 0; y < H; y++) {
  const base = y * stride
  raw[base] = 0  // filter = None
  const [r, g, b] = y < H / 2 ? [0x00, 0x5B, 0xBB] : [0xFF, 0xD5, 0x00]
  for (let x = 0; x < W; x++) {
    raw[base + 1 + x * 3] = r
    raw[base + 2 + x * 3] = g
    raw[base + 3 + x * 3] = b
  }
}

const ihdr = Buffer.allocUnsafe(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

writeFileSync('public/og-image.png', png)
console.log(`public/og-image.png — ${(png.length / 1024).toFixed(1)} KB`)
