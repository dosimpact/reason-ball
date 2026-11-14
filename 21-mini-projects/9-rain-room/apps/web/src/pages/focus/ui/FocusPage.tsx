import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/shared/i18n'
import { getBackground, ALL_BACKGROUNDS } from '../model/backgrounds'
import { getTrack } from '../model/music'
import {
  fresh,
  tick,
  sanitizeSettings,
  reconfigureSession,
  type Settings,
  type Session,
} from '../model/timer'
import { useSound } from '../model/useSound'
import { useCoffeeRewards } from '../model/useCoffeeRewards'
import { useTimerCompletion } from '../model/useTimerCompletion'
import { useObjectCollection } from '../model/useObjectCollection'
import { getSceneInteractiveObject } from '../model/sceneInteractiveObjects'
import {
  createRitualState,
  ritualReducer,
  type RitualState,
  type RitualEvent,
  type DrinkId,
} from '../model/cafeRitual'
import { RitualAudio } from '../lib/ritualAudio'
import { PAPER_FEED_CUE_TIMES_MS } from '../lib/receiptPaper'
import { installExperienceViewport } from '../lib/experienceViewport'
import KioskExperience, { SeatingTransition } from './ritual/KioskExperience'
import ImmersiveRoom from './ritual/ImmersiveRoom'
import CouponExperience, { DepartureTransition } from './ritual/CouponExperience'
import RitualSettings, { type RitualSheet } from './ritual/RitualSettings'
import ObjectCollection from './ObjectCollection'
import DiscoveryToast from './DiscoveryToast'
import type { AmbientId } from '../model/ambient'
import './ritual/experience.css'

