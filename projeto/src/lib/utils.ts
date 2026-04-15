import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPreviousMonthISO(baseDate = new Date()) {
  const d = new Date(baseDate)
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export function resolveReferenceMonth(options: string[], preferredMonth = getPreviousMonthISO()) {
  return options.includes(preferredMonth) ? preferredMonth : (options[0] || preferredMonth)
}

export function buildMonthOptions(startYear = 2025, endYear?: number) {
  const nowYear = new Date().getFullYear()
  const yEnd = Number.isFinite(endYear as number) ? Number(endYear) : nowYear + 1
  const out: string[] = []

  for (let y = yEnd; y >= startYear; y--) {
    for (let m = 12; m >= 1; m--) {
      out.push(`${y}-${String(m).padStart(2, "0")}`)
    }
  }

  return out
}
