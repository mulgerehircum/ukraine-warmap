export const GROUP_TYPE_CODES: Record<GroupKey, string[]> = {
  Airstrike: ['S'],
  Drone:     ['D'],
  Artillery: ['A'],
  Ground:    ['F', 'V'],
  Other:     ['C', 'M', 'L', 'O'],
}

export const GROUP_COLORS = {
  Airstrike: '#f0522a',
  Drone:     '#4dd7fa',
  Artillery: '#f0b428',
  Ground:    '#3ecf7a',
  Other:     '#7890b0',
} as const

export type GroupKey = keyof typeof GROUP_COLORS

// Bottom → top stacking order (Other excluded — it's noise that buries the combat breakdown)
export const GROUP_ORDER: GroupKey[] = ['Airstrike', 'Drone', 'Artillery', 'Ground']

export interface TypeTimelineData {
  start:     number
  Airstrike: number[]
  Drone:     number[]
  Artillery: number[]
  Ground:    number[]
  Other:     number[]
}

let cached: TypeTimelineData | null = null

export async function loadTypeTimeline(): Promise<TypeTimelineData> {
  if (cached) return cached
  const res = await fetch('/data/type-timeline.json')
  cached = await res.json()
  return cached!
}