const KEY = 'rain-room.v1'
type AppSession = { settings: Settings; session: Session; ritual: RitualState; muted: boolean }
function load(): AppSession & { coffeeRunId?: unknown } {
  let saved: Record<string, unknown> | null = null
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {}
  const settings = sanitizeSettings(saved?.settings)
  // Every app entry starts a new café visit. Keep preferences and earned coffee,
  // but never resume the previous countdown while the order screen is visible.
  const session = fresh('focus', settings)
  return {
    settings,
    session,
    ritual: createRitualState(saved?.ritual, session),
    muted: saved?.ritualMuted === true,
    coffeeRunId: saved?.coffeeRunId,
  }
}
export default function FocusPage() {
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation(['ritual', 'common', 'catalog'])
  const viewport = useRef<HTMLDivElement>(null)
  const [initial] = useState(load)
  const [app, setApp] = useState<AppSession>(initial)
  const latest = useRef(app)
  latest.current = app
  const { settings, session, ritual, muted } = app
  const [sheet, setSheet] = useState<RitualSheet | null>(null)
  const [customTimeOpen, setCustomTimeOpen] = useState(false)
  const modalOpen = Boolean(sheet) || customTimeOpen
  const currentSheet = useRef(sheet)
  currentSheet.current = sheet
  const currentCustomTimeOpen = useRef(customTimeOpen)
  currentCustomTimeOpen.current = customTimeOpen
  const programmaticBacks = useRef(0)
  const sheetClosedByBack = useRef(false)
  const opener = useRef<HTMLElement | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [sceneError, setSceneError] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [transitionDone, setTransitionDone] = useState(false)
  const entering = useRef(false)
  const seatingRequested = useRef(false)
  const cue = useRef<RitualAudio | null>(null)
  const [completedVisit, setCompletedVisit] = useState<{
    runId: string | null
    focusMs: number
  } | null>(null)
  const rewards = useCoffeeRewards(session, initial.coffeeRunId)
  const completionCue = useTimerCompletion(session)
  const discoveries = useObjectCollection()
  const discoverObject = useCallback(
    (id: string) => {
      const current = latest.current
      const object = getSceneInteractiveObject(id)
      if (current.ritual.stage !== 'room' || object?.roomId !== current.settings.background) return
      discoveries.discover(id)
    },
    [discoveries.discover],
  )
  const patchSettings = useCallback(
    (patch: Partial<Settings>) =>
      setApp((current) => ({
        ...current,
        settings: sanitizeSettings({ ...current.settings, ...patch }),
      })),
    [],
  )
  const sound = useSound(
    settings,
    (track) => patchSettings({ track }),
    (playbackMode, musicCategory) => patchSettings({ playbackMode, musicCategory }),
  )
  const transport = useRef(sound)
  transport.current = sound
  const dispatch = useCallback(
    (event: RitualEvent) =>
      setApp((current) => ({ ...current, ritual: ritualReducer(current.ritual, event) })),
    [],
  )
  useEffect(() => {
    const element = viewport.current
    if (element) return installExperienceViewport(element)
  }, [])
  useEffect(() => {
    const audio = new RitualAudio()
    cue.current = audio
    audio.setMuted(latest.current.muted)
    return () => {
      audio.dispose()
      if (cue.current === audio) cue.current = null
    }
  }, [])
  useEffect(() => cue.current?.setMuted(muted), [muted])
  useEffect(() => {
    const id = window.setInterval(
      () =>
        setApp((current) =>
          current.session.status === 'running'
            ? { ...current, session: tick(current.session, Date.now()) }
            : current,
        ),
      250,
    )
    const visible = () =>
      setApp((current) => ({ ...current, session: tick(current.session, Date.now()) }))
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 4,
          settings,
          session,
          ritual,
          ritualMuted: muted,
          coffeeRunId: rewards.getRunId(),
        }),
      )
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [settings, session.phase, session.status, session.duration, session.deadline, ritual, muted])
  useEffect(() => {
    if (ritual.stage !== 'printing') return
    const audio = cue.current
    if (!audio) return
    const play = () => {
      void audio.printWhenReady(Boolean(reducedMotion))
    }
    const timers = reducedMotion
      ? []
      : PAPER_FEED_CUE_TIMES_MS.map((delay) => window.setTimeout(play, delay))
    if (reducedMotion) play()
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      audio.cancelPrint()
    }
  }, [ritual.stage, reducedMotion])
  const prepareCue = () => {
    const audio = cue.current
    audio?.setMuted(latest.current.muted)
    void audio?.unlock()
  }
  const toggleCueMute = () => {
    const next = !latest.current.muted
    cue.current?.setMuted(next)
    if (!next) void cue.current?.unlock()
    setApp((current) => ({ ...current, muted: next }))
  }
  const failEntry = useCallback(() => {
    if (latest.current.ritual.stage !== 'seating') return
    seatingRequested.current = false
    transport.current.stop()
    transport.current.stopAmbient()
    entering.current = false
    setSceneError(true)
    setSceneReady(false)
    setTransitionDone(false)
    dispatch({ type: 'fail' })
  }, [dispatch])
  useEffect(() => {
    if (ritual.stage !== 'seating') return
    const id = window.setTimeout(failEntry, 15000)
    return () => window.clearTimeout(id)
  }, [ritual.stage, failEntry])
  const onSceneStatus = useCallback(
    (status: 'loading' | 'ready' | 'error' | 'paused') => {
      if (latest.current.ritual.stage !== 'seating') return
      if (status === 'error') failEntry()
      else setSceneReady(status === 'ready')
    },
    [failEntry],
  )
  useEffect(() => {
    if (ritual.stage !== 'seating' || !sceneReady || !transitionDone || entering.current) return
    entering.current = true
    setApp((current) => {
      if (current.ritual.stage !== 'seating') return current
      const next = fresh('focus', current.settings)
      return {
        ...current,
        ritual: ritualReducer(current.ritual, { type: 'ready' }),
        session: { ...next, status: 'running', deadline: Date.now() + next.remaining },
      }
    })
  }, [ritual.stage, sceneReady, transitionDone])
  useEffect(() => {
    if (ritual.stage !== 'room' || session.phase !== 'focus' || session.status !== 'complete')
      return
    transport.current.stop()
    transport.current.stopAmbient()
    setSheet(null)
    setCustomTimeOpen(false)
    setCompletedVisit({ runId: rewards.getRunId(), focusMs: session.duration })
    dispatch({ type: 'finish' })
  }, [ritual.stage, session.phase, session.status])
  const openSettings = useCallback((element: HTMLElement, target: RitualSheet) => {
    opener.current = element
    setSheet(target)
  }, [])
  // Keep the listener alive between sheets so our own asynchronous history.back()
  // cannot dismiss a new sheet opened immediately after the previous one closes.
  useEffect(() => {
    const back = () => {
      if (programmaticBacks.current > 0) {
        programmaticBacks.current--
        return
      }
      if (currentSheet.current || currentCustomTimeOpen.current) {
        sheetClosedByBack.current = true
        setSheet(null)
        setCustomTimeOpen(false)
      }
    }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  useEffect(() => {
    if (!modalOpen) return
    sheetClosedByBack.current = false
    window.history.pushState({ ...window.history.state, rainRoomSheet: true }, '')
    return () => {
      if (!sheetClosedByBack.current && window.history.state?.rainRoomSheet) {
        programmaticBacks.current++
        window.history.back()
      }
    }
  }, [modalOpen])
  const order = () => {
    if (latest.current.ritual.stage !== 'checkout') return
    void cue.current?.unlock()
    const current = latest.current.ritual
    dispatch({
      type: 'order',
      order: {
        id:
          typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : `rr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        drinkId: current.drinkId,
        temperature: current.temperature,
        createdAt: Date.now(),
      },
    })
    setSceneError(false)
  }
  const seat = () => {
    if (latest.current.ritual.stage !== 'receipt' || seatingRequested.current) return
    seatingRequested.current = true
    // Native playback/resume must execute inside the trusted seat gesture, before GPU awaits.
    void transport.current.start()
    void transport.current.startAmbient()
    completionCue()
    void cue.current?.unlock()
    cue.current?.cup()
    entering.current = false
    setSceneError(false)
    setSceneReady(false)
    setTransitionDone(false)
    dispatch({ type: 'seat' })
  }
  const reorder = () => {
    setCompletedVisit(null)
    seatingRequested.current = false
    sound.stop()
    sound.stopAmbient()
    setSheet(null)
    entering.current = false
    setSceneReady(false)
    setTransitionDone(false)
    setSceneError(false)
    setApp((current) => ({
      ...current,
      session: fresh('focus', current.settings),
      ritual: ritualReducer(current.ritual, { type: 'reorder' }),
    }))
  }
  const setTime = (focus: number, rest: number) => {
    setApp((current) => {
      const next = sanitizeSettings({ ...current.settings, focus, rest })
      return {
        ...current,
        settings: next,
        session: reconfigureSession(current.session, current.settings, next, Date.now()),
      }
    })
    setSheet(null)
  }
  const randomize = () => {
    const choices = ALL_BACKGROUNDS.filter((room) => room.id !== settings.background)
    patchSettings({ background: choices[Math.floor(Math.random() * choices.length)].id })
  }
  const background = getBackground(settings.background)
  const backgroundName = t(`catalog:backgrounds.${background.id}.name`)
  const inRoom = ritual.stage === 'seating' || ritual.stage === 'room' || ritual.stage === 'leaving'
  const completion = rewards.getCompletion(completedVisit?.runId ?? null)
  const startRest = () => {
    if (latest.current.ritual.stage !== 'coupon' || !completion || rewards.error) return
    setApp((current) => {
      if (current.ritual.stage !== 'coupon') return current
      const rest = fresh('rest', current.settings)
      return {
        ...current,
        ritual: ritualReducer(current.ritual, { type: 'startrest' }),
        session: { ...rest, status: 'running', deadline: Date.now() + rest.duration },
      }
    })
  }
  const error =
    sound.error || sound.ambientError || (saveFailed ? t('common:errors.saveSettings') : '')
  return (
    <div
      ref={viewport}
      onPointerDownCapture={prepareCue}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter' || event.key === ' ') prepareCue()
      }}
      className="rain-room-experience"
      data-testid="rain-room-experience"
      data-stage={ritual.stage}
    >
      {inRoom ? (
        <ImmersiveRoom
          backgroundId={background.id}
          backgroundName={backgroundName}
          coffeeCount={rewards.coffees}
          order={ritual.order}
          session={session}
          settings={settings}
          playing={sound.playing}
          ambientPlaying={sound.ambientPlaying}
          trackTitle={getTrack(settings.track).title}
          error={error}
          blocked={ritual.stage === 'seating' || ritual.stage === 'leaving'}
          settingsOpen={Boolean(sheet)}
          onSceneStatus={onSceneStatus}
          onMusicToggle={() => (sound.playing ? sound.stop() : void sound.start())}
          onNext={() => void sound.next()}
          onMode={sound.setMode}
          onOpenSettings={openSettings}
          onReorder={reorder}
          sessionActive={session.status === 'running' || session.status === 'paused'}
          onRandomBackground={randomize}
          onObjectDiscover={discoverObject}
        />
      ) : ritual.stage === 'coupon' || ritual.stage === 'break' ? (
        <CouponExperience
          drinkId={ritual.drinkId}
          focusMs={completion?.focusMs ?? completedVisit?.focusMs ?? 0}
          earned={completion?.earned ?? 0}
          totalCoupons={rewards.coffees}
          remainderMs={rewards.remainderMs}
          confirmed={Boolean(completion)}
          error={rewards.error}
          phase={ritual.stage === 'break' ? 'rest' : 'coupon'}
          restRemaining={session.phase === 'rest' ? session.remaining : settings.rest * 60000}
          restComplete={session.phase === 'rest' && session.status === 'complete'}
          restMinutes={settings.rest}
          onRetry={rewards.retry}
          onRest={startRest}
          onReturn={reorder}
        />
      ) : (
        <KioskExperience
          state={ritual}
          focus={settings.focus}
          rest={settings.rest}
          backgroundName={backgroundName}
          onSelectDrink={(drinkId: DrinkId) => dispatch({ type: 'selectdrink', drinkId })}
          onCheckout={() => dispatch({ type: 'checkout' })}
          onBack={() => dispatch({ type: 'back' })}
          onOrder={order}
          onPrinted={() => dispatch({ type: 'printed' })}
          onTimeChange={(kind, minutes) => patchSettings({ [kind]: minutes })}
          customTimeOpen={customTimeOpen}
          onCustomTimeOpenChange={setCustomTimeOpen}
          onCustomTimeApply={(focus, rest) => {
            patchSettings({ focus, rest })
            setCustomTimeOpen(false)
          }}
          onSeat={seat}
          error={
            sceneError ? t('room.loadError') : saveFailed ? t('common:errors.saveSettings') : ''
          }
          muted={muted}
          onMute={toggleCueMute}
          onLanguage={() => {
            opener.current = document.activeElement as HTMLElement
            setSheet('language')
          }}
        />
      )}
      {ritual.stage === 'leaving' && (
        <DepartureTransition onComplete={() => dispatch({ type: 'left' })} />
      )}
      {ritual.stage === 'seating' && (
        <SeatingTransition
          drinkId={ritual.drinkId}
          temperature={ritual.temperature}
          ready={sceneReady}
          onComplete={() => setTransitionDone(true)}
        />
      )}
      <RitualSettings
        sheet={sheet}
        onSheet={setSheet}
        opener={opener.current}
        settings={settings}
        sound={sound}
        rewards={rewards}
        onSettings={patchSettings}
        onTime={setTime}
        onAmbient={(id: AmbientId, patch) =>
          patchSettings({
            ambient: { ...settings.ambient, [id]: { ...settings.ambient[id], ...patch } },
          })
        }
        onReorder={reorder}
        sessionActive={session.status === 'running' || session.status === 'paused'}
        collection={
          <ObjectCollection
            collected={discoveries.collected}
            storageError={discoveries.storageError}
            onRetry={discoveries.retrySave}
          />
        }
      />
      <DiscoveryToast
        notice={ritual.stage === 'room' ? discoveries.notice : null}
        storageError={discoveries.storageError}
      />
    </div>
  )
}
