import { lazy } from 'react'
export { default as FocusPage } from './ui/FocusPage'
export const LegacyFocusPage = lazy(() => import('./ui/LegacyFocusPage'))
