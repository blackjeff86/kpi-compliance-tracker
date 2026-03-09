"use server"

import sql from "@/lib/db"

type ActionPlanDbRow = {
  [key: string]: unknown
}

type FetchActionPlansResult =
  | { success: true; data: ActionPlanDbRow[] }
  | { success: false; error: string }

type CreateActionPlanResult =
  | { success: true; data: ActionPlanDbRow | null }
  | { success: false; error: string }

type BackfillResult =
  | { success: true; updated: number }
  | { success: false; error: string; updated: number }

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

async function ensureActionPlansKpiRunIdColumn() {
  try {
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS kpi_run_id text
    `
  } catch (error) {
    console.warn("Não foi possível garantir action_plans.kpi_run_id:", error)
  }
}

export async function backfillActionPlansKpiRunIds(): Promise<BackfillResult> {
  await ensureActionPlansKpiRunIdColumn()

  let updated = 0

  try {
    const rowsByKpiCode = await sql`
      WITH candidates AS (
        SELECT
          ap.ctid AS ap_ctid,
          kr.id::text AS run_id
        FROM action_plans ap
        JOIN LATERAL (
          SELECT kr.id, kr.is_latest, kr.updated_at, kr.created_at
          FROM control_kpis ck
          JOIN kpi_runs kr ON kr.kpi_uuid::text = ck.kpi_uuid::text
          WHERE ap.kpi_run_id IS NULL
            AND ck.id_control = ap.id_control
            AND UPPER(ck.kpi_id) = UPPER(
              COALESCE(
                NULLIF(substring(ap.title from '(KPI ID [A-Za-z0-9-]+)'), ''),
                NULLIF(substring(ap.description from '(KPI ID [A-Za-z0-9-]+)'), '')
              )
            )
          ORDER BY kr.is_latest DESC NULLS LAST, kr.updated_at DESC NULLS LAST, kr.created_at DESC NULLS LAST
          LIMIT 1
        ) kr ON TRUE
        WHERE ap.kpi_run_id IS NULL
      )
      UPDATE action_plans ap
      SET kpi_run_id = candidates.run_id
      FROM candidates
      WHERE ap.ctid = candidates.ap_ctid
        AND ap.kpi_run_id IS NULL
      RETURNING ap.kpi_run_id
    `
    updated += rowsByKpiCode.length

    const rowsByTimestamp = await sql`
      WITH candidates AS (
        SELECT
          ap.ctid AS ap_ctid,
          kr.id::text AS run_id
        FROM action_plans ap
        JOIN LATERAL (
          SELECT
            kr.id,
            kr.is_latest,
            kr.updated_at,
            kr.created_at,
            ABS(EXTRACT(EPOCH FROM (kr.created_at::timestamp - ap.created_at))) AS delta_seconds
          FROM control_kpis ck
          JOIN kpi_runs kr ON kr.kpi_uuid::text = ck.kpi_uuid::text
          WHERE ap.kpi_run_id IS NULL
            AND ck.id_control = ap.id_control
            AND ap.created_at IS NOT NULL
            AND ABS(EXTRACT(EPOCH FROM (kr.created_at::timestamp - ap.created_at))) <= 600
          ORDER BY
            delta_seconds ASC,
            kr.is_latest DESC NULLS LAST,
            kr.updated_at DESC NULLS LAST,
            kr.created_at DESC NULLS LAST
          LIMIT 1
        ) kr ON TRUE
        WHERE ap.kpi_run_id IS NULL
      )
      UPDATE action_plans ap
      SET kpi_run_id = candidates.run_id
      FROM candidates
      WHERE ap.ctid = candidates.ap_ctid
        AND ap.kpi_run_id IS NULL
      RETURNING ap.kpi_run_id
    `
    updated += rowsByTimestamp.length

    return { success: true, updated }
  } catch (error) {
    console.error("Erro no backfill de action_plans.kpi_run_id:", error)
    return { success: false, error: "Falha ao executar backfill de kpi_run_id.", updated }
  }
}

export async function fetchActionPlans(): Promise<FetchActionPlansResult> {
  try {
    try {
      await backfillActionPlansKpiRunIds()
    } catch (error) {
      console.warn("Backfill de kpi_run_id ignorado nesta execução:", error)
    }

    try {
      const rows = await sql`
        SELECT
          ap.*,
          c.framework,
          c.name_control,
          c.owner_name,
          c.id_control AS control_code,
          kr.status AS run_status,
          kr.measured_value AS run_measured_value,
          kr.period AS run_period,
          COALESCE(
            NULLIF(ck.kpi_name, ''),
            NULLIF(ck.kpi_id, ''),
            NULLIF(kr.kpi_code, ''),
            NULLIF(substring(ap.title from '(KPI ID [A-Za-z0-9-]+)'), ''),
            NULLIF(substring(ap.description from '(KPI ID [A-Za-z0-9-]+)'), ''),
            'KPI não identificado'
          ) AS kpi_affected
        FROM action_plans ap
        LEFT JOIN controls c ON c.id_control = ap.id_control
        LEFT JOIN LATERAL (
          SELECT kr.*
          FROM kpi_runs kr
          WHERE
            ap.kpi_run_id IS NOT NULL
            AND kr.id::text = ap.kpi_run_id
          ORDER BY
            kr.is_latest DESC NULLS LAST,
            kr.updated_at DESC NULLS LAST,
            kr.created_at DESC NULLS LAST
          LIMIT 1
        ) kr ON TRUE
        LEFT JOIN control_kpis ck
          ON ck.kpi_uuid::text = kr.kpi_uuid::text
        ORDER BY ap.created_at DESC NULLS LAST, ap.id DESC
      `

      return { success: true, data: rows as ActionPlanDbRow[] }
    } catch (error) {
      console.warn("Query completa de action_plans falhou, usando fallback:", error)

      const rowsFallback = await sql`
        SELECT
          ap.*,
          c.framework,
          c.name_control,
          c.owner_name,
          c.id_control AS control_code,
          COALESCE(
            NULLIF(substring(ap.title from '(KPI ID [A-Za-z0-9-]+)'), ''),
            NULLIF(substring(ap.description from '(KPI ID [A-Za-z0-9-]+)'), ''),
            NULLIF(ap.title, ''),
            'KPI não identificado'
          ) AS kpi_affected
        FROM action_plans ap
        LEFT JOIN controls c ON c.id_control = ap.id_control
        ORDER BY ap.created_at DESC NULLS LAST, ap.id DESC
      `

      return { success: true, data: rowsFallback as ActionPlanDbRow[] }
    }
  } catch (error) {
    console.error("Erro fetchActionPlans:", error)
    return { success: false, error: "Erro ao carregar planos de ação." }
  }
}

export async function createActionPlan(input: {
  id_control?: string | null
  kpi_affected?: string | null
  description: string
  responsible: string
  due_date: string
  criticality: string
}): Promise<CreateActionPlanResult> {
  try {
    const id_control = safeText(input.id_control) || null
    const kpiAffected = safeText(input.kpi_affected)
    const description = safeText(input.description)
    const responsible = safeText(input.responsible)
    const dueDate = safeText(input.due_date)
    const criticality = safeText(input.criticality) || "Alta"

    if (!description) return { success: false, error: "Descrição do plano é obrigatória." }
    if (!responsible) return { success: false, error: "Responsável é obrigatório." }
    if (!dueDate) return { success: false, error: "Data limite é obrigatória." }

    const title = `Plano para ${kpiAffected || "KPI crítico"}`
    const descriptionWithMeta = `${description}

Responsável: ${responsible}
Criticidade: ${criticality}${kpiAffected ? `\nKPI: ${kpiAffected}` : ""}`

    try {
      const rows = await sql`
        INSERT INTO action_plans (
          id_control,
          title,
          description,
          due_date,
          status,
          owner,
          created_at
        ) VALUES (
          ${id_control},
          ${title},
          ${descriptionWithMeta},
          ${dueDate},
          'Aberto',
          ${responsible},
          now()
        )
        RETURNING *
      `
      return { success: true, data: (rows?.[0] as ActionPlanDbRow) || null }
    } catch {
      const rowsFallback = await sql`
        INSERT INTO action_plans (
          id_control,
          title,
          description,
          due_date,
          status
        ) VALUES (
          ${id_control},
          ${title},
          ${descriptionWithMeta},
          ${dueDate},
          'Aberto'
        )
        RETURNING *
      `
      return { success: true, data: (rowsFallback?.[0] as ActionPlanDbRow) || null }
    }
  } catch (error: any) {
    console.error("Erro createActionPlan:", error)
    return { success: false, error: error?.message || "Erro ao criar plano de ação." }
  }
}
