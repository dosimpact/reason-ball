import { useTranslation } from '@/shared/i18n'
import { useEffect, useRef, useState } from 'react'
import { AmbientAudio } from '../lib/ambientAudio'
import { getTrack, MUSIC_TRACKS } from './music'
import { getMusicSource } from '../../../shared/audio'
import {
  advancePlayback,
  playbackQueue,
  makeMusicQueue,
  type MusicQueue,
  type PlaybackMode,
} from './musicQueue'
import { AMBIENT_SOUNDS } from './ambient'
import type { Settings } from './timer'
export function useSound(
  settings: Settings,
  onTrackChange: (id: string) => void,
  onPlaybackChange: (mode: PlaybackMode, category: string) => void,
) {
  const { t } = useTranslation('sound')
  const { t: catalog } = useTranslation('catalog')
  const playbackChange = useRef(onPlaybackChange)
  playbackChange.current = onPlaybackChange
  const modeRef = useRef(settings.playbackMode)
  const categoryRef = useRef(settings.musicCategory)
  const currentTrack = useRef(settings.track)
  const audio = useRef<HTMLAudioElement | null>(null)
  const ambience = useRef<AmbientAudio | null>(null)
  const intent = useRef(false)
  const generation = useRef(0)
  const queueRef = useRef<MusicQueue | null>(null)
  const trackChange = useRef(onTrackChange)
  trackChange.current = onTrackChange
  const [queue, setQueue] = useState<MusicQueue | null>(null)
  const updateQueue = (next: MusicQueue | null) => {
    queueRef.current = next
    setQueue(next)
  }
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [ambientPlaying, setAmbientPlaying] = useState(false)
  const [ambientError, setAmbientError] = useState('')

  useEffect(() => {
    const a = new Audio()
    a.loop = false
    a.preload = 'none'
    audio.current = a
    ambience.current = new AmbientAudio(setAmbientPlaying, setAmbientError)
    const onPlaying = () => {
      if (!intent.current) {
        a.pause()
        return
      }
      setPlaying(true)
    }
    const onPause = () => setPlaying(false)
    const onError = () => {
      if (!a.error) return
      ++generation.current
      intent.current = false
      setPlaying(false)
      setError('musicLoad')
    }
    const onEnded = () => {
      if (!intent.current || !a.ended) return
      void nextTrack(false)
    }
    a.addEventListener('ended', onEnded)
    a.addEventListener('playing', onPlaying)
    a.addEventListener('pause', onPause)
    a.addEventListener('error', onError)
    return () => {
      ++generation.current
      intent.current = false
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('playing', onPlaying)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('error', onError)
      a.pause()
      a.removeAttribute('src')
      a.load()
      ambience.current?.close()
      ambience.current = null
      audio.current = null
    }
  }, [])

  const playRequest = async (a: HTMLAudioElement, request: number) => {
    try {
      await a.play()
      if (generation.current !== request || audio.current !== a) {
        if (audio.current !== a || !intent.current) a.pause()
        return
      }
      if (!intent.current) a.pause()
      else setPlaying(!a.paused)
    } catch {
      if (generation.current !== request || audio.current !== a) return
      intent.current = false
      setPlaying(false)
      setError('musicPlay')
    }
  }
  const start = async () => {
    const a = audio.current
    if (!a) return
    const request = ++generation.current
    intent.current = true
    setError('')
    if (!a.src) a.src = getMusicSource(getTrack(settings.track).file)
    a.volume = settings.music
    await playRequest(a, request)
  }
  const stop = () => {
    ++generation.current
    intent.current = false
    audio.current?.pause()
    setPlaying(false)
  }
  const loadTrack = async (track: string, shouldPlay: boolean) => {
    const a = audio.current
    if (!a) return
    const request = ++generation.current
    setError('')
    setPlaying(false)
    a.loop = false
    a.src = getMusicSource(getTrack(track).file)
    currentTrack.current = track
    trackChange.current(track)
    if (shouldPlay) await playRequest(a, request)
  }
  const pool = () =>
    MUSIC_TRACKS.filter(
      (track) => !categoryRef.current || track.categoryId === categoryRef.current,
    ).map((track) => track.id)
  const criteria = () => categoryRef.current || 'all'
  const currentQueue = () =>
    queueRef.current ?? playbackQueue(pool(), currentTrack.current, modeRef.current, criteria())
  const nextTrack = async (manual = true) => {
    const next = advancePlayback(currentQueue(), modeRef.current, pool(), manual)
    updateQueue(next)
    await loadTrack(next.ids[next.index], intent.current)
  }
  const setMode = (mode: PlaybackMode) => {
    const current = currentTrack.current
    modeRef.current = mode
    const ids = pool()
    updateQueue(playbackQueue(ids, current, mode, criteria()))
    playbackChange.current(mode, categoryRef.current)
  }
  const shuffle = async (
    ids: string[],
    criteria: string,
    category = '',
    preferredStartId?: string,
  ) => {
    modeRef.current = 'shuffle'
    categoryRef.current = category
    playbackChange.current('shuffle', category)
    const next = makeMusicQueue(ids, criteria, Math.random, preferredStartId)
    if (!next) return
    updateQueue(next)
    intent.current = true
    await loadTrack(next.ids[0], true)
  }
  useEffect(() => {
    if (audio.current) audio.current.volume = settings.music
  }, [settings.music])
  useEffect(() => {
    void ambience.current?.sync(settings.ambient)
  }, [settings.ambient])
  // Translate at render time: changing language does not rebuild the audio engine.
  const failedAmbient = AMBIENT_SOUNDS.find((sound) => ambientError.startsWith(`${sound.name}을`))
  const ambientMessage = !ambientError
    ? ''
    : failedAmbient
      ? t('errors.ambientLoad', { name: catalog(`ambient.${failedAmbient.id}.name`) })
      : ambientError.startsWith('먼저 ')
        ? t('errors.ambientSelect')
        : ambientError.includes('Web Audio')
          ? t('errors.ambientPlay')
          : t('errors.ambientUnavailable')
  return {
    playing,
    error: error ? t(`errors.${error}`) : '',
    start,
    stop,
    queue,
    shuffle,
    next: nextTrack,
    setMode,
    ambientPlaying,
    ambientError: ambientMessage,
    startAmbient: () => ambience.current?.start(settings.ambient),
    stopAmbient: () => ambience.current?.stop(),
  }
}
