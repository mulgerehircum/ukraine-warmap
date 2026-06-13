/**
 * NATO APP-6 adapted SVG icons, 20×20 viewBox.
 * Frame shape encodes domain: pentagon = air, rectangle = ground, diamond = unknown.
 * Inner symbols derived from APP-6 unit/activity indicators.
 * All strokes use currentColor. Some fills use currentColor for solid silhouettes.
 */
export const EVENT_SVGS: Record<string, string> = {

  // S — Airstrike: air pentagon + swept-wing aircraft (fixed-wing strike)
  S: `<path d="M10 2L18 8L18 17L2 17L2 8Z"/>
      <line x1="10" y1="9" x2="5"  y2="14"/>
      <line x1="10" y1="9" x2="15" y2="14"/>
      <line x1="10" y1="9" x2="10" y2="15"/>`,

  // D — UAV/Drone: air pentagon + filled delta-wing silhouette (fixed-wing UAS)
  D: `<path d="M10 2L18 8L18 17L2 17L2 8Z"/>
      <path d="M10 8L16 15L10 13L4 15Z" fill="currentColor" stroke="none"/>`,

  // A — Artillery: ground rectangle + upward arc (NATO indirect fire symbol)
  A: `<rect x="2" y="6" width="16" height="8"/>
      <path d="M6 13A4 4.5 0 0 1 14 13"/>`,

  // F — Firefight: ground rectangle + diagonal cross (NATO infantry symbol)
  F: `<rect x="2" y="6" width="16" height="8"/>
      <line x1="6" y1="8"  x2="14" y2="13"/>
      <line x1="14" y1="8" x2="6"  y2="13"/>`,

  // C — Civilian casualties: ground rectangle + abstracted person (head + body + shoulders)
  C: `<rect x="2" y="6" width="16" height="8"/>
      <circle cx="10" cy="8.5" r="1.8"/>
      <line x1="10"  y1="10.3" x2="10"  y2="13"/>
      <line x1="7.5" y1="11.2" x2="12.5" y2="11.2"/>`,

  // V — Armor: ground rectangle + oval (NATO armor/tank inner symbol)
  V: `<rect x="2" y="6" width="16" height="8"/>
      <ellipse cx="10" cy="10" rx="5" ry="2.5"/>`,

  // M — Military casualties: ground rectangle + cross (NATO medical/casualty)
  M: `<rect x="2" y="6" width="16" height="8"/>
      <line x1="10" y1="7.5" x2="10" y2="12.5"/>
      <line x1="7"  y1="10"  x2="13" y2="10"/>`,

  // L — Air alert: air pentagon + upward arrow (incoming air threat)
  L: `<path d="M10 2L18 8L18 17L2 17L2 8Z"/>
      <line x1="10" y1="16" x2="10" y2="9"/>
      <line x1="7"  y1="12" x2="10" y2="9"/>
      <line x1="13" y1="12" x2="10" y2="9"/>`,

  // O — Other: diamond frame + circle (NATO unknown track)
  O: `<path d="M10 2L18 10L10 18L2 10Z"/>
      <circle cx="10" cy="10" r="2.5"/>`,
}
