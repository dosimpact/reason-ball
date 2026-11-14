import { useEffect, useRef, useState, type ReactNode } from 'react'
export default function ScrollTrackList({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const refresh = () => {
    const element = viewport.current
    if (element) setMore(element.scrollHeight - element.scrollTop - element.clientHeight > 3)
  }
  useEffect(() => {
    refresh()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null
    if (viewport.current) observer?.observe(viewport.current)
    window.addEventListener('resize', refresh)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', refresh)
    }
  }, [children])
  return (
    <div className="scroll-track-list" data-more-below={more}>
      <div
        ref={viewport}
        className="track-scroll-viewport"
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={refresh}
        onFocusCapture={(event) => {
          if (event.target !== event.currentTarget)
            event.target.scrollIntoView?.({ block: 'nearest' })
          refresh()
        }}
      >
        <div className="track-list compact-track-list">{children}</div>
      </div>
      <span className="track-scroll-shadow" aria-hidden="true" />
    </div>
  )
}
