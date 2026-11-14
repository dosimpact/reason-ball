import { useTranslation } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import { useState } from 'react'
import './music-settings.css'
import MusicLibrary from './MusicLibrary'
import { MUSIC_TRACKS } from '../model/music'
import type { MusicQueue } from '../model/musicQueue'
export { default as AmbientSettings } from './AmbientMixer'
export function MusicSettings({
  selectedId,
  volume,
  onVolume,
  error,
  queue,
  onShuffle,
  category: initialCategory,
}: {
  queue: MusicQueue | null
  onShuffle: (ids: string[], criteria: string, category: string, preferredStartId?: string) => void
  selectedId: string
  volume: number
  onVolume: (volume: number) => void
  error: string
  category: string
}) {
  const { t } = useTranslation('sound')
  const [category, setCategory] = useState(initialCategory)
  const [preferredStartId, setPreferredStartId] = useState('')
  const changeCategory = (id: string) => {
    setCategory(id)
    setPreferredStartId((current) =>
      !id || MUSIC_TRACKS.some((track) => track.id === current && track.categoryId === id)
        ? current
        : '',
    )
  }
  const results = MUSIC_TRACKS.filter((track) => !category || track.categoryId === category)
  return (
    <section className="music-settings" data-testid="music-settings">
      <MusicLibrary
        selectedId={selectedId}
        category={category}
        onCategory={changeCategory}
        preferredStartId={preferredStartId}
        onPreferredStart={(id) => {
          if (results.some((track) => track.id === id))
            setPreferredStartId((current) => (current === id ? '' : id))
        }}
        queue={queue}
      />
      <label className="volume">
        <span>
          {t('music.label')}
          <span>{Math.round(volume * 100)}%</span>
        </span>
        <input
          aria-label={t('music.volume')}
          type="range"
          min="0"
          max="1"
          step=".01"
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </label>
      {error && (
        <p className="error" role="status">
          {error}
        </p>
      )}
      <div className="music-settings-footer">
        <Button
          variant="existing"
          className="primary save action-accent shuffle-play"
          disabled={!results.length}
          onClick={() =>
            onShuffle(
              results.map((track) => track.id),
              category || 'all',
              category,
              preferredStartId || undefined,
            )
          }
        >
          {t('music.playPlaylist')}
        </Button>
      </div>
    </section>
  )
}
