#!/usr/bin/env node
/**
 * Downloads landmark GLB models from Sketchfab and saves them to public/models/.
 * Requires SKETCHFAB_TOKEN in .env (Settings → Password & API on sketchfab.com).
 *
 * Usage:
 *   node --env-file=.env scripts/download-landmarks.mjs
 */
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import JSZip from 'jszip'
import gltfPipeline from 'gltf-pipeline'
const { gltfToGlb } = gltfPipeline

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = resolve(__dir, '..')
const OUT   = join(ROOT, 'public', 'models')

const TOKEN = process.env.SKETCHFAB_TOKEN
if (!TOKEN) {
  console.error('Error: SKETCHFAB_TOKEN not set. Run with: node --env-file=.env scripts/download-landmarks.mjs')
  process.exit(1)
}

const MODELS = [
  { slug: 'kyiv',         uid: '77e7fb7e29b249e38d349555fd20f01b', name: 'Motherland Monument'    },
  { slug: 'kharkiv',      uid: '11af78557cb04330a7289d6a6d31dc46', name: 'Kharkiv Architecture'   },
  { slug: 'mariupol',     uid: 'ffaf6bfbd8b84eb985dee2a35ba79440', name: 'Industrial Smoke Stacks' },
  { slug: 'zaporizhzhia', uid: '7480a4f717854719b533b770efad7a23', name: 'Atomic Cooling Tower'   },
  { slug: 'donetsk',      uid: 'fd274d7f1a304eb2a18269f078afd18f', name: 'Donbas Arena'           },
]

mkdirSync(OUT, { recursive: true })

for (const { slug, uid, name } of MODELS) {
  const outPath = join(OUT, `${slug}.glb`)
  if (existsSync(outPath)) {
    console.log(`  skip ${slug} (already exists)`)
    continue
  }

  console.log(`↓  ${name} (${slug})…`)

  // 1. Get signed download URL from Sketchfab API
  const metaRes = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
    headers: { Authorization: `Token ${TOKEN}` },
  })
  if (!metaRes.ok) {
    const body = await metaRes.text()
    console.error(`   ✗ API ${metaRes.status}: ${body}`)
    continue
  }
  const dlMeta = await metaRes.json()
  const gltfUrl = dlMeta?.gltf?.url
  if (!gltfUrl) {
    console.error(`   ✗ No gltf URL in response:`, JSON.stringify(dlMeta))
    continue
  }

  // 2. Download ZIP archive
  const zipRes = await fetch(gltfUrl)
  if (!zipRes.ok) {
    console.error(`   ✗ ZIP download failed: ${zipRes.status}`)
    continue
  }
  const zipBuf = Buffer.from(await zipRes.arrayBuffer())

  // 3. Extract ZIP to temp dir
  const tmpDir = join(tmpdir(), `sfab-${slug}-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  try {
    const zip = await JSZip.loadAsync(zipBuf)

    // Check for a direct GLB inside the ZIP
    const glbEntry = Object.keys(zip.files).find(f => !zip.files[f].dir && f.endsWith('.glb'))
    if (glbEntry) {
      const glbBuf = await zip.files[glbEntry].async('nodebuffer')
      writeFileSync(outPath, glbBuf)
      console.log(`   ✓ ${slug}.glb  (direct GLB from ZIP)`)
      continue
    }

    // Otherwise extract all files, find .gltf, convert to GLB
    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue
      const dest = join(tmpDir, filename)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, await file.async('nodebuffer'))
    }

    const gltfEntry = Object.keys(zip.files).find(f => !zip.files[f].dir && f.endsWith('.gltf'))
    if (!gltfEntry) {
      console.error(`   ✗ No .gltf or .glb found in ZIP`)
      continue
    }

    const gltfJson    = JSON.parse(readFileSync(join(tmpDir, gltfEntry), 'utf8'))
    const resourceDir = join(tmpDir, dirname(gltfEntry))
    const { glb }     = await gltfToGlb(gltfJson, { resourceDirectory: resourceDir })
    writeFileSync(outPath, glb)
    console.log(`   ✓ ${slug}.glb`)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

console.log('\nDone. Models saved to public/models/')
