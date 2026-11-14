import { sceneAssetUrl } from './sceneAsset.ts'
export type FullscreenPlatform = { userAgent?: string; platform?: string; maxTouchPoints?: number }
/** Legacy platform detection retained for compatibility; live scenes use layered rendering on every platform. */
export function prefersRasterScene(platform: FullscreenPlatform): boolean {
  return (
    /iPhone|iPad|iPod/i.test(platform.userAgent ?? '') ||
    ((platform.platform === 'MacIntel' || /Macintosh/i.test(platform.userAgent ?? '')) &&
      (platform.maxTouchPoints ?? 0) > 1)
  )
}
export function fullscreenBackgroundUrl(id: string): string {
  return sceneAssetUrl(id, 'fullscreen')
}
