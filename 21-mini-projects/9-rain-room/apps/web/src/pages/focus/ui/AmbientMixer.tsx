import { useTranslation } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import { AMBIENT_SOUNDS, type AmbientId, type AmbientMix } from '../model/ambient'
import { AmbientIcon } from './SoundIcons'
import './compact-ui.css'

type Props = {
  mix: AmbientMix
  onUpdate: (id: AmbientId, patch: Partial<AmbientMix[AmbientId]>) => void
  playing: boolean
  error: string
  onToggle: () => void
}
export default function AmbientMixer({ mix, onUpdate, playing, error, onToggle }: Props) {
  const { t } = useTranslation('sound')
  const { t: catalog } = useTranslation('catalog')
  const count = AMBIENT_SOUNDS.filter((sound) => mix[sound.id].enabled).length
  return (
    <section className="ambient-mixer" data-testid="ambient-settings">
      <p className="mixer-description">{t('ambient.description')}</p>
      <div className="mixer-transport">
        <div>
          <span className="mixer-eyebrow">{t('ambient.eyebrow')}</span>
          <p role="status">
            {t('ambient.selection', {
              count,
              state: t(playing ? 'ambient.playing' : 'ambient.paused'),
            })}
          </p>
        </div>
        <Button
          variant="existing"
          type="button"
          className={`mixer-play${playing ? '' : ' action-accent'}`}
          aria-label={t(playing ? 'ambient.pauseLabel' : 'ambient.playLabel')}
          onClick={onToggle}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M5 3h3v14H5zm7 0h3v14h-3z" /> : <path d="m6 3 11 7-11 7z" />}
          </svg>
          <span>{t(playing ? 'ambient.pause' : 'ambient.play')}</span>
        </Button>
      </div>
      {error && (
        <p className="error" role="status">
          {error}
        </p>
      )}
      <div className="mixer-grid">
        {AMBIENT_SOUNDS.map((sound) => {
          const state = mix[sound.id]
          const name = catalog(`ambient.${sound.id}.name`)
          return (
            <div key={sound.id} className={`mixer-card${state.enabled ? ' is-enabled' : ''}`}>
              <label className="mixer-choice">
                <input
                  type="checkbox"
                  aria-label={name}
                  checked={state.enabled}
                  onChange={(event) => onUpdate(sound.id, { enabled: event.target.checked })}
                />
                <span className="mixer-icon">
                  <AmbientIcon id={sound.id} />
                </span>
                <span className="mixer-name">{name}</span>
                <span className="mixer-check" aria-hidden="true">
                  {state.enabled ? '✓' : '+'}
                </span>
              </label>
              {state.enabled && (
                <label className="mixer-volume">
                  <span className="mixer-volume-label">
                    {t('ambient.volume')}
                    <span>{Math.round(state.volume * 100)}%</span>
                  </span>
                  <input
                    aria-label={t('ambient.soundVolume', { name })}
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={state.volume}
                    onChange={(event) => onUpdate(sound.id, { volume: Number(event.target.value) })}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
      <p className="mixer-footnote">
        <a href="/audio/credits.txt" target="_blank" rel="noreferrer">
          {t('ambient.credits')}
        </a>
      </p>
    </section>
  )
}
