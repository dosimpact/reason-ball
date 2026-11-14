/** Optional native shell bridge; ordinary browsers have no receiver. */
export function publishNativeLanguage(
  language: string | undefined,
  target: unknown = typeof window === 'undefined' ? undefined : window,
): void {
  if (language !== 'ko' && language !== 'en' && language !== 'zh') return
  const bridge = (target as { ReactNativeWebView?: { postMessage?: unknown } } | undefined)
    ?.ReactNativeWebView
  if (typeof bridge?.postMessage === 'function') {
    bridge.postMessage(JSON.stringify({ type: 'rain-room:language', language }))
  }
}
