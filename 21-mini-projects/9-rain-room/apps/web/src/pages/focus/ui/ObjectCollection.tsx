import { useState } from 'react'
import { useTranslation, normalizeLanguage } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import { SCENE_INTERACTIVE_OBJECTS } from '../model/sceneInteractiveObjects'
import './object-collection.css'
type Props = {
  collected: Readonly<Record<string, number>>
  storageError?: boolean
  onRetry?: () => void
}
export default function ObjectCollection({ collected, storageError, onRetry }: Props) {
  const { t, i18n } = useTranslation('collection')
  const language = normalizeLanguage(i18n.resolvedLanguage) ?? 'en'
  const [filter, setFilter] = useState<'all' | 'collected' | 'locked'>('all')
  const count = SCENE_INTERACTIVE_OBJECTS.filter((object) =>
    Object.hasOwn(collected, object.id),
  ).length
  const objects = SCENE_INTERACTIVE_OBJECTS.filter(
    (object) =>
      filter === 'all' ||
      (Object.hasOwn(collected, object.id) ? filter === 'collected' : filter === 'locked'),
  )
  return (
    <section className="object-collection" aria-label={t('title')}>
      <div className="collection-summary">
        <strong>{t('progress', { count, total: SCENE_INTERACTIVE_OBJECTS.length })}</strong>
        <progress value={count} max={SCENE_INTERACTIVE_OBJECTS.length} aria-label={t('title')} />
      </div>
      {storageError && (
        <div className="collection-warning" role="status">
          {t('storageError')}
          {onRetry && (
            <Button variant="ghost" onClick={onRetry}>
              {t('retry')}
            </Button>
          )}
        </div>
      )}
      <div className="collection-filters" aria-label={t('filter')} role="group">
        {(['all', 'collected', 'locked'] as const).map((value) => (
          <Button
            key={value}
            variant="ghost"
            aria-pressed={value === filter}
            onClick={() => setFilter(value)}
          >
            {t(value)}
          </Button>
        ))}
      </div>
      <ul className="collection-grid">
        {objects.map((object) => {
          const unlocked = Object.hasOwn(collected, object.id)
          return (
            <li className="collection-card" key={object.id} data-collected={unlocked}>
              <div className="collection-art">
                {unlocked ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    width="72"
                    height="72"
                    alt=""
                    src={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${object.art.base}${object.art.subject}</svg>`)}`}
                  />
                ) : (
                  <svg
                    className="collection-lock"
                    data-collection-lock="true"
                    role="img"
                    aria-label={t('locked')}
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="5" y="10" width="14" height="11" rx="3" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                  </svg>
                )}
              </div>
              <strong>{object.label[language]}</strong>
              <span className="collection-location">
                {i18n.t(`backgrounds.${object.roomId}.name`, { ns: 'catalog' })}
              </span>
              <span className="collection-state">{t(unlocked ? 'collected' : 'locked')}</span>
            </li>
          )
        })}
      </ul>
      {objects.length === 0 && <p className="collection-empty">{t('empty')}</p>}
    </section>
  )
}
