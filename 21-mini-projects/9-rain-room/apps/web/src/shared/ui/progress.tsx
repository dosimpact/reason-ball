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
// Adapted from https://ui.shadcn.com/r/styles/new-york/progress.json (MIT; see SHADCN-LICENSE).
import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/shared/lib'
const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    appearance?: 'default' | 'existing'
    indicatorClassName?: string
    indicatorStyle?: React.CSSProperties
  }
>(
  (
    { className, value = 0, max = 100, appearance, indicatorClassName, indicatorStyle, ...props },
    ref,
  ) => {
    const percentage = Math.max(0, Math.min(100, ((value ?? 0) / max) * 100))
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={value}
        max={max}
        className={cn(
          appearance === 'existing'
            ? undefined
            : 'relative h-2 w-full overflow-hidden rounded-app-pill bg-app-action/20',
          className,
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator asChild>
          <span
            className={cn(
              appearance === 'existing'
                ? undefined
                : 'block h-full w-full flex-1 bg-app-action transition-all',
              indicatorClassName,
            )}
            style={{
              ...(appearance === 'existing'
                ? { width: `${percentage}%` }
                : { transform: `translateX(-${100 - percentage}%)` }),
              ...indicatorStyle,
            }}
          />
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    )
  },
)
Progress.displayName = ProgressPrimitive.Root.displayName
export { Progress }
