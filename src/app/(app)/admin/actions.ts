"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export type AdminKpiRules = {
  yellow_ratio: number
  zero_meta_yellow_max: number
}

const DEFAULT_RULES: AdminKpiRules = {
  yellow_ratio: 0.9,
  zero_meta_yellow_max: 1,
}

function safeText(v: any) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function safeNumber(v: any): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeRules(input: Partial<AdminKpiRules> | null | undefined): AdminKpiRules {
  const yellow_ratio = safeNumber((input as any)?.yellow_ratio)
  const zero_meta_yellow_max = safeNumber((input as any)?.zero_meta_yellow_max)

  return {
    yellow_ratio: clamp(yellow_ratio ?? DEFAULT_RULES.yellow_ratio, 0.01, 0.999),
    zero_meta_yellow_max: clamp(zero_meta_yellow_max ?? DEFAULT_RULES.zero_meta_yellow_max, 0, 999999),
  }
}

/**
 * helpers internos (NÃO exportar em arquivo use server)
 */
function parseNumberLoose(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const s = v.trim().replace("%", "").replace(",", ".")
    if (!s) return null
    const n = Number(s)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function computeKpiStatusWithRules(
  metaRaw: any,
  atualRaw: any,
  rules?: Partial<AdminKpiRules>
): "GREEN" | "YELLOW" | "RED" {
  const r = normalizeRules(rules || null)

  const metaN = parseNumberLoose(metaRaw)
  const atualN = parseNumberLoose(atualRaw)

  if (metaN === null || atualN === null) return "YELLOW"

  const lowerIsBetter = metaN === 0

  if (lowerIsBetter) {
    if (atualN === 0) return "GREEN"
    if (atualN > 0 && atualN <= r.zero_meta_yellow_max) return "YELLOW"
    return "RED"
  }

  const yellowFloor = metaN * r.yellow_ratio

  if (atualN >= metaN) return "GREEN"
  if (atualN >= yellowFloor) return "YELLOW"
  return "RED"
}

export type ControlRollup = {
  total_kpis: number
  executed_kpis: number
  green: number
  yellow: number
  red: number
  final_label: "Em aberto" | "Não conforme" | "Em atenção" | "Conforme"
}

function computeControlRollup(params: {
  totalKpis: number
  executedKpis: number
  green: number
  yellow: number
  red: number
}): ControlRollup {
  const total_kpis = Math.max(0, Number(params.totalKpis || 0))
  const executed_kpis = Math.max(0, Number(params.executedKpis || 0))
  const green = Math.max(0, Number(params.green || 0))
  const yellow = Math.max(0, Number(params.yellow || 0))
  const red = Math.max(0, Number(params.red || 0))

  let final_label: ControlRollup["final_label"] = "Em aberto"

  if (executed_kpis < total_kpis) {
    final_label = "Em aberto"
  } else if (red > 0) {
    final_label = "Não conforme"
  } else if (yellow > 0) {
    final_label = "Em atenção"
  } else {
    final_label = "Conforme"
  }

  return { total_kpis, executed_kpis, green, yellow, red, final_label }
}

/**
 * Server Actions reais (essas SIM exportadas)
 */

export async function fetchAdminKpiRules() {
  try {
    const rows = await sql`
      SELECT value_json
      FROM admin_settings
      WHERE key = 'kpi_rules'
      LIMIT 1
    `
    const raw = rows?.[0]?.value_json ?? null
    const rules = normalizeRules(raw)
    return { success: true as const, data: rules }
  } catch (e) {
    return {
      success: true as const,
      data: DEFAULT_RULES,
      warning: "Tabela admin_settings não encontrada. Usando regras padrão.",
    }
  }
}

export async function saveAdminKpiRules(input: Partial<AdminKpiRules>) {
  try {
    const rules = normalizeRules(input)

    await sql`
      INSERT INTO admin_settings (key, value_json, updated_at)
      VALUES ('kpi_rules', ${JSON.stringify(rules)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = now()
    `
    return { success: true as const, data: rules }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao salvar regras no banco." }
  }
}
