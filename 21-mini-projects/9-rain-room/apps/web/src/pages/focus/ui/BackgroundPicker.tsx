import { Button } from '@/shared/ui'
import { useTranslation } from '@/shared/i18n'
import { useState } from 'react'
import Cafe from './RuntimeCafe'
import {
  ALL_BACKGROUNDS,
  BACKGROUND_CATEGORIES,
  getBackground,
  type BackgroundCategory,
} from '../model/backgrounds'
import './backgrounds.css'
import './premium-picker.css'
import { getPremiumSpace } from '../model/premiumSpaces'

export default function BackgroundPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('catalog')
  const [category, setCategory] = useState<BackgroundCategory>(
    () => getBackground(selectedId).category,
  )
  const rarityRank = (id: string) => {
    const rarity = getPremiumSpace(id)?.rarity
    return rarity === 'legendary' ? 2 : rarity === 'epic' ? 1 : 0
  }
  const backgrounds = ALL_BACKGROUNDS.filter((background) => background.category === category).sort(
    (a, b) => rarityRank(a.id) - rarityRank(b.id),
  )
  return (
    <div className="background-picker">
      <div className="background-categories" role="group" aria-label={t('picker.categoryLabel')}>
        {BACKGROUND_CATEGORIES.map((item) => (
          <Button
            variant="existing"
            type="button"
            key={item.id}
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
          >
            {t(`backgroundCategories.${item.id}`)}
          </Button>
        ))}
      </div>
      <p className="background-count" aria-live="polite">
        {t('picker.count', { count: backgrounds.length })}
      </p>
      <div className="background-grid">
        {backgrounds.map((background) => (
          <Button
            variant="existing"
            className="background-card"
            data-rarity={getPremiumSpace(background.id)?.rarity}
            key={background.id}
            type="button"
            aria-label={t('picker.select', { name: t(`backgrounds.${background.id}.name`) })}
            aria-pressed={selectedId === background.id}
            onClick={() => onSelect(background.id)}
          >
            <span className="background-preview">
              <Cafe backgroundId={background.id} thumbnail />
              {selectedId === background.id && (
                <span className="background-selected" aria-hidden="true">
                  ✓
                </span>
              )}
            </span>
            <span className="background-card-name">{t(`backgrounds.${background.id}.name`)}</span>
            <span className="background-card-meta">
              <span className="background-card-category">
                {t(`backgroundCategories.${background.category}`)}
              </span>
              {background.companions > 0 && (
                <span className="background-card-presence">
                  <span aria-hidden="true">● ●</span> {t('picker.presence')}
                </span>
              )}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
