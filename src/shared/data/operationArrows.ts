export type ArrowType = 'attack' | 'retreat' | 'counteroffensive'

export interface OperationArrow {
  id:        string
  label:     string
  type:      ArrowType
  dateStart: number             // YYYYMMDD
  dateEnd:   number             // YYYYMMDD (inclusive)
  coords:    [number, number][] // [lng, lat][]
  color:     string
}

const ATK = '#e05050'   // Russian attack
const RET = '#7890b0'   // Retreat/withdrawal
const CNT = '#4dd7fa'   // Ukrainian counteroffensive / incursion

export const OPERATION_ARROWS: OperationArrow[] = [
  {
    id: 'kyiv-nw', label: 'Advance on Kyiv (NW)', type: 'attack',
    dateStart: 20220224, dateEnd: 20220329,
    coords: [[30.10, 51.50], [30.15, 51.30], [30.20, 51.00], [30.30, 50.70], [30.45, 50.55]],
    color: ATK,
  },
  {
    id: 'kyiv-ne', label: 'Advance on Kyiv (NE)', type: 'attack',
    dateStart: 20220224, dateEnd: 20220329,
    coords: [[31.80, 51.80], [31.50, 51.40], [31.20, 51.00], [30.80, 50.70], [30.60, 50.50]],
    color: ATK,
  },
  {
    id: 'sumy-thrust', label: 'Sumy / northeast thrust', type: 'attack',
    dateStart: 20220224, dateEnd: 20220401,
    coords: [[35.20, 51.30], [34.90, 51.10], [34.80, 50.91]],
    color: ATK,
  },
  {
    id: 'kharkiv-pressure', label: 'Kharkiv pressure', type: 'attack',
    dateStart: 20220224, dateEnd: 20220601,
    coords: [[36.60, 50.60], [36.50, 50.30], [36.35, 50.10], [36.23, 49.99]],
    color: ATK,
  },
  {
    id: 'mariupol-east', label: 'Mariupol pincer (east)', type: 'attack',
    dateStart: 20220224, dateEnd: 20220520,
    coords: [[38.50, 47.40], [38.10, 47.20], [37.80, 47.10], [37.54, 47.10]],
    color: ATK,
  },
  {
    id: 'mariupol-west', label: 'Mariupol pincer (west)', type: 'attack',
    dateStart: 20220224, dateEnd: 20220520,
    coords: [[35.50, 46.80], [36.50, 46.90], [37.10, 47.00], [37.40, 47.10]],
    color: ATK,
  },
  {
    id: 'kherson-advance', label: 'Kherson advance', type: 'attack',
    dateStart: 20220224, dateEnd: 20220310,
    coords: [[33.60, 46.40], [33.20, 46.50], [32.62, 46.64]],
    color: ATK,
  },

  {
    id: 'kyiv-retreat', label: 'Withdrawal from Kyiv', type: 'retreat',
    dateStart: 20220330, dateEnd: 20220410,
    coords: [[30.45, 50.55], [30.25, 50.80], [30.10, 51.30], [29.80, 51.65]],
    color: RET,
  },

  {
    id: 'izium-donbas', label: 'Izium–Donbas axis', type: 'attack',
    dateStart: 20220401, dateEnd: 20220901,
    coords: [[37.27, 49.21], [37.15, 48.95], [37.05, 48.70], [37.00, 48.50]],
    color: ATK,
  },
  {
    id: 'severodonetsk', label: 'Severodonetsk advance', type: 'attack',
    dateStart: 20220401, dateEnd: 20220703,
    coords: [[39.00, 49.10], [38.70, 49.00], [38.49, 48.95]],
    color: ATK,
  },
  {
    id: 'bakhmut', label: 'Bakhmut axis', type: 'attack',
    dateStart: 20220501, dateEnd: 20230520,
    coords: [[38.60, 48.75], [38.35, 48.68], [38.10, 48.62], [37.99, 48.60]],
    color: ATK,
  },

  {
    id: 'kharkiv-counter', label: 'Kharkiv counteroffensive', type: 'counteroffensive',
    dateStart: 20220906, dateEnd: 20221001,
    coords: [[36.50, 49.80], [36.90, 49.50], [37.27, 49.21], [37.62, 49.71]],
    color: CNT,
  },

  {
    id: 'kherson-counter', label: 'Kherson counteroffensive', type: 'counteroffensive',
    dateStart: 20220829, dateEnd: 20221111,
    coords: [[33.40, 47.50], [33.00, 47.20], [32.80, 46.90], [32.62, 46.64]],
    color: CNT,
  },

  {
    id: 'zaporizhzhia-counter', label: 'Zaporizhzhia counteroffensive', type: 'counteroffensive',
    dateStart: 20230604, dateEnd: 20231101,
    coords: [[35.18, 47.84], [35.28, 47.55], [35.45, 47.25], [35.55, 47.00]],
    color: CNT,
  },

  {
    id: 'avdiivka-north', label: 'Avdiivka pincer (north)', type: 'attack',
    dateStart: 20231001, dateEnd: 20240217,
    coords: [[38.00, 48.35], [37.88, 48.25], [37.75, 48.14]],
    color: ATK,
  },
  {
    id: 'avdiivka-south', label: 'Avdiivka pincer (south)', type: 'attack',
    dateStart: 20231001, dateEnd: 20240217,
    coords: [[37.90, 47.95], [37.82, 48.05], [37.75, 48.14]],
    color: ATK,
  },

  {
    id: 'kursk', label: 'Kursk incursion', type: 'counteroffensive',
    dateStart: 20240806, dateEnd: 20241120,
    coords: [[34.20, 51.10], [34.80, 51.35], [35.30, 51.52], [35.70, 51.65]],
    color: CNT,
  },
]
