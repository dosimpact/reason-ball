import { useId } from 'react'
import { premiumGeometry } from './premiumGeometry'
import './premium.css'
import { getSceneWeather } from '../../model/sceneWeather'
import SceneWeatherDrawing from '../SceneWeatherDrawing'
type Props = { spaceId: string; paused?: boolean; static?: boolean }
export function PremiumAtmosphereDrawing({
  spaceId,
  paused = false,
  static: stationary = false,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const geometry = premiumGeometry(spaceId)
  const weather = getSceneWeather(spaceId)
  return (
    <g className="premium-atmosphere-drawing" data-paused={paused} data-static={stationary}>
      <defs>
        <clipPath id={`${uid}-rain-clip`}>
          <path d={geometry.opening} />
        </clipPath>
        <mask id={`${uid}-frames`}>
          <rect width="800" height="820" fill="white" />
          <path d={geometry.frames} stroke="black" strokeWidth="12" fill="none" />
        </mask>
        <radialGradient id={`${uid}-light`}>
          <stop stopColor="#f3d492" stopOpacity=".48" />
          <stop offset=".3" stopColor="#e8ca84" stopOpacity=".16" />
          <stop offset="1" stopColor="#e8ca84" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${uid}-rain-clip)`} mask={`url(#${uid}-frames)`}>
        <SceneWeatherDrawing weather={weather} paused={paused} static={stationary} />
        {spaceId === 'premium-underwater-library' && (
          <g className="premium-bubbles" stroke="#b1d5c4" fill="none" opacity=".8">
            {Array.from({ length: 9 }, (_, i) => (
              <circle
                key={i}
                cx={160 + ((i * 73) % 500)}
                cy={210 + ((i * 51) % 230)}
                r={3 + (i % 4)}
              />
            ))}
          </g>
        )}
      </g>
      {geometry.light.map(([x, y], i) => (
        <ellipse
          key={i}
          className="premium-light-breathe"
          cx={x}
          cy={y + 35}
          rx={180}
          ry={190}
          fill={`url(#${uid}-light)`}
        />
      ))}
      {[
        'premium-wizard-library',
        'premium-spirit-tree',
        'premium-moon-alchemy',
        'premium-cloud-post',
      ].includes(spaceId) && (
        <g className="premium-motes" fill="#c6d5a0" opacity=".4">
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={150 + i * 79} cy={220 + ((i * 83) % 250)} r={1.5 + (i % 2)} />
          ))}
        </g>
      )}
    </g>
  )
}
export function PremiumAtmosphere(props: Props) {
  return (
    <svg
      className="premium-atmosphere"
      viewBox="0 0 800 820"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-testid="premium-atmosphere"
      data-paused={props.paused ?? false}
      data-static={props.static ?? false}
    >
      <PremiumAtmosphereDrawing {...props} />
    </svg>
  )
}
export default PremiumAtmosphere
