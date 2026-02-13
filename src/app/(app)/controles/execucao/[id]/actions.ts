"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

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

/** ===== Regras (mesmo padrão do admin) ===== */
export type AdminKpiRules = {
  yellow_ratio: number
  zero_meta_yellow_max: number
}

const DEFAULT_RULES: AdminKpiRules = {
  yellow_ratio: 0.9,
  zero_meta_yellow_max: 1,
}

function normalizeRules(input: any): AdminKpiRules {
  const yellow_ratio = safeNumber(input?.yellow_ratio)
  const zero_meta_yellow_max = safeNumber(input?.zero_meta_yellow_max)

  return {
    yellow_ratio: clamp(yellow_ratio ?? DEFAULT_RULES.yellow_ratio, 0.01, 0.999),
    zero_meta_yellow_max: clamp(zero_meta_yellow_max ?? DEFAULT_RULES.zero_meta_yellow_max, 0, 999999),
  }
}

export type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"

function normalizeMode(v: any): KpiEvaluationMode {
  const s = String(v || "").trim().toUpperCase()
  if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
  return "UP"
}

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

function parseBooleanLoose(v: any): boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === "boolean") return v

  const s = String(v).trim().toLowerCase()
  if (!s) return null

  if (["true", "t", "1", "sim", "s", "yes", "y", "ok", "conforme"].includes(s)) return true
  if (["false", "f", "0", "nao", "não", "n", "no", "fail", "não conforme"].includes(s)) return false

  return null
}

/**
 * ✅ Cálculo universal:
 * - BOOLEAN: compara medido vs target (true/false)
 * - UP: maior melhor (>= meta) com faixa yellow = meta * yellow_ratio
 * - DOWN: menor melhor (<= meta) com faixa yellow = meta..(meta+buffer)
 */
function computeKpiStatusUniversal(params: {
  mode: KpiEvaluationMode
  target: any
  measured: any
  rules: AdminKpiRules
}): "GREEN" | "YELLOW" | "RED" {
  const mode = normalizeMode(params.mode)
  const r = normalizeRules(params.rules)

  if (mode === "BOOLEAN") {
    const t = parseBooleanLoose(params.target)
    const m = parseBooleanLoose(params.measured)
    if (t === null || m === null) return "YELLOW"
    return m === t ? "GREEN" : "RED"
  }

  const targetN = parseNumberLoose(params.target)
  const measuredN = parseNumberLoose(params.measured)
  if (targetN === null || measuredN === null) return "YELLOW"

  if (mode === "UP") {
    const yellowFloor = targetN * r.yellow_ratio
    if (measuredN >= targetN) return "GREEN"
    if (measuredN >= yellowFloor) return "YELLOW"
    return "RED"
  }

  // DOWN
  const bufferMax = targetN + r.zero_meta_yellow_max
  if (measuredN <= targetN) return "GREEN"
  if (measuredN > targetN && measuredN <= bufferMax) return "YELLOW"
  return "RED"
}

