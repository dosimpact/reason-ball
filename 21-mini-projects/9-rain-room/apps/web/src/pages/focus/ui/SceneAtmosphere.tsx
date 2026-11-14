import { useEffect, useState, useId } from 'react'
import { getSceneEffects } from '../model/sceneEffects'
import { REST_EFFECTS, SceneEffectCycle, type EffectState } from '../lib/sceneEffectCycle'
import SceneDetails from './SceneDetails'
import { getBackground } from '../model/backgrounds'
import RainOverlay from './RainOverlay'
import { getSceneWeather } from '../model/sceneWeather'
import './scene-effects.css'
export default function SceneAtmosphere({
  backgroundId = 'cafe-rain',
  static: stationary = false,
  preview,
  detailPhase,
  paused = false,
}: {
  backgroundId?: string
  static?: boolean
  preview?: EffectState
  detailPhase?: number
  paused?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const config = getSceneEffects(backgroundId)
  const weather = getSceneWeather(backgroundId)
  const storm = weather === 'storm' || weather === 'thunderstorm'
  const [state, setState] = useState<EffectState>(REST_EFFECTS)
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (stationary || preview) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cycle = new SceneEffectCycle(setState, {
      set: (fn, delay) => window.setTimeout(fn, delay),
      clear: (id) => window.clearTimeout(id as number),
    })
    const sync = () => {
      const enabled = !paused && !document.hidden && !media.matches
      setActive(enabled)
      if (enabled)
        cycle.start(
          Boolean(config.cat),
          storm,
          config.weather.gustDelay,
          config.weather.gustDuration,
          config.weather.lightningDelay,
          config.timing.yawnDelay,
          config.timing.yawnDuration,
        )
      else cycle.stop()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    media.addEventListener('change', sync)
    return () => {
      cycle.stop()
      document.removeEventListener('visibilitychange', sync)
      media.removeEventListener('change', sync)
    }
  }, [config, stationary, preview, paused, storm, backgroundId])
  const effects = preview ?? state
  return (
    <>
      <RainOverlay
        backgroundId={backgroundId}
        static={stationary}
        paused={!active && !preview}
        gust={storm && effects.gust}
        lightning={weather === 'storm' && effects.lightning}
      />
      {!stationary && (
        <svg
          className="scene-effects-overlay"
          data-testid="scene-effects"
          data-active={active || Boolean(preview)}
          data-yawn={effects.yawn}
          viewBox="0 0 800 820"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          <SceneDetails
            background={getBackground(backgroundId)}
            details={config.details}
            phase={detailPhase}
          />
          <defs>
            <radialGradient id={`${uid}-lamp-halo`}>
              <stop stopColor="#ffe0a3" stopOpacity=".24" />
              <stop offset=".5" stopColor="#edb967" stopOpacity=".09" />
              <stop offset="1" stopColor="#edb967" stopOpacity="0" />
            </radialGradient>
          </defs>
          {config.sparkles.map(({ x, y }, index) => (
            <path
              key={index}
              className="lamp-sparkle"
              d={`M${x - 6} ${y}h12m-6-6v12`}
              fill="none"
              stroke="#ffedbf"
              strokeWidth="1.3"
              opacity=".6"
            />
          ))}
          {config.lamps.map(({ x, y }, index) => (
            <g key={index} className="effect-lamp" style={{ animationDelay: `${index * 2}s` }}>
              <ellipse cx={x} cy={y + 24} rx="145" ry="105" fill={`url(#${uid}-lamp-halo)`} />
            </g>
          ))}
          {config.steam.map(({ x, y, scale = 1 }, index) => (
            <g key={index} transform={`translate(${x} ${y}) scale(${scale})`}>
              <path
                className="effect-steam"
                d="M-14-7q-12-18 0-34m14 38q13-20 1-42m16 36q-9-15-1-28"
                fill="none"
                stroke="#ded7bc"
                strokeWidth="1.7"
                opacity=".4"
              />
            </g>
          ))}
          {effects.yawn && config.cat && (
            <g
              transform={`translate(${config.cat.x} ${config.cat.y}) scale(${config.cat.scale ?? 0.9})`}
              data-effect="cat-yawn"
            >
              <g
                className="effect-yawn"
                style={{ animationDuration: `${config.timing.yawnDuration}ms` }}
              >
                <path d="M23-2h13v12H23z" fill={config.cat.coat} />
                <ellipse cx="29" cy="3" rx="5" ry="7" fill="#665247" />
                <ellipse cx="29" cy="7" rx="3" ry="2" fill="#c38e83" />
                <path
                  d="m17-6 4 2 4-2m7 0 4 2 4-2"
                  fill="none"
                  stroke="#5d5746"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            </g>
          )}
        </svg>
      )}
    </>
  )
}
