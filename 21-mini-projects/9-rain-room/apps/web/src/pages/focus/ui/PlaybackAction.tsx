import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Button, Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui'
import './playback-tooltip.css'
type Props = {
  label: string
  description: string
  className: string
  mode?: string
  pressed?: boolean
  tooltipDisabled: boolean
  onActivate: () => void
  children: ReactNode
}
export default function PlaybackAction({
  label,
  description,
  className,
  mode,
  pressed,
  tooltipDisabled,
  onActivate,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null),
    content = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null),
    cleanupGesture = useRef<(() => void) | null>(null)
  const pinned = useRef(false),
    suppressRelease = useRef(false)
  const clearGesture = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    cleanupGesture.current?.()
    cleanupGesture.current = null
  }
  const close = () => {
    pinned.current = false
    clearGesture()
    setOpen(false)
  }
  useEffect(() => () => clearGesture(), [])
  useEffect(() => {
    if (tooltipDisabled) close()
  }, [tooltipDisabled])
  useEffect(() => {
    if (!open || tooltipDisabled) return
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !content.current?.contains(event.target as Node)
      )
        close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      } else if (event.key === 'Tab') close()
    }
    const scroll = () => close()
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    document.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('scroll', scroll, true)
    }
  }, [open, tooltipDisabled])
  const begin = (event: ReactPointerEvent<HTMLButtonElement>) => {
    suppressRelease.current = false
    pinned.current = false
    clearGesture()
    if (tooltipDisabled || !['touch', 'pen'].includes(event.pointerType) || event.button !== 0)
      return
    setOpen(false)
    const { clientX, clientY, pointerId } = event
    const cancel = () => {
      suppressRelease.current = true
      close()
    }
    const move = (next: PointerEvent) => {
      if (
        next.pointerId === pointerId &&
        Math.hypot(next.clientX - clientX, next.clientY - clientY) > 10
      )
        cancel()
    }
    const end = (next: PointerEvent) => {
      if (next.pointerId === pointerId) clearGesture()
    }
    const cancelled = (next: PointerEvent) => {
      if (next.pointerId === pointerId) cancel()
    }
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerup', end, true)
    document.addEventListener('pointercancel', cancelled, true)
    document.addEventListener('scroll', cancel, true)
    cleanupGesture.current = () => {
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', end, true)
      document.removeEventListener('pointercancel', cancelled, true)
      document.removeEventListener('scroll', cancel, true)
    }
    timer.current = window.setTimeout(() => {
      timer.current = null
      pinned.current = true
      suppressRelease.current = true
      setOpen(true)
    }, 500)
  }
  return (
    <Tooltip
      open={!tooltipDisabled && open}
      onOpenChange={(value) => {
        if (!value && pinned.current) return
        setOpen(value)
      }}
      disableHoverableContent
    >
      <TooltipTrigger asChild>
        <Button
          ref={trigger}
          variant="existing"
          className={className}
          data-mode={mode}
          aria-label={label}
          aria-pressed={pressed}
          onBlur={close}
          onPointerDown={begin}
          onLostPointerCapture={() => {
            if (cleanupGesture.current) {
              suppressRelease.current = true
              close()
            }
          }}
          onContextMenu={(event) => {
            if (cleanupGesture.current || pinned.current) event.preventDefault()
          }}
          onKeyDownCapture={(event) => {
            if (event.key === 'Enter' || event.key === ' ') suppressRelease.current = false
          }}
          onClickCapture={(event) => {
            if (suppressRelease.current) {
              event.preventDefault()
              event.stopPropagation()
              queueMicrotask(() => {
                suppressRelease.current = false
              })
            }
          }}
          onClick={(event) => {
            if (suppressRelease.current) {
              event.preventDefault()
              return
            }
            close()
            onActivate()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        ref={content}
        className="playback-tooltip"
        side="top"
        sideOffset={8}
        collisionPadding={16}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  )
}
