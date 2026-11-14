// shadcn/ui class composition pattern: https://ui.shadcn.com/docs/installation/manual
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
