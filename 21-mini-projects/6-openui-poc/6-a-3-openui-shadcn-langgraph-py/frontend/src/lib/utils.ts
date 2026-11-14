import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Shared class composition expected by the upstream shadcn and Magic UI registries. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
