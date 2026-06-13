import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import { Map, Popup, GeoJSONSource } from 'maplibre-gl'
import { EVENT_TYPE_LABELS, EVENT_DETAIL_MIN_ZOOM, CLUSTER_MAX_ZOOM } from './events'
import { TYPE_DEFS } from './eventIcons'
import { EVENT_SVGS } from './eventSvgs'
import { fetchOg } from './ogFetch'
import { getOblastBreakdown } from './oblasts'
import { getLiberationDate } from './timeline'

function eventIcon(type: string): string {
  const color = TYPE_DEFS[type]?.color ?? '#757575'
  const inner = EVENT_SVGS[type] ?? EVENT_SVGS['O']
  return (
    `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"` +
    ` stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"` +
    ` color="${color}" style="display:block;flex-shrink:0">` +
    inner +
    `</svg>`
  )
}

interface OgMap { title: string | null; description: string | null }

function parseUrls(raw: unknown): string[] {
  try { return JSON.parse(raw as string) } catch { return [] }
}

function renderEventFeatures(
  features: Feature<Geometry, GeoJsonProperties>[],
  og: Record<string, OgMap> = {},
): string {
  const groups: Record<string, typeof features> = {}
  for (const f of features) {
    const name = (f.properties?.name as string) ?? ''
    if (!groups[name]) groups[name] = []
    groups[name].push(f)
  }

  const sections = Object.entries(groups).map(([locationName, feats]) => {
    const rows = feats.map((f) => {
      const type  = f.properties?.type as string
      const n     = f.properties?.n as number
      const label = EVENT_TYPE_LABELS[type] ?? type
      const urls  = parseUrls(f.properties?.urls)

      const firstOg = urls[0] ? og[urls[0]] : null
      const excerpt = firstOg?.description
        ? `<div style="font-size:11px;color:#c4cad4;margin-top:3px;line-height:1.4;max-width:220px;white-space:normal">${firstOg.description.slice(0, 140)}…</div>`
        : ''

      return (
        `<div style="display:flex;align-items:center;gap:5px;padding:2px 0">` +
        eventIcon(type) +
        `<span class="tt-status">${label}</span>` +
        `<span class="tt-status" style="color:#8b95a8;margin-left:auto;padding-left:8px">×${n}</span>` +
        `</div>` +
        excerpt
      )
    })
    return `<span class="tt-name">${locationName}</span>` + rows.join('')
  })

  return sections.join('<hr style="margin:5px 0;border:none;border-top:1px solid rgba(77,215,250,0.15)">')
}

const STATUS_LABELS: Record<string, string> = {
  UA: 'Ukrainian-controlled',
  LIBERATED: 'Liberated',
  CONTESTED: 'Contested',
  RU: 'Russian-occupied',
}

const STATUS_COLORS: Record<string, string> = {
  LIBERATED: '#60a5fa',
  CONTESTED: '#fb923c',
  RU:        '#f87171',
}

