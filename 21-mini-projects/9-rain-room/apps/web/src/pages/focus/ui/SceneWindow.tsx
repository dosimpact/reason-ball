import type { Background } from '../model/backgrounds'
import { getSceneSeats, getSeatGeometry } from '../model/sceneCast'
import ScenePlants from './ScenePlants'
import { LightingOcclusions } from './RoomLighting'
import { getSceneArchitecture } from '../model/sceneArchitecture'
export function WindowRegion({ scene }: { scene: number }) {
  return <path d={getSceneArchitecture(scene).opening} fillRule="evenodd" />
}
/** Black shapes keep additive highlights off interior people, furniture and window frames. */
export function WindowExclusions({
  background,
  rain = false,
}: {
  background: Background
  rain?: boolean
}) {
  const scene = background.scene
  const cast = scene === 35 ? { ...background, companions: 2 as const } : background
  return (
    <g fill="black">
      <path
        d={getSceneArchitecture(scene).frames}
        fill="none"
        stroke="black"
        strokeWidth={getSceneArchitecture(scene).frameWidth + 3}
      />
      <path d={getSceneArchitecture(scene).opening} fill="none" stroke="black" strokeWidth="16" />
      <LightingOcclusions scene={scene} />
      <ScenePlants background={background} mask />
      {getSceneArchitecture(scene).kind === 'terrace' && (
        <>
          <path d="M48 130H78V650H48Z M722 130H752V650H722Z" />
          <path d="M0 574H800M0 586H800" fill="none" stroke="black" strokeWidth="12" />
        </>
      )}
      {scene === 35 && (
        <>
          <rect x="343" y="307" width="137" height="230" rx="35" />
          <rect x="489" y="410" width="185" height="105" />
          <rect x="74" y="512" width="650" height="77" />
        </>
      )}
      {getSceneSeats(cast).map((seat, index) => {
        const geometry = getSeatGeometry(cast, seat, !(scene === 0 || scene === 35 || scene === 36))
        return (
          <rect
            key={index}
            x={seat.x - 70 * geometry.scale}
            y={geometry.y - 150 * geometry.scale}
            width={140 * geometry.scale}
            height={200 * geometry.scale}
            rx="35"
          />
        )
      })}
      {scene === 5 && rain && (
        <>
          <rect x="50" y="160" width="200" height="430" />
          <rect x="550" y="160" width="200" height="430" />
          <rect x="265" y="300" width="265" height="350" />
        </>
      )}
      {scene === 36 && <path d="M105 628q295-55 590 0v192H105z" />}
      {scene === 7 && (
        <>
          <rect x="8" y="180" width="57" height="394" />
          <rect x="735" y="180" width="57" height="394" />
        </>
      )}
      {scene === 8 && <rect x="305" y="480" width="160" height="131" />}
      {scene === 22 && (
        <>
          <rect x="368" y="170" width="64" height="28" />
          <path d="M70 580q330-32 660 0v40H70Z" />
        </>
      )}
      {scene === 24 && (
        <g transform="translate(-170 0)">
          <path d="M548 410 665 500l-16 34-40-15-90-61Z" />
          <ellipse cx="537" cy="432" rx="20" ry="28" transform="rotate(38 537 432)" />
          <path d="M594 496h17l32 34v24h-43v-30Z" />
        </g>
      )}
      {scene === 34 && <rect x="60" y="505" width="150" height="180" rx="20" />}
    </g>
  )
}
