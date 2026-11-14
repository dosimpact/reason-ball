import { useTranslation } from '@/shared/i18n'
import LanguageSettings from './LanguageSettings'
import CoffeeCollection from './CoffeeCollection'
import { useCoffeeRewards } from '../model/useCoffeeRewards'
import {
  Brand,
  Card,
  Badge,
  Input,
  Progress,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/shared/ui'
import { Button } from '@/shared/ui'
import { useEffect, useRef, useState } from 'react'
import Cafe from './RuntimeCafe'
import TimerCoffee from './TimerCoffee'
import HeaderActions from './HeaderActions'
import ViewportRain from './ViewportRain'
import { getSceneWeather } from '../model/sceneWeather'
import './sticky-player.css'
import PlaybackControls from './PlaybackControls'
import SceneFullscreen from './SceneFullscreen'
import BackgroundPicker from './BackgroundPicker'
import { ALL_BACKGROUNDS, getBackground } from '../model/backgrounds'
import { AMBIENT_SOUNDS, type AmbientId } from '../model/ambient'
import { AmbientIcon } from './SoundIcons'
import MusicVolumePopover from './MusicVolumePopover'
import {
  defaults,
  fresh,
  reconfigureSession,
  pause,
  restore,
  sanitizeSettings,
  tick,
  type Session,
  type Settings,
} from '../model/timer'
import { useSound } from '../model/useSound'
import { useTimerCompletion } from '../model/useTimerCompletion'
import { getTrack } from '../model/music'
import { MusicSettings, AmbientSettings } from './SoundPanels'
const KEY = 'rain-room.v1'
function load(): {
  settings: Settings
  session: Session
  coffeeRunId?: unknown
  ritual?: unknown
  ritualMuted?: unknown
  version?: number
} {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    const settings = sanitizeSettings(value?.settings)
    return {
      settings,
      coffeeRunId: value?.coffeeRunId,
      ritual: value?.ritual,
      ritualMuted: value?.ritualMuted,
      version: value?.version,
      session: [1, 2, 3, 4].includes(value?.version)
        ? restore(value.session, settings, Date.now())
        : fresh('focus', settings),
    }
  } catch {
    return { settings: defaults, session: fresh('focus', defaults) }
  }
}
function Icon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'play' ? (
        <path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none" />
      ) : name === 'pause' ? (
        <>
          <path d="M8 5v14M16 5v14" strokeWidth="3" />
        </>
      ) : name === 'reset' ? (
        <>
          <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
        </>
      ) : name === 'clock' ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </>
      ) : name === 'sound' ? (
        <>
          <path d="m11 4-6 5H2v6h3l6 5zM15 8q5 4 0 8M18 5q8 7 0 14" />
        </>
      ) : name === 'close' ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : (
        <>
          <path d="M5 19V9l14-4v12M5 12l14-4" />
          <ellipse cx="2.8" cy="19" rx="2.5" ry="2" />
          <ellipse cx="16.8" cy="17" rx="2.5" ry="2" />
        </>
      )}
    </svg>
  )
}
export default function FocusPage() {
  const { t } = useTranslation('common')
  const [initial] = useState(load)
  const [fullscreen, setFullscreen] = useState(false)
  const [settings, setSettings] = useState(initial.settings)
  const [session, setSession] = useState(initial.session)
  const rewards = useCoffeeRewards(session, initial.coffeeRunId)
  const prepareCompletionCue = useTimerCompletion(session)
  const [sheet, setSheet] = useState<
    'time' | 'music' | 'ambient' | 'background' | 'coffee' | 'language' | null
  >(null)
  const [draft, setDraft] = useState({ focus: settings.focus, rest: settings.rest })
  const [saveError, setSaveError] = useState('')
  const sheetOpener = useRef<HTMLElement | null>(null)
  const sound = useSound(
    settings,
    (track) => setSettings((s) => ({ ...s, track })),
    (playbackMode, musicCategory) => setSettings((s) => ({ ...s, playbackMode, musicCategory })),
  )
  useEffect(() => {
    const id = window.setInterval(
      () => setSession((s) => (s.status === 'running' ? tick(s, Date.now()) : s)),
      250,
    )
    const visible = () => setSession((s) => tick(s, Date.now()))
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: initial.version === 4 ? 4 : 3,
          ...(initial.version === 4
            ? { ritual: initial.ritual, ritualMuted: initial.ritualMuted }
            : {}),
          settings,
          session,
          coffeeRunId: rewards.getRunId(),
        }),
      )
      setSaveError('')
    } catch {
      setSaveError('saveSettings')
    }
  }, [settings, session.phase, session.status, session.duration, session.deadline])
  const open = (
    kind: 'time' | 'music' | 'ambient' | 'background' | 'coffee' | 'language',
    opener?: HTMLElement,
  ) => {
    sheetOpener.current = opener ?? (document.activeElement as HTMLElement)
    setDraft({ focus: settings.focus, rest: settings.rest })
    setSheet(kind)
  }
  const act = () => {
    if (session.status === 'running') {
      setSession((s) => pause(s, Date.now()))
      return
    }
    prepareCompletionCue()
    const next =
      session.status === 'complete'
        ? fresh(session.phase === 'focus' ? 'rest' : 'focus', settings)
        : session
    setSession({ ...next, status: 'running', deadline: Date.now() + next.remaining })
    if (!sound.playing) void sound.start()
    if (!sound.ambientPlaying) void sound.startAmbient()
  }
  const randomizeBackground = () => {
    const roll = Math.random()
    setSettings((current) => {
      const choices = ALL_BACKGROUNDS.filter((room) => room.id !== current.background)
      return { ...current, background: choices[Math.floor(roll * choices.length)].id }
    })
  }
  const background = getBackground(settings.background)
  const backgroundName = t(`catalog:backgrounds.${background.id}.name`, {
    defaultValue: background.name,
  })
  const backgroundDescription = t(`catalog:backgrounds.${background.id}.description`, {
    defaultValue: background.description,
  })
  const updateAmbient = (id: AmbientId, patch: Partial<{ enabled: boolean; volume: number }>) =>
    setSettings((s) => ({ ...s, ambient: { ...s.ambient, [id]: { ...s.ambient[id], ...patch } } }))
  const seconds = Math.ceil(session.remaining / 1000)
  const label =
    session.status === 'running'
      ? t('session.pause')
      : session.status === 'paused'
        ? session.phase === 'focus'
          ? t('session.resumeFocus')
          : t('session.resumeRest')
        : session.status === 'complete'
          ? session.phase === 'focus'
            ? t('session.startRest')
            : t('session.again')
          : session.phase === 'focus'
            ? t('session.startFocus')
            : t('session.startRest')
  const progress = 1 - session.remaining / session.duration
  return (
    <div className="page focus-page">
      {sound.playing && (
        <ViewportRain
          weather={getSceneWeather(background.id)}
          obscured={Boolean(sheet) || fullscreen}
        />
      )}
      <header className="focus-header">
        <Brand label={t('app.home')} />
        <HeaderActions onSelect={(kind, opener) => open(kind, opener)} />
      </header>
      <main>
        <section className="scene-section">
          <div className="focus-intro">
            <h1 className="scene-page-title">{t('app.heading')}</h1>
            <p className="intro">{backgroundDescription}</p>
          </div>
          <div className="scene-preview">
            {!fullscreen && (
              <Cafe
                backgroundId={background.id}
                paused={Boolean(sheet)}
                coffeeCount={rewards.coffees}
              />
            )}
            <Button
              variant="existing"
              className="scene-expand"
              aria-label={t('scene.expand')}
              onClick={() => setFullscreen(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
              </svg>
              <span>{t('scene.fullscreen')}</span>
            </Button>
          </div>
          <div className="scene-bottom">
            <span className="scene-title">
              <span className="scene-name">{backgroundName}</span>
              {background.companions > 0 && (
                <span className="scene-presence">
                  <span aria-hidden="true">● ●</span> {t('scene.together')}
                </span>
              )}
            </span>
            <span className="scene-actions">
              <Button
                variant="existing"
                className="change-background"
                onClick={(event) => open('background', event.currentTarget)}
              >
                {t('scene.change')} <span aria-hidden="true">↗</span>
              </Button>
              <Button
                variant="existing"
                className="random-background"
                aria-label={t('scene.random')}
                title={t('scene.random')}
                onClick={randomizeBackground}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4" />
                </svg>
              </Button>
            </span>
          </div>
        </section>
        <section className="focus-section" aria-label={t('session.region')}>
          <Card appearance="existing" className="timer-block surface-card" data-testid="timer-card">
            <div className="phase-line">
              <div className="ticket-heading">
                <span className="ticket-label">{t('session.eyebrow')}</span>
                <span className="ticket-subtitle">
                  {session.phase === 'focus' ? t('session.focusTime') : t('session.restTime')}
                </span>
                <TimerCoffee running={session.status === 'running'} />
              </div>
              <Badge appearance="existing" className="phase-pill status-pill">
                {session.status === 'running'
                  ? t('session.running')
                  : session.status === 'paused'
                    ? t('session.paused')
                    : session.status === 'complete'
                      ? t('session.complete')
                      : t('session.ready')}
              </Badge>
            </div>
            <div
              className="timer"
              role="timer"
              aria-label={t('session.remaining', {
                minutes: Math.floor(seconds / 60),
                seconds: seconds % 60,
              })}
            >
              {String(Math.floor(seconds / 60)).padStart(2, '0')}
              <span>:</span>
              {String(seconds % 60).padStart(2, '0')}
            </div>
            <Progress
              appearance="existing"
              className="progress-track"
              value={progress * 100}
              aria-label={t('session.progress')}
            />
            <Button
              variant="existing"
              className="session-details"
              onClick={(event) => open('time', event.currentTarget)}
              aria-label={t('session.change')}
            >
              <span>
                <small>{t('session.focus')}</small>
                <strong>{t('session.minutes', { count: settings.focus })}</strong>
              </span>
              <span className="session-connector">→</span>
              <span>
                <small>{t('session.rest')}</small>
                <strong>{t('session.minutes', { count: settings.rest })}</strong>
              </span>
              <span className="session-edit">
                <Icon name="clock" /> {t('session.edit')}
              </span>
            </Button>
            <p className="timer-message" role="status">
              {session.status === 'complete'
                ? session.phase === 'focus'
                  ? t('session.messages.focusComplete')
                  : t('session.messages.restComplete')
                : session.status === 'running'
                  ? t('session.messages.running')
                  : session.status === 'paused'
                    ? t('session.messages.paused')
                    : t('session.messages.ready')}
            </p>
            <div className="timer-actions">
              <Button
                variant="existing"
                className={`primary button-primary${session.status === 'running' ? '' : ' action-accent'}`}
                onClick={act}
              >
                <Icon name={session.status === 'running' ? 'pause' : 'play'} />
                {label}
              </Button>
              <Button
                variant="existing"
                className="reset"
                aria-label={t('session.reset')}
                onClick={() => setSession(fresh(session.phase, settings))}
              >
                <Icon name="reset" />
              </Button>
            </div>
          </Card>
          <PlaybackControls
            tooltipsDisabled={Boolean(sheet)}
            mode={settings.playbackMode}
            onMode={sound.setMode}
            onNext={() => void sound.next()}
            hidden={fullscreen}
          />
          <div
            className="now-playing"
            role="region"
            aria-label={t('player.region')}
            hidden={fullscreen}
          >
            <Button
              variant="existing"
              className={`music-toggle ${sound.playing ? 'is-playing' : 'action-accent'}`}
              aria-label={sound.playing ? t('player.pause') : t('player.play')}
              onClick={() => (sound.playing ? sound.stop() : void sound.start())}
            >
              <Icon name={sound.playing ? 'pause' : 'play'} />
            </Button>
            <Button
              variant="existing"
              className="track-info"
              onClick={(event) => open('music', event.currentTarget)}
            >
              <span className="track-label">
                {sound.playing ? t('player.playing') : t('player.focusMusic')}
              </span>
              <strong>{getTrack(settings.track).title}</strong>
            </Button>
            <div className={`equalizer ${sound.playing ? 'active' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <MusicVolumePopover
              volume={settings.music}
              onVolume={(music) => setSettings((current) => ({ ...current, music }))}
              dismiss={Boolean(sheet) || fullscreen}
            />
          </div>
          <Button
            variant="existing"
            className="ambient-summary"
            onClick={(event) => open('ambient', event.currentTarget)}
          >
            <span>
              {sound.ambientPlaying ? t('player.ambientPlaying') : t('player.ambientMixer')}
            </span>
            <span className="ambient-summary-sounds">
              {AMBIENT_SOUNDS.some((item) => settings.ambient[item.id].enabled) ? (
                AMBIENT_SOUNDS.filter((item) => settings.ambient[item.id].enabled).map((item) => (
                  <span className="ambient-summary-pill" key={item.id}>
                    <AmbientIcon id={item.id} />
                    <span>{t(`catalog:ambient.${item.id}.name`, { defaultValue: item.name })}</span>
                  </span>
                ))
              ) : (
                <span className="ambient-summary-empty">{t('player.chooseSounds')}</span>
              )}
              <span className="ambient-summary-arrow" aria-hidden="true">
                ↗
              </span>
            </span>
          </Button>
          {(sound.error || sound.ambientError || saveError) && (
            <p className="error" role="status">
              {sound.error || sound.ambientError || (saveError ? t('errors.saveSettings') : '')}
            </p>
          )}
        </section>
      </main>
      <footer>
        <span>Rain Room</span>
        <span>{t('app.footer')}</span>
      </footer>
      <Dialog
        open={sheet !== null}
        onOpenChange={(value) => {
          if (!value) setSheet(null)
        }}
      >
        <DialogContent
          appearance="existing"
          className="settings-dialog"
          aria-modal="true"
          overlayClassName="settings-overlay"
          showCloseButton={false}
          aria-labelledby="sheet-title"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            sheetOpener.current?.focus({ preventScroll: true })
          }}
        >
          <div className="sheet">
            <div className="sheet-header">
              <div>
                <DialogTitle appearance="existing" id="sheet-title">
                  {sheet === 'language'
                    ? t('language.title')
                    : sheet === 'time'
                      ? t('sheets.time')
                      : sheet === 'background'
                        ? t('sheets.background')
                        : sheet === 'music'
                          ? t('sheets.music')
                          : sheet === 'coffee'
                            ? t('sheets.coffee')
                            : t('player.ambientMixer')}
                </DialogTitle>
              </div>
              <DialogClose asChild>
                <Button variant="existing" aria-label={t('sheets.close')} className="close">
                  <Icon name="close" />
                </Button>
              </DialogClose>
            </div>
            {sheet === 'language' ? (
              <LanguageSettings />
            ) : sheet === 'coffee' ? (
              <CoffeeCollection
                available={rewards.available}
                coffees={rewards.coffees}
                remainderMs={rewards.remainderMs}
                notice={rewards.notice}
                error={rewards.error}
              />
            ) : sheet === 'background' ? (
              <BackgroundPicker
                selectedId={settings.background}
                onSelect={(id) => {
                  setSettings((s) => ({ ...s, background: id }))
                  setSheet(null)
                }}
              />
            ) : sheet === 'time' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const next = sanitizeSettings({ ...settings, ...draft })
                  setSession((current) => reconfigureSession(current, settings, next, Date.now()))
                  setSettings(next)
                  setSheet(null)
                }}
              >
                <p className="sheet-description">
                  {t('time.description1')}
                  <br />
                  {t('time.description2')}
                </p>
                {(['focus', 'rest'] as const).map((kind) => (
                  <fieldset key={kind}>
                    <legend>{kind === 'focus' ? t('time.focus') : t('time.rest')}</legend>
                    <div className="presets">
                      {(kind === 'focus' ? [15, 25, 35, 50] : [5, 10, 15]).map((n) => (
                        <Button
                          variant="existing"
                          type="button"
                          key={n}
                          className={draft[kind] === n ? 'selected' : ''}
                          aria-pressed={draft[kind] === n}
                          onClick={() => setDraft((d) => ({ ...d, [kind]: n }))}
                        >
                          {t('session.minutes', { count: n })}
                        </Button>
                      ))}
                    </div>
                    <label className="custom-time">
                      {t('time.custom')}{' '}
                      <span>
                        <Input
                          appearance="existing"
                          aria-label={
                            kind === 'focus' ? t('time.focusCustom') : t('time.restCustom')
                          }
                          type="number"
                          min="1"
                          max={kind === 'focus' ? 180 : 60}
                          required
                          value={draft[kind] || ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [kind]: Number(e.target.value) }))
                          }
                        />{' '}
                        {t('session.unitMinute')}
                      </span>
                    </label>
                  </fieldset>
                ))}
                <Button variant="existing" className="primary save" type="submit">
                  {t('time.save')}
                </Button>
              </form>
            ) : sheet === 'music' ? (
              <MusicSettings
                queue={sound.queue}
                category={settings.musicCategory}
                onShuffle={(ids, criteria, category, preferredStartId) => {
                  void sound.shuffle(ids, criteria, category, preferredStartId)
                }}
                selectedId={settings.track}
                volume={settings.music}
                onVolume={(music) => setSettings((s) => ({ ...s, music }))}
                error={sound.error}
              />
            ) : sheet === 'ambient' ? (
              <AmbientSettings
                mix={settings.ambient}
                onUpdate={updateAmbient}
                playing={sound.ambientPlaying}
                error={sound.ambientError}
                onToggle={() =>
                  sound.ambientPlaying ? sound.stopAmbient() : void sound.startAmbient()
                }
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      {fullscreen && (
        <SceneFullscreen
          backgroundId={background.id}
          coffeeCount={rewards.coffees}
          backgroundName={backgroundName}
          mode={settings.playbackMode}
          onMode={sound.setMode}
          onNext={() => void sound.next()}
          trackTitle={getTrack(settings.track).title}
          playing={sound.playing}
          volume={settings.music}
          phase={session.phase}
          status={session.status}
          timerText={`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}
          error={sound.error}
          onToggleMusic={() => (sound.playing ? sound.stop() : void sound.start())}
          onVolume={(music) => setSettings((s) => ({ ...s, music }))}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  )
}
