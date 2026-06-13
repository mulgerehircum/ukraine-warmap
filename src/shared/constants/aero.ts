export const AERO_ACCENT   = '#4DD7FA'
export const AERO_ACCENT_R = 77
export const AERO_ACCENT_G = 215
export const AERO_ACCENT_B = 250

export const AERO_AMBER   = '#fcd34d'
export const AERO_AMBER_R = 252
export const AERO_AMBER_G = 211
export const AERO_AMBER_B = 77

export const AERO_RED   = '#d32f2f'
export const AERO_RED_R = 211
export const AERO_RED_G = 47
export const AERO_RED_B = 47

export const AERO_ORANGE   = '#f97316'
export const AERO_ORANGE_R = 249
export const AERO_ORANGE_G = 115
export const AERO_ORANGE_B = 22

/** Build an rgba() string using the accent colour — for use in canvas draw(). */
export function accentRgba(alpha: number): string {
  return `rgba(${AERO_ACCENT_R},${AERO_ACCENT_G},${AERO_ACCENT_B},${alpha})`
}

/** Build an rgba() string using the amber colour — for canvas milestone markers. */
export function amberRgba(alpha: number): string {
  return `rgba(${AERO_AMBER_R},${AERO_AMBER_G},${AERO_AMBER_B},${alpha})`
}

/** Build an rgba() string using the red colour. */
export function redRgba(alpha: number): string {
  return `rgba(${AERO_RED_R},${AERO_RED_G},${AERO_RED_B},${alpha})`
}
