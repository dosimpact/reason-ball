import { useId } from 'react'
import { NEON_BUILDINGS, NEON_SIGNS } from '../model/neonSigns'
import { NeonMount, NeonRoadReflections } from './NeonFacadeLights'
export default function NeonCityArt() {
  const uid = useId().replace(/:/g, '')
  return (
    <g data-city-art="rainy-neon">
      <defs>
        {NEON_BUILDINGS.map((building) => (
          <clipPath key={building.id} id={`${uid}-${building.id}`}>
            <path d={building.plane} />
          </clipPath>
        ))}
        {NEON_SIGNS.map((sign) => (
          <radialGradient key={sign.id} id={`${uid}-${sign.id}`}>
            <stop stopColor={sign.color} stopOpacity=".22" />
            <stop offset="1" stopColor={sign.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <path d="M0 0H800V820H0Z" fill="#0e1d2c" />
      {/* Faint towers sit behind the opposite houses and the narrow street's vanishing point. */}
      {[34, 205, 285, 463, 704].map((x, index) => (
        <g key={x}>
          <path
            d={`M${x} ${95 + (index % 3) * 31}h78V453H${x}Z`}
            fill={index % 2 ? '#142936' : '#112632'}
          />
          {[0, 1, 2, 3, 4].map((row) => (
            <path
              key={row}
              d={`M${x + 14} ${151 + (index % 3) * 31 + row * 47}h7m16 0h8m14 0h5`}
              stroke="#71919a"
              opacity=".22"
              strokeWidth="3"
            />
          ))}
        </g>
      ))}
      {NEON_BUILDINGS.map((building, index) => (
        <g
          key={building.id}
          data-opposite-building={building.id}
          data-depth={index === 0 ? 'far' : 'mid'}
        >
          <path d={building.plane} fill={building.color} stroke={building.edge} strokeWidth="1.8" />
          {building.id === 'far-tower' ? (
            <>
              <path d="M334 163h125v11H334Z" fill="#344754" />
              {[195, 244, 365].map((y) => (
                <g key={y}>
                  {[347, 382, 417].map((x, j) => (
                    <path
                      key={x}
                      d={`M${x} ${y}h20v24h-20Z`}
                      fill={j % 2 ? '#4b5a65' : '#233b48'}
                      opacity=".65"
                    />
                  ))}
                  <path d={`M338 ${y + 30}h117`} stroke="#0f2330" strokeWidth="3" />
                </g>
              ))}
            </>
          ) : building.id === 'left-house' ? (
            <>
              <path d="M84 185 252 203v9L84 197Z" fill="#41515d" />
              <path
                d="M84 260 252 276M84 329 252 341M84 397 252 405"
                stroke="#10222d"
                strokeWidth="6"
              />
              {[226, 351, 412].map((y, row) => (
                <g key={y}>
                  {[105, 157, 209].map((x, column) => (
                    <path
                      key={x}
                      d={`M${x} ${y + (x - 84) * 0.1}l23 2v27l-23-2Z`}
                      fill={(row + column) % 3 === 0 ? '#6d5b6e' : '#2d4656'}
                      stroke="#11232f"
                      strokeWidth="3"
                    />
                  ))}
                </g>
              ))}
            </>
          ) : (
            <>
              <path d="M560 219 733 173v10L560 229Z" fill="#44616b" />
              <path
                d="M560 263 733 223M560 370 733 345M560 430 733 419"
                stroke="#102b37"
                strokeWidth="5"
              />
              {[265, 341, 401].map((y, row) => (
                <g key={y}>
                  {[649, 695].map((x, column) => (
                    <path
                      key={x}
                      d={`M${x} ${y - (x - 560) * 0.16}l26-5v29l-26 5Z`}
                      fill={(row + column) % 3 === 0 ? '#406d76' : '#1e4554'}
                      stroke="#0f2a36"
                      strokeWidth="3"
                    />
                  ))}
                </g>
              ))}
            </>
          )}
          {NEON_SIGNS.filter((sign) => sign.buildingId === building.id).map((sign) => (
            <g key={sign.id} clipPath={`url(#${uid}-${building.id})`}>
              <g transform={sign.transform}>
                <ellipse
                  cx={sign.width / 2}
                  cy={sign.height / 2}
                  rx={sign.width * 0.95 + 30}
                  ry={sign.height * 0.65 + 45}
                  fill={`url(#${uid}-${sign.id})`}
                />
              </g>
              <NeonMount sign={sign} />
            </g>
          ))}
        </g>
      ))}
      {/* Foreground facade edges and shop awnings occlude parts of the far street. */}
      <path d="M0 90 84 127v355L0 530Z" fill="#0c1c28" />
      <path d="M733 112 800 79v463l-67-36Z" fill="#0b202b" />
      <path d="M84 451 252 429l17 15-185 32Z" fill="#101f2b" />
      <path d="M560 423 733 472v20l-173-50Z" fill="#12303b" />
      <path d="M84 482 430 414 733 506 800 820H0Z" fill="#102832" />
      <path
        d="M84 482 430 414 733 506"
        fill="none"
        stroke="#42616b"
        strokeWidth="2"
        opacity=".45"
      />
      <path
        d="M20 594 430 421 797 614M0 680 430 424 800 729"
        fill="none"
        stroke="#32515b"
        strokeWidth="2"
        opacity=".24"
      />
      <NeonRoadReflections phase={0.15} stationary />
    </g>
  )
}
