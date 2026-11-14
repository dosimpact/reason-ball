import { useTranslation } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import PlaybackControls from './PlaybackControls'
import type { PlaybackMode } from '../model/musicQueue'
import type { Session } from '../model/timer'
import './fullscreen-player.css'
import Cafe from './RuntimeCafe'
import { FullscreenIdle } from '../lib/fullscreenIdle'

type Props = {
  mode: PlaybackMode
  onMode: (mode: PlaybackMode) => void
  onNext: () => void
  coffeeCount?: number
  backgroundId: string
  backgroundName: string
  trackTitle: string
  playing: boolean
  volume: number
  phase: Session['phase']
  status: Session['status']
  timerText: string
  error: string
  onToggleMusic: () => void
  onVolume: (volume: number) => void
  onClose: () => void
}
export const FULLSCREEN_SCENE_ID = 'rain-room-fullscreen-scene'
export default function SceneFullscreen(props: Props) {
  const { t } = useTranslation('sound')
  const root = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const reopen = useRef<HTMLButtonElement>(null)
  const panelClose = useRef<HTMLButtonElement>(null)
  const [playerOpen, setPlayerOpen] = useState(true)
  const exit = useRef<HTMLButtonElement>(null)
  const idle = useRef<FullscreenIdle | null>(null)
  const visibleRef = useRef(true)
  const suppressClick = useRef(false)
  const keyboard = useRef(false)
  const pointerHeld = useRef(false)
  const closeRef = useRef(props.onClose)
  closeRef.current = props.onClose
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const element = root.current!
    const resize = () => {
      const height = window.visualViewport?.height || window.innerHeight
      if (height > 0) element.style.setProperty('--scene-viewport-height', `${height}px`)
    }
    resize()
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const app = document.getElementById('root')
    const wasInert = app?.inert ?? false
    if (app) app.inert = true
    document.body.style.overflow = 'hidden'
    element.focus({ preventScroll: true })
    const controller = new FullscreenIdle((value) => {
      visibleRef.current = value
      if (!value && document.activeElement?.closest('.fullscreen-chrome'))
        element.focus({ preventScroll: true })
      setVisible(value)
    })
    idle.current = controller
    controller.reveal()
    const pointerEnd = (event: Event) => {
      if (event.type === 'pointercancel') suppressClick.current = false
      if (pointerHeld.current) {
        pointerHeld.current = false
        controller.release('pointer')
      }
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        (event.target as Element | null)?.closest('[data-scene-interactive]')
      )
        return
      keyboard.current = true
      flushSync(() => controller.reveal())
      if (event.key === 'Tab') {
        event.preventDefault()
        const buttons = Array.from(
          element.querySelectorAll<HTMLElement>('button, input, select'),
        ).filter((item) => !item.closest('[inert]') && !item.hasAttribute('disabled'))
        // Scene loading/retry controls can precede chrome in DOM; keep exit first.
        const exitIndex = buttons.indexOf(exit.current!)
        if (exitIndex > 0) buttons.unshift(...buttons.splice(exitIndex, 1))
        const index = buttons.indexOf(document.activeElement as HTMLElement)
        const next = event.shiftKey
          ? index <= 0
            ? buttons.length - 1
            : index - 1
          : (index + 1) % buttons.length
        buttons[next]?.focus()
        if (buttons[next]?.closest('.fullscreen-chrome')) controller.hold('keyboard')
        else controller.release('keyboard')
      } else if (
        document.activeElement === element &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault()
        exit.current?.focus()
        controller.hold('keyboard')
      }
    }
    document.addEventListener('pointerup', pointerEnd)
    document.addEventListener('pointercancel', pointerEnd)
    document.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      controller.destroy()
      idle.current = null
      document.removeEventListener('pointerup', pointerEnd)
      document.removeEventListener('pointercancel', pointerEnd)
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = previousOverflow
      if (app) app.inert = wasInert
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div
      id={FULLSCREEN_SCENE_ID}
      ref={root}
      className="scene-fullscreen"
      data-testid="scene-fullscreen"
      data-render-mode="layered-viewport"
      role="dialog"
      aria-modal="true"
      aria-label={t('fullscreen.label', { name: props.backgroundName })}
      tabIndex={-1}
      onPointerDownCapture={(event) => {
        if (
          (event.target as Element).closest(
            '[data-fullscreen-persistent], [data-scene-interactive]',
          )
        ) {
          suppressClick.current = false
          return
        }
        const wasHidden = !visibleRef.current
        suppressClick.current = wasHidden
        keyboard.current = false
        idle.current?.release('keyboard')
        if (wasHidden) {
          event.preventDefault()
          event.stopPropagation()
        }
        pointerHeld.current = true
        idle.current?.hold('pointer')
      }}
      onClickCapture={(event) => {
        if (
          (event.target as Element).closest(
            '[data-fullscreen-persistent], [data-scene-interactive]',
          )
        ) {
          suppressClick.current = false
          return
        }
        if (suppressClick.current) {
          suppressClick.current = false
          event.preventDefault()
          event.stopPropagation()
        }
        idle.current?.reveal()
      }}
      onFocusCapture={(event) => {
        if (keyboard.current) {
          if ((event.target as Element).closest('.fullscreen-chrome'))
            idle.current?.hold('keyboard')
          else idle.current?.release('keyboard')
        }
      }}
      onBlurCapture={(event) => {
        if (
          keyboard.current &&
          !(event.relatedTarget as Element | null)?.closest('.fullscreen-chrome')
        )
          idle.current?.release('keyboard')
      }}
    >
      <Cafe coffeeCount={props.coffeeCount} backgroundId={props.backgroundId} fullscreen />
      <div
        className="fullscreen-chrome"
        data-testid="fullscreen-controls"
        data-visible={visible}
        inert={!visible}
        aria-hidden={!visible}
      >
        <div className="fullscreen-top">
          <span>{props.backgroundName}</span>
          <Button
            variant="existing"
            ref={exit}
            className="fullscreen-exit"
            aria-label={t('fullscreen.exit')}
            onClick={props.onClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M8 3v5H3m18 0h-5V3M3 16h5v5m8 0v-5h5" />
            </svg>
          </Button>
        </div>
      </div>
      {playerOpen ? (
        <div
          className="fullscreen-player"
          data-testid="fullscreen-player"
          data-fullscreen-persistent
          ref={controls}
          role="region"
          aria-label={t('fullscreen.player')}
        >
          <div className="fullscreen-session">
            <div className="fullscreen-timer">
              <span>
                {t('fullscreen.session', {
                  phase: t(props.phase === 'focus' ? 'fullscreen.focus' : 'fullscreen.break'),
                  status: t(`fullscreen.${props.status === 'idle' ? 'idle' : props.status}`),
                })}
              </span>
              <strong>{props.timerText}</strong>
            </div>
            <Button
              variant="existing"
              ref={panelClose}
              className="fullscreen-player-close"
              aria-label={t('fullscreen.collapse')}
              onClick={() => {
                flushSync(() => setPlayerOpen(false))
                reopen.current?.focus()
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </Button>
          </div>
          <Button
            variant="existing"
            className={`fullscreen-play${props.playing ? '' : ' action-accent'}`}
            aria-label={t(props.playing ? 'fullscreen.pauseMusic' : 'fullscreen.playMusic')}
            onClick={props.onToggleMusic}
          >
            {props.playing ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
              >
                <path d="M8 5v14m8-14v14" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="m8 4 12 8-12 8z" />
              </svg>
            )}
          </Button>
          <div className="fullscreen-track">
            <span>{t(props.playing ? 'fullscreen.playing' : 'fullscreen.focusMusic')}</span>
            <strong>{props.trackTitle}</strong>
          </div>
          <label className="fullscreen-volume">
            <span>
              {t('music.label')} <span>{Math.round(props.volume * 100)}%</span>
            </span>
            <input
              aria-label={t('fullscreen.volume')}
              type="range"
              min="0"
              max="1"
              step=".01"
              value={props.volume}
              onChange={(event) => props.onVolume(Number(event.target.value))}
            />
          </label>
          <PlaybackControls
            tooltipsDisabled={!playerOpen}
            fullscreen
            mode={props.mode}
            onMode={props.onMode}
            onNext={props.onNext}
          />
          {props.error && (
            <p className="fullscreen-error" role="status">
              {props.error}
            </p>
          )}
        </div>
      ) : (
        <Button
          variant="existing"
          className="fullscreen-player-reopen"
          data-fullscreen-persistent
          ref={reopen}
          aria-label={t('fullscreen.openPlayer')}
          onClick={() => {
            flushSync(() => setPlayerOpen(true))
            panelClose.current?.focus()
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M4 17V7h16v10zM8 11h8m-8 3h5" />
          </svg>
          <span>{t('fullscreen.openPlayer')}</span>
        </Button>
      )}
    </div>,
    document.body,
  )
}
