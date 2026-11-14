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
// Adapted from https://ui.shadcn.com/r/styles/new-york/badge.json (MIT; see SHADCN-LICENSE).
// Existing appearance deliberately keeps application class names and dimensions unchanged.
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib'

const badgeVariants = cva(
  'inline-flex items-center rounded-app-pill border border-solid px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-app-ring',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-app-action text-app-on-action shadow hover:bg-app-action/80',
        secondary: 'border-transparent bg-app-raised text-app-primary hover:bg-app-raised/80',
        destructive:
          'border-transparent bg-app-danger text-app-on-action shadow hover:bg-app-danger/80',
        outline: 'text-app-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  appearance?: 'default' | 'existing'
  asChild?: boolean
}

function Badge({ className, variant, appearance, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'div'
  return (
    <Comp
      className={cn(appearance === 'existing' ? undefined : badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
