export const MUSIC_CATEGORIES = [
  { id: 'deep-work', name: '집중과 탐구' },
  { id: 'bright-energy', name: '활기와 카페' },
  { id: 'cozy-rest', name: '포근한 쉼' },
  { id: 'inspired-exploration', name: '영감과 탐험' },
] as const
export type MusicCategoryId = (typeof MUSIC_CATEGORIES)[number]['id']
export type MusicTrack = {
  id: string
  title: string
  file: string
  categoryId: MusicCategoryId
  tags: string[]
  tagStatus: 'provisional-context' | 'user-provided'
}
/** User-provided tags preserve the source tag filenames exactly; categories group those tags. */
export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'afternoon-study',
    title: 'Afternoon Study',
    file: 'Afternoon_Study.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '돌파', '굳건'],
    tagStatus: 'user-provided',
  },
  {
    id: 'afternoon-in-the-stacks',
    title: 'Afternoon in the Stacks',
    file: 'Afternoon_in_the_Stacks.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '희망', '블론드'],
    tagStatus: 'user-provided',
  },
  {
    id: 'afternoons-in-wool',
    title: 'Afternoons in Wool',
    file: 'Afternoons_in_Wool.mp3',
    categoryId: 'cozy-rest',
    tags: ['집중', '캐롤', '코지', '카라멜'],
    tagStatus: 'user-provided',
  },
  {
    id: 'felt-firelight',
    title: 'Felt Firelight',
    file: 'Felt_Firelight.mp3',
    categoryId: 'cozy-rest',
    tags: ['맺음', '캐롤', '약속'],
    tagStatus: 'user-provided',
  },
  {
    id: 'glass-walls-at-midnight',
    title: 'Glass Walls At Midnight',
    file: 'Glass_Walls_At_Midnight.mp3',
    categoryId: 'bright-energy',
    tags: ['활기', '희망', '신남'],
    tagStatus: 'user-provided',
  },
  {
    id: 'ink-and-espresso',
    title: 'Ink and Espresso',
    file: 'Ink_and_Espresso.mp3',
    categoryId: 'bright-energy',
    tags: ['활기', '카페', '신남'],
    tagStatus: 'user-provided',
  },
  {
    id: 'morning-at-the-pavilion',
    title: 'Morning at the Pavilion',
    file: 'Morning_at_the_Pavilion.mp3',
    categoryId: 'inspired-exploration',
    tags: ['우리집', '로피', '한국', '탐험'],
    tagStatus: 'user-provided',
  },
  {
    id: 'sunlight-on-the-canopy',
    title: 'Sunlight on the Canopy',
    file: 'Sunlight_on_the_Canopy.mp3',
    categoryId: 'bright-energy',
    tags: ['활기', '트로피칼', '오예', '산장'],
    tagStatus: 'user-provided',
  },
  {
    id: 'table-five-by-the-window',
    title: 'Table Five by the Window',
    file: 'Table_Five_by_the_Window.mp3',
    categoryId: 'bright-energy',
    tags: ['활기', '따뜻', '코코아'],
    tagStatus: 'user-provided',
  },
  {
    id: 'the-drafting-table',
    title: 'The Drafting Table',
    file: 'The_Drafting_Table.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '직진', '의지', '탐구'],
    tagStatus: 'user-provided',
  },
  {
    id: 'the-quiet-basin',
    title: 'The Quiet Basin',
    file: 'The_Quiet_Basin.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '바다', '연구', '세르토닌'],
    tagStatus: 'user-provided',
  },
  {
    id: 'the-steady-tide',
    title: 'The Steady Tide',
    file: 'The_Steady_Tide.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '우주', '하프'],
    tagStatus: 'user-provided',
  },
  {
    id: 'view-from-charon',
    title: 'View From Charon',
    file: 'View_From_Charon.mp3',
    categoryId: 'inspired-exploration',
    tags: ['집중', '우주', '영감', '문명'],
    tagStatus: 'user-provided',
  },
  {
    id: 'afternoons-under-linen',
    title: 'Afternoons Under Linen',
    file: 'Afternoons_Under_Linen.mp3',
    categoryId: 'cozy-rest',
    tags: ['집중', '따뜻', '과도기', '넛츠'],
    tagStatus: 'user-provided',
  },
  {
    id: 'fireflies-in-pine',
    title: 'Fireflies in Pine',
    file: 'Fireflies_in_Pine.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '숲', '피톤치드', '민트'],
    tagStatus: 'user-provided',
  },
  {
    id: 'granite-underfoot',
    title: 'Granite Underfoot',
    file: 'Granite_Underfoot.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '돌맹이', '강직'],
    tagStatus: 'user-provided',
  },
  {
    id: 'harbor-floor',
    title: 'Harbor Floor',
    file: 'Harbor_Floor.mp3',
    categoryId: 'inspired-exploration',
    tags: ['집중', '용궁', '우주', '몰입', '신명'],
    tagStatus: 'user-provided',
  },
  {
    id: 'salt-and-velvet-tide',
    title: 'Salt and Velvet Tide',
    file: 'Salt_and_Velvet_Tide.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '바다', '소다', '고요'],
    tagStatus: 'user-provided',
  },
  {
    id: 'after-the-first-snow',
    title: 'After the First Snow',
    file: 'After_the_First_Snow.mp3',
    categoryId: 'cozy-rest',
    tags: ['집중', '눈', '애정'],
    tagStatus: 'user-provided',
  },
  {
    id: 'afternoon-amber',
    title: 'Afternoon Amber',
    file: 'Afternoon_Amber.mp3',
    categoryId: 'cozy-rest',
    tags: ['집중', '황옥석', '맺음'],
    tagStatus: 'user-provided',
  },
  {
    id: 'midnight-shore',
    title: 'Midnight Shore',
    file: 'Midnight_Shore.mp3',
    categoryId: 'inspired-exploration',
    tags: ['시작', '바다', '상쾌'],
    tagStatus: 'user-provided',
  },
  {
    id: 'the-quiet-hearth',
    title: 'The Quiet Hearth',
    file: 'The_Quiet_Hearth.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '탐구', '의문'],
    tagStatus: 'user-provided',
  },
  {
    id: 'wrapped-in-felt',
    title: 'Wrapped in Felt',
    file: 'Wrapped_in_Felt.mp3',
    categoryId: 'deep-work',
    tags: ['집중', '솜', '전진'],
    tagStatus: 'user-provided',
  },
]
export const DEFAULT_TRACK_ID = 'afternoon-study'
export function resolveTrackId(value: unknown, tracks: MusicTrack[] = MUSIC_TRACKS): string {
  return typeof value === 'string' && tracks.some((track) => track.id === value)
    ? value
    : DEFAULT_TRACK_ID
}
export function getTrack(id: unknown): MusicTrack {
  return MUSIC_TRACKS.find((track) => track.id === resolveTrackId(id))!
}
export type MusicFilters = { query?: string; categoryId?: string; tags?: string[] }
export function filterMusic(tracks: MusicTrack[], filters: MusicFilters): MusicTrack[] {
  const query = (filters.query ?? '').trim().toLocaleLowerCase()
  return tracks.filter((track) => {
    if (filters.categoryId && track.categoryId !== filters.categoryId) return false
    if (filters.tags?.some((tag) => !track.tags.includes(tag))) return false
    const category = MUSIC_CATEGORIES.find((item) => item.id === track.categoryId)?.name ?? ''
    return (
      !query || [track.title, category, ...track.tags].join(' ').toLocaleLowerCase().includes(query)
    )
  })
}
export function musicPage(tracks: MusicTrack[], limit = 40): MusicTrack[] {
  return tracks.slice(0, Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 40)))
}
export function validateMusicCatalog(input: unknown): string[] {
  if (!Array.isArray(input)) return ['음악 목록은 배열이어야 합니다.']
  const errors: string[] = []
  const ids = new Set<string>()
  for (const [index, value] of input.entries()) {
    if (!value || typeof value !== 'object') {
      errors.push(`${index}: 잘못된 항목`)
      continue
    }
    const track = value as Record<string, unknown>
    const prefix = `${index}(${String(track.id)})`
    if (typeof track.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(track.id))
      errors.push(`${prefix}: 안정적인 ID 필요`)
    else if (ids.has(track.id)) errors.push(`${prefix}: 중복 ID`)
    else ids.add(track.id)
    if (typeof track.title !== 'string' || !track.title.trim()) errors.push(`${prefix}: 제목 필요`)
    if (typeof track.file !== 'string' || !/^[A-Za-z0-9_-]+\.mp3$/.test(track.file))
      errors.push(`${prefix}: 안전한 MP3 파일명 필요`)
    if (!MUSIC_CATEGORIES.some((category) => category.id === track.categoryId))
      errors.push(`${prefix}: 알 수 없는 카테고리`)
    if (
      !Array.isArray(track.tags) ||
      track.tags.length < 3 ||
      track.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag !== tag.trim()) ||
      new Set(track.tags).size !== track.tags.length
    )
      errors.push(`${prefix}: 서로 다른 비어 있지 않은 태그 3개 이상 필요`)
    if (track.tagStatus !== 'provisional-context' && track.tagStatus !== 'user-provided')
      errors.push(`${prefix}: 태그 검토 상태 필요`)
  }
  return errors
}
