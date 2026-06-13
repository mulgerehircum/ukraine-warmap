import type { Map, CustomRenderMethodInput } from 'maplibre-gl'
import { MercatorCoordinate } from 'maplibre-gl'
import { WebGLRenderer, Scene, Camera, AmbientLight, DirectionalLight } from 'three'
import { getSunVector } from './daynight'

export const scene = new Scene()
const camera = new Camera()
let renderer: WebGLRenderer | null = null
let _map: Map | null = null
let _animating = false

const ambient = new AmbientLight(0xffffff, 0.6)
const sun = new DirectionalLight(0xffffff, 0.8)
sun.position.set(0.5, -0.7, 1)

export function setAnimating(on: boolean): void {
  _animating = on
}

export function triggerRepaint(): void {
  _map?.triggerRepaint()
}

export function initThreeLayer(map: Map): void {
  _map = map
  map.addLayer({
    id: 'three-layer',
    type: 'custom',
    renderingMode: '3d',

    onAdd(_m, gl) {
      renderer = new WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl as WebGL2RenderingContext,
        antialias: true,
      })
      renderer.autoClear = false

      scene.add(ambient, sun)
    },

    render(_gl, args: CustomRenderMethodInput) {
      if (!renderer) return

      // modelViewProjectionMatrix coordinate convention (MapLibre v5):
      //   X, Y columns: expect world-pixel coords (Mercator × worldSize)
      //   Z column:     already pre-scaled by pixelsPerMeter — expects raw METERS
      //   W column:     clip-space translation, untouched
      // Scale only columns 0 and 1 (indices 0-7) by worldSize so objects
      // positioned in Mercator [0,1] space for X/Y project correctly,
      // while Z stays in meters as the matrix expects.
      const e = args.modelViewProjectionMatrix
      const worldSize: number = (_map as any).transform?.worldSize ?? 16384
      const scaled = new Float32Array(16)
      for (let i = 0; i < 8; i++) scaled[i] = (e[i] as number) * worldSize
      for (let i = 8; i < 16; i++) scaled[i] = e[i] as number

      camera.projectionMatrix.fromArray(scaled)
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
      renderer.resetState()
      // Clear depth buffer so the Three.js scene can self-occlude correctly
      // without MapLibre's terrain depth values interfering.
      renderer.getContext().clear(renderer.getContext().DEPTH_BUFFER_BIT)
      renderer.render(scene, camera)
      if (_animating) map.triggerRepaint()
    },

    onRemove() {
      renderer?.dispose()
      renderer = null
    },
  })
}

export function updateSunLight(date: Date): void {
  const { x, y, z } = getSunVector(date)
  const dayFactor = Math.max(0, z)  // z = sin(elevation); 0 at horizon, 1 at zenith
  sun.position.set(x, y, z)
  sun.intensity = dayFactor * 1.2
  ambient.intensity = 0.15 + dayFactor * 0.5
  _map?.triggerRepaint()
}

// Convert lng/lat + altitude in meters to Three.js position in Mercator world space.
export function lngLatToWorld(lng: number, lat: number, altitudeM = 0): [number, number, number] {
  const mc = MercatorCoordinate.fromLngLat({ lng, lat }, altitudeM)
  return [mc.x, mc.y, mc.z ?? 0]
}

// Scale factor: converts meters to Mercator units at a given location.
export function meterScale(lng: number, lat: number): number {
  return MercatorCoordinate.fromLngLat({ lng, lat }).meterInMercatorCoordinateUnits()
}
