export type ObjectCollectionLedger = { version: 1; collected: Record<string, number> }
export const emptyObjectCollection = (): ObjectCollectionLedger => ({ version: 1, collected: {} })
const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(id)
export function parseObjectCollection(value: unknown): ObjectCollectionLedger | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    record.version !== 1 ||
    !record.collected ||
    typeof record.collected !== 'object' ||
    Array.isArray(record.collected)
  )
    return null
  const entries = Object.entries(record.collected)
  if (entries.length > 10000) return null
  const collected: Record<string, number> = {}
  for (const [id, at] of entries) {
    if (
      !validId(id) ||
      id === '__proto__' ||
      id === 'constructor' ||
      typeof at !== 'number' ||
      !Number.isSafeInteger(at) ||
      at < 0
    )
      return null
    collected[id] = at
  }
  return { version: 1, collected }
}
export function mergeObjectCollections(
  a: ObjectCollectionLedger,
  b: ObjectCollectionLedger,
): ObjectCollectionLedger {
  const collected = { ...a.collected }
  for (const [id, at] of Object.entries(b.collected))
    collected[id] = Object.hasOwn(collected, id) ? Math.min(collected[id]!, at) : at
  return { version: 1, collected }
}
