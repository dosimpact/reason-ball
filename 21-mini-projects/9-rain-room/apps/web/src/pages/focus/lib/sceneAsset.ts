export type SceneResolution = 'thumbnail' | 'normal' | 'fullscreen' | 'ambience'
export function sceneAssetUrl(id: string, resolution: SceneResolution): string {
  const safe = /^[a-z0-9-]+$/.test(id) ? id : 'cafe-rain'
  if (resolution === 'ambience') return `/backgrounds/ambience/${safe}.webp`
  return resolution === 'thumbnail'
    ? `/backgrounds/thumbnail/${safe}.webp`
    : `/backgrounds/rear/${resolution}/${safe}.png`
}
