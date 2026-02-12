"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

function safeText(v: any) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
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

function computeKpiStatus(metaRaw: any, atualRaw: any) {
  const metaN = parseNumberLoose(metaRaw)
  const atualN = parseNumberLoose(atualRaw)

  if (metaN === null || atualN === null) return "Pendente"

  const lowerIsBetter = metaN === 0
  const ok = lowerIsBetter ? atualN <= metaN : atualN >= metaN
  const critical = !ok && lowerIsBetter && atualN > 0

  if (ok) return "Meta Atingida"
  if (critical) return "Crítico"
  return "Em Atenção"
}

// Detecta UUID em string
function isUuidLike(v: any) {
  const s = String(v || "").trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Carrega:
 * - controle (controls)
 * - KPI do controle (control_kpis) resolvendo por:
 *    a) kpi_uuid (UUID)  OU
 *    b) kpi_id (TEXT "KPI ID 166") OU
 *    c) kpi_name (TEXT)
 * - execução do período (kpi_runs) usando kpi_uuid + period
 */
export async function fetchExecucaoContext(params: {
  id_control: string
  kpi: string // pode ser kpi_uuid OU kpi_id (texto) OU kpi_name
  period: string // YYYY-MM
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

    // ✅ Resolve KPI SEM tentar comparar TEXT com UUID.
    // - Se vier UUID: compara com kpi_uuid
    // - Senão: compara com kpi_id (texto) ou kpi_name
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
          ORDER BY kpi_id ASC
          LIMIT 1
        `

    if (!kpiRows?.length) return { success: false, error: "KPI não encontrado para este controle." }
    const kpiRow = kpiRows[0]

    const kpiUuid = kpiRow.kpi_uuid
    if (!kpiUuid) return { success: false, error: "KPI sem kpi_uuid. Gere e preencha essa coluna no control_kpis." }

    // ✅ Busca execução por kpi_uuid + period (sem kpi_code)
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
        kpi: kpiRow,
        run,
      },
    }
  } catch (error: any) {
    console.error("Erro fetchExecucaoContext:", error)
    return {
      success: false,
      error: `Erro ao carregar dados da execução. Detalhe: ${error?.message || "desconhecido"}`,
    }
  }
}

/**
 * Salva execução do KPI no período (kpi_runs):
 * - resolve o KPI para kpi_uuid (control_kpis.kpi_uuid)
 * - garante 1 latest por (kpi_uuid, period)
 */
export async function saveKpiExecution(payload: {
  id_control: string
  kpi_id: string // pode vir como kpi_uuid OU kpi_id(texto) OU kpi_name
  period: string
  measured_value: number | null
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

    const measured_value = payload.measured_value === null ? null : parseNumberLoose(payload.measured_value)
    if (measured_value === null) return { success: false, error: "measured_value inválido." }

    // ✅ resolve para kpi_uuid
    const kpiRows = isUuidLike(kpi_ref)
      ? await sql`
          SELECT kpi_uuid, kpi_target
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND kpi_uuid = (${kpi_ref})::uuid
          LIMIT 1
        `
      : await sql`
          SELECT kpi_uuid, kpi_target
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND (kpi_id = ${kpi_ref} OR kpi_name = ${kpi_ref})
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `

    if (!kpiRows?.length) return { success: false, error: "KPI não encontrado no controle." }

    const kpiUuid = kpiRows[0].kpi_uuid
    const meta = kpiRows[0].kpi_target

    if (!kpiUuid) return { success: false, error: "KPI sem kpi_uuid. Gere e preencha essa coluna no control_kpis." }

    const kpiStatus = computeKpiStatus(meta, measured_value)

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
        kpi_uuid,
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
        ${kpiUuid},
        ${period},
        ${String(measured_value)},
        ${kpiStatus},
        ${safeText(payload.evidence_link)},
        ${safeText(payload.executor_comment)},
        ${safeText(payload.created_by_email)},
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
