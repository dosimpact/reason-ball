export type NeonBuilding = { id: string; plane: string; color: string; edge: string }
export const NEON_BUILDINGS: NeonBuilding[] = [
  { id: 'far-tower', plane: 'M334 163H459V431H334Z', color: '#16303b', edge: '#34515b' },
  { id: 'left-house', plane: 'M84 185 252 203V453L84 482Z', color: '#223845', edge: '#485464' },
  { id: 'right-house', plane: 'M560 219 733 173V506L560 449Z', color: '#203d47', edge: '#3b6267' },
]
export type NeonSign = {
  id: string
  buildingId: string
  transform: string
  width: number
  height: number
  color: string
  core: string
  label: string
  vertical: boolean
  mount: 'flush' | 'left'
  duration: number
  delay: number
  reflection: { x: number; start: number; spread: number }
}
/** Local sign coordinates are transformed onto opposite building facades, never window glass. */
export const NEON_SIGNS: NeonSign[] = [
  {
    id: 'rain-bar',
    buildingId: 'left-house',
    transform: 'matrix(.82 .088 0 .82 116 274)',
    width: 100,
    height: 36,
    color: '#ff74b8',
    core: '#ffe2f1',
    label: 'RAIN',
    vertical: false,
    mount: 'flush',
    duration: 17,
    delay: -3,
    reflection: { x: 171, start: 475, spread: 44 },
  },
  {
    id: 'open-shop',
    buildingId: 'far-tower',
    transform: 'matrix(.56 0 0 .56 368 306)',
    width: 90,
    height: 29,
    color: '#c1a0ff',
    core: '#eee4ff',
    label: 'OPEN',
    vertical: false,
    mount: 'flush',
    duration: 23,
    delay: -15,
    reflection: { x: 400, start: 438, spread: 18 },
  },
  {
    id: 'cafe-blade',
    buildingId: 'right-house',
    transform: 'matrix(.78 -.13 0 .78 602 278)',
    width: 35,
    height: 110,
    color: '#55e8df',
    core: '#d8fffa',
    label: 'CAFE',
    vertical: true,
    mount: 'left',
    duration: 19,
    delay: -9,
    reflection: { x: 612, start: 478, spread: 36 },
  },
]
