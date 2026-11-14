import { useId, type CSSProperties } from 'react'
import type { SceneWeather } from '../model/sceneWeather'
import { createSakuraPetals, sakuraPetalPose, SAKURA_PETAL_PATH } from '../model/sakuraPetals'
import {
  createThunderstormTimeline,
  thunderstormEventEnvelope,
  thunderstormBoltMarkup,
  thunderstormReflectionMarkup,
  thunderstormSkyMarkup,
  type ThunderstormEvent,
  type ThunderstormEnvelope,
} from '../model/thunderstorm'
import './weather.css'

const lighthouseSeed = [...'premium-storm-lighthouse'].reduce((sum, c) => sum + c.charCodeAt(0), 0)
const thunderTimeline = createThunderstormTimeline(lighthouseSeed)
const thunderChannels = ['skyAlpha', 'cloudAlpha', 'reflectionAlpha', 'boltAlpha'] as const
/** Percent knots match weather-thunder-envelope in weather.css; sample only on mount. */
const thunderSampleOffsets = [
  0, 0.157407, 0.259259, 0.314815, 0.5, 0.703704, 1, 1.5, 2.166667, 2.592593, 2.777778, 2.962963,
  3.5, 4, 5, 6, 7.037037, 11.111111, 100,
]
function thunderAlphaSamples(event: ThunderstormEvent, channel: keyof ThunderstormEnvelope) {
  return Object.fromEntries(
    thunderSampleOffsets.map((offset, index) => [
      `--thunder-alpha-${index}`,
      thunderstormEventEnvelope(event, (offset * thunderTimeline.cycleSeconds) / 100)[channel],
    ]),
  )
}
/** All transient light stays inside the caller's stationary aperture/foreground mask. */
function ThunderstormDrawing() {
  return (
    <g className="weather-thunderstorm" data-thunder-cycle={thunderTimeline.cycleSeconds}>
      {thunderTimeline.events.map((event, index) => {
        const fragments = [
          thunderstormSkyMarkup(1, 0),
          thunderstormSkyMarkup(0, 1),
          thunderstormReflectionMarkup(event.variant),
          thunderstormBoltMarkup(event.variant),
        ]
        return (
          <g key={index} data-thunder-variant={event.variant} data-thunder-start={event.start}>
            {thunderChannels.map((channel, channelIndex) => (
              <g
                key={channel}
                className={`weather-thunder-channel weather-thunder-${channel}`}
                opacity="0"
                style={
                  {
                    ...thunderAlphaSamples(event, channel),
                    animationDuration: `${thunderTimeline.cycleSeconds}s`,
                    animationDelay: `${event.start}s`,
                  } as CSSProperties
                }
                dangerouslySetInnerHTML={{ __html: fragments[channelIndex]! }}
              />
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** Bounded tiled precipitation; callers own the aperture and foreground exclusions. */
export default function SceneWeatherDrawing({
  weather,
  paused = false,
  static: stationary = false,
}: {
  weather: SceneWeather
  paused?: boolean
  static?: boolean
}) {
  const uid = `weather-${useId().replace(/:/g, '')}`
  const frozen = paused || stationary
  const rainy = weather !== 'snow'
  const snowy = weather === 'snow' || weather === 'sleet'
  const storm = weather === 'storm' || weather === 'thunderstorm'
  const heavy = weather === 'heavy-rain' || storm
  const petals = weather === 'sakura-rain' ? createSakuraPetals(800, 820, 1) : []
  return (
    <g
      className="scene-weather-drawing"
      data-weather={weather}
      data-paused={frozen}
      data-static={stationary}
    >
      <defs>
        {rainy && (
          <pattern
            id={`${uid}-rain`}
            width={storm ? 42 : heavy ? 52 : 64}
            height="180"
            patternUnits="userSpaceOnUse"
          >
            <path
              d={
                storm
                  ? 'M16-32-7 68m37-45L8 124m32-17-23 99M42-10 20 91m4 40L1 231'
                  : heavy
                    ? 'M16-20-3 58m35-34L12 105m34-12-20 79M20 125 3 201'
                    : 'M16-12 0 47m44-21L27 89m31 12-17 61M20 117 6 175'
              }
              stroke="#c2d8d4"
              strokeWidth={storm ? 2 : heavy ? 1.8 : 1.6}
              fill="none"
            />
          </pattern>
        )}
        {snowy &&
          [0, 1].map((depth) => (
            <pattern
              key={depth}
              id={`${uid}-snow-${depth}`}
              width={depth ? 117 : 99}
              height={depth ? 153 : 133}
              patternUnits="userSpaceOnUse"
            >
              <g fill={depth ? '#dce5dc' : '#c4d5d0'} opacity={depth ? 0.85 : 0.55}>
                <circle cx="22" cy="29" r={depth ? 3.2 : 1.7} />
                <circle cx="81" cy="96" r={depth ? 2.6 : 1.3} />
                <circle cx="53" cy="119" r={depth ? 2.2 : 1.5} />
                {depth === 1 && (
                  <path
                    d="M103 43v10m-5-5h10m-8-3 6 6m0-6-6 6"
                    stroke="#e1e8de"
                    strokeWidth="1.1"
                  />
                )}
              </g>
            </pattern>
          ))}
      </defs>
      {rainy && (
        <path
          className="weather-rain"
          d="M-90-180H890V1000H-90Z"
          fill={`url(#${uid}-rain)`}
          opacity={storm ? 0.7 : heavy ? 0.62 : weather === 'sleet' ? 0.46 : 0.55}
        />
      )}
      {(storm || heavy) && (
        <g transform="translate(29 67)">
          <path
            className="weather-rain weather-rain-depth"
            d="M-90-180H890V1000H-90Z"
            fill={`url(#${uid}-rain)`}
            opacity={storm ? 0.3 : 0.18}
          />
        </g>
      )}
      {snowy &&
        [0, 1].map((depth) => (
          <path
            key={depth}
            className={`weather-snow weather-snow-${depth}`}
            d="M-180-240H980V1060H-180Z"
            fill={`url(#${uid}-snow-${depth})`}
            opacity={weather === 'sleet' ? 0.65 : 1}
          />
        ))}
      {petals.map((petal, index) => {
        const pose = sakuraPetalPose(petal, 800, 820, 0)
        return [-1, 0].map((row) => (
          <g
            key={`${index}-${row}`}
            transform={`translate(${pose.x + (row * 1080 * petal.wind) / petal.speed} ${pose.y + row * 1080})`}
            data-weather-petal={index}
          >
            <g
              className="weather-sakura-fall"
              style={
                {
                  animationDuration: `${1080 / petal.speed}s`,
                  '--petal-travel': '1080px',
                  '--petal-wind': `${(1080 * petal.wind) / petal.speed}px`,
                } as CSSProperties
              }
            >
              <g
                className="weather-sakura-drift"
                style={
                  {
                    animationDuration: `${(Math.PI * 2) / petal.driftRate}s`,
                    '--petal-drift': `${petal.drift}px`,
                  } as CSSProperties
                }
              >
                <g
                  className="weather-sakura-tumble"
                  style={{
                    animationDuration: `${(Math.PI * 2) / Math.abs(petal.spinRate)}s`,
                    animationDirection: petal.spinRate < 0 ? 'reverse' : 'normal',
                  }}
                >
                  <g
                    transform={`rotate(${(pose.rotation * 180) / Math.PI}) scale(${pose.scaleX} ${pose.scaleY})`}
                    opacity={pose.alpha}
                  >
                    <path d={SAKURA_PETAL_PATH} fill={petal.color} />
                    <path
                      d="M0 4.5 .2-2.5"
                      fill="none"
                      stroke="#b77791"
                      strokeWidth=".45"
                      opacity=".28"
                    />
                  </g>
                </g>
              </g>
            </g>
          </g>
        ))
      })}
      {weather === 'thunderstorm' && <ThunderstormDrawing />}
    </g>
  )
}
