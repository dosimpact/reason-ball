import { useState } from 'react'
import {
  APP_LANGUAGES,
  i18n,
  setAppLanguage,
  useTranslation,
  type AppLanguage,
} from '@/shared/i18n'
import './language-settings.css'
const labels: Record<AppLanguage, string> = { ko: '한국어', zh: '简体中文', en: 'English' }
export default function LanguageSettings() {
  const { t } = useTranslation('common')
  const [error, setError] = useState(false)
  return (
    <fieldset className="language-settings">
      <legend>{t('language.choose')}</legend>
      <p>{t('language.description')}</p>
      <div className="language-options">
        {APP_LANGUAGES.map((language) => (
          <label
            className="language-option"
            key={language}
            data-selected={i18n.resolvedLanguage === language}
          >
            <input
              type="radio"
              name="app-language"
              value={language}
              checked={i18n.resolvedLanguage === language}
              onChange={() =>
                void setAppLanguage(language)
                  .then((saved) => setError(!saved))
                  .catch(() => setError(true))
              }
            />
            <span lang={language === 'zh' ? 'zh-Hans' : language}>{labels[language]}</span>
            <span aria-hidden="true">{i18n.resolvedLanguage === language ? '✓' : ''}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="error" role="status">
          {t('language.storageError')}
        </p>
      )}
    </fieldset>
  )
}
