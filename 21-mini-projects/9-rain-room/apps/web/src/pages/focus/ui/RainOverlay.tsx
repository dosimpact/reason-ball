import { useId } from 'react'
import { WindowRegion, WindowExclusions } from './SceneWindow'
import { getSceneWeather } from '../model/sceneWeather'
import SceneWeatherDrawing from './SceneWeatherDrawing'
import { getBackground } from '../model/backgrounds'
import './backgrounds.css'

export default function RainOverlay({
  backgroundId,
  static: stationary = false,
  gust = false,
  lightning = false,
  paused = false,
}: {
  backgroundId?: string
  static?: boolean
  gust?: boolean
  lightning?: boolean
  paused?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const scene = getBackground(backgroundId).scene
  const weather = getSceneWeather(getBackground(backgroundId).id)
  const storm = weather === 'storm' || weather === 'thunderstorm'
  const heavy = weather === 'heavy-rain' || storm
  return (
    <svg
      className={`scene-rain-overlay${heavy ? ' scene-rain-heavy' : ''}`}
      viewBox="0 0 800 820"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-testid="rain-overlay"
      data-static={stationary}
      data-weather={weather}
      data-gust={storm && gust}
      data-paused={paused}
      // Each precipitation layer owns its opacity; do not multiply by legacy rain styling.
      style={{ opacity: 1 }}
    >
      <defs>
        <clipPath id={`${id}-region`}>
          <WindowRegion scene={scene} />
        </clipPath>
        <mask id={`${id}-foreground`}>
          <rect width="800" height="820" fill="white" />
          <WindowExclusions background={getBackground(backgroundId)} rain />
        </mask>
      </defs>
      <g clipPath={`url(#${id}-region)`} mask={`url(#${id}-foreground)`}>
        {lightning && weather === 'storm' && (
          <path className="effect-lightning" opacity=".12" fill="#dae9e6" d="M0 0h800v820H0z" />
        )}
        <SceneWeatherDrawing weather={weather} paused={paused} static={stationary} />
      </g>
    </svg>
  )
}