export function addTooltips(map: Map): void {
  const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 })
  let overCity = false
  let overEvent = false
  let overCluster = false
  let overHonorary = false
  let overOblastChoropleth = false
  let overPopup = false

  // Keep popup alive when the cursor moves from a map feature into the popup
  // itself, so links inside it are reachable and clickable.
  // getElement() returns undefined until the popup is first added to the map,
  // so attach DOM listeners on the first open event.
  popup.once('open', () => {
    const el = popup.getElement()
    if (!el) return
    el.addEventListener('mouseenter', () => { overPopup = true })
    el.addEventListener('mouseleave', () => {
      overPopup = false
      if (!overCity && !overEvent && !overCluster && !overOblastChoropleth) popup.remove()
    })
  })

  function maybeRemove() {
    setTimeout(() => {
      if (!overCity && !overEvent && !overCluster && !overOblastChoropleth && !overPopup) popup.remove()
    }, 80)
  }

  map.on('mouseenter', 'events-cluster', async (e) => {
    overCluster = true
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    if (!f) return
    const clusterId = f.properties?.cluster_id as number
    const pointCount = f.properties?.point_count as number ?? 0
    const src = map.getSource('events') as GeoJSONSource

    const leaves = await src.getClusterLeaves(clusterId, pointCount, 0)
    if (!overCluster) return  // user already left while we were awaiting

    popup.setLngLat(e.lngLat).setHTML(renderEventFeatures(leaves, ogCache)).addTo(map)

    // Prefetch OG for all leaf URLs in background
    const urls = leaves.flatMap(l => parseUrls(l.properties?.urls))
    for (const url of urls) {
      if (url in ogCache) continue
      ogCache[url] = { title: null, description: null }
      fetchOg(url).then(data => {
        if (!data || !overCluster) return
        ogCache[url] = data
        popup.setHTML(renderEventFeatures(leaves, ogCache))
      })
    }
  })

  map.on('mousemove', 'events-cluster', (e) => {
    popup.setLngLat(e.lngLat)
  })

  map.on('mouseleave', 'events-cluster', () => {
    overCluster = false
    map.getCanvas().style.cursor = ''
    maybeRemove()
  })

  map.on('click', 'events-cluster', async (e) => {
    const f = e.features?.[0]
    if (!f || f.geometry.type !== 'Point') return
    const clusterId = f.properties?.cluster_id as number
    const pointCount = f.properties?.point_count as number | undefined
    const [lng, lat] = f.geometry.coordinates as [number, number]
    const src = map.getSource('events') as GeoJSONSource

    const leaves = await src.getClusterLeaves(clusterId, pointCount ?? 10, 0)
    const firstLeafCoords = leaves[0]?.geometry.type === 'Point'
      ? leaves[0].geometry.coordinates as [number, number]
      : null

    const allAtSameCoordinate = Boolean(firstLeafCoords) && leaves.every((leaf) => {
      if (leaf.geometry.type !== 'Point') return false
      const [leafLng, leafLat] = leaf.geometry.coordinates as [number, number]
      return leafLng === firstLeafCoords![0] && leafLat === firstLeafCoords![1]
    })

    if (allAtSameCoordinate && pointCount && pointCount > 1) {
      map.easeTo({ center: [lng, lat], zoom: CLUSTER_MAX_ZOOM + 1, duration: 350 })
      return
    }

    const expansionZoom = await src.getClusterExpansionZoom(clusterId)
    const zoom = Math.max(expansionZoom, CLUSTER_MAX_ZOOM + 1)
    map.easeTo({ center: [lng, lat], zoom, duration: 350 })
  })

  map.on('mouseenter', 'events-circles', () => {
    overEvent = true
    map.getCanvas().style.cursor = 'pointer'
  })

  const ogCache: Record<string, OgMap> = {}

  map.on('mousemove', 'events-circles', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['events-circles'] })
    if (!features.length) return

    // Render immediately with whatever OG data is already cached
    popup.setLngLat(e.lngLat).setHTML(renderEventFeatures(features, ogCache)).addTo(map)

    // Kick off OG fetches for any URLs not yet in cache; refresh popup on arrival
    const urls = features.flatMap(f => parseUrls(f.properties?.urls))
    for (const url of urls) {
      if (url in ogCache) continue
      ogCache[url] = { title: null, description: null } // mark pending
      fetchOg(url).then(data => {
        if (!data) return
        ogCache[url] = data
        // Only refresh if popup is still showing these features
        const cur = map.queryRenderedFeatures(e.point, { layers: ['events-circles'] })
        if (cur.length) popup.setHTML(renderEventFeatures(cur, ogCache))
      })
    }
  })

  map.on('mouseleave', 'events-circles', () => {
    overEvent = false
    map.getCanvas().style.cursor = ''
    maybeRemove()
  })

  map.on('click', 'events-circles', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['events-circles'] })
    if (!features.length) return
    const urls: string[] = []
    for (const f of features) {
      try {
        (JSON.parse(f.properties?.urls ?? '[]') as string[])
          .forEach(u => { if (!urls.includes(u)) urls.push(u) })
      } catch { /* skip */ }
    }
    if (urls.length) window.open(urls[0], '_blank', 'noopener')
  })

  map.on('mouseenter', 'events-oblast-counts', (e) => {
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    if (!f) return
    const name = f.properties?.name as string
    const count = f.properties?.count as number
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<span class="tt-name">${name}</span>` +
        `<span class="tt-status">${count} event${count !== 1 ? 's' : ''} — click to zoom</span>`,
      )
      .addTo(map)
  })

  map.on('mousemove', 'events-oblast-counts', (e) => {
    popup.setLngLat(e.lngLat)
  })

  map.on('mouseleave', 'events-oblast-counts', () => {
    map.getCanvas().style.cursor = ''
    maybeRemove()
  })

  map.on('click', 'events-oblast-counts', (e) => {
    const f = e.features?.[0]
    if (!f || f.geometry.type !== 'Point') return
    const [lng, lat] = f.geometry.coordinates as [number, number]
    map.easeTo({ center: [lng, lat], zoom: EVENT_DETAIL_MIN_ZOOM + 1, duration: 400 })
  })

  map.on('mouseenter', 'honorary-events', (e) => {
    overHonorary = true
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    if (!f) return
    const { title, date, description } = f.properties as Record<string, string>
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<span class="tt-name">${title}</span>` +
        `<span class="tt-status" style="color:#888">${date}</span>` +
        `<span class="tt-status" style="white-space:normal;max-width:200px">${description}</span>`,
      )
      .addTo(map)
  })

  map.on('mousemove', 'honorary-events', (e) => { popup.setLngLat(e.lngLat) })

  map.on('mouseleave', 'honorary-events', () => {
    overHonorary = false
    map.getCanvas().style.cursor = ''
    maybeRemove()
  })

  map.on('click', 'honorary-events', (e) => {
    const url = e.features?.[0]?.properties?.url as string | undefined
    if (url) window.open(url, '_blank', 'noopener')
  })

  map.on('mouseenter', 'city-dots', (e) => {
    overCity = true
    if (overCluster || overEvent) return
    map.getCanvas().style.cursor = 'pointer'
    const f = e.features?.[0]
    if (!f) return
    popup
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${f.properties?.name}</strong>`)
      .addTo(map)
  })

  map.on('mousemove', 'city-dots', (e) => {
    popup.setLngLat(e.lngLat)
  })

  map.on('mouseleave', 'city-dots', () => {
    overCity = false
    map.getCanvas().style.cursor = ''
    maybeRemove()
  })

  map.on('mouseenter', 'oblast-choropleth', () => {
    overOblastChoropleth = true
    map.getCanvas().style.cursor = 'crosshair'
  })

  map.on('mousemove', 'oblast-choropleth', (e) => {
    const f = e.features?.[0]
    if (!f) return
    const id = f.id as number
    const name = (f.properties?.NAME_1 as string | undefined) ?? 'Oblast'
    const breakdown = getOblastBreakdown(id)
    if (!breakdown) return

    const { total, ...types } = breakdown
    const top5 = (Object.entries(types) as [string, number][])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .filter(([, count]) => count > 0)

    const rows = top5.map(([type, count]) =>
      `<div style="display:flex;align-items:center;gap:5px;padding:1px 0">` +
      eventIcon(type) +
      `<span class="tt-status">${EVENT_TYPE_LABELS[type] ?? type}</span>` +
      `<span class="tt-status" style="color:#888;margin-left:auto;padding-left:8px">${count.toLocaleString()}</span>` +
      `</div>`,
    )

    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<span class="tt-name">${name}</span>` +
        `<span class="tt-status" style="color:#8b95a8">${total.toLocaleString()} total events</span>` +
        rows.join(''),
      )
      .addTo(map)
  })

  map.on('mouseleave', 'oblast-choropleth', () => {
    overOblastChoropleth = false
    map.getCanvas().style.cursor = ''
    maybeRemove()
  })

  map.on('mousemove', 'occupation-fill', (e) => {
    if (overCity || overEvent || overCluster || overHonorary || overOblastChoropleth) return
    const f = e.features?.[0]
    if (!f) return
    const status = ((f as any).state?.status as string | undefined) ?? (f.properties?.status as string)
    if (status === 'UA') { popup.remove(); return }

    const label = STATUS_LABELS[status] ?? status
    const color = STATUS_COLORS[status] ?? '#8b95a8'
    const name = f.properties?.name as string
    const cellId = f.id as number | undefined

    let dateLine = ''
    if (status === 'LIBERATED' && cellId != null) {
      const di = getLiberationDate(cellId)
      if (di) {
        const y = Math.floor(di / 10000)
        const m = Math.floor((di % 10000) / 100) - 1
        const d = di % 100
        const dateStr = new Date(Date.UTC(y, m, d))
          .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
        dateLine = `<span class="tt-status" style="color:#8b95a8">Liberated ${dateStr}</span>`
      }
    }

    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<span class="tt-name">${name}</span>` +
        `<span class="tt-status" style="color:${color}">${label}</span>` +
        dateLine,
      )
      .addTo(map)
  })

  map.on('mouseleave', 'occupation-fill', () => {
    maybeRemove()
  })
}
