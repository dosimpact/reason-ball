import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import type { CafeOrder } from '../../model/cafeRitual'
import type { PlaybackMode } from '../../model/musicQueue'
import type { Session, Settings } from '../../model/timer'
import { FullscreenIdle } from '../../lib/fullscreenIdle'
import Cafe from '../RuntimeCafe'
import PlaybackControls from '../PlaybackControls'
import HeaderActions, { ActionIcon, type HeaderAction } from '../HeaderActions'
import '../sticky-player.css'
import '../fullscreen-player.css'
import { useSceneTransition } from './useSceneTransition'
import './room.css'

export type RoomSetting = HeaderAction | 'background' | 'return' | 'collection' | 'settings'
type SceneStatus = 'loading' | 'ready' | 'error' | 'paused'
export type ImmersiveRoomProps = {
  backgroundId: string
  backgroundName: string
  coffeeCount: number
  order: CafeOrder | null
  session: Session
  settings: Settings
  playing: boolean
  ambientPlaying: boolean
  trackTitle: string
  error: string
  blocked: boolean
  settingsOpen?: boolean
  onSceneStatus: (status: SceneStatus) => void
  onMusicToggle: () => void
  onNext: () => void
  onMode: (mode: PlaybackMode) => void
  onOpenSettings: (opener: HTMLElement, target: RoomSetting) => void
  onReorder?: () => void
  sessionActive?: boolean
  onRandomBackground: () => void
  onObjectDiscover?: (objectId: string) => void
}
function PlayerIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      {playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 4 13 8-13 8z" />}
    </svg>
  )
}
/** A room in the app's own React tree; overlays never move or duplicate the artwork. */
export default function ImmersiveRoom(props: ImmersiveRoomProps) {
  const { t, i18n } = useTranslation('ritual')
  const { t: soundText } = useTranslation('sound')
  const root = useRef<HTMLElement>(null)
  const idle = useRef<FullscreenIdle | null>(null)
  const restore = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const playerFocusRequested = useRef(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [playerOpen, setPlayerOpen] = useState(true)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [clock, setClock] = useState(() => Date.now())
  const disabled = props.blocked || Boolean(props.settingsOpen)
  const scene = useSceneTransition(props.backgroundId, props.onSceneStatus)
  const randomLock = useRef(false)
  const randomTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [randomRequested, setRandomRequested] = useState(false)
  useEffect(() => {
    if (!scene.busy) return
    randomLock.current = false
    setRandomRequested(false)
    if (randomTimer.current !== null) clearTimeout(randomTimer.current)
    randomTimer.current = null
  }, [scene.busy])
  useEffect(
    () => () => {
      if (randomTimer.current !== null) clearTimeout(randomTimer.current)
    },
    [],
  )
  const randomize = () => {
    if (disabled || scene.busy || randomLock.current) return
    randomLock.current = true
    setRandomRequested(true)
    randomTimer.current = setTimeout(() => {
      randomLock.current = false
      setRandomRequested(false)
      randomTimer.current = null
    }, 1000)
    props.onRandomBackground()
  }
  const wasBlocked = useRef(props.blocked)
  useEffect(() => {
    if (wasBlocked.current && !props.blocked && !props.settingsOpen)
      root.current?.focus({ preventScroll: true })
    wasBlocked.current = props.blocked
  }, [props.blocked, props.settingsOpen])
  const previousSession = useRef({ phase: props.session.phase, status: props.session.status })
  const [completion, setCompletion] = useState('')
  useEffect(() => {
    const before = previousSession.current
    previousSession.current = { phase: props.session.phase, status: props.session.status }
    if (before.status === 'running' && props.session.status === 'complete')
      setCompletion(
        t(
          props.session.phase === 'focus'
            ? 'room.focusCompleteAnnouncement'
            : 'room.restCompleteAnnouncement',
        ),
      )
    else if (props.session.status !== 'complete') setCompletion('')
  }, [props.session.phase, props.session.status, t])
  const seconds = Math.max(0, Math.ceil(props.session.remaining / 1000))
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  useEffect(() => {
    const controller = new FullscreenIdle((visible) => {
      if (!visible && document.activeElement?.closest('.ritual-room-header'))
        root.current?.focus({ preventScroll: true })
      setChromeVisible(visible)
    })
    idle.current = controller
    controller.reveal()
    return () => {
      controller.destroy()
      idle.current = null
    }
  }, [])
  useEffect(() => {
    if (disabled) idle.current?.hold('overlay')
    else idle.current?.release('overlay')
  }, [disabled])
  useEffect(() => {
    if (settingsExpanded) idle.current?.hold('settings-flyout')
    else idle.current?.release('settings-flyout')
  }, [settingsExpanded])
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (!playerFocusRequested.current) return
    playerFocusRequested.current = false
    ;(playerOpen ? close.current : restore.current)?.focus({ preventScroll: true })
  }, [playerOpen])
  const reveal = () => {
    if (!disabled) idle.current?.reveal()
  }
  return (
    <main
      ref={root}
      className="scene-fullscreen ritual-room"
      data-testid="immersive-room"
      data-blocked={props.blocked}
      data-phase={scene.phase}
      data-displayed-background={scene.displayedId}
      aria-label={t('room.roomLabel', { name: props.backgroundName })}
      tabIndex={-1}
      onPointerDown={(event) => {
        if (!(event.target as Element).closest('[data-scene-interactive]')) reveal()
      }}
      onKeyDown={(event) => {
        if (disabled || event.defaultPrevented) return
        if (event.key === 'Escape') {
          event.preventDefault()
          idle.current?.reveal()
          root.current?.focus({ preventScroll: true })
        } else if (event.key === 'Tab') idle.current?.reveal()
      }}
    >
      <div className="ritual-room-art" aria-busy={scene.busy}>
        <Cafe
          key={`${scene.displayedId}:${scene.generation}`}
          backgroundId={scene.displayedId}
          coffeeCount={props.coffeeCount}
          fullscreen
          paused={Boolean(props.settingsOpen)}
          interactionsEnabled={!disabled && !scene.busy && scene.displayedId === props.backgroundId}
          onObjectDiscover={props.onObjectDiscover}
          onStatus={scene.sceneStatus}
        />
        <div
          className="ritual-scene-transition"
          data-phase={scene.phase}
          data-reduced-motion={scene.reducedMotion}
          aria-hidden="true"
        />
      </div>
      {scene.timedOut && (
        <div className="pixi-render-error ritual-room-scene-recovery" role="status">
          <span>{t('room.sceneTimeout')}</span>
          <Button variant="existing" disabled={scene.busy} onClick={scene.retry}>
            {t('extras:scene.retry')}
          </Button>
        </div>
      )}
      <p
        className="ritual-room-visually-hidden ritual-room-completion"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {completion}
      </p>
      {!playerOpen && props.error && (
        <p
          id="ritual-room-folded-error"
          className="fullscreen-error ritual-room-folded-error"
          role="status"
        >
          {props.error}
        </p>
      )}
      <header
        className="fullscreen-chrome fullscreen-top ritual-room-header"
        data-visible={chromeVisible}
        aria-label={t('room.headerLabel')}
        aria-hidden={!chromeVisible}
        inert={!chromeVisible || disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerEnter={() => idle.current?.hold('pointer')}
        onPointerLeave={() => idle.current?.release('pointer')}
        onFocusCapture={() => idle.current?.hold('focus')}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            idle.current?.release('focus')
        }}
      >
        <span className="ritual-room-heading">
          <span className="ritual-room-name">{props.backgroundName}</span>
          <time
            className="text-[11px] text-app-secondary tabular-nums"
            dateTime={new Date(clock).toISOString()}
          >
            {new Intl.DateTimeFormat(i18n.resolvedLanguage || 'ko', {
              hour: '2-digit',
              minute: '2-digit',
            }).format(clock)}
          </time>
        </span>
        <div className="ritual-room-header-actions">
          <Button
            variant="existing"
            className="settings-gear grid size-11 place-items-center ritual-room-tool ritual-room-random"
            disabled={disabled || scene.busy || randomRequested}
            onClick={randomize}
            aria-label={t('room.randomBackground')}
          >
            <ActionIcon kind="random" />
          </Button>
          <HeaderActions
            triggerClassName="ritual-room-tool ritual-room-settings"
            disabled={disabled}
            closeWhen={disabled || !chromeVisible}
            onExpandedChange={setSettingsExpanded}
            onSelect={(action, opener) => props.onOpenSettings(opener, action)}
            additionalActions={[
              {
                key: 'collection',
                label: t('common:header.actions.collection.label'),
                short: t('common:header.actions.collection.short'),
                icon: 'collection',
                onSelect: (opener) => props.onOpenSettings(opener, 'collection'),
              },
              {
                key: 'background',
                label: t('common:sheets.background'),
                short: t('common:sheets.background'),
                icon: 'background',
                onSelect: (opener) => props.onOpenSettings(opener, 'background'),
              },
              {
                key: 'return',
                label: t('room.returnToCounter'),
                short: t('room.returnToCounter'),
                icon: 'coffee',
                className: 'ritual-return-counter',
                onSelect: (opener) => {
                  const active =
                    props.sessionActive ??
                    (props.session.status === 'running' || props.session.status === 'paused')
                  if (active) props.onOpenSettings(opener, 'return')
                  else props.onReorder?.()
                },
              },
            ]}
          />
        </div>
      </header>
      {playerOpen ? (
        <section
          className="fullscreen-player ritual-room-player"
          aria-label={t('room.playerLabel')}
          inert={disabled}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="fullscreen-session ritual-room-player-top">
            <Button
              variant="existing"
              className="ritual-room-player-settings"
              disabled={disabled}
              aria-label={t('room.playerSettings')}
              title={t('room.playerSettings')}
              aria-haspopup="dialog"
              onClick={(event) => props.onOpenSettings(event.currentTarget, 'settings')}
            >
              <ActionIcon kind="settings" />
            </Button>
            <div className="fullscreen-timer ritual-room-timer-row">
              <div className="ritual-room-timer-copy">
                <span className="ritual-room-phase">
                  {t(props.session.phase === 'focus' ? 'room.focus' : 'room.break')} ·{' '}
                  {t(`room.${props.session.status === 'idle' ? 'ready' : props.session.status}`)}
                </span>
                <strong
                  className="ritual-room-timer"
                  role="timer"
                  aria-label={`${t('room.remainingLabel')} ${time}`}
                >
                  {time}
                </strong>
              </div>
            </div>
            <Button
              variant="existing"
              ref={close}
              className="fullscreen-player-close ritual-room-close"
              disabled={disabled}
              aria-label={t('room.playerClose')}
              onClick={() => {
                playerFocusRequested.current = true
                setPlayerOpen(false)
              }}
            >
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m5 5 10 10M5 15 15 5" />
              </svg>
            </Button>
          </div>
          <div className="ritual-room-player-bottom">
            <div className="fullscreen-track ritual-room-track">
              <span>
                {soundText(props.playing ? 'fullscreen.playing' : 'fullscreen.focusMusic')}
              </span>
              <strong title={props.trackTitle}>{props.trackTitle}</strong>
            </div>
            <div className="ritual-room-transport">
              <div className="ritual-room-playback">
                <PlaybackControls
                  compact
                  mode={props.settings.playbackMode}
                  primaryAction={
                    <Button
                      variant="existing"
                      className="fullscreen-play ritual-room-music-toggle"
                      data-testid="room-music-toggle"
                      disabled={disabled}
                      aria-label={t(props.playing ? 'room.musicPause' : 'room.musicPlay')}
                      onClick={props.onMusicToggle}
                    >
                      <PlayerIcon playing={props.playing} />
                    </Button>
                  }
                  onMode={(mode) => {
                    if (!disabled) props.onMode(mode)
                  }}
                  onNext={() => {
                    if (!disabled) props.onNext()
                  }}
                  tooltipsDisabled={disabled}
                />
              </div>
            </div>
          </div>
          {props.error && (
            <p className="fullscreen-error ritual-room-error" role="status">
              {props.error}
            </p>
          )}
        </section>
      ) : (
        <Button
          variant="existing"
          className="fullscreen-player-reopen ritual-room-restore"
          ref={restore}
          disabled={disabled}
          aria-label={t('room.playerOpen')}
          aria-describedby={!playerOpen && props.error ? 'ritual-room-folded-error' : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            playerFocusRequested.current = true
            setPlayerOpen(true)
          }}
        >
          <PlayerIcon playing={props.playing || props.ambientPlaying} />
          <span>{t('room.playerOpen')}</span>
        </Button>
      )}
    </main>
  )
}
