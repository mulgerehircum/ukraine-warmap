import { Map } from 'maplibre-gl'
import { MAP_CENTER_LON, MAP_CENTER_LAT, MAP_ZOOM, MAP_MIN_ZOOM, MAP_MAX_BOUNDS } from '../../constants/map'
import { addCityLayer } from './cities'
import { addDayNightLayer } from './daynight'
import { addEventsLayer } from './events'
import { addHonoraryEventsLayer } from './honoraryEvents'
import { addOblastLayer } from './oblasts'
import { addOccupationLayer } from './occupation'
import { addSatelliteLayer } from './satellite'
import { addTerrainLayer } from './terrain'
import { addTooltips } from './tooltips'
import { initThreeLayer } from './threeLayer'
import { addArrowsLayer } from './arrows'

export function initMap(container: HTMLElement): Map {
  const mobile = window.innerWidth <= 640
  const map = new Map({
    container,
    style: 'https://demotiles.maplibre.org/style.json',
    center: [MAP_CENTER_LON, MAP_CENTER_LAT],
    zoom: mobile ? 4 : MAP_ZOOM,
    minZoom: mobile ? 3.5 : MAP_MIN_ZOOM,
    maxBounds: MAP_MAX_BOUNDS,
    pitch: 45,
    bearing: 0,
    attributionControl: false, // custom © button in MapView handles attribution
  })

  map.on('load', () => {
    addSatelliteLayer(map)
    addTerrainLayer(map)
    addOblastLayer(map)
    addOccupationLayer(map)
    addDayNightLayer(map)
    addCityLayer(map)
    addEventsLayer(map)
    addHonoraryEventsLayer(map)
    addArrowsLayer(map)
    addTooltips(map)
    initThreeLayer(map)
  })

  return map
}
