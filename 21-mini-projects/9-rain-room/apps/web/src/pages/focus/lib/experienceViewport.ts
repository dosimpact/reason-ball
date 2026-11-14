const viewportProperties = [
  '--rain-room-viewport-width',
  '--rain-room-viewport-height',
  '--rain-room-viewport-left',
  '--rain-room-viewport-top',
] as const

/** Keep the café and document-level portals in the same visible viewport.
 * Offsets belong to the fixed outer surface only; room children fill that surface.
 */
export function installExperienceViewport(element: HTMLElement): () => void {
  const document = element.ownerDocument
  const window = document.defaultView
  if (!window) return () => {}
  const viewport = window.visualViewport
  const targets = [...new Set([element, document.documentElement])]
  const saved = targets.flatMap((target) =>
    viewportProperties.map((property) => ({
      target,
      property,
      value: target.style.getPropertyValue(property),
      priority: target.style.getPropertyPriority(property),
    })),
  )
  const overflow = [document.body, document.documentElement].filter(Boolean).map((target) => ({
    target,
    value: target.style.getPropertyValue('overflow'),
    priority: target.style.getPropertyPriority('overflow'),
  }))
  for (const { target } of overflow) target.style.setProperty('overflow', 'hidden')
  const positive = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) && value! > 0 ? value! : Math.max(1, fallback || 1)
  const offset = (value: number | undefined) => (Number.isFinite(value) ? Math.max(0, value!) : 0)
  let disposed = false
  const sync = () => {
    if (disposed) return
    const values = [
      positive(viewport?.width, window.innerWidth),
      positive(viewport?.height, window.innerHeight),
      offset(viewport?.offsetLeft),
      offset(viewport?.offsetTop),
    ]
    for (const target of targets)
      viewportProperties.forEach((property, index) =>
        target.style.setProperty(property, `${values[index]}px`),
      )
  }
  sync()
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)
  viewport?.addEventListener('resize', sync)
  viewport?.addEventListener('scroll', sync)
  return () => {
    if (disposed) return
    disposed = true
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
    viewport?.removeEventListener('resize', sync)
    viewport?.removeEventListener('scroll', sync)
    for (const { target, property, value, priority } of saved)
      if (value) target.style.setProperty(property, value, priority)
      else target.style.removeProperty(property)
    for (const { target, value, priority } of overflow)
      if (value) target.style.setProperty('overflow', value, priority)
      else target.style.removeProperty('overflow')
  }
}
