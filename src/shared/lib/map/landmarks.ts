import type { Map as MlMap } from 'maplibre-gl'
import { MercatorCoordinate } from 'maplibre-gl'
import {
  Group, Mesh, Object3D,
  MeshBasicMaterial, Box3, Vector3, DoubleSide, BackSide,
  ShaderMaterial, Texture,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { scene, meterScale, triggerRepaint } from './threeLayer'

const SC     = meterScale(31, 49)
const GLTF_M = 60_000
const MAX_POP = 2_952_301

function popScale(pop: number): number {
  return 0.4 + 0.6 * Math.sqrt(pop / MAX_POP)
}

// ── Flag ShaderMaterial ───────────────────────────────────────────────────────
// Samples the original GLTF texture and blends in a world-space waving
// Ukrainian flag overlay.  Using a full ShaderMaterial avoids onBeforeCompile
// fragility while keeping the photogrammetry texture intact.

const FLAG_VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv        = uv;
  vWorldPos  = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FLAG_FRAG = /* glsl */`
uniform sampler2D uMap;
uniform float     uTime;
uniform float     uMZ0;   // monument base Z in metres
uniform float     uMH;    // monument height in metres
uniform float     uMCX;   // monument centre X in Mercator
uniform float     uMW;    // monument width in Mercator

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec4 base = texture2D(uMap, vUv);

  // World-space flag projection
  float nZ   = clamp((vWorldPos.z - uMZ0) / uMH, 0.0, 1.0);
  float nX   = clamp((vWorldPos.x - uMCX + uMW * 0.5) / uMW, 0.0, 1.0);

  // Wave grows from pole (left, nX=0) to free end (right, nX=1)
  float wave = 0.22 * nX * sin(nX * 12.566 - uTime * 2.5);

  // Blue on top (nZ > 0.5), yellow on bottom — smoothstep avoids aliasing
  float boundary = 0.35 + wave;
  float isBlue   = smoothstep(boundary - 0.02, boundary + 0.02, nZ);
  vec3 flagCol = mix(
    vec3(1.0, 0.843, 0.0),   // Ukrainian yellow
    vec3(0.0, 0.341, 0.718), // Ukrainian blue
    isBlue
  );

  gl_FragColor = vec4(mix(base.rgb, flagCol, 0.68), base.a);
}
`

// References to all flag ShaderMaterials so we can update uTime each frame
const flagMats: ShaderMaterial[] = []

function makeFlagMat(
  tex: Texture | null,
  monumentCX: number,
  monumentW:  number,
  monumentZ0: number,
  monumentH:  number,
): ShaderMaterial {
  const mat = new ShaderMaterial({
    uniforms: {
      uMap:  { value: tex },
      uTime: { value: 0 },
      uMZ0:  { value: monumentZ0 },
      uMH:   { value: monumentH },
      uMCX:  { value: monumentCX },
      uMW:   { value: monumentW },
    },
    vertexShader:   FLAG_VERT,
    fragmentShader: FLAG_FRAG,
    side:           DoubleSide,
  })
  flagMats.push(mat)
  return mat
}

// ── Cell-shading outline ──────────────────────────────────────────────────────
// Back-face expansion in clip space: push each vertex outward along its
// screen-space normal, render only back faces in a solid dark colour.
// normalMatrix (mat3) is provided automatically by Three.js ShaderMaterial.

const OUTLINE_VERT = /* glsl */`
void main() {
  vec3 n    = normalize(normalMatrix * normal);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Expand in NDC along screen-space normal; multiply by w for perspective
  clip.xy  += normalize(n.xy + vec2(0.0001)) * 0.0012 * clip.w;
  gl_Position = clip;
}
`

const OUTLINE_FRAG = /* glsl */`
void main() {
  gl_FragColor = vec4(0.03, 0.03, 0.07, 1.0);
}
`

function makeOutlineMesh(src: Mesh): Mesh {
  const m = new Mesh(
    src.geometry,
    new ShaderMaterial({
      vertexShader:   OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      side:           BackSide,
    }),
  )
  m.frustumCulled = false
  return m
}

// ── GLTF loader ──────────────────────────────────────────────────────────────

const loader = new GLTFLoader()

interface MeshEntry { mesh: Mesh; tex: Texture | null }
interface Loaded { group: Group; meshEntries: MeshEntry[] }

function loadGLTF(slug: string, targetHeight: number): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    loader.load(`/models/${slug}.glb`, gltf => {
      const root = gltf.scene

      root.rotation.x = Math.PI / 2
      root.rotation.y = Math.PI  // face south

      root.updateWorldMatrix(true, true)
      const box = new Box3().setFromObject(root)
      const size = new Vector3()
      box.getSize(size)
      const h = size.z > 0 ? size.z : Math.max(size.x, size.y)
      if (h > 0) {
        const xy = targetHeight / h
        root.scale.set(xy, xy / SC, xy)
      }

      root.updateWorldMatrix(true, true)
      const box2 = new Box3().setFromObject(root)
      const center = new Vector3()
      box2.getCenter(center)
      root.position.x -= center.x
      root.position.y -= center.y
      root.position.z -= box2.min.z

      const meshEntries: MeshEntry[] = []
      root.traverse((obj: Object3D) => {
        obj.frustumCulled = false
        if (obj instanceof Mesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tex = (mats[0] as any)?.map as Texture | null ?? null
          meshEntries.push({ mesh: obj, tex })
        }
      })

      const g = new Group()
      g.add(root)
      resolve({ group: g, meshEntries })
    }, undefined, reject)
  })
}

// ── city registry ────────────────────────────────────────────────────────────

const CITY_DEFS = [
  { name: 'Kyiv', lng: 30.5238, lat: 50.4546, pop: 2_952_301, oblastIdx: 12, model: 'kyiv' },
] as const

// ── runtime state ────────────────────────────────────────────────────────────

const landmarksGroup = new Group()
scene.add(landmarksGroup)
landmarksGroup.visible = false

let flagRaf = 0

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(flagRaf)
    flagMats.forEach(m => m.dispose())
    flagMats.length = 0
    scene.remove(landmarksGroup)
    landmarksGroup.traverse(obj => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m: MeshBasicMaterial) => m.dispose())
      }
    })
  })
}

// ── public API ───────────────────────────────────────────────────────────────

export async function initLandmarks(map: MlMap): Promise<void> {
  for (const city of CITY_DEFS) {
    const mc = MercatorCoordinate.fromLngLat({ lng: city.lng, lat: city.lat })
    let elev = 0
    try { elev = map.queryTerrainElevation({ lng: city.lng, lat: city.lat }) ?? 0 } catch { /* terrain not ready */ }

    const targetH = popScale(city.pop) * GLTF_M * SC
    const { group, meshEntries } = await loadGLTF(city.model, targetH)
    group.position.set(mc.x, mc.y, elev)
    landmarksGroup.add(group)

    if (city.model === 'kyiv') {
      for (const { mesh, tex } of meshEntries) {
        mesh.material = makeFlagMat(tex, mc.x, GLTF_M * SC, elev, GLTF_M)
        mesh.parent?.add(makeOutlineMesh(mesh))
      }
    }
  }

  // Drive the uTime uniform and keep the map repainting
  ;(function loop() {
    const t = performance.now() / 1000
    for (const m of flagMats) m.uniforms.uTime.value = t
    triggerRepaint()
    flagRaf = requestAnimationFrame(loop)
  })()
}

export function updateLandmarks(_counts: Map<number, number>): void {}

export function setLandmarksVisible(v: boolean): void {
  landmarksGroup.visible = v
}
