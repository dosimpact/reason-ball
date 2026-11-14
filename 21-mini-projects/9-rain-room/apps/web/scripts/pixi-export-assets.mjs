import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
/** Content can be identical across PNG roles; only an actual filename proves that URL was written. */
export async function writeCachedPng(directory, filename, bytes, cache) {
  const key = `file:${filename}`
  if (!cache.has(key)) {
    await writeFile(join(directory, filename), bytes)
    cache.add(key)
  }
}
