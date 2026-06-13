interface OgData { title: string | null; description: string | null; image: string | null }

const cache = new globalThis.Map<string, OgData | 'pending'>()

export async function fetchOg(url: string): Promise<OgData | null> {
  const hit = cache.get(url)
  if (hit && hit !== 'pending') return hit
  if (hit === 'pending') return null

  cache.set(url, 'pending')
  try {
    const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`)
    const data = await res.json() as OgData
    cache.set(url, data)
    return data
  } catch {
    cache.delete(url)
    return null
  }
}
