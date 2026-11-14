import { useEffect, useState } from 'react'
import './viewport-rain.css'
import type { SceneWeather } from '../model/sceneWeather'

/** Decorative precipitation behind the page; mounted only for actual music playback. */
export default function ViewportRain({
  obscured = false,
  weather = 'rain',
}: {
  obscured?: boolean
  weather?: SceneWeather
}) {
  const [paused, setPaused] = useState(() => document.visibilityState === 'hidden')
  useEffect(() => {
    const syncVisibility = () => setPaused(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])
  return (
    <div
      className="viewport-rain"
      data-testid="viewport-rain"
      data-weather={weather}
      data-paused={paused || obscured}
      aria-hidden="true"
    />
  )
}
