import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Display helper: if value has decimals, show 2; else show as integer
export function formatNumber(value: number | string): string {
  const n = typeof value === "number" ? value : Number.parseFloat(value)
  if (!Number.isFinite(n)) return "-"
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded)
    ? `${Math.trunc(rounded)}`
    : rounded.toFixed(2)
}
