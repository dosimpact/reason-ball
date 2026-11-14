import { useId } from 'react'
import { NEON_SIGNS, NEON_BUILDINGS, type NeonSign } from '../model/neonSigns'
export function NeonLettering({ sign, core = false }: { sign: NeonSign; core?: boolean }) {
  const color = core ? sign.core : sign.color
  return sign.vertical ? (
    <>
      {[...sign.label].map((letter, index) => (
        <text
          key={index}
          x={sign.width / 2}
          y={23 + index * 24}
          textAnchor="middle"
          fontFamily="sans-serif"
          fontWeight="500"
          fontSize="20"
          letterSpacing="1"
          fill={color}
          stroke="none"
        >
          {letter}
        </text>
      ))}
    </>
  ) : (
    <text
      x={sign.width / 2}
      y={sign.height / 2 + 6}
      textAnchor="middle"
      fontFamily="sans-serif"
      fontWeight="500"
      fontSize="18"
      letterSpacing="4"
      fill={color}
      stroke="none"
    >
      {sign.label}
    </text>
  )
}
export function NeonMount({ sign }: { sign: NeonSign }) {
  return (
    <g
      data-sign-mount={sign.id}
      data-sign-label={sign.label}
      data-building-id={sign.buildingId}
      transform={sign.transform}
    >
      <path
        d={
          sign.mount === 'left'
            ? `M-20 19H1M-20 ${sign.height - 18}H1`
            : `M${sign.width} 7h17v10m-17 ${sign.height - 18}h17v-10`
        }
        fill="none"
        stroke="#647783"
        strokeWidth="4"
      />
      <path
        d={`M${sign.width + 13} 15v${sign.height + 40}q3 13 12 17`}
        fill="none"
        stroke="#111e28"
        strokeWidth="2"
      />
      <rect
        x="-4"
        y="-4"
        width={sign.width + 8}
        height={sign.height + 8}
        rx="3"
        fill="#0c1b26"
        stroke="#53616d"
        strokeWidth="2"
      />
      <rect
        width={sign.width}
        height={sign.height}
        rx="2"
        fill="#152532"
        stroke={sign.color}
        strokeWidth="2"
        opacity=".68"
      />
      <NeonLettering sign={sign} />
      {[
        [0, 0],
        [sign.width, sign.height],
      ].map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r="1.6" fill="#aab6b5" />
      ))}
    </g>
  )
}
export default function NeonFacadeLights({ phase }: { phase?: number }) {
  const uid = useId().replace(/:/g, '')
  return (
    <>
      <defs>
        {NEON_BUILDINGS.map((building) => (
          <clipPath key={building.id} id={`${uid}-${building.id}`}>
            <path d={building.plane} />
          </clipPath>
        ))}
        {NEON_SIGNS.map((sign) => (
          <radialGradient key={sign.id} id={`${uid}-halo-${sign.id}`}>
            <stop stopColor={sign.color} stopOpacity=".48" />
            <stop offset=".32" stopColor={sign.color} stopOpacity=".20" />
            <stop offset="1" stopColor={sign.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {NEON_SIGNS.map((sign) => (
        <g
          key={sign.id}
          data-facade-light={sign.buildingId}
          clipPath={`url(#${uid}-${sign.buildingId})`}
        >
          <g
            className="detail-neon"
            style={{ animationDuration: `${sign.duration}s`, animationDelay: `${sign.delay}s` }}
            opacity={phase === undefined ? 1 : 0.35 + phase * 0.8}
          >
            <g transform={sign.transform}>
              <ellipse
                cx={sign.width / 2}
                cy={sign.height / 2}
                rx={sign.width * 0.95 + 28}
                ry={sign.height * 0.7 + 42}
                fill={`url(#${uid}-halo-${sign.id})`}
                stroke="none"
              />
              <rect
                width={sign.width}
                height={sign.height}
                rx="2"
                fill="none"
                stroke={sign.color}
                strokeWidth="4"
                opacity=".45"
              />
              <rect
                width={sign.width}
                height={sign.height}
                rx="2"
                fill="none"
                stroke={sign.core}
                strokeWidth=".9"
                opacity=".95"
              />
              <NeonLettering sign={sign} core />
              <path
                className="detail-neon-sparkle"
                style={{
                  animationDuration: `${sign.duration + 4}s`,
                  animationDelay: `${sign.delay - 5}s`,
                }}
                d={`M${sign.width - 8} -4v8m-4-4h8`}
                stroke={sign.core}
                strokeWidth="1"
                opacity=".8"
              />
            </g>
          </g>
        </g>
      ))}
    </>
  )
}
export function NeonRoadReflections({
  phase,
  stationary = false,
}: {
  phase?: number
  stationary?: boolean
}) {
  return (
    <>
      {NEON_SIGNS.map((sign) => (
        <g
          key={sign.id}
          className={stationary ? undefined : 'detail-neon-water'}
          style={
            stationary
              ? undefined
              : { animationDuration: `${sign.duration + 4}s`, animationDelay: `${sign.delay}s` }
          }
        >
          {Array.from({ length: 7 }, (_, row) => {
            const depth = row / 6
            const center = 430 + (sign.reflection.x - 430) * (1 + depth * 0.16)
            const width = sign.reflection.spread * (0.35 + depth * 0.6) * (row % 2 ? 0.65 : 1)
            return (
              <path
                key={row}
                d={`M${center - width / 2 + (phase ?? 0) * 2} ${sign.reflection.start + row * 14}h${width}`}
                stroke={sign.color}
                strokeWidth={1.5 + depth * 2}
                strokeLinecap="round"
                opacity={(0.36 - depth * 0.18) * (phase === undefined ? 1 : 0.5 + phase)}
              />
            )
          })}
        </g>
      ))}
    </>
  )
}
