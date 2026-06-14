import { lookup } from 'dns/promises'

function isPrivateIP(ip) {
  const v4 = ip.replace(/^::ffff:/i, '')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    const [a, b] = v4.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  const lo = ip.toLowerCase()
  return lo === '::1' || lo.startsWith('fc') || lo.startsWith('fd') || lo.startsWith('fe80')
}

async function validateUrl(raw) {
  let parsed
  try { parsed = new URL(raw) } catch { throw new Error('invalid URL') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol not allowed')
  const { address } = await lookup(parsed.hostname)
  if (isPrivateIP(address)) throw new Error('private address blocked')
}

function isTelegramUrl(url) {
  try {
    const h = new URL(url).hostname
    return h === 't.me' || h === 'telegram.me'
  } catch { return false }
}

// t.me/channel/postId → t.me/s/channel?before=postId+1
function telegramStaticUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2) return null
    const [channel, postId] = parts
    const n = parseInt(postId, 10)
    if (!n) return null
    return { fetchUrl: `https://t.me/s/${channel}?before=${n + 1}`, postKey: `${channel}/${n}` }
  } catch { return null }
}

function extractTelegramText(html, postKey) {
  const anchor = `data-post="${postKey}"`
  const idx = html.indexOf(anchor)
  if (idx < 0) return null
  const chunk = html.slice(idx, idx + 6000)
  const m = chunk.match(/class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
  if (!m) return null
  const text = m[1]
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  return decodeEntities(text).trim().slice(0, 400) || null
}

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

export default async function handler(req, res) {
  const url = req.query.url
  if (!url) {
    res.status(400).json({ error: 'missing url' })
    return
  }

  try { await validateUrl(url) } catch (err) {
    res.status(400).json({ error: String(err) })
    return
  }

  const tg = isTelegramUrl(url) ? telegramStaticUrl(url) : null
  const fetchUrl = tg ? tg.fetchUrl : url

  try {
    const r = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
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
      (tg ? extractTelegramText(html, tg.postKey) : null) ??
      extractMeta(html, 'og:description') ??
      extractMeta(html, 'twitter:description') ??
      null

    const image =
      extractMeta(html, 'og:image') ??
      extractMeta(html, 'twitter:image') ??
      null

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.status(200).json({ title, description, image })
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
}
