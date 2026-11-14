/*!
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Adapted from https://ui.shadcn.com/r/styles/new-york/dialog.json (MIT; see SHADCN-LICENSE).
// Radix owns focus trapping, Escape, outside dismissal, accessibility and restoration.
import * as React from 'react'
import { useTranslation } from '@/shared/i18n'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/shared/lib'
type Appearance = { appearance?: 'default' | 'existing' }
const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & Appearance
>(({ className, appearance, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      appearance === 'existing' ? undefined : 'fixed inset-0 z-50 bg-black/70',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName
const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    Appearance & {
      showCloseButton?: boolean
      overlayClassName?: string
      overlayProps?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
      container?: React.ComponentProps<typeof DialogPortal>['container']
    }
>(
  (
    {
      className,
      children,
      appearance,
      showCloseButton = true,
      overlayClassName,
      overlayProps,
      container,
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation('extras')
    return (
      <DialogPortal container={container}>
        <DialogOverlay appearance={appearance} className={overlayClassName} {...overlayProps} />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            appearance === 'existing'
              ? undefined
              : 'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-app-card border border-solid border-app-border bg-app-surface p-app-card text-app-primary shadow-lg',
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-app-pill text-app-secondary"
              aria-label={t('ui.close')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    )
  },
)
DialogContent.displayName = DialogPrimitive.Content.displayName
function DialogHeader({
  className,
  appearance,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & Appearance) {
  return (
    <div
      className={cn(
        appearance === 'existing' ? undefined : 'flex flex-col gap-1.5 text-center sm:text-left',
        className,
      )}
      {...props}
    />
  )
}
function DialogFooter({
  className,
  appearance,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & Appearance) {
  return (
    <div
      className={cn(
        appearance === 'existing'
          ? undefined
          : 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}
const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & Appearance
>(({ className, appearance, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      appearance === 'existing' ? undefined : 'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName
const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & Appearance
>(({ className, appearance, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(appearance === 'existing' ? undefined : 'text-sm text-app-secondary', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