function isUuidLike(v: any) {
  const s = String(v || "").trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

async function fetchRulesForKpi(kpiUuid: string | null): Promise<{ rules: AdminKpiRules; warning?: string }> {
  try {
    // 1) regra por KPI
    if (kpiUuid) {
      const key = `kpi_rules:${kpiUuid}`
      const r1 = await sql`
        SELECT value_json
        FROM admin_settings
        WHERE key = ${key}
        LIMIT 1
      `
      if (r1?.length) return { rules: normalizeRules(r1[0]?.value_json) }
    }

    // 2) regra global
    const r2 = await sql`
      SELECT value_json
      FROM admin_settings
      WHERE key = 'kpi_rules'
      LIMIT 1
    `
    if (r2?.length) return { rules: normalizeRules(r2[0]?.value_json) }

    return { rules: DEFAULT_RULES, warning: "Nenhuma regra encontrada em admin_settings. Usando padrão." }
  } catch {
    return { rules: DEFAULT_RULES, warning: "Tabela admin_settings não disponível. Usando padrão." }
  }
}

/**
 * Carrega:
 * - controle (controls)
 * - KPI do controle (control_kpis)
 * - regras do KPI (admin_settings)
 * - execução do período (kpi_runs) por kpi_uuid + period
 */
export async function fetchExecucaoContext(params: {
  id_control: string
  kpi: string
  period: string
}) {
  try {
    const id_control = safeText(params.id_control)
    const kpi = safeText(params.kpi)
    const period = safeText(params.period)

    if (!id_control) return { success: false, error: "id_control é obrigatório." }
    if (!kpi) return { success: false, error: "kpi é obrigatório." }
    if (!period) return { success: false, error: "period é obrigatório." }

    const controlsRows = await sql`
      SELECT *
      FROM controls
      WHERE id_control = ${id_control}
      LIMIT 1
    `
    if (!controlsRows?.length) return { success: false, error: "Controle não encontrado." }
    const control = controlsRows[0]

    // Resolve KPI no control_kpis
    const kpiRows = isUuidLike(kpi)
      ? await sql`
          SELECT *
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND kpi_uuid = (${kpi})::uuid
          LIMIT 1
        `
      : await sql`
          SELECT *
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND (kpi_id = ${kpi} OR kpi_name = ${kpi})
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        `

    if (!kpiRows?.length) return { success: false, error: "KPI não encontrado para este controle." }
    const kpiRow = kpiRows[0]

    const kpiUuid = kpiRow.kpi_uuid ? String(kpiRow.kpi_uuid) : null
    if (!kpiUuid) return { success: false, error: "KPI sem kpi_uuid em control_kpis." }

    const { rules, warning } = await fetchRulesForKpi(kpiUuid)

    // ✅ Busca execução latest do período
    const runRows = await sql`
      SELECT *
      FROM kpi_runs
      WHERE kpi_uuid = ${kpiUuid}
        AND period = ${period}
        AND is_latest = TRUE
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `
    const run = runRows?.length ? runRows[0] : null

    return {
      success: true,
      data: {
        control,
        kpi: {
          ...kpiRow,
          kpi_evaluation_mode: normalizeMode(kpiRow?.kpi_evaluation_mode),
        },
        run,
        rules,
      },
      ...(warning ? { warning } : {}),
    }
  } catch (error: any) {
    console.error("Erro fetchExecucaoContext:", error)
    return { success: false, error: `Erro ao carregar dados da execução. Detalhe: ${error?.message || "desconhecido"}` }
  }
}

/**
 * Salva execução:
 * - resolve KPI para kpi_uuid
 * - calcula status automaticamente usando mode + rules + target
 * - garante 1 latest por (kpi_uuid, period)
 */
export async function saveKpiExecution(payload: {
  id_control: string
  kpi_id: string // pode ser uuid ou texto; aqui seguimos seu padrão atual
  period: string
  measured_value: any
  executor_comment: string | null
  evidence_link: string | null
  created_by_email?: string | null
}) {
  try {
    const id_control = safeText(payload.id_control)
    const kpi_ref = safeText(payload.kpi_id)
    const period = safeText(payload.period)

    if (!id_control) return { success: false, error: "id_control é obrigatório." }
    if (!kpi_ref) return { success: false, error: "kpi_id é obrigatório." }
    if (!period) return { success: false, error: "period é obrigatório." }

    // resolve KPI e já traz target + mode + kpi_id(texto) pra kpi_code
    const kpiRows = isUuidLike(kpi_ref)
      ? await sql`
          SELECT kpi_uuid, kpi_target, kpi_id, kpi_evaluation_mode
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND kpi_uuid = (${kpi_ref})::uuid
          LIMIT 1
        `
      : await sql`
          SELECT kpi_uuid, kpi_target, kpi_id, kpi_evaluation_mode
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND (kpi_id = ${kpi_ref} OR kpi_name = ${kpi_ref})
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        `

    if (!kpiRows?.length) return { success: false, error: "KPI não encontrado no controle." }

    const kpiUuid = kpiRows[0].kpi_uuid ? String(kpiRows[0].kpi_uuid) : null
    const target = kpiRows[0].kpi_target
    const mode = normalizeMode(kpiRows[0].kpi_evaluation_mode)
    const kpiCodeText = safeText(kpiRows[0].kpi_id) // ex: "KPI ID 166"

    if (!kpiUuid) return { success: false, error: "KPI sem kpi_uuid em control_kpis." }

    const { rules } = await fetchRulesForKpi(kpiUuid)

    // ✅ valida medição conforme modo
    let measuredToStore: string | null = null
    if (mode === "BOOLEAN") {
      const b = parseBooleanLoose(payload.measured_value)
      if (b === null) return { success: false, error: "measured_value inválido para KPI BOOLEAN (use Sim/Não)." }
      // salvamos numérico 1/0 pra manter compatibilidade com telas que tratam como number
      measuredToStore = b ? "1" : "0"
    } else {
      const n = parseNumberLoose(payload.measured_value)
      if (n === null) return { success: false, error: "measured_value inválido (numérico)." }
      measuredToStore = String(n)
    }

    const status = computeKpiStatusUniversal({
      mode,
      target,
      measured: mode === "BOOLEAN" ? (measuredToStore === "1" ? "true" : "false") : measuredToStore,
      rules,
    })

    const createdBy = safeText(payload.created_by_email) || "system@grc.local"

    // 1) desmarca latest anterior
    await sql`
      UPDATE kpi_runs
      SET is_latest = FALSE,
          updated_at = now()
      WHERE kpi_uuid = ${kpiUuid}
        AND period = ${period}
        AND is_latest = TRUE
    `

    // 2) insere novo latest
    const inserted = await sql`
      INSERT INTO kpi_runs (
        kpi_id,
        kpi_uuid,
        kpi_code,
        period,
        measured_value,
        status,
        evidence_link,
        executor_comment,
        created_by_email,
        is_latest,
        created_at,
        updated_at
      ) VALUES (
        NULL,
        ${kpiUuid},
        ${kpiCodeText},
        ${period},
        ${measuredToStore},
        ${status},
        ${safeText(payload.evidence_link)},
        ${safeText(payload.executor_comment)},
        ${createdBy},
        TRUE,
        now(),
        now()
      )
      RETURNING *
    `

    return { success: true, data: inserted?.[0] || null }
  } catch (error: any) {
    console.error("Erro saveKpiExecution:", error)
    return { success: false, error: `Erro ao salvar execução. Detalhe: ${error?.message || "desconhecido"}` }
  }
}
