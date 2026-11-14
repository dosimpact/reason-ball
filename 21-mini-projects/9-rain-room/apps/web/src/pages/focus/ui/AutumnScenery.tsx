import { useId, type ReactNode } from 'react'
import { getAutumnSpace, type AutumnSpaceConfig } from '../model/sceneAutumn'
import { getSceneArchitecture } from '../model/sceneArchitecture'
import './backgrounds.css'

type LeafKind = 'ginkgo' | 'maple' | 'persimmon' | 'oak' | 'birch'
type LeafPoint = readonly [number, number, number, number?]
const leafPaths: Record<LeafKind, string> = {
  ginkgo: 'M0 9C-2 3-13 1-15-8Q-7-16-1-12L0-8 2-13Q10-15 16-7C13 1 3 4 0 9Z',
  maple: 'M0 12-4 5-12 7-9 0-17-5-8-7-9-15-3-11 0-21 4-11 11-15 10-7 18-4 10 1 13 8 4 6Z',
  persimmon: 'M0 12C-11 4-14-8-1-17C12-9 12 3 0 12Z',
  oak: 'M0 16C-7 13-10 9-5 6C-14 3-13-3-7-3C-15-8-10-14-5-10C-8-18-2-22 1-16C6-22 11-16 7-11C16-12 17-5 10-3C17 0 12 7 6 6C12 12 5 16 0 16Z',
  birch: 'M0 12-8 4-11 1-8-2-10-5-6-7-5-11 0-17 6-10 7-7 11-4 8-1 10 2 6 6Z',
}
function Leaf({ kind, color, detail = true }: { kind: LeafKind; color: string; detail?: boolean }) {
  return (
    <g data-autumn-leaf={kind}>
      <path d={leafPaths[kind]} fill={color} />
      {detail && (
        <path
          d={kind === 'ginkgo' ? 'M0 14V7M0 7-8-7M0 7 0-9M0 7 9-6' : 'M0 19V-11M0 4-6-2M0-3 6-8'}
          fill="none"
          stroke="#554c35"
          strokeWidth=".8"
          opacity=".32"
        />
      )}
    </g>
  )
}
function Leaves({
  kind,
  points,
  colors,
  size = 1,
  opacity = 1,
}: {
  kind: LeafKind
  points: readonly LeafPoint[]
  colors: AutumnSpaceConfig['palette']['foliage']
  size?: number
  opacity?: number
}) {
  return (
    <g opacity={opacity}>
      {points.map(([x, y, angle, scale = 1], i) => (
        <g
          key={`${x}-${y}`}
          transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale * size})`}
        >
          <Leaf kind={kind} color={colors[i % 4]!} />
        </g>
      ))}
    </g>
  )
}
function Carpet({
  kind,
  colors,
  x = 80,
  y = 490,
  width = 640,
  depth = 75,
  count = 22,
}: {
  kind: LeafKind
  colors: AutumnSpaceConfig['palette']['foliage']
  x?: number
  y?: number
  width?: number
  depth?: number
  count?: number
}) {
  const scatter = (index: number, salt: number) => {
    let value = Math.imul(index + 19, salt)
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296
  }
  return (
    <g data-autumn-detail="fallen-leaves">
      {Array.from({ length: count }, (_, i) => (
        <g
          key={i}
          transform={`translate(${x + scatter(i, 374761393) * width} ${y + scatter(i, 668265263) * depth}) rotate(${scatter(i, 1274126177) * 180}) scale(${0.24 + scatter(i, 1597334677) * 0.24} .2)`}
        >
          <Leaf kind={kind} color={colors[i % 4]!} detail={false} />
        </g>
      ))}
    </g>
  )
}
function FallingLeaves({
  kind,
  colors,
  points,
}: {
  kind: LeafKind
  colors: AutumnSpaceConfig['palette']['foliage']
  points: readonly LeafPoint[]
}) {
  return (
    <g data-autumn-detail="wind-leaves">
      {points.map(([x, y, angle, scale = 0.5], i) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
          <g
            className="autumn-leaf-fall"
            style={{
              animationDuration: `${[18, 22, 25][i]}s`,
              animationDelay: `${[-4, -12, -17][i]}s`,
            }}
          >
            <Leaf kind={kind} color={colors[(i + 1) % 4]!} />
          </g>
        </g>
      ))}
    </g>
  )
}
function Chrysanthemums({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} data-autumn-detail="chrysanthemums">
      <path d="M-48 9Q-52-22-31-21Q-30-45-9-32Q7-49 24-29Q51-34 51 8Z" fill="#596043" />
      {[
        [-31, -12],
        [-13, -26],
        [9, -17],
        [29, -13],
        [5, 3],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
          {[0, 45, 90, 135].map((angle) => (
            <ellipse key={angle} rx="9" ry="2.5" transform={`rotate(${angle})`} fill={color} />
          ))}
          <circle r="2.7" fill="#9e8444" />
        </g>
      ))}
      <path d="M-53 10Q0 18 54 10L46 26H-45Z" fill="#6c6750" />
      <path d="M-49 12Q0 20 50 12" fill="none" stroke="#979077" strokeWidth="3" />
    </g>
  )
}

/** Eight distinct outdoor scenes. Every added tree/leaf stays behind the actual window. */
export default function AutumnScenery({
  scene,
  opening,
  children,
}: {
  scene: string | number
  opening?: string
  children?: ReactNode
}) {
  const uid = `autumn-${useId().replace(/:/g, '')}`
  const config = getAutumnSpace(scene)
  if (!config) return null
  const p = config.palette
  const colors = p.foliage
  let art
  switch (config.motif) {
    case 'ginkgo-alley':
      art = (
        <>
          <path
            d="M398 562Q386 398 408 234M399 368 329 287M402 326 479 246M406 282 380 204"
            fill="none"
            stroke={p.bark}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M273 261Q254 211 296 187Q283 137 337 128Q351 76 395 103Q434 64 464 109Q518 97 529 153Q566 178 533 219Q548 257 494 278Q467 308 425 285Q369 322 331 285Q293 302 273 261Z"
            fill={colors[2]}
          />
          <path
            d="M291 234Q267 183 322 178Q304 128 360 133Q379 94 412 129Q461 96 480 149Q528 139 531 190Q528 231 478 233Q446 275 408 245Q356 278 335 243Z"
            fill={colors[0]}
          />
          <path
            d="M323 177Q343 136 374 153Q391 123 427 152Q469 133 486 177Q474 212 437 204Q397 236 373 212Q337 224 323 177Z"
            fill={colors[3]}
            opacity=".64"
          />
          <Leaves
            kind="ginkgo"
            colors={colors}
            points={[
              [285, 216, -40, 1.2],
              [320, 146, -25],
              [356, 115, 14],
              [411, 115, -5],
              [471, 142, 25, 1.3],
              [518, 189, 42],
              [498, 244, 78, 1.1],
              [449, 270, 20],
              [373, 278, -45],
              [322, 258, 12],
              [367, 201, 46],
              [444, 188, -36],
            ]}
          />
          <path d="M343 507q55-12 108 1l30 13q-76 16-152 4z" fill={p.water} opacity=".6" />
          <path
            d="M354 516h97m-89 8h112M387 492l-12 42m44-39-2 37"
            fill="none"
            stroke={colors[3]}
            strokeWidth="3"
            opacity=".28"
          />
          <Carpet kind="ginkgo" colors={colors} x={295} y={491} width={217} depth={79} count={27} />
        </>
      )
      break
    case 'persimmon-linen':
      art = (
        <>
          <path d="M0 369q180-73 356-10t444-18v479H0Z" fill={p.distant} />
          <path d="M0 444q210-62 420 0t380-20v396H0Z" fill={p.ground} />
          <path d="M165 467h486v62H165Z" fill="#6d6650" />
          <path
            d="M168 480h480m-480 28h480m-405-40v13m109 0v26m120-39v13m92 0v26"
            fill="none"
            stroke="#96876a"
            strokeWidth="2"
            opacity=".5"
          />
          <path
            d="M542 521Q530 369 550 218L571 100M542 388 451 303 411 218M550 310 617 235M553 253 482 177M543 436 607 359"
            fill="none"
            stroke={p.bark}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M405 255Q368 226 397 190Q378 151 424 146Q425 106 473 129Q507 104 529 147Q578 106 607 143Q655 133 659 179Q688 215 650 246Q653 281 614 292Q582 314 550 285Q504 307 483 276Q436 293 405 255Z"
            fill={colors[2]}
          />
          <path
            d="M398 209Q409 162 456 176Q469 138 500 165Q524 135 551 163Q588 142 612 175Q649 174 646 213Q632 252 591 238Q570 269 535 238Q499 269 476 237Q432 252 398 209Z"
            fill={colors[0]}
          />
          <path
            d="M438 280Q408 302 430 340Q463 363 489 330Q515 345 528 316L511 278Z"
            fill={colors[1]}
          />
          <Leaves
            kind="persimmon"
            colors={colors}
            points={[
              [407, 188, -40],
              [446, 143, -18, 1.1],
              [493, 158, 28],
              [579, 145, 42],
              [630, 190, 70],
              [615, 269, -30],
              [553, 277, 12],
              [464, 260, -45],
              [432, 318, 30],
              [487, 314, -12],
              [525, 201, 55],
            ]}
          />
          {[
            [454, 215],
            [475, 265],
            [530, 245],
            [568, 310],
            [430, 340],
            [607, 359],
            [520, 392],
            [602, 228],
          ].map(([x, y], i) => (
            <g key={x} data-autumn-detail="persimmon-fruit">
              <path d={`M${x - 3} ${y - 21}l3 16`} fill="none" stroke={p.bark} strokeWidth="2" />
              <path
                d={`M${x} ${y - 10}c-16-6-17 15-5 19q9 6 16-3c9-13 1-21-11-16Z`}
                fill={`url(#${uid}-fruit)`}
              />
              <path d={`m${x} ${y - 9}-6-4 7 1 4-5 1 6 6 2-7 1Z`} fill="#5d6641" />
              <path
                d={`M${x - 5} ${y - 4}q-4 4-1 7`}
                fill="none"
                stroke="#e0b575"
                strokeWidth="2"
                opacity={i % 2 ? 0.45 : 0.6}
              />
            </g>
          ))}
          <path
            d="M182 548q165-28 333 0"
            fill="none"
            stroke={p.water}
            strokeWidth="18"
            opacity=".5"
          />
          <Carpet
            kind="persimmon"
            colors={colors}
            x={185}
            y={535}
            width={422}
            depth={41}
            count={19}
          />
        </>
      )
      break
    case 'maple-forest':
      art = (
        <>
          <path d="M0 290q200-95 380-4t420-25v559H0Z" fill={p.distant} />
          <path
            d="M87 535 98 137m159 355-18-371m357 405 18-390m100 388-15-420"
            fill="none"
            stroke="#655641"
            strokeWidth="14"
            opacity=".55"
          />
          <path d="M0 454q175-67 368 13t432-40v393H0Z" fill={p.ground} />
          <path
            d="M296 820q-77-165 107-287t-10-137l28-3q212 42 44 169t7 258Z"
            fill="#8f7954"
            opacity=".68"
          />
          <path
            d="M71 582Q100 367 88 175M94 341 186 233M89 290 29 222M690 585Q652 393 691 175M671 373 568 286M682 289 758 217"
            fill="none"
            stroke={p.bark}
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M-40 145Q2 72 69 106Q113 49 164 104Q224 91 240 153Q281 181 240 225Q251 278 186 287Q150 331 99 294Q36 327 12 278Q-41 274-29 219Z"
            fill={colors[2]}
          />
          <path
            d="M-10 153Q33 102 76 132Q119 88 157 137Q209 126 213 177Q246 208 207 233Q171 272 128 242Q80 277 44 237Q-4 247-10 203Z"
            fill={colors[0]}
          />
          <path
            d="M529 151Q548 97 598 111Q630 59 685 94Q743 67 779 124Q839 133 813 194Q843 238 783 263Q755 308 702 278Q643 309 617 266Q555 281 548 231Q503 210 529 151Z"
            fill={colors[1]}
          />
          <path
            d="M568 168Q591 126 627 152Q664 112 700 150Q751 126 771 167Q810 200 766 220Q733 264 690 234Q648 274 616 235Q571 246 568 208Z"
            fill={colors[3]}
            opacity=".72"
          />
          <Leaves
            kind="maple"
            size={0.58}
            opacity={0.64}
            colors={colors}
            points={[
              [27, 173, -30, 1.5],
              [83, 112, 10, 1.3],
              [154, 139, 40, 1.4],
              [219, 191, -15, 1.2],
              [174, 267, 22],
              [107, 285, -33, 1.2],
              [550, 195, -15, 1.4],
              [601, 133, 30],
              [692, 113, -16, 1.3],
              [758, 159, 25, 1.5],
              [783, 227, -10],
              [705, 271, 35],
              [619, 258, -26, 1.2],
            ]}
          />
          <path
            d="M85 522q80-32 154-5m284 19q94-43 191-9"
            fill="none"
            stroke={colors[2]}
            strokeWidth="22"
            opacity=".45"
          />
          <Leaves
            kind="maple"
            colors={colors}
            opacity={0.72}
            points={[
              [28, 140, -25, 0.5],
              [55, 112, 15, 0.5],
              [115, 104, -15, 0.55],
              [182, 116, 25, 0.5],
              [222, 154, 45, 0.5],
              [242, 210, -15, 0.5],
              [212, 266, 35, 0.5],
              [157, 287, 15, 0.55],
              [96, 296, -15, 0.5],
              [27, 259, -40, 0.55],
              [553, 137, -15, 0.5],
              [600, 109, 20, 0.5],
              [667, 100, -10, 0.55],
              [730, 109, 22, 0.5],
              [778, 148, 40, 0.5],
              [796, 195, 22, 0.55],
              [780, 251, -15, 0.5],
              [731, 280, 15, 0.5],
              [663, 287, -30, 0.5],
              [600, 270, 25, 0.55],
            ]}
          />
          <Carpet kind="maple" colors={colors} y={476} depth={100} count={34} />
        </>
      )
      break
    case 'maple-lake':
      art = (
        <>
          <path d="M0 350 156 204 277 294 443 153 621 298 800 232V820H0Z" fill={p.distant} />
          <path d="M0 382q191-77 371-8t429-15v461H0Z" fill="#7a6345" />
          <path d="M0 394q218-25 430-4t370-7v437H0Z" fill={p.water} />
          <path
            d="M50 408q97-29 202 0l-24 18H76Zm482-8q91-23 214-6l-11 20H553Z"
            fill={colors[1]}
            opacity=".32"
          />
          <path
            d="M67 436q91-11 164 0m322-9q102-12 179-1M164 479q129-15 252-1m-52 41q120-13 241-2"
            fill="none"
            stroke={colors[2]}
            strokeWidth="5"
            opacity=".25"
          />
          <path
            d="M0 449q210-18 404 0t396-8M0 503q184-15 377-1t423-8M110 548q198-11 435-3"
            fill="none"
            stroke="#94a194"
            strokeWidth="2.5"
            opacity=".38"
          />
          <path
            d="M64 559Q86 360 59 162M74 346 200 225M66 276 13 202M748 560Q705 365 748 157M720 328 617 217M737 255 790 182"
            fill="none"
            stroke={p.bark}
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M-49 143Q-20 86 34 111Q77 62 124 105Q186 83 207 136Q262 151 239 202Q257 248 197 273Q168 308 123 279Q77 316 42 275Q-17 293-27 243Q-70 206-49 143Z"
            fill={colors[1]}
          />
          <path
            d="M-12 155Q20 116 57 141Q85 97 124 137Q177 114 191 160Q222 173 207 213Q168 246 136 225Q84 265 51 236Q10 250-12 214Z"
            fill={colors[0]}
          />
          <path
            d="M569 112Q595 65 645 91Q692 45 729 94Q789 72 815 129Q862 148 826 198Q841 245 786 262Q762 301 711 272Q657 296 636 253Q578 264 580 211Q542 173 569 112Z"
            fill={colors[3]}
          />
          <path
            d="M601 136Q630 98 664 130Q703 98 735 133Q779 115 797 153Q819 188 782 210Q748 250 713 218Q666 250 642 211Q600 222 601 181Z"
            fill={colors[0]}
          />
          <Leaves
            kind="maple"
            colors={colors}
            points={[
              [10, 165, -40, 1.5],
              [74, 119, 15, 1.4],
              [144, 130, -12, 1.6],
              [219, 191, 38, 1.3],
              [177, 263, -15, 1.3],
              [80, 283, -40],
              [587, 165, -26, 1.5],
              [646, 111, 17, 1.3],
              [713, 106, -25, 1.2],
              [790, 157, 31, 1.4],
              [771, 248, 25],
              [680, 264, -18, 1.4],
            ]}
          />
          <Carpet kind="maple" colors={colors} x={135} y={437} width={538} depth={111} count={16} />
        </>
      )
      break
    case 'birch-train':
      art = (
        <>
          <path d="M0 325 171 188 298 315 455 209 638 333 800 200V820H0Z" fill={p.distant} />
          <path d="M0 347 192 289 359 406 586 282 800 338V820H0Z" fill="#756447" />
          <path d="M0 507 212 332 361 470 518 361 800 492V820H0Z" fill="#544a38" />
          <path d="M372 820Q530 616 413 502T450 397l24 10q-72 24-13 94t37 319Z" fill={p.water} />
          <path
            d="M442 445q-21 26-1 52m1 41q47 58 22 111"
            fill="none"
            stroke="#a5ada0"
            strokeWidth="3"
            opacity=".4"
          />
          <path
            d="M0 451q113-88 223-59l-19 64L0 566Zm550-61q151-83 250-19v176l-203-69Z"
            fill={colors[2]}
          />
          <path
            d="M154 615 139 234m63 338 15-378m394 389-9-337m68 357 18-391"
            fill="none"
            stroke={p.bark}
            strokeWidth="12"
          />
          <path
            d="m138 279 15 4m-12 53 16-4m-15 76 15 5m58-155 14-4m-17 70 15 4m-18 72 14-5m380-112 15 5m-14 65 15-4m-13 67 17 3m69-154 15-4m-18 68 13 5m-16 70 15-4"
            fill="none"
            stroke="#5b5848"
            strokeWidth="4"
          />
          <path
            d="M91 259Q78 213 110 191Q102 151 142 145Q175 116 198 155Q238 147 246 188Q284 208 258 247Q267 285 225 304Q180 336 154 303Q111 323 105 289Z"
            fill={colors[0]}
          />
          <path
            d="M566 236Q552 193 588 178Q582 136 627 140Q650 110 677 145Q721 126 742 172Q784 184 759 226Q769 269 721 281Q687 308 655 277Q609 295 595 258Z"
            fill={colors[1]}
          />
          <path
            d="M107 226Q131 178 160 194Q194 164 218 203Q249 226 217 250Q185 288 155 264Q123 281 107 249Z"
            fill={colors[3]}
            opacity=".75"
          />
          <Leaves
            kind="birch"
            colors={colors}
            points={[
              [107, 210, -25],
              [146, 154, 12],
              [198, 166, 42],
              [244, 223, -23, 1.1],
              [206, 287, 15],
              [157, 305, -27],
              [575, 203, -35],
              [620, 155, 15],
              [678, 149, -10],
              [739, 187, 30],
              [753, 247, 42],
              [686, 288, -18],
              [619, 268, 20],
            ]}
          />
          <Carpet kind="birch" colors={colors} x={100} y={499} width={242} depth={54} count={17} />
        </>
      )
      break
    case 'oak-camper':
      art = (
        <>
          <path d="M0 360q202-116 406-14t394-43v517H0Z" fill={p.distant} />
          <path d="M0 520q400-70 800 0v300H0Z" fill={p.ground} />
          <path
            d="M236 563C266 528 329 505 318 470S276 420 310 402L325 406C298 429 319 445 336 471S304 536 288 563Z"
            fill="#8d7b56"
          />
          <path d="M474 517q44-12 108 2l-13 12h-95Z" fill={p.water} opacity=".7" />
          <path
            d="M490 521h79m-59 7h47"
            fill="none"
            stroke="#b1ac87"
            strokeWidth="2"
            opacity=".45"
          />
          <path
            d="M117 573Q147 360 122 182M137 364 229 272M132 290 53 223M720 575Q671 381 711 165M692 335 598 252M706 267 780 208"
            fill="none"
            stroke={p.bark}
            strokeWidth="24"
            strokeLinecap="round"
          />
          <path
            d="M-10 192Q-12 142 40 135Q49 83 101 108Q142 67 185 110Q236 99 255 151Q311 164 291 216Q310 270 257 294Q237 340 182 315Q135 348 98 308Q43 330 25 287Q-30 269-10 221Z"
            fill={colors[1]}
          />
          <path
            d="M18 197Q32 157 75 168Q97 123 137 153Q180 131 209 174Q252 169 266 211Q244 261 200 244Q171 287 135 260Q83 290 61 249Q17 250 18 218Z"
            fill={colors[0]}
          />
          <path
            d="M538 145Q557 97 604 111Q639 61 685 97Q740 72 771 119Q820 116 829 166Q869 206 829 242Q835 287 779 299Q743 341 701 302Q648 331 617 288Q560 305 558 251Q518 224 538 182Z"
            fill={colors[2]}
          />
          <path
            d="M580 171Q607 130 644 151Q678 118 712 155Q765 136 784 176Q825 198 793 233Q764 276 719 251Q669 290 641 251Q596 272 582 230Z"
            fill={colors[3]}
            opacity=".72"
          />
          <Leaves
            kind="oak"
            colors={colors}
            points={[
              [25, 194, -40, 1.4],
              [85, 139, 10, 1.2],
              [164, 129, 23, 1.25],
              [243, 180, 39, 1.2],
              [269, 266, -20],
              [180, 316, 20],
              [81, 293, -35],
              [566, 193, -25, 1.3],
              [628, 129, 26],
              [700, 119, -14, 1.4],
              [790, 175, 40, 1.3],
              [781, 282, -20],
              [685, 304, 18],
            ]}
          />
          <g data-autumn-detail="acorns" fill="#a88a55" stroke="#67573a" strokeWidth="2">
            <path d="M209 329q-11 19 0 25q12-8 0-25Zm-17 7q-13 15-1 23q12-10 1-23Z" />
            <path d="M201 329q8-11 16 0m-33 7q8-10 15-1" fill="none" strokeWidth="4" />
          </g>
          <Carpet kind="oak" colors={colors} x={88} y={502} width={608} depth={49} count={24} />
        </>
      )
      break
    case 'maple-hanok':
      art = (
        <>
          <path d="M0 350q197-96 398-12t402-39v521H0Z" fill={p.distant} />
          <path d="M0 496q400-81 800-17v341H0Z" fill={p.ground} />
          <path d="M312 580 374 482l39-7 77 105Z" fill={p.water} />
          <path
            d="m357 508 58-4 18 20-91 6Zm-28 36 119-8 22 25-162 6Z"
            fill="#9f9680"
            opacity=".7"
          />
          <path
            d="M637 581Q666 374 638 212M650 369 550 280M649 310 719 235M643 261 601 201M96 580Q110 465 82 356"
            fill="none"
            stroke={p.bark}
            strokeWidth="20"
            strokeLinecap="round"
          />
          <path
            d="M466 241Q476 193 526 207Q545 160 590 190Q628 158 666 195Q718 176 747 223Q796 231 777 275Q804 317 755 342Q733 390 687 368Q642 401 606 364Q552 389 529 343Q480 353 476 309Q439 282 466 241Z"
            fill={colors[2]}
          />
          <path
            d="M495 255Q521 224 552 240Q574 205 608 232Q641 204 673 238Q718 219 739 256Q771 278 737 305Q704 342 670 316Q628 353 602 321Q558 347 540 312Q499 319 495 289Z"
            fill={colors[0]}
          />
          <path
            d="M-22 339Q8 295 44 318Q67 278 105 307Q154 298 166 340Q194 364 165 390Q156 426 113 419Q75 447 46 414Q4 433-6 394Z"
            fill={colors[1]}
          />
          <Leaves
            kind="maple"
            colors={colors}
            points={[
              [485, 258, -25, 1.2],
              [538, 212, 20, 1.3],
              [604, 201, -12, 1.4],
              [680, 217, 31],
              [748, 268, 40, 1.3],
              [728, 348, 24],
              [650, 373, -20, 1.3],
              [560, 290, -35],
              [33, 333, -25],
              [108, 321, 22],
              [157, 376, -15],
            ]}
          />
          <path
            d="M60 534q102-14 198 0m229 9q107-18 218-3"
            fill="none"
            stroke="#9b8f70"
            strokeWidth="3"
            opacity=".4"
          />
          <Carpet kind="maple" colors={colors} y={491} depth={83} count={28} />
        </>
      )
      break
    case 'ginkgo-courtyard':
      art = (
        <>
          <path d="M0 353q185-65 381 6t419-29v490H0Z" fill={p.distant} />
          <path d="M87 462h631v27H87Z" fill="#84795b" />
          <path d="M91 459h622l17 9H78Z" fill="#9d9070" />
          <path d="M0 508q400-38 800 0v312H0Z" fill={p.ground} />
          <path
            d="M0 549h800m-630-41-29 72m188-72-8 72m187-72 14 72m190-72 34 72"
            fill="none"
            stroke="#96886a"
            strokeWidth="2"
            opacity=".45"
          />
          <path
            d="M264 519Q279 476 282 417l9-1q-4 72-14 105ZM513 511Q529 457 531 374l10-2q4 84-17 141Z"
            fill={p.bark}
          />
          <path
            d="M280 467 246 405m39 46 35-60m214 52-41-71m43 44 39-62M270 517l-15 8m16-7 12 6m236-16-13 7m14-7 12 4"
            fill="none"
            stroke={p.bark}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M218 443Q186 401 225 370Q212 327 258 315Q276 277 312 306Q355 298 370 337Q404 360 379 399Q386 439 342 451Q300 483 271 453Q239 474 218 443Z"
            fill={colors[2]}
          />
          <path
            d="M226 399Q235 359 267 366Q278 329 314 351Q345 332 362 368Q390 394 359 420Q331 452 304 429Q268 455 250 425Z"
            fill={colors[0]}
          />
          <path
            d="M425 393Q401 352 438 327Q430 283 477 277Q500 235 539 266Q584 246 607 291Q652 305 632 349Q654 391 607 412Q587 452 546 430Q500 459 478 418Q443 434 425 393Z"
            fill={colors[1]}
          />
          <path
            d="M438 359Q452 320 483 332Q501 295 532 321Q566 296 591 331Q626 347 602 379Q574 413 544 390Q510 423 484 393Q449 413 438 380Z"
            fill={colors[3]}
            opacity=".75"
          />
          <Leaves
            kind="ginkgo"
            size={0.58}
            opacity={0.64}
            colors={colors}
            points={[
              [222, 380, -25, 1.3],
              [259, 329, 12],
              [313, 314, -20, 1.2],
              [369, 369, 45],
              [343, 439, 30, 1.3],
              [274, 456, -15],
              [434, 343, -30, 1.4],
              [478, 293, 17, 1.2],
              [540, 274, -15, 1.3],
              [607, 314, 35, 1.2],
              [623, 379, 42],
              [555, 434, -20, 1.2],
              [485, 414, -25],
            ]}
          />
          <Chrysanthemums x={206} y={537} color="#c0aa6b" />
          <Chrysanthemums x={480} y={532} color="#b28b68" />
          <path d="M315 535q70-11 141 0l-14 12H305Z" fill={p.water} opacity=".7" />
          <path
            d="M328 539h102m-91 5h73"
            fill="none"
            stroke="#b4ad86"
            strokeWidth="2"
            opacity=".4"
          />
          <Leaves
            kind="ginkgo"
            colors={colors}
            opacity={0.72}
            points={[
              [222, 379, -25, 0.45],
              [235, 347, 15, 0.4],
              [270, 317, -10, 0.45],
              [315, 307, 20, 0.45],
              [357, 334, 40, 0.4],
              [378, 382, 15, 0.45],
              [351, 444, 22, 0.45],
              [299, 462, -15, 0.4],
              [250, 446, -30, 0.45],
              [433, 335, -25, 0.45],
              [469, 284, 15, 0.45],
              [519, 258, -10, 0.5],
              [576, 275, 25, 0.45],
              [619, 319, 35, 0.45],
              [637, 378, 15, 0.5],
              [596, 427, 22, 0.45],
              [537, 441, -15, 0.45],
              [479, 420, -30, 0.45],
            ]}
          />
          <Carpet kind="ginkgo" colors={colors} x={105} y={500} width={586} depth={76} count={32} />
        </>
      )
  }
  return (
    <g data-autumn-scene={config.id} data-autumn-motif={config.motif}>
      <defs>
        <clipPath id={`${uid}-opening`}>
          <path d={opening ?? getSceneArchitecture(config.scene).opening} />
        </clipPath>
        <linearGradient id={`${uid}-sky`} x2="0" y2="1">
          <stop stopColor={p.sky} />
          <stop offset="1" stopColor={p.horizon} />
        </linearGradient>
        <radialGradient id={`${uid}-fruit`} cx=".3" cy=".25">
          <stop stopColor="#d8a15e" />
          <stop offset=".6" stopColor="#bc7b43" />
          <stop offset="1" stopColor="#925b36" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${uid}-opening)`}>
        {config.motif !== 'ginkgo-alley' && <path d="M0 0H800V820H0Z" fill={`url(#${uid}-sky)`} />}
        {children}
        {art}
      </g>
    </g>
  )
}

