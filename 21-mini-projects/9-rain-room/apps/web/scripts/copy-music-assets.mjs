// Explicit manual replacement only. Build/runtime never read the sample originals.
// Usage: node scripts/copy-music-assets.mjs --replace-all
import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../../../sample/', import.meta.url))
const targetRoot = path.join(root, 'src/shared/audio/assets')
const destination = path.join(targetRoot, 'music')
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`원본 심볼릭 링크는 지원하지 않습니다: ${file}`)
    if (entry.isDirectory()) files.push(...(await walk(file)))
    else if (entry.isFile()) files.push(file)
  }
  return files
}
if (process.argv.slice(2).join(' ') !== '--replace-all') {
  console.error('사용법: node scripts/copy-music-assets.mjs --replace-all (sample은 읽기 전용)')
  process.exitCode = 1
} else {
  // Validate every source and filename-derived tag before writing any replacement.
  const all = await walk(sourceRoot)
  const sources = all.filter((file) => path.extname(file).toLowerCase() === '.mp3').sort()
  if (!sources.length) throw new Error('교체할 MP3 파일이 없습니다.')
  const names = new Set()
  const manifest = []
  for (const source of sources) {
    const file = path.basename(source)
    if (!/^[A-Za-z0-9_-]+\.mp3$/.test(file) || names.has(file))
      throw new Error(`중복되거나 안전하지 않은 파일명: ${file}`)
    names.add(file)
    const siblings = all.filter((item) => path.dirname(item) === path.dirname(source))
    const notes = siblings.filter((item) => path.extname(item) === '.md')
    if (notes.length !== 1 || siblings.filter((item) => path.extname(item) === '.mp3').length !== 1)
      throw new Error(`각 곡 폴더에는 MP3와 태그 MD가 하나씩 있어야 합니다: ${source}`)
    const tags = path.basename(notes[0], '.md').split(',')
    if (
      tags.length < 3 ||
      new Set(tags).size !== tags.length ||
      tags.some((tag) => !tag || tag !== tag.trim())
    )
      throw new Error(`태그 파일명을 확인해 주세요: ${notes[0]}`)
    if (!(await stat(source)).size) throw new Error(`빈 음원: ${source}`)
    manifest.push({
      source: path.relative(root, source),
      file,
      title: path.basename(path.dirname(source)).replaceAll('_', ' '),
      tags,
      sha256: await hash(source),
    })
  }
  await mkdir(targetRoot, { recursive: true })
  const staging = path.join(targetRoot, `.music-staging-${randomUUID()}`)
  const backup = path.join(targetRoot, `.music-backup-${randomUUID()}`)
  let oldMoved = false
  let committed = false
  try {
    await mkdir(staging)
    for (const entry of manifest) {
      const source = path.join(root, entry.source)
      if ((await hash(source)) !== entry.sha256)
        throw new Error(`검증 중 원본이 바뀌었습니다: ${entry.source}`)
      await copyFile(source, path.join(staging, entry.file))
      if ((await hash(path.join(staging, entry.file))) !== entry.sha256)
        throw new Error(`복사 해시 불일치: ${entry.file}`)
    }
    try {
      await rename(destination, backup)
      oldMoved = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await rename(staging, destination)
    committed = true
    if (oldMoved) await rm(backup, { recursive: true })
    await mkdir(path.join(root, '../../artifacts/music-replacement'), { recursive: true })
    const { writeFile } = await import('node:fs/promises')
    await writeFile(
      path.join(root, '../../artifacts/music-replacement/copied.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    )
    console.log(
      `복사본 ${manifest.length}곡 교체 및 SHA-256 확인 완료. sample 원본은 수정하지 않았습니다.`,
    )
  } catch (error) {
    if (oldMoved && !committed) await rename(backup, destination)
    throw error
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
