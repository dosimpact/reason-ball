import { useTranslation } from '@/shared/i18n'
import { Button } from '@/shared/ui'
import { useEffect, useId, useRef, useState } from 'react'
import './header-actions.css'
export type HeaderAction = 'time' | 'music' | 'ambient' | 'coffee' | 'language'
type Action = HeaderAction
const actions: Action[] = ['time', 'music', 'ambient', 'coffee', 'language']
export function ActionIcon({
  kind,
}: {
  kind: Action | 'settings' | 'background' | 'random' | 'collection'
}) {
  return (
    <svg
      className="size-5"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'settings' ? (
        <>
          <path d="m9.7 3-.6 2.1-1.8 1-2.1-.5L3 9.4l1.5 1.6v2L3 14.6l2.2 3.8 2.1-.5 1.8 1 .6 2.1h4.6l.6-2.1 1.8-1 2.1.5 2.2-3.8-1.5-1.6v-2L21 9.4l-2.2-3.8-2.1.5-1.8-1-.6-2.1z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : kind === 'random' ? (
        <>
          <path d="M10 20H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5" />
          <circle cx="8" cy="7" r="1.4" />
          <path d="m3 15 5-5 5 5m-1-2 3-3 2 2" />
          <path d="M14 15h1c2.5 0 3.5 6 6 6h1m-2-2 2 2-2 2M14 21h1c.8 0 1.6-1 2.3-2.5m1.4-2c.7-.9 1.4-1.5 2.3-1.5h1m-2-2 2 2-2 2" />
        </>
      ) : kind === 'background' ? (
        <path d="M7 17 17 7M7 7h10v10" />
      ) : kind === 'collection' ? (
        <>
          <path d="M4 10h16v10H4zM3 6h18v4H3zM12 10v10" />
          <path d="M12 6C5-1 4 8 12 6Zm0 0c7-7 8 2 0 0Z" />
        </>
      ) : kind === 'language' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3q-7 9 0 18 7-9 0-18" />
        </>
      ) : kind === 'time' ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </>
      ) : kind === 'coffee' ? (
        <>
          <path d="M4 8h13l-1 9q-5 3-11 0zM17 9c7-2 7 8-1 7M3 21h17" />
          <path d="M8 5q-2-2 0-4m5 4q2-2 0-4" />
        </>
      ) : kind === 'music' ? (
        <>
          <path d="M5 19V9l14-4v12M5 12l14-4" />
          <ellipse cx="3" cy="19" rx="2.5" ry="2" />
          <ellipse cx="17" cy="17" rx="2.5" ry="2" />
        </>
      ) : (
        <>
          <path d="m11 4-6 5H2v6h3l6 5zM15 8q5 4 0 8M18 5q8 7 0 14" />
        </>
      )}
    </svg>
  )
}
export type AdditionalHeaderAction = {
  key: string
  label: string
  short: string
  icon: Action | 'settings' | 'background' | 'collection'
  onSelect: (opener: HTMLButtonElement) => void
  pressed?: boolean
  className?: string
}
export default function HeaderActions({
  onSelect,
  additionalActions = [],
  disabled = false,
  closeWhen = false,
  onExpandedChange,
  triggerClassName = '',
}: {
  onSelect: (action: Action, opener: HTMLButtonElement) => void
  additionalActions?: AdditionalHeaderAction[]
  disabled?: boolean
  closeWhen?: boolean
  onExpandedChange?: (expanded: boolean) => void
  triggerClassName?: string
}) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    first = useRef<HTMLButtonElement>(null)
  const focusFirst = useRef(false)
  const expandedCallback = useRef(onExpandedChange)
  expandedCallback.current = onExpandedChange
  useEffect(() => {
    expandedCallback.current?.(expanded)
  }, [expanded])
  useEffect(() => () => expandedCallback.current?.(false), [])
  useEffect(() => {
    if (disabled || closeWhen) setExpanded(false)
  }, [disabled, closeWhen])
  const panelId = `header-settings-${useId().replace(/:/g, '')}`
  useEffect(() => {
    if (!expanded) return
    if (focusFirst.current) {
      focusFirst.current = false
      first.current?.focus()
    }
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setExpanded(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setExpanded(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape)
    }
  }, [expanded])
  return (
    <div
      ref={root}
      className="header-actions relative shrink-0"
      onKeyDown={(event) => {
        if (expanded && event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setExpanded(false)
          trigger.current?.focus()
        }
      }}
      onBlur={(event) => {
        if (expanded && !event.currentTarget.contains(event.relatedTarget as Node | null))
          setExpanded(false)
      }}
    >
      <Button
        variant="existing"
        ref={trigger}
        className={`settings-gear grid size-11 place-items-center ${triggerClassName}`}
        aria-label={t('header.settings')}
        title={t('header.settings')}
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => {
          if (!disabled && !closeWhen) setExpanded((value) => !value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !disabled && !closeWhen) {
            event.preventDefault()
            if (expanded) first.current?.focus()
            else {
              focusFirst.current = true
              setExpanded(true)
            }
          }
        }}
      >
        <ActionIcon kind="settings" />
      </Button>
      <div
        id={panelId}
        className="header-settings-panel absolute right-0 top-[calc(100%+10px)] z-40 grid grid-cols-2 gap-1 p-2"
        role="group"
        aria-label={t('header.quick')}
        hidden={!expanded}
        inert={!expanded}
      >
        {actions.map((action, index) => (
          <Button
            variant="existing"
            ref={index === 0 ? first : undefined}
            key={action}
            className="header-setting-action flex flex-col items-center justify-center gap-2"
            style={{ animationDelay: `${index * 45}ms` }}
            aria-label={t(`header.actions.${action}.label`)}
            tabIndex={expanded ? 0 : -1}
            onClick={() => {
              if (!expanded || !trigger.current) return
              setExpanded(false)
              onSelect(action, trigger.current)
            }}
          >
            <ActionIcon kind={action} />
            <span className="header-action-label text-[11px] leading-none">
              {t(`header.actions.${action}.short`)}
            </span>
          </Button>
        ))}
        {additionalActions.map((action, index) => (
          <Button
            variant="existing"
            key={action.key}
            className={`header-setting-action flex flex-col items-center justify-center gap-2 ${action.className ?? ''}`}
            style={{ animationDelay: `${(actions.length + index) * 45}ms` }}
            aria-label={action.label}
            aria-pressed={action.pressed}
            tabIndex={expanded ? 0 : -1}
            onClick={() => {
              if (!expanded || !trigger.current) return
              setExpanded(false)
              trigger.current.focus({ preventScroll: true })
              action.onSelect(trigger.current)
            }}
          >
            <ActionIcon kind={action.icon} />
            <span className="header-action-label text-[11px] leading-none">{action.short}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
