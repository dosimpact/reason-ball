const DEVELOPMENT_WEB_URL = 'http://localhost:3000/'

/** @param {string | undefined} value @param {boolean} development */
function resolveWebUrl(value, development) {
  const raw = value?.trim() || (development ? DEVELOPMENT_WEB_URL : '')
  if (!raw) throw new Error('EXPO_PUBLIC_WEB_URL must be set to an HTTPS URL for release builds.')
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('EXPO_PUBLIC_WEB_URL is not a valid URL.')
  }
  if (url.username || url.password) throw new Error('The web URL must not contain credentials.')
  if (url.protocol !== 'https:' && !(development && url.protocol === 'http:')) {
    throw new Error('The web URL must use HTTPS (HTTP is allowed only during development).')
  }
  return url.toString()
}

/** @param {string} candidate @param {string} webUrl @returns {'internal' | 'external' | 'block'} */
function navigationAction(candidate, webUrl) {
  try {
    const target = new URL(candidate)
    if (target.username || target.password) return 'block'
    if (target.origin === new URL(webUrl).origin && ['http:', 'https:'].includes(target.protocol))
      return 'internal'
    return target.protocol === 'https:' ? 'external' : 'block'
  } catch {
    return 'block'
  }
}

module.exports = { DEVELOPMENT_WEB_URL, resolveWebUrl, navigationAction }
