import { defaultAmbient, sanitizeAmbient, type AmbientMix } from './ambient.ts'
import { sanitizePlaybackMode, type PlaybackMode } from './musicQueue.ts'
import { DEFAULT_TRACK_ID, resolveTrackId, MUSIC_CATEGORIES } from './music.ts'
import { getBackground } from './backgrounds.ts'
export type Settings = {
  focus: number
  rest: number
  track: string
  playbackMode: PlaybackMode
  musicCategory: string
  music: number
  background: string
  ambient: AmbientMix
}
export type Session = {
  phase: 'focus' | 'rest'
  status: 'idle' | 'running' | 'paused' | 'complete'
  remaining: number
  duration: number
  deadline: number | null
}
export const defaults: Settings = {
  focus: 35,
  rest: 5,
  track: DEFAULT_TRACK_ID,
  playbackMode: 'repeat-one',
  musicCategory: '',
  music: 0.65,
  background: 'cafe-rain',
  ambient: defaultAmbient(),
}
export const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
export function sanitizeSettings(input: unknown = {}): Settings {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    focus: Math.round(bounded(value.focus, 1, 180, 35)),
    rest: Math.round(bounded(value.rest, 1, 60, 5)),
    track: resolveTrackId(value.track),
    playbackMode: sanitizePlaybackMode(value.playbackMode),
    musicCategory: MUSIC_CATEGORIES.some((category) => category.id === value.musicCategory)
      ? (value.musicCategory as string)
      : '',
    music: bounded(value.music, 0, 1, 0.65),
    background: getBackground(typeof value.background === 'string' ? value.background : undefined)
      .id,
    ambient: sanitizeAmbient(value.ambient, value.rain),
  }
}
export const fresh = (phase: Session['phase'], settings: Settings): Session => ({
  phase,
  status: 'idle',
  remaining: settings[phase] * 60000,
  duration: settings[phase] * 60000,
  deadline: null,
})
export function tick(session: Session, now: number): Session {
  if (session.status !== 'running' || session.deadline === null) return session
  const remaining = Math.max(0, session.deadline - now)
  return {
    ...session,
    remaining,
    status: remaining === 0 ? 'complete' : 'running',
    deadline: remaining === 0 ? null : session.deadline,
  }
}
export function pause(session: Session, now: number): Session {
  const current = tick(session, now)
  return current.status === 'running' ? { ...current, status: 'paused', deadline: null } : current
}
export function restore(raw: unknown, settings: Settings, now: number): Session {
  const s = raw as Session | null
  if (
    !s ||
    !['focus', 'rest'].includes(s.phase) ||
    !['idle', 'running', 'paused', 'complete'].includes(s.status) ||
    !Number.isFinite(s.duration) ||
    s.duration < 60000 ||
    s.duration > 10800000 ||
    !Number.isFinite(s.remaining) ||
    s.remaining < 0 ||
    s.remaining > s.duration ||
    (s.status === 'running' && (typeof s.deadline !== 'number' || !Number.isFinite(s.deadline)))
  )
    return fresh('focus', settings)
  return tick(
    {
      phase: s.phase,
      status: s.status,
      remaining: s.remaining,
      duration: s.duration,
      deadline: s.status === 'running' ? s.deadline : null,
    },
    now,
  )
}

/** Apply a changed focus/rest preference immediately to the current phase. */
export function reconfigureSession(
  session: Session,
  previous: Pick<Settings, 'focus' | 'rest'>,
  next: Settings,
  now: number,
): Session {
  if (previous.focus === next.focus && previous.rest === next.rest) return session
  const reset = fresh(session.phase, next)
  if (session.status === 'running')
    return { ...reset, status: 'running', deadline: now + reset.duration }
  if (session.status === 'paused') return { ...reset, status: 'paused' }
  return reset
}
