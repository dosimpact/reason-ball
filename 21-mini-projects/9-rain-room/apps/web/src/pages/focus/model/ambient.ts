export const AMBIENT_SOUNDS = [
  {
    url: '/audio/rain.mp3',
    id: 'rain',
    name: '빗소리',
    description: '창밖에 내리는 부드러운 비',
    source: '현장 녹음',
  },
  {
    url: '/audio/crickets.mp3',
    id: 'crickets',
    name: '귀뚜라미',
    description: '고요한 밤의 리듬 있는 울음',
    source: '현장 녹음',
  },
  {
    id: 'cafe',
    name: '카페 사람들',
    description: '잔잔한 대화와 카페의 생활 소리',
    source: '현장 녹음 · CC0',
    url: '/audio/cafe.mp3',
  },
  {
    url: '/audio/fire.mp3',
    id: 'fire',
    name: '장작불',
    description: '타닥이는 불씨와 따뜻한 온기',
    source: '현장 녹음',
  },
  {
    url: '/audio/waves.mp3',
    id: 'waves',
    name: '파도',
    description: '천천히 밀려오는 바다의 물결',
    source: '현장 녹음',
  },
  {
    url: '/audio/stream.mp3',
    id: 'stream',
    name: '시냇물',
    description: '작은 물방울과 흐르는 물',
    source: '현장 녹음',
  },
  {
    url: '/audio/wind.mp3',
    id: 'wind',
    name: '바람',
    description: '나뭇잎 사이를 지나는 바람',
    source: '현장 녹음',
  },
  {
    url: '/audio/birds.mp3',
    id: 'birds',
    name: '새소리',
    description: '아침을 여는 가벼운 지저귐',
    source: '현장 녹음',
  },
  {
    id: 'boat',
    name: '물 위의 배',
    description: '배 곁에 부딪히는 잔잔한 물결',
    source: '현장 녹음 · CC0',
    url: '/audio/boat.mp3',
  },
  {
    id: 'train',
    name: '지나는 열차',
    description: '멀리 오가는 열차의 리듬',
    source: '현장 녹음 · CC BY',
    url: '/audio/train.mp3',
  },
] as const
export type AmbientId = (typeof AMBIENT_SOUNDS)[number]['id']
export type AmbientMix = Record<AmbientId, { enabled: boolean; volume: number }>
export function sanitizeAmbient(value: unknown, legacyRain?: unknown): AmbientMix {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  return Object.fromEntries(
    AMBIENT_SOUNDS.map((sound) => {
      const item = raw?.[sound.id]
      const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const legacy =
        typeof legacyRain === 'number' && Number.isFinite(legacyRain)
          ? Math.min(1, Math.max(0, legacyRain))
          : 0.35
      const fallback = sound.id === 'rain' ? legacy : 0.4
      return [
        sound.id,
        {
          enabled: typeof entry.enabled === 'boolean' ? entry.enabled : sound.id === 'rain',
          volume:
            typeof entry.volume === 'number' && Number.isFinite(entry.volume)
              ? Math.min(1, Math.max(0, entry.volume))
              : fallback,
        },
      ]
    }),
  ) as AmbientMix
}
export const defaultAmbient = (): AmbientMix => sanitizeAmbient(null)
