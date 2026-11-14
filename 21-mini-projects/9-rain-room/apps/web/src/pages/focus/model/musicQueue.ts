export type MusicQueue = { ids: string[]; index: number; criteria: string }
export function shuffledIds(ids: string[], previous?: string, random = Math.random): string[] {
  const result = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.min(0.999999999, Math.max(0, random())) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  if (result.length > 1 && result[0] === previous) [result[0], result[1]] = [result[1], result[0]]
  return result
}
export function makeMusicQueue(
  ids: string[],
  criteria: string,
  random = Math.random,
  preferredStartId?: string,
): MusicQueue | null {
  const shuffled = shuffledIds(ids, undefined, random)
  if (preferredStartId && shuffled.includes(preferredStartId)) {
    shuffled.splice(shuffled.indexOf(preferredStartId), 1)
    shuffled.unshift(preferredStartId)
  }
  return shuffled.length ? { ids: shuffled, index: 0, criteria } : null
}
export function advanceMusicQueue(queue: MusicQueue, random = Math.random): MusicQueue {
  if (queue.index + 1 < queue.ids.length) return { ...queue, index: queue.index + 1 }
  return { ...queue, ids: shuffledIds(queue.ids, queue.ids[queue.index], random), index: 0 }
}

export const PLAYBACK_MODES = ['repeat-one', 'shuffle', 'sequential'] as const
export type PlaybackMode = (typeof PLAYBACK_MODES)[number]
export function sanitizePlaybackMode(value: unknown): PlaybackMode {
  return PLAYBACK_MODES.includes(value as PlaybackMode) ? (value as PlaybackMode) : 'repeat-one'
}
export function advancePlayback(
  queue: MusicQueue,
  mode: PlaybackMode,
  canonical: string[],
  manual = false,
  random = Math.random,
): MusicQueue {
  if (mode === 'repeat-one' && !manual) return queue
  if (mode === 'shuffle') return advanceMusicQueue(queue, random)
  const ids = canonical.length ? canonical : queue.ids
  const current = queue.ids[queue.index]
  return { ...queue, ids: [...ids], index: (ids.indexOf(current) + 1) % ids.length }
}
export function playbackQueue(
  ids: string[],
  current: string,
  mode: PlaybackMode,
  criteria: string,
  random = Math.random,
): MusicQueue {
  const canonical = [...new Set(ids)]
  if (!canonical.includes(current)) canonical.unshift(current)
  const ordered =
    mode === 'shuffle'
      ? [
          current,
          ...shuffledIds(
            canonical.filter((id) => id !== current),
            undefined,
            random,
          ),
        ]
      : canonical
  return { ids: ordered, index: Math.max(0, ordered.indexOf(current)), criteria }
}
