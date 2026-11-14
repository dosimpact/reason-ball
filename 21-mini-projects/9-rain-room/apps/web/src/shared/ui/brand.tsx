import { cn } from '@/shared/lib'
import './brand.css'

/** The existing Rain Room identity, shared by the app and printed surfaces. */
export function Brand({
  href = '/',
  label,
  className,
  static: printed = false,
}: {
  href?: string
  label?: string
  className?: string
  static?: boolean
}) {
  const content = (
    <>
      <span className="brand-icon" aria-hidden="true">
        ◒
      </span>{' '}
      Rain Room
    </>
  )
  return printed ? (
    <span className={cn('brand', className)}>{content}</span>
  ) : (
    <a className={cn('brand', className)} href={href} aria-label={label}>
      {content}
    </a>
  )
}
