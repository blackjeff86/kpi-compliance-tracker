function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

/** Primeiro token antes de " - " no rótulo SOX (ex.: TEC_C92). */
export function controlCodeFromControleSox(raw: string | null | undefined): string | null {
  const s = safeText(raw)
  if (!s) return null
  const code = s.split(/\s*-\s*/)[0]?.trim() ?? ""
  return code.length ? code : null
}
