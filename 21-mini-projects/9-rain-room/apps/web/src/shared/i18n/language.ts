export const LANGUAGE_STORAGE_KEY = 'rain-room.language'
export const APP_LANGUAGES = ['ko', 'zh', 'en'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]
export function normalizeLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== 'string') return null
  const base = value.trim().toLowerCase().replace(/_/g, '-').split('-')[0]
  return base === 'ko' || base === 'zh' || base === 'en' ? base : null
}
export function detectLanguage(languages: readonly string[]): AppLanguage {
  for (const language of languages) {
    const supported = normalizeLanguage(language)
    if (supported) return supported
  }
  return 'en'
}
export function initialLanguage(
  storage: Pick<Storage, 'getItem'> | null,
  languages: readonly string[],
  browser = true,
): AppLanguage {
  if (!browser) return 'ko'
  try {
    const manual = normalizeLanguage(storage?.getItem(LANGUAGE_STORAGE_KEY))
    if (manual) return manual
  } catch {}
  return detectLanguage(languages)
}
export function persistLanguage(storage: Pick<Storage, 'setItem'> | null, language: AppLanguage) {
  try {
    if (!storage) return false
    storage.setItem(LANGUAGE_STORAGE_KEY, language)
    return true
  } catch {
    return false
  }
}
