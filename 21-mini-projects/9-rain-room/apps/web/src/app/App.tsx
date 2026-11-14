import '@/shared/i18n'
import { Suspense } from 'react'
import { FocusPage, LegacyFocusPage } from '../pages/focus'
import { DesignSystemPage } from '../pages/design-system'

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '')
  if (path === '/design-system') return <DesignSystemPage />
  if (
    path === '/legacy' ||
    new URLSearchParams(window.location.search).get('experience') === 'legacy' ||
    new URLSearchParams(window.location.search).get('renderer') === 'legacy'
  )
    return (
      <Suspense fallback={<div className="legacy-loading">Rain Room</div>}>
        <LegacyFocusPage />
      </Suspense>
    )
  return <FocusPage />
}
