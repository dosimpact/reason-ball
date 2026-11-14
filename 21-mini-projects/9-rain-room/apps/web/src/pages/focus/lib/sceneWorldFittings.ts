import { getSceneWorldJunction, sideFloorAt } from '../model/sceneWorldJunctions.ts'
import { SCENE_SIDE_FITTINGS, type SideFitting } from '../model/sceneSideFittings.ts'
import type { SceneWorld } from '../model/sceneWorldCatalog.ts'

/** Native-parser-safe filled geometry. Each fixture stays in its own side bay;
 * the output is already translated into the 2600×2340 expanded SVG coordinates. */
export function sceneWorldFittings(world: SceneWorld): string {
  const plan = SCENE_SIDE_FITTINGS[world.id]
  if (!plan) throw new Error(`Missing side fittings: ${world.id}`)
  const parts: string[] = []
  const rawRect = (x: number, y: number, w: number, h: number, fill: string) =>
    parts.push(
      `<rect x="${x + 900}" y="${y + 760}" width="${w}" height="${h}" fill="${fill}" stroke="none"/>`,
    )
  const rawEllipse = (x: number, y: number, rx: number, ry: number, fill: string) =>
    parts.push(
      `<ellipse cx="${x + 900}" cy="${y + 760}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="none"/>`,
    )
  const rawPoly = (points: number[][], fill: string) =>
    parts.push(
      `<polygon points="${points.map(([x, y]) => `${x + 900},${y + 760}`).join(' ')}" fill="${fill}" stroke="none"/>`,
    )
  const ink = world.edge.lower
  const dark = world.wall
  const wood = world.trim
  const paper = '#aca58d'
  const leaf = '#6d8068'
  const mix = (a: string, b: string, weight: number) => {
    const channels = [1, 3, 5].map((i) =>
      Math.round(
        Number.parseInt(a.slice(i, i + 2), 16) * (1 - weight) +
          Number.parseInt(b.slice(i, i + 2), 16) * weight,
      ),
    )
    return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`
  }
  const door = mix(wood, dark, 0.48)
  const backing = mix(wood, dark, 0.7)
  function draw(kind: SideFitting, x: number) {
    const end = x + 196
    const wallMounted = ['vines', 'pipes', 'rigging', 'art-rack', 'controls'].includes(kind)
    const junction = getSceneWorldJunction(world.id)
    const base = Math.ceil(Math.max(sideFloorAt(junction, x), sideFloorAt(junction, end)) + 12)
    const originalBase =
      kind === 'planter'
        ? 670
        : kind === 'rail' || kind === 'luggage'
          ? 687
          : kind === 'cupboard' || kind === 'lockers'
            ? 680
            : 690
    const dy = wallMounted ? 0 : base - originalBase
    const rect = (xx: number, y: number, w: number, h: number, fill: string) =>
      rawRect(xx, y + dy, w, h, fill)
    const ellipse = (xx: number, y: number, rx: number, ry: number, fill: string) =>
      rawEllipse(xx, y + dy, rx, ry, fill)
    const poly = (points: number[][], fill: string) =>
      rawPoly(
        points.map(([xx, y]) => [xx, y + dy]),
        fill,
      )
    if (!wallMounted && !(kind === 'rail' && junction.rail))
      rawEllipse(x + 98, base + 4, 96, 9, mix(dark, '#101611', 0.45))
    // A visible wall bracket or grounded plinth carries every fitted object.
    const shelf = (y: number) => {
      rect(x, y, 196, 10, wood)
      poly(
        [
          [x + 10, y + 10],
          [x + 10, y + 40],
          [x + 42, y + 10],
        ],
        dark,
      )
      poly(
        [
          [end - 10, y + 10],
          [end - 10, y + 40],
          [end - 42, y + 10],
        ],
        dark,
      )
    }
    if (kind === 'rail' && junction.rail) {
      const railColor = mix(wood, '#07100e', junction.source === 'ordinary' ? 0.12 : 0)
      for (const y of junction.rail.courses)
        rawRect(x, y - junction.rail.width / 2, 196, junction.rail.width, railColor)
      // Structural posts are emitted once by the continuous architecture rail.
      return
    }
    if (kind === 'rail') {
      rect(x, 426, 196, 13, wood)
      rect(x, 508, 196, 7, wood)
      for (let i = 0; i < 4; i++) rect(x + 12 + i * 54, 435, 7, 240, wood)
      rect(x, 675, 196, 12, dark)
    } else if (kind === 'bench') {
      rect(x + 5, 475, 186, 84, wood)
      rect(x, 552, 196, 23, ink)
      rect(x + 10, 575, 16, 115, wood)
      rect(end - 26, 575, 16, 115, wood)
      rect(x + 20, 540, 150, 13, '#777862')
    } else if (kind === 'planter' || kind === 'vines' || kind === 'roots') {
      if (kind === 'vines') shelf(245)
      const baseY = kind === 'vines' ? 245 : 670
      poly(
        [
          [x + 55, baseY - 72],
          [x + 145, baseY - 72],
          [x + 132, baseY],
          [x + 68, baseY],
        ],
        wood,
      )
      for (let i = 0; i < 5; i++) {
        const cx = x + 60 + i * 20
        rect(cx, baseY - 175 - (i % 2) * 36, 4, 110 + (i % 2) * 36, leaf)
        ellipse(cx - 12, baseY - 148 - (i % 2) * 36, 21, 8, leaf)
        ellipse(cx + 13, baseY - 175 - (i % 2) * 36, 20, 9, '#879079')
      }
      if (kind === 'roots') {
        poly(
          [
            [x + 82, 620],
            [x + 62, 660],
            [x + 9, 687],
            [x + 66, 677],
            [x + 108, 641],
            [x + 152, 684],
            [end, 690],
            [x + 139, 660],
            [x + 115, 620],
          ],
          wood,
        )
      }
    } else if (kind === 'pipes' || kind === 'rigging') {
      // Wall clips visibly attach these vertical fittings to the side lining.
      for (const yy of [155, 375, 595]) {
        rect(x + 17, yy, 24, 9, backing)
        rect(end - 42, yy, 24, 9, backing)
      }
      rect(x + 24, 115, 9, 530, wood)
      rect(end - 34, 180, 9, 465, wood)
      for (let i = 0; i < 4; i++) rect(x + 24, 210 + i * 110, 138, kind === 'pipes' ? 12 : 5, wood)
      if (kind === 'pipes') {
        ellipse(x + 100, 352, 31, 31, wood)
        ellipse(x + 100, 352, 21, 21, dark)
        rect(x + 96, 330, 8, 45, paper)
        rect(x + 77, 348, 46, 8, paper)
      } else {
        for (let i = 0; i < 4; i++) ellipse(x + 98, 535 + i * 12, 45, 8, wood)
        shelf(600)
      }
    } else if (kind === 'art-rack') {
      rect(x + 10, 145, 176, 390, wood)
      rect(x + 20, 155, 156, 370, dark)
      for (let i = 0; i < 3; i++) {
        rect(x + 34 + i * 45, 215 + i * 22, 36, 280 - i * 22, '#8b8d7b')
        rect(x + 40 + i * 45, 224 + i * 22, 24, 258 - i * 22, '#565f57')
      }
      shelf(535)
    } else if (kind === 'controls') {
      rect(x + 15, 210, 166, 270, wood)
      rect(x + 24, 220, 148, 250, dark)
      rect(x + 38, 240, 120, 65, '#536b63')
      for (let i = 0; i < 4; i++) {
        ellipse(x + 49 + (i % 2) * 79, 345 + Math.floor(i / 2) * 67, 15, 15, wood)
        rect(x + 46 + (i % 2) * 79, 333 + Math.floor(i / 2) * 67, 5, 17, paper)
      }
      shelf(490)
    } else if (kind === 'luggage') {
      rect(x + 14, 550, 168, 125, wood)
      rect(x + 44, 466, 135, 81, '#716855')
      for (const yy of [485, 565]) {
        rect(x + 65, yy, 8, yy === 485 ? 62 : 110, dark)
        rect(x + 136, yy, 8, yy === 485 ? 62 : 110, dark)
      }
      rect(x + 92, 452, 45, 14, paper)
      rect(x + 6, 675, 184, 12, dark)
    } else if (kind === 'cupboard' || kind === 'lockers') {
      const top = kind === 'lockers' ? 180 : 405
      rect(x + 10, top, 176, 680 - top, wood)
      rect(x + 21, top + 13, 73, 650 - top, door)
      rect(x + 102, top + 13, 73, 650 - top, door)
      rect(x + 76, top + 92, 6, 23, paper)
      rect(x + 113, top + 92, 6, 23, paper)
      if (kind === 'lockers')
        for (let i = 0; i < 3; i++) rect(x + 37, top + 35 + i * 12, 43, 3, wood)
      rect(x, top - 11, 196, 13, wood)
      poly(
        [
          [x + 186, top],
          [end, top - 11],
          [end, 670],
          [x + 186, 680],
        ],
        backing,
      )
      rect(x + 15, 665, 166, 15, backing)
    } else {
      // Solid recessed backboard and side return distinguish timber cabinetry
      // from the wall; its grounded plinth follows the actual side-floor junction.
      rect(x + 5, 190, 186, 490, backing)
      poly(
        [
          [end - 15, 190],
          [end, 182],
          [end, 680],
          [end - 15, 680],
        ],
        door,
      )
      rect(x, 680, 196, 10, wood)
      rect(x + 5, 190, 10, 490, wood)
      rect(end - 15, 190, 10, 490, wood)
      for (const yy of [225, 370, 515, 670]) {
        rect(x, yy, 196, 11, wood)
        if (yy === 670) continue
        if (kind === 'books' || kind === 'letters') {
          for (let i = 0; i < 7; i++) {
            const h = kind === 'letters' ? 48 + (i % 2) * 18 : 75 + (i % 3) * 13
            rect(x + 17 + i * 24, yy - h, 17, h, [paper, '#7b806b', '#8d775b'][i % 3])
            if (kind === 'letters') rect(x + 20 + i * 24, yy - h + 14, 11, 2, dark)
          }
        } else if (kind === 'tea-shelf' || kind === 'bottles') {
          for (let i = 0; i < 4; i++) {
            const xx = x + 20 + i * 44
            if (kind === 'bottles') {
              rect(xx + 8, yy - 89, 17, 24, wood)
              rect(xx, yy - 66, 34, 64, '#73816b')
              rect(xx + 4, yy - 44, 26, 22, paper)
            } else {
              ellipse(xx + 17, yy - 6, 22, 5, wood)
              rect(xx + 2, yy - 38, 29, 30, paper)
              ellipse(xx + 31, yy - 25, 9, 9, paper)
              ellipse(xx + 31, yy - 25, 5, 5, dark)
            }
          }
        } else if (kind === 'instruments') {
          ellipse(x + 93, yy - 45, 31, 40, '#8b7755')
          rect(x + 87, yy - 120, 12, 85, wood)
          ellipse(x + 93, yy - 46, 10, 11, dark)
        } else {
          for (let i = 0; i < 4; i++) {
            rect(x + 29 + i * 43, yy - 75, 6, 70, wood)
            rect(x + 18 + i * 43, yy - 84, 28, 16, '#8d9381')
          }
        }
      }
    }
  }
  draw(plan.left, -236)
  draw(plan.right, 840)
  return parts.join('')
}
