import { useTranslation } from '@/shared/i18n'
import { useEffect, useState } from 'react'
import { formatSceneTime } from '../lib/sceneTime'

export default function SceneCaption({ name }: { name: string }) {
  const { t } = useTranslation('extras')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timeout: number | undefined
    const sync = () => {
      window.clearTimeout(timeout)
      const current = new Date()
      setNow(current)
      timeout = window.setTimeout(
        sync,
        60000 - current.getSeconds() * 1000 - current.getMilliseconds() + 10,
      )
    }
    const visible = () => {
      if (document.visibilityState !== 'hidden') sync()
    }
    sync()
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  const time = formatSceneTime(now)
  return (
    <div className="scene-caption">
      <span className="live-dot" />
      <span className="scene-caption-name">{name}</span>
      <time
        className="scene-clock"
        dateTime={now.toISOString()}
        aria-label={t('scene.time', { time })}
      >
        {time}
      </time>
    </div>
  )
}
