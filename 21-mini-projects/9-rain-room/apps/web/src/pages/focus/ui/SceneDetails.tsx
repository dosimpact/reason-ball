import NeonFacadeLights, { NeonRoadReflections } from './NeonFacadeLights'
import { useId, type CSSProperties } from 'react'
import type { Background } from '../model/backgrounds'
import type { SceneDetail } from '../model/sceneDetails'
import { WindowRegion, WindowExclusions } from './SceneWindow'
function Marks({ detail, phase }: { detail: SceneDetail; phase?: number }) {
  const { kind, width: w, height: h, count } = detail
  const factors = Array.from({ length: count }, (_, index) =>
    count === 1 ? 0.5 : (index / (count - 1)) * 0.8 + 0.1,
  )
  if (kind === 'droplets')
    return (
      <>
        {factors.map((factor, index) => (
          <g
            key={index}
            style={{ animationDelay: `${-index * 5}s` }}
            className="detail-droplet"
            transform={phase === undefined ? undefined : `translate(0 ${phase * 12})`}
          >
            <path
              d={`M${w * factor} 0q-5 ${h * 0.25} 0 ${h * 0.5}t-2 ${h * 0.4}`}
              strokeWidth="1.4"
              opacity=".22"
            />
            <ellipse
              cx={w * factor - 2}
              cy={h * 0.9}
              rx="2.1"
              ry="4.5"
              stroke="none"
              fill="currentColor"
              opacity=".45"
            />
          </g>
        ))}
      </>
    )
  if (kind === 'distant-lights')
    return (
      <g
        className="detail-passing"
        transform={phase === undefined ? undefined : `translate(${phase * (w - 60)} 0)`}
      >
        <path d={`M0 ${h * 0.5}h18m8 0h11m10 0h9`} strokeWidth="4" opacity=".6" />
        <path d={`M1 ${h * 0.5 + 8}h10m19 0h6`} strokeWidth="2" opacity=".16" />
      </g>
    )
  if (kind === 'leaf-glints')
    return (
      <>
        {factors.map((factor, index) => (
          <path
            key={index}
            className="detail-foliage"
            style={{ animationDelay: `${-index * 3}s` }}
            d={`M${w * factor} ${h * (index % 2 ? 0.7 : 0.25)}q12-14 29-9m-22 6 12-3`}
            strokeWidth="2.4"
            opacity=".29"
          />
        ))}
      </>
    )
  if (kind === 'water-ripples')
    return detail.surface === 'falls' ? (
      <g className="detail-waterfall">
        <path
          d={`M${w * 0.3} 0q-7 ${h * 0.3} 0 ${h * 0.7}m${w * 0.3}-${h * 0.58}q6 ${h * 0.3}-2 ${h * 0.7}`}
          opacity=".27"
          strokeWidth="3"
        />
      </g>
    ) : (
      <>
        {factors.map((factor, index) => (
          <g key={index} transform={`translate(${w * factor} ${h * (index % 2 ? 0.75 : 0.3)})`}>
            <ellipse
              className="detail-ripple"
              rx={phase === undefined ? 24 : 18 + phase * 22}
              ry={phase === undefined ? 4 : 3 + phase * 3}
              strokeWidth="1.7"
              opacity=".35"
              style={{ animationDelay: `${-index * 3}s` }}
            />
          </g>
        ))}
      </>
    )
  if (kind === 'fireflies' || kind === 'dust')
    return (
      <>
        {Array.from({ length: count }, (_, index) => (
          <circle
            key={index}
            className={kind === 'dust' ? 'detail-dust' : 'detail-firefly'}
            cx={(index * 43 + 17) % Math.max(1, w)}
            cy={((index * 67 + 13) % Math.max(1, h)) - (phase ?? 0) * 10}
            r={kind === 'dust' ? 1.6 : 2.2}
            fill="currentColor"
            stroke="none"
            opacity={phase === undefined ? (kind === 'dust' ? '.25' : '.65') : 0.12 + phase * 0.6}
            style={{ animationDelay: `${-index * 2.7}s` }}
          />
        ))}
      </>
    )
  if (kind === 'embers')
    return (
      <>
        {factors.map((factor, index) => (
          <circle
            key={index}
            className="detail-ember"
            cx={w * factor}
            cy={h * 0.85 - index * 14}
            r="2"
            fill="currentColor"
            stroke="none"
            opacity=".65"
            style={{ animationDelay: `${-index * 2}s` }}
          />
        ))}
      </>
    )
  if (kind === 'neon-sign') return <NeonFacadeLights phase={phase} />
  if (kind === 'neon-reflection') return <NeonRoadReflections phase={phase} />
  if (kind === 'table-reflection')
    return (
      <path
        className="detail-reflection"
        d={`M0 ${h * 0.4}q${w * 0.5} 3 ${w} 0m-${w * 0.8} 3h${w * 0.5}`}
        strokeWidth="1.5"
        opacity={phase === undefined ? 0.25 : 0.15 + phase * 0.3}
      />
    )
  return (
    <path
      className="detail-curtain"
      d={`M0 0q10 ${h * 0.4} 1 ${h}m${w * 0.5}-${h}q-8 ${h * 0.5} 0 ${h}`}
      strokeWidth="5"
      opacity=".15"
    />
  )
}
export default function SceneDetails({
  background,
  details,
  phase,
}: {
  background: Background
  details: SceneDetail[]
  phase?: number
}) {
  const id = useId().replace(/:/g, '')
  return (
    <>
      <defs>
        <clipPath id={`${id}-window`}>
          <WindowRegion scene={background.scene} />
        </clipPath>
        <mask id={`${id}-objects`}>
          <rect width="800" height="820" fill="white" />
          <WindowExclusions background={background} />
        </mask>
        <clipPath id={`${id}-stream`}>
          <path d="M290 420q360 120 80 400h270q200-260-230-400" />
        </clipPath>
        <clipPath id={`${id}-falls`}>
          <path d="M330 0h200l-15 520H315z" />
        </clipPath>
      </defs>
      {details.map((detail, index) => {
        const style = {
          '--detail-duration': `${detail.duration}s`,
          '--detail-delay': `${detail.delay}s`,
          '--detail-travel': `${detail.width - 60}px`,
          '--detail-phase': phase ?? 0.35,
        } as CSSProperties
        return (
          <g
            key={index}
            data-detail={detail.kind}
            data-duration={detail.duration}
            data-layer={detail.layer}
            data-detail-surface={detail.surface}
            clipPath={detail.layer === 'window' ? `url(#${id}-window)` : undefined}
            mask={detail.layer === 'window' ? `url(#${id}-objects)` : undefined}
            style={style}
            opacity={detail.intensity}
          >
            <g clipPath={detail.surface ? `url(#${id}-${detail.surface})` : undefined}>
              <svg
                x={detail.x}
                y={detail.y}
                width={detail.width}
                height={detail.height}
                viewBox={`0 0 ${detail.width} ${detail.height}`}
                overflow="hidden"
              >
                <g fill="none" stroke={detail.color} color={detail.color} strokeLinecap="round">
                  <Marks detail={detail} phase={phase} />
                </g>
              </svg>
            </g>
          </g>
        )
      })}
    </>
  )
}
