import { useTranslation } from '@/shared/i18n'
import { memo, useEffect, useRef, useState } from 'react'
import { getBackground } from '../model/backgrounds'
import { sceneAssetUrl, type SceneResolution } from '../lib/sceneAsset'
import SceneAtmosphere from './SceneAtmosphere'
import SceneCaption from './SceneCaption'
import './backgrounds.css'
import AuthoringCafe from './Cafe'
import { getPremiumSpace } from '../model/premiumSpaces'
import PremiumAtmosphere from './premium/PremiumAtmosphere'
/** Only architecture / distant landscape is raster. Every room object remains real SVG. */
function RuntimeCafe({
  backgroundId = 'cafe-rain',
  thumbnail = false,
  fullscreen = false,
  paused = false,
  coffeeCount = 0,
}: {
  backgroundId?: string
  thumbnail?: boolean
  fullscreen?: boolean
  paused?: boolean
  coffeeCount?: number
}) {
  const { t } = useTranslation(['extras', 'catalog'])
  const background = getBackground(backgroundId)
  const premium = getPremiumSpace(background.id)
  const root = useRef<HTMLDivElement>(null)
  const [onscreen, setOnscreen] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [failedSource, setFailedSource] = useState('')
  const resolution: SceneResolution = thumbnail ? 'thumbnail' : fullscreen ? 'fullscreen' : 'normal'
  const source = sceneAssetUrl(background.id, resolution)
  const effectsPaused = paused || !onscreen || hidden
  useEffect(() => {
    if (thumbnail) return
    const sync = () => setHidden(document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [thumbnail])
  useEffect(() => {
    if (thumbnail || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) =>
      setOnscreen(entries.some((entry) => entry.isIntersecting)),
    )
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [thumbnail])
  if (failedSource === source)
    return (
      <div
        ref={root}
        className={`cafe runtime-cafe runtime-fallback${thumbnail ? ' scene-thumbnail' : ''}`}
        data-paused={effectsPaused}
      >
        <AuthoringCafe
          backgroundId={background.id}
          thumbnail={thumbnail}
          paused={effectsPaused}
          coffeeCount={coffeeCount}
        />
        {!thumbnail && (
          <span className="scene-image-error" role="status">
            {t('scene.original')}
          </span>
        )}
      </div>
    )
  return (
    <div
      ref={root}
      className={`cafe runtime-cafe${thumbnail ? ' scene-thumbnail' : ''}`}
      data-testid={thumbnail ? undefined : 'cafe-scene'}
      data-presence={background.companions ? 'shared' : 'solo'}
      data-resolution={resolution}
      data-paused={effectsPaused}
      role="img"
      aria-label={t(`catalog:backgrounds.${background.id}.description`)}
    >
      <img
        className="scene-artwork"
        key={source}
        src={source}
        width={thumbnail ? 320 : fullscreen ? 1200 : 800}
        height={thumbnail ? 328 : fullscreen ? 1230 : 820}
        alt=""
        loading={thumbnail ? 'lazy' : 'eager'}
        decoding="async"
        onError={() => setFailedSource(source)}
      />
      {!thumbnail && (
        <>
          {premium && <PremiumAtmosphere spaceId={background.id} paused={effectsPaused} />}
          <div className="scene-foreground" aria-hidden="true">
            <AuthoringCafe
              backgroundId={background.id}
              layer="foreground"
              artOnly
              coffeeCount={coffeeCount}
              paused={effectsPaused}
            />
          </div>
          {!premium && <SceneAtmosphere backgroundId={background.id} paused={effectsPaused} />}
          <div className="scene-grain" />
          {!fullscreen && <SceneCaption name={t(`catalog:backgrounds.${background.id}.name`)} />}
        </>
      )}
    </div>
  )
}

export default memo(RuntimeCafe)
