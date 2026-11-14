import { existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MUSIC_TRACKS, validateMusicCatalog } from '../src/pages/focus/model/music.ts'
const errors = validateMusicCatalog(MUSIC_TRACKS)
const directory = fileURLToPath(new URL('../src/shared/audio/assets/music/', import.meta.url))
for (const track of MUSIC_TRACKS) {
  const file = fileURLToPath(
    new URL(`../src/shared/audio/assets/music/${track.file}`, import.meta.url),
  )
  if (!existsSync(file) || !statSync(file).isFile() || !statSync(file).size)
    errors.push(`${track.id}: 음원 복사본을 찾을 수 없거나 비어 있습니다 (${track.file})`)
}
const expected = new Set(MUSIC_TRACKS.map((track) => track.file))
if (existsSync(directory))
  for (const file of readdirSync(directory)) {
    if (file.endsWith('.mp3') && !expected.has(file))
      errors.push(`목록에 없는 서비스 음원 복사본: ${file}`)
  }
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else
  console.log(
    `음악 목록 검증 통과: ${MUSIC_TRACKS.length}곡 · 고유 ID · 카테고리 · 태그 · 서비스 복사본 일치`,
  )
