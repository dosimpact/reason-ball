import { lazy, memo, Suspense } from 'react'
import { getBackground } from '../model/backgrounds'
import { sceneAssetUrl } from '../lib/sceneAsset'
import PixiScene from './pixi/PixiScene'
import './backgrounds.css'
const LegacyRuntimeCafe = lazy(() => import('./LegacyRuntimeCafe'))
function RuntimeCafe(props: {
  backgroundId?: string
  thumbnail?: boolean
  fullscreen?: boolean
  paused?: boolean
  coffeeCount?: number
  onStatus?: (status: 'loading' | 'ready' | 'error' | 'paused') => void
  onObjectDiscover?: (objectId: string) => void
  interactionsEnabled?: boolean
}) {
  const background = getBackground(props.backgroundId)
  if (props.thumbnail)
    return (
      <div className="cafe runtime-cafe scene-thumbnail" data-renderer="thumbnail">
        <img
          src={sceneAssetUrl(background.id, 'thumbnail')}
          width="320"
          height="328"
          loading="lazy"
          decoding="async"
          alt=""
        />
      </div>
    )
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('renderer') === 'legacy'
  )
    return (
      <Suspense
        fallback={
          <div className="cafe runtime-cafe" data-renderer="legacy-loading">
            <img className="scene-artwork" src={sceneAssetUrl(background.id, 'thumbnail')} alt="" />
          </div>
        }
      >
        <LegacyRuntimeCafe {...props} />
      </Suspense>
    )
  return <PixiScene key={background.id} {...props} backgroundId={background.id} />
}
export default memo(RuntimeCafe)
