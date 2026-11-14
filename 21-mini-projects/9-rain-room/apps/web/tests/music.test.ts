import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MUSIC_TRACKS,
  MUSIC_CATEGORIES,
  DEFAULT_TRACK_ID,
  filterMusic,
  musicPage,
  resolveTrackId,
  validateMusicCatalog,
  type MusicTrack,
} from '../src/pages/focus/model/music.ts'
import { sanitizeSettings } from '../src/pages/focus/model/timer.ts'

const suppliedTags: Record<string, string[]> = {
  'Afternoon_Study.mp3': ['집중', '돌파', '굳건'],
  'Afternoon_in_the_Stacks.mp3': ['집중', '희망', '블론드'],
  'Afternoons_in_Wool.mp3': ['집중', '캐롤', '코지', '카라멜'],
  'Felt_Firelight.mp3': ['맺음', '캐롤', '약속'],
  'Glass_Walls_At_Midnight.mp3': ['활기', '희망', '신남'],
  'Ink_and_Espresso.mp3': ['활기', '카페', '신남'],
  'Morning_at_the_Pavilion.mp3': ['우리집', '로피', '한국', '탐험'],
  'Sunlight_on_the_Canopy.mp3': ['활기', '트로피칼', '오예', '산장'],
  'Table_Five_by_the_Window.mp3': ['활기', '따뜻', '코코아'],
  'The_Drafting_Table.mp3': ['집중', '직진', '의지', '탐구'],
  'The_Quiet_Basin.mp3': ['집중', '바다', '연구', '세르토닌'],
  'The_Steady_Tide.mp3': ['집중', '우주', '하프'],
  'View_From_Charon.mp3': ['집중', '우주', '영감', '문명'],
  'Afternoons_Under_Linen.mp3': ['집중', '따뜻', '과도기', '넛츠'],
  'Fireflies_in_Pine.mp3': ['집중', '숲', '피톤치드', '민트'],
  'Granite_Underfoot.mp3': ['집중', '돌맹이', '강직'],
  'Harbor_Floor.mp3': ['집중', '용궁', '우주', '몰입', '신명'],
  'Salt_and_Velvet_Tide.mp3': ['집중', '바다', '소다', '고요'],
  'After_the_First_Snow.mp3': ['집중', '눈', '애정'],
  'Afternoon_Amber.mp3': ['집중', '황옥석', '맺음'],
  'Midnight_Shore.mp3': ['시작', '바다', '상쾌'],
  'The_Quiet_Hearth.mp3': ['집중', '탐구', '의문'],
  'Wrapped_in_Felt.mp3': ['집중', '솜', '전진'],
}
test('expanded catalog registers all twenty-three supplied tracks and preserves every user tag verbatim', () => {
  assert.deepEqual(validateMusicCatalog(MUSIC_TRACKS), [])
  assert.equal(MUSIC_TRACKS.length, 23)
  assert.deepEqual(MUSIC_TRACKS.map((t) => t.file).sort(), Object.keys(suppliedTags).sort())
  for (const track of MUSIC_TRACKS) {
    assert.deepEqual(track.tags, suppliedTags[track.file])
    assert.equal(track.tagStatus, 'user-provided')
    assert.equal(track.title, track.file.slice(0, -4).replaceAll('_', ' '))
  }
  assert.equal(MUSIC_CATEGORIES.length, 4)
  assert.deepEqual(
    MUSIC_CATEGORIES.map((c) => MUSIC_TRACKS.filter((t) => t.categoryId === c.id).length),
    [10, 4, 5, 4],
  )
})
test('catalog validation rejects duplicate IDs, unsafe files, bad categories and tags', () => {
  assert.ok(validateMusicCatalog(null).length)
  for (const bad of [
    [...MUSIC_TRACKS, MUSIC_TRACKS[0]],
    [{ ...MUSIC_TRACKS[0], id: '' }],
    [{ ...MUSIC_TRACKS[0], file: '../audio.mp3' }],
    [{ ...MUSIC_TRACKS[0], categoryId: 'unknown' }],
    [{ ...MUSIC_TRACKS[0], tags: ['반복', '반복', '공백'] }],
    [{ ...MUSIC_TRACKS[0], tags: ['a', 'b', ' '] }],
    [{ ...MUSIC_TRACKS[0], tags: ['a', 'b'] }],
    [{ ...MUSIC_TRACKS[0], tagStatus: 'listened' }],
  ])
    assert.ok(validateMusicCatalog(bad).length)
  assert.deepEqual(
    validateMusicCatalog([{ ...MUSIC_TRACKS[0], tagStatus: 'provisional-context' }]),
    [],
  )
})
test('search covers new titles, categories and exact user tags with multiple tag intersections', () => {
  assert.equal(filterMusic(MUSIC_TRACKS, { query: '  DRAFTING  ' })[0].id, 'the-drafting-table')
  assert.equal(filterMusic(MUSIC_TRACKS, { query: '포근한 쉼' }).length, 5)
  assert.equal(filterMusic(MUSIC_TRACKS, { query: '트로피칼' })[0].id, 'sunlight-on-the-canopy')
  assert.deepEqual(
    filterMusic(MUSIC_TRACKS, { tags: ['집중', '우주'] })
      .map((t) => t.id)
      .sort(),
    ['harbor-floor', 'the-steady-tide', 'view-from-charon'],
  )
  assert.equal(filterMusic(MUSIC_TRACKS, { tags: ['집중', '캐롤'] })[0].id, 'afternoons-in-wool')
  assert.deepEqual(
    filterMusic(MUSIC_TRACKS, { tags: ['집중', '바다'] })
      .map((track) => track.id)
      .sort(),
    ['salt-and-velvet-tide', 'the-quiet-basin'],
  )
  assert.equal(filterMusic(MUSIC_TRACKS, { categoryId: 'cozy-rest', tags: ['활기'] }).length, 0)
  assert.equal(filterMusic(MUSIC_TRACKS, { query: 'no-result' }).length, 0)
  assert.equal(filterMusic(MUSIC_TRACKS, { tags: ['집중'] }).length, 16)
  assert.equal(filterMusic(MUSIC_TRACKS, {}).length, 23)
})
test('200-track catalog filters before pagination and supports forty-item increments', () => {
  const tracks: MusicTrack[] = Array.from({ length: 200 }, (_, i) => ({
    ...MUSIC_TRACKS[i % MUSIC_TRACKS.length],
    id: `track-${i}`,
    title: `Track ${i}`,
    tags: ['집중', i % 2 ? '우주' : '카페', '탐구'],
  }))
  assert.deepEqual(validateMusicCatalog(tracks), [])
  const filtered = filterMusic(tracks, { tags: ['집중', '우주'] })
  assert.equal(filtered.length, 100)
  assert.equal(musicPage(filtered).length, 40)
  assert.equal(musicPage(filtered, 80).length, 80)
  assert.equal(musicPage(filtered, 120).length, 100)
  assert.equal(musicPage(filtered, -2).length, 0)
  assert.equal(musicPage(filtered)[0].id, 'track-1')
})
test('retired selections and numeric legacy values recover to the new default while retained IDs survive reorder', () => {
  for (const track of [
    0,
    1,
    2,
    'missing',
    'measured-stillness',
    'ink-under-glass',
    'weight-of-the-afternoon',
    'the-slow-margin',
  ])
    assert.equal(sanitizeSettings({ track }).track, DEFAULT_TRACK_ID)
  assert.equal(DEFAULT_TRACK_ID, 'afternoon-study')
  for (const track of MUSIC_TRACKS) {
    assert.equal(sanitizeSettings({ track: track.id }).track, track.id)
    assert.equal(resolveTrackId(track.id, [...MUSIC_TRACKS].reverse()), track.id)
  }
  assert.equal(
    sanitizeSettings({ track: 'glass-walls-at-midnight' }).track,
    'glass-walls-at-midnight',
  )
  const settings = sanitizeSettings({ track: 'ink-and-espresso' })
  filterMusic(MUSIC_TRACKS, { query: 'unmatched' })
  assert.equal(settings.track, 'ink-and-espresso')
})