/** Three windborne leaves live in the extracted foreground, never in the rear bitmap. */
export function AutumnFallingLeaves({
  scene,
  opening,
  frames,
  frameWidth,
}: {
  scene: string | number
  opening?: string
  frames?: string
  frameWidth?: number
}) {
  const uid = `autumn-wind-${useId().replace(/:/g, '')}`
  const config = getAutumnSpace(scene)
  if (!config) return null
  const geometry = getSceneArchitecture(config.scene)
  const arrangement: Record<
    AutumnSpaceConfig['motif'],
    { kind: LeafKind; points: readonly LeafPoint[] }
  > = {
    'ginkgo-alley': {
      kind: 'ginkgo',
      points: [
        [348, 332, -10, 0.55],
        [463, 372, 25, 0.48],
        [385, 430, -20, 0.5],
      ],
    },
    'persimmon-linen': {
      kind: 'persimmon',
      points: [
        [336, 320, -25, 0.45],
        [460, 390, 30, 0.5],
        [594, 420, -15, 0.42],
      ],
    },
    'maple-forest': {
      kind: 'maple',
      points: [
        [251, 314, -15, 0.7],
        [511, 357, 22, 0.65],
        [663, 403, -25, 0.48],
      ],
    },
    'maple-lake': {
      kind: 'maple',
      points: [
        [233, 290, -20, 0.65],
        [581, 332, 25, 0.62],
        [355, 409, -10, 0.48],
      ],
    },
    'birch-train': {
      kind: 'birch',
      points: [
        [244, 319, -15, 0.48],
        [554, 340, 20, 0.45],
        [656, 392, -25, 0.4],
      ],
    },
    'oak-camper': {
      kind: 'oak',
      points: [
        [257, 318, -15, 0.58],
        [558, 352, 25, 0.52],
        [668, 412, -20, 0.45],
      ],
    },
    'maple-hanok': {
      kind: 'maple',
      points: [
        [214, 278, -10, 0.52],
        [474, 359, 15, 0.62],
        [665, 425, -20, 0.45],
      ],
    },
    'ginkgo-courtyard': {
      kind: 'ginkgo',
      points: [
        [230, 277, -15, 0.55],
        [497, 382, 25, 0.52],
        [625, 445, -20, 0.45],
      ],
    },
  }
  const wind = arrangement[config.motif]
  const aperture = opening ?? geometry.opening
  return (
    <g data-autumn-motion={config.id}>
      <defs>
        <clipPath id={`${uid}-opening`}>
          <path d={aperture} />
        </clipPath>
        <mask id={`${uid}-frames`}>
          <rect width="800" height="820" fill="white" />
          <path
            d={frames ?? geometry.frames}
            fill="none"
            stroke="black"
            strokeWidth={(frameWidth ?? geometry.frameWidth) + 3}
          />
          <path d={aperture} fill="none" stroke="black" strokeWidth="20" />
        </mask>
      </defs>
      <g clipPath={`url(#${uid}-opening)`} mask={`url(#${uid}-frames)`}>
        <FallingLeaves kind={wind.kind} colors={config.palette.foliage} points={wind.points} />
      </g>
    </g>
  )
}
