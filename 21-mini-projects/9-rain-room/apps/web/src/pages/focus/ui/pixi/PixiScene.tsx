import { getSceneInteractiveObjects } from '../../model/sceneInteractiveObjects'
import SceneInteractiveTargets from './SceneInteractiveTargets'
import { frameSceneWorld, type SceneWorldFrame } from '../../model/sceneWorldCamera'
import { SCENE_WORLD_BOUNDS } from '../../model/sceneWorldCatalog'
import { sceneWorldSvg } from '../../lib/sceneWorldArt'
import { useTranslation } from '@/shared/i18n'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/ui'
import { getBackground } from '../../model/backgrounds'
import { sceneAssetUrl } from '../../lib/sceneAsset'
import type { SceneTextureTier } from '../../model/pixiScene'
import { PixiSceneRuntime } from '../../lib/pixiSceneRuntime'
import SceneCaption from '../SceneCaption'
import './pixi-scene.css'
export default function PixiScene({
  backgroundId = 'cafe-rain',
  fullscreen = false,
  paused = false,
  coffeeCount = 0,
  onStatus,
  onObjectDiscover,
  interactionsEnabled = true,
}: {
  backgroundId?: string
  fullscreen?: boolean
  paused?: boolean
  coffeeCount?: number
  onStatus?: (status: 'loading' | 'ready' | 'error' | 'paused') => void
  onObjectDiscover?: (objectId: string) => void
  interactionsEnabled?: boolean
}) {
  const { t, i18n } = useTranslation(['extras', 'catalog'])
  const background = getBackground(backgroundId),
    root = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null),
    runtime = useRef<PixiSceneRuntime | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'paused'>('loading'),
    [error, setError] = useState(''),
    [frame, setFrame] = useState<SceneWorldFrame>(() => frameSceneWorld(800, 820, background.id)),
    [vectors, setVectors] = useState({ native: 0, raster: 0, fallback: 0 }),
    [quality, setQuality] = useState<{ tier: SceneTextureTier; resolution: number }>({
      tier: fullscreen ? 'high' : 'base',
      resolution: 1,
    }),
    [retry, setRetry] = useState(0),
    [onscreen, setOnscreen] = useState(true),
    [hidden, setHidden] = useState(() => document.hidden),
    [reduced, setReduced] = useState(false)
  const interactiveObjects = useMemo(
    () => getSceneInteractiveObjects(background.id),
    [background.id],
  )
  const worldSvg = useMemo(
    () => ({
      underlay: sceneWorldSvg(background.id, 'underlay'),
      joinery: sceneWorldSvg(background.id, 'joinery'),
    }),
    [background.id],
  )
  useLayoutEffect(() => {
    const measure = () => {
      const rect = root.current?.getBoundingClientRect()
      if (
        rect &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height) &&
        rect.width > 0 &&
        rect.height > 0
      )
        setFrame((old) => {
          const next = frameSceneWorld(rect.width, rect.height, background.id)
          return old.x === next.x && old.y === next.y && old.scale === next.scale ? old : next
        })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (root.current) observer?.observe(root.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [background.id])
  const statusCallback = useRef(onStatus)
  statusCallback.current = onStatus
  useEffect(() => {
    statusCallback.current?.(status)
  }, [status])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setHidden(document.hidden)
      setReduced(media.matches)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    media.addEventListener('change', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      media.removeEventListener('change', sync)
    }
  }, [])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) =>
      setOnscreen(entries.some((e) => e.isIntersecting)),
    )
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let active = true
    setError('')
    const scene = new PixiSceneRuntime({
      id: background.id,
      host: host.current!,
      coffeeCount,
      fullscreen,
      onFraming: (next) => {
        if (active)
          setFrame((old) =>
            old &&
            old.x === next.x &&
            old.y === next.y &&
            old.width === next.width &&
            old.height === next.height &&
            old.scale === next.scale
              ? old
              : next,
          )
      },
      onVectorStats: (stats) => {
        if (active) setVectors(stats)
      },
      onRebuild: () => {
        if (active) setRetry((v) => v + 1)
      },
      onQuality: (tier, resolution) => {
        if (active)
          setQuality((old) =>
            old.tier === tier && old.resolution === resolution ? old : { tier, resolution },
          )
      },
      reducedMotion: reduced,
      onStatus: (value, message) => {
        if (active) {
          setStatus(value)
          setError(message ?? '')
        }
      },
    })
    runtime.current = scene
    scene.setPaused(paused || hidden || !onscreen)
    void scene.start()
    const resize =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scene.resize())
    resize?.observe(host.current!)
    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)
    return () => {
      active = false
      resize?.disconnect()
      window.removeEventListener('resize', onResize)
      scene.destroy()
      if (runtime.current === scene) runtime.current = null
    }
  }, [background.id, retry, reduced, fullscreen])
  useEffect(
    () => runtime.current?.setPaused(paused || hidden || !onscreen),
    [paused, hidden, onscreen],
  )
  useEffect(() => runtime.current?.setCoffeeCount(coffeeCount), [coffeeCount])
  return (
    <div
      ref={root}
      className="cafe runtime-cafe pixi-scene"
      data-testid="cafe-scene"
      data-renderer="pixi"
      data-scene-fit="world"
      data-world-x={frame.worldX}
      data-world-y={frame.worldY}
      data-world-width={frame.worldWidth}
      data-world-height={frame.worldHeight}
      data-viewport-world-x={frame.viewportWorld.x}
      data-viewport-world-y={frame.viewportWorld.y}
      data-viewport-world-width={frame.viewportWorld.width}
      data-viewport-world-height={frame.viewportWorld.height}
      data-frame-x={frame?.x}
      data-frame-y={frame?.y}
      data-frame-width={frame?.width}
      data-frame-height={frame?.height}
      data-frame-scale={frame?.scale}
      data-native-vector-count={vectors.native}
      data-raster-layer-count={vectors.raster}
      data-vector-fallback-count={vectors.fallback}
      data-texture-tier={quality.tier}
      data-render-resolution={quality.resolution.toFixed(2)}
      data-render-status={status}
      data-resolution={fullscreen ? 'fullscreen' : 'normal'}
      data-paused={paused || hidden || !onscreen}
      role="group"
      aria-label={t(`catalog:backgrounds.${background.id}.description`)}
    >
      {status !== 'ready' && (
        <div className="pixi-world-fallback" aria-hidden="true">
          <div
            className="pixi-world-projection"
            style={{ left: frame.x, top: frame.y, transform: `scale(${frame.scale})` }}
          >
            <div
              className="pixi-world-underlay"
              style={{
                left: SCENE_WORLD_BOUNDS.x,
                top: SCENE_WORLD_BOUNDS.y,
                width: SCENE_WORLD_BOUNDS.width,
                height: SCENE_WORLD_BOUNDS.height,
              }}
              dangerouslySetInnerHTML={{ __html: worldSvg.underlay }}
            />
            <img
              className="pixi-world-core"
              src={sceneAssetUrl(background.id, 'thumbnail')}
              width="800"
              height="820"
              alt=""
              draggable={false}
            />
            <div
              className="pixi-world-joinery"
              style={{
                left: SCENE_WORLD_BOUNDS.x,
                top: SCENE_WORLD_BOUNDS.y,
                width: SCENE_WORLD_BOUNDS.width,
                height: SCENE_WORLD_BOUNDS.height,
              }}
              dangerouslySetInnerHTML={{ __html: worldSvg.joinery }}
            />
          </div>
        </div>
      )}
      <div ref={host} className="pixi-canvas-host" aria-hidden="true" />
      <SceneInteractiveTargets
        objects={interactiveObjects}
        frame={frame}
        language={i18n.resolvedLanguage ?? i18n.language}
        enabled={status === 'ready' && interactionsEnabled && !paused && !hidden && onscreen}
        onActivate={(id) => {
          if (runtime.current?.activateSceneObject(id)) onObjectDiscover?.(id)
        }}
      />
      {status === 'error' && (
        <div className="pixi-render-error" role="status">
          <span>
            {t(
              error === '그래픽 연결이 끊겼어요. 다시 시도해 주세요.'
                ? 'scene.connection'
                : 'scene.error',
            )}
          </span>
          <Button variant="existing" onClick={() => setRetry((v) => v + 1)}>
            {t('scene.retry')}
          </Button>
        </div>
      )}
      {!fullscreen && <SceneCaption name={t(`catalog:backgrounds.${background.id}.name`)} />}
    </div>
  )
}
