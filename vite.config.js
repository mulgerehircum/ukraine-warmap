import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function decodeEntities(str) {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeEntities(m[1].trim())
  }
  return null
}

// Debug mock: eastern/southern oblasts under alert so the UI is testable
// without a real token.  Positions map to REGION_TO_FEATURE in alerts.ts:
//  2=Dnipro  3=Donetsk  6=Zaporizhzhia  10=Luhansk  12=Mykolaiv  13=Odesa
//  16=Sumy  18=Kharkiv  19=Kherson
const DEBUG_STATES = 'NNAANNANNN' + 'ANAANNANAA' + 'NNNNNNN'

const alertsPlugin = {
  name: 'alerts-mock',
  configureServer(server) {
    server.middlewares.use('/api/alerts', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Alerts-Debug': '1' })
      res.end(JSON.stringify({ states: DEBUG_STATES, debug: true }))
    })
  },
}

const ogPlugin = {
  name: 'og-proxy',
  configureServer(server) {
    server.middlewares.use('/api/og', async (req, res) => {
      const raw = req.url ?? ''
      const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
      const url = new URLSearchParams(qs).get('url')

      if (!url) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'missing url' }))
        return
      }

      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; project-map-bot/1.0)' },
          signal: AbortSignal.timeout(6000),
        })
        const buf = await r.arrayBuffer()

        let charset = 'utf-8'
        const ctCharset = (r.headers.get('content-type') ?? '').match(/charset=([^\s;]+)/i)?.[1]
        if (ctCharset) {
          charset = ctCharset
        } else {
          const sniff = new TextDecoder('latin-1').decode(new Uint8Array(buf, 0, 2048))
          const metaCharset = sniff.match(/<meta[^>]+charset=["']?\s*([^"'\s;>]+)/i)?.[1]
          if (metaCharset) charset = metaCharset
        }

        let html
        try { html = new TextDecoder(charset).decode(buf) }
        catch { html = new TextDecoder('utf-8').decode(buf) }

        const title =
          extractMeta(html, 'og:title') ??
          extractMeta(html, 'twitter:title') ??
          (m => m ? decodeEntities(m[1].trim()) : null)(html.match(/<title[^>]*>([^<]+)<\/title>/i)) ??
          null

        const description =
          extractMeta(html, 'og:description') ??
          extractMeta(html, 'twitter:description') ??
          null

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ title, description }))
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: String(err) }))
      }
    })
  },
}

export default defineConfig({
  plugins: [vue(), alertsPlugin, ogPlugin],
})
