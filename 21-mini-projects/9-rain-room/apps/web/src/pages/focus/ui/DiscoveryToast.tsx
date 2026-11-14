import { useTranslation, normalizeLanguage } from '@/shared/i18n'
import { SCENE_INTERACTIVE_OBJECTS } from '../model/sceneInteractiveObjects'
import './object-collection.css'
type Props = {
  notice: { objectId: string; serial: number } | null
  storageError?: boolean
  onDismiss?: () => void
}
export default function DiscoveryToast({ notice, storageError }: Props) {
  const { t, i18n } = useTranslation('collection')
  const object = notice
    ? SCENE_INTERACTIVE_OBJECTS.find((object) => object.id === notice.objectId)
    : undefined
  const language = normalizeLanguage(i18n.resolvedLanguage) ?? 'en'
  return (
    <div className="discovery-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {object && notice && (
        <div className="discovery-toast" key={notice.serial}>
          <span aria-hidden="true">✦</span>
          <div>
            <strong>{t('discovered')}</strong>
            <span>{object.label[language]}</span>
            {storageError && <small>{t('sessionOnly')}</small>}
          </div>
        </div>
      )}
    </div>
  )
}
