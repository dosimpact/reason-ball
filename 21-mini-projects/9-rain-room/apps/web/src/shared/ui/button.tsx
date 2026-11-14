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
// Adapted from https://ui.shadcn.com/r/styles/new-york/button.json (MIT; see SHADCN-LICENSE).
// Existing appearance deliberately keeps application class names and dimensions unchanged.
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-app-control text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-app-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        existing: '',
        default: 'bg-app-action text-app-on-action shadow hover:bg-app-action/90',
        accent: 'bg-app-accent text-app-on-accent shadow hover:bg-app-accent-hover',
        destructive: 'bg-app-danger text-app-on-action shadow-sm hover:bg-app-danger/90',
        outline:
          'border border-solid border-app-border bg-app-bg shadow-sm hover:bg-app-raised hover:text-app-primary',
        secondary: 'bg-app-raised text-app-primary shadow-sm hover:bg-app-raised/80',
        ghost: 'hover:bg-app-raised hover:text-app-primary',
        link: 'text-app-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-app-control min-h-app-control px-4 py-2',
        sm: 'h-app-control min-h-app-control px-3 text-xs',
        lg: 'h-app-button min-h-app-button rounded-app-pill px-8',
        icon: 'size-app-control min-h-app-control',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  appearance?: 'default' | 'existing'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, appearance, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(
          variant === 'existing' || appearance === 'existing'
            ? undefined
            : buttonVariants({ variant, size }),
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
