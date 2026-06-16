const ALERTS_URL = 'https://api.alerts.in.ua/v1/iot/active_air_raid_alerts_by_oblast.json'

// Fallback used when ALERTS_TOKEN is not configured (preview / local dev).
// Eastern/southern oblasts: positions 2,3,6,10,12,13,16,18,19 = A.
const DEBUG_STATES = 'NNAANNANNN' + 'ANAANNANAA' + 'NNNNNNN'

export default async function handler(req, res) {
  const token = process.env.ALERTS_TOKEN
  if (!token) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10')
    res.status(200).json({ states: DEBUG_STATES, debug: true })
    return
  }

  try {
    const r = await fetch(ALERTS_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })

    if (r.status === 429) {
      res.status(429).json({ error: 'rate limited' })
      return
    }

    if (!r.ok) {
      res.status(r.status).json({ error: `upstream ${r.status}` })
      return
    }

    // Upstream returns a raw JSON string (e.g. "NNAANNANNN...") — wrap it.
    const states = await r.json()
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10')
    res.status(200).json({ states })
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
}
