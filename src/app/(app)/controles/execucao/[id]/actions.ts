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

/**
 * ✅ PADRÃO do ENUM kpi_status no banco:
 * - GREEN
 * - YELLOW
 * - RED
 */
function computeKpiStatus(metaRaw: any, atualRaw: any): "GREEN" | "YELLOW" | "RED" {
  const metaN = parseNumberLoose(metaRaw)
  const atualN = parseNumberLoose(atualRaw)

  // se não dá pra calcular, fica YELLOW
  if (metaN === null || atualN === null) return "YELLOW"

  // regra:
  // - meta = 0 => "quanto menor melhor" (ex.: pendências)
  // - meta > 0 => "quanto maior melhor" (ex.: % conformidade)
  const lowerIsBetter = metaN === 0

  const ok = lowerIsBetter ? atualN <= metaN : atualN >= metaN
  const critical = lowerIsBetter ? atualN > metaN : false

  if (ok) return "GREEN"
  if (critical) return "RED"
  return "YELLOW"
}

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
 * - execução do período (kpi_runs) usando:
 *    kpi_runs.kpi_uuid (UUID) + period
 *
 * ⚠️ IMPORTANTE:
 * kpi_runs.kpi_id tem FK para kpis(id), então aqui usamos kpi_uuid mesmo.
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
          ORDER BY kpi_id ASC
          LIMIT 1
        `

    if (!kpiRows?.length) return { success: false, error: "KPI não encontrado para este controle." }
    const kpiRow = kpiRows[0]

    const kpiUuid = kpiRow.kpi_uuid
    if (!kpiUuid) return { success: false, error: "KPI sem kpi_uuid em control_kpis." }

    // ✅ Busca execução por kpi_runs.kpi_uuid + period (sem FK)
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
    return { success: false, error: `Erro ao carregar dados da execução. Detalhe: ${error?.message || "desconhecido"}` }
  }
}

/**
 * Salva execução do KPI no período (kpi_runs):
 * - resolve o KPI para control_kpis.kpi_uuid
 * - grava em kpi_runs.kpi_uuid (UUID)  ✅ (sem FK)
 * - opcionalmente grava kpi_code (texto) para compatibilidade
 * - garante 1 latest por (kpi_uuid, period)
 * - created_by_email é NOT NULL -> sempre preencher
 */
export async function saveKpiExecution(payload: {
  id_control: string
  kpi_id: string
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

    // resolve para control_kpis.kpi_uuid + pega meta + pega kpi_id(texto) pra salvar em kpi_code (opcional)
    const kpiRows = isUuidLike(kpi_ref)
      ? await sql`
          SELECT kpi_uuid, kpi_target, kpi_id
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND kpi_uuid = (${kpi_ref})::uuid
          LIMIT 1
        `
      : await sql`
          SELECT kpi_uuid, kpi_target, kpi_id
          FROM control_kpis
          WHERE id_control = ${id_control}
            AND (kpi_id = ${kpi_ref} OR kpi_name = ${kpi_ref})
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        `

    if (!kpiRows?.length) return { success: false, error: "KPI não encontrado no controle." }

    const kpiUuid = kpiRows[0].kpi_uuid
    const meta = kpiRows[0].kpi_target
    const kpiCodeText = safeText(kpiRows[0].kpi_id) // ex: "KPI ID 166"

    if (!kpiUuid) return { success: false, error: "KPI sem kpi_uuid em control_kpis." }

    const kpiStatus = computeKpiStatus(meta, measured_value)

    // created_by_email é NOT NULL no seu banco -> default seguro
    const createdBy =
      safeText(payload.created_by_email) || "system@grc.local"

    // 1) desmarca latest anterior por (kpi_uuid, period)
    await sql`
      UPDATE kpi_runs
      SET is_latest = FALSE,
          updated_at = now()
      WHERE kpi_uuid = ${kpiUuid}
        AND period = ${period}
        AND is_latest = TRUE
    `

    // 2) insere novo latest
    // ⚠️ kpi_id (FK para kpis.id) deixamos NULL para não estourar FK
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
        ${String(measured_value)},
        ${kpiStatus},
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
