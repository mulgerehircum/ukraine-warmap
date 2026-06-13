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

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; project-map-bot/1.0)' },
      signal: AbortSignal.timeout(6000),
    })
    const buf = await r.arrayBuffer()

    // Detect charset: Content-Type header wins, then sniff <meta charset>
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

    const image =
      extractMeta(html, 'og:image') ??
      extractMeta(html, 'twitter:image') ??
      null

    res.status(200).json({ title, description, image })
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
}
