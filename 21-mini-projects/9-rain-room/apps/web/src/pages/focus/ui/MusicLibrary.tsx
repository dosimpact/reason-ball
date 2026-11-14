import { useTranslation } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import { getTrack, MUSIC_CATEGORIES, MUSIC_TRACKS } from '../model/music'
import type { MusicQueue } from '../model/musicQueue'
import { ScrollTrackList } from '../../../shared/ui'
type Props = {
  selectedId: string
  category: string
  onCategory: (id: string) => void
  preferredStartId: string
  onPreferredStart: (id: string) => void
  queue: MusicQueue | null
}
export default function MusicLibrary({
  selectedId,
  category,
  onCategory,
  queue,
  preferredStartId,
  onPreferredStart,
}: Props) {
  const { t } = useTranslation('sound')
  const { t: catalog, i18n } = useTranslation('catalog')
  // New queues store stable category IDs; accept older localized labels without
  // changing their track order when the display language changes.
  const matchesLegacy = (id: string, criteria: string) =>
    ['ko', 'en', 'zh'].some(
      (language) => i18n.getResource(language, 'catalog', `musicCategories.${id}`) === criteria,
    )
  const queueCategory = queue
    ? (MUSIC_CATEGORIES.find(
        (item) =>
          item.id === queue.criteria ||
          item.name === queue.criteria ||
          matchesLegacy(item.id, queue.criteria),
      )?.id ??
      (queue.criteria === 'all' || queue.criteria === '전체' || matchesLegacy('all', queue.criteria)
        ? ''
        : null))
    : null
  const activeOrder = Boolean(queue) && queueCategory === category
  const tracks = activeOrder
    ? queue!.ids.map(getTrack).filter((track) => !category || track.categoryId === category)
    : MUSIC_TRACKS.filter((track) => !category || track.categoryId === category)
  return (
    <section className="music-library" aria-label={t('library.label')}>
      <div className="music-categories" role="group" aria-label={t('library.categories')}>
        {[{ id: '' }, ...MUSIC_CATEGORIES].map((item) => (
          <Button
            variant="existing"
            key={item.id}
            aria-pressed={category === item.id}
            onClick={() => onCategory(item.id)}
          >
            {catalog(`musicCategories.${item.id || 'all'}`)}
          </Button>
        ))}
      </div>
      <div className="library-heading">
        <h3>{t('library.heading')}</h3>
        <span>{t('library.trackCount', { count: tracks.length })}</span>
      </div>
      <section data-testid="music-playlist" data-order={activeOrder ? 'queue' : 'catalog'}>
        <ScrollTrackList label={t('library.trackList')}>
          <ol className="music-playlist" role="list">
            {tracks.map((track, index) => (
              <li
                key={track.id}
                className="playlist-track-row"
                data-track-id={track.id}
                aria-current={track.id === selectedId ? 'true' : undefined}
              >
                <Button
                  variant="existing"
                  className="playlist-track"
                  aria-label={t('library.selectFirst', { title: track.title })}
                  aria-pressed={track.id === preferredStartId}
                  onClick={() => onPreferredStart(track.id)}
                >
                  <span className="queue-position" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="library-track-copy">
                    <strong>{track.title}</strong>
                    <small>
                      {track.id === preferredStartId
                        ? track.id === selectedId
                          ? t('library.firstCurrent')
                          : t('library.firstSelected')
                        : track.id === selectedId
                          ? t('library.current')
                          : activeOrder && track.id === queue!.ids[queue!.index + 1]
                            ? t('library.next')
                            : catalog(`musicCategories.${track.categoryId}`)}
                    </small>
                  </span>
                  {track.id === preferredStartId && (
                    <span className="playlist-first-mark" aria-hidden="true">
                      {t('library.firstBadge')}
                    </span>
                  )}
                </Button>
              </li>
            ))}
          </ol>
        </ScrollTrackList>
      </section>
    </section>
  )
}
