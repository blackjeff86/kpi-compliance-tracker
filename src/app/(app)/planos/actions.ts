"use server"

import sql from "@/lib/db"
import { ensureActionPlansJiraColumns, syncActionPlanToJira } from "@/lib/jira"

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

async function ensureAutomationActionPlansSchema() {
  try {
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS progress_percent integer
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS progress_notes text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS finished_reason text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_epic_key text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_epic_url text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_story_key text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_story_url text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_issue_key text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_issue_url text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_sync_status text
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_last_synced_at timestamp without time zone
    `
    await sql`
      ALTER TABLE automation_action_plans
      ADD COLUMN IF NOT EXISTS jira_last_error text
    `
    await sql`
      CREATE TABLE IF NOT EXISTS automation_action_plan_history (
        id bigserial PRIMARY KEY,
        automation_action_plan_id bigint NOT NULL REFERENCES automation_action_plans(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        old_status text,
        new_status text,
        comment text,
        progress_percent integer,
        created_by text,
        created_at timestamp without time zone NOT NULL DEFAULT now()
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_action_plan_history_plan_id
      ON automation_action_plan_history (automation_action_plan_id, created_at DESC)
    `
  } catch (error) {
    console.warn("Não foi possível garantir schema de automation_action_plans:", error)
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
      await ensureAutomationActionPlansSchema()
    } catch (error) {
      console.warn("Preparação de schemas de planos ignorada nesta execução:", error)
    }

    try {
      const rows = await sql`
        SELECT *
        FROM (
          SELECT
            ap.id,
            'CONTROLES'::text AS plan_type,
            ap.id_control,
            c.id_control AS control_code,
            COALESCE(c.framework, ap.framework, 'N/A') AS framework,
            ap.title,
            ap.description,
            COALESCE(ap.control_name, c.name_control, 'Controle não identificado') AS name_control,
            COALESCE(
              NULLIF(ck.kpi_name, ''),
              NULLIF(ck.kpi_id, ''),
              NULLIF(kr.kpi_code, ''),
              NULLIF(substring(ap.title from '(KPI ID [A-Za-z0-9-]+)'), ''),
              NULLIF(substring(ap.description from '(KPI ID [A-Za-z0-9-]+)'), ''),
              'KPI não identificado'
            ) AS kpi_affected,
            ap.owner,
            NULL::text AS responsavel,
            NULL::text AS responsible,
            c.owner_name,
            ap.status,
            ap.due_date,
            ap.created_at AS sort_created_at
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

          UNION ALL

          SELECT
            aap.id,
            'AUTOMACOES'::text AS plan_type,
            aap.id_control,
            COALESCE(aap.id_control, aap.automation_code, '') AS control_code,
            COALESCE(aap.framework, 'N/A') AS framework,
            aap.title,
            aap.description,
            COALESCE(aap.control_name, aap.automation_name, 'Automação não identificada') AS name_control,
            COALESCE(aap.automation_name, aap.title, 'Automação não identificada') AS kpi_affected,
            aap.owner,
            NULL::text AS responsavel,
            NULL::text AS responsible,
            NULL::text AS owner_name,
            aap.status,
            aap.due_date,
            aap.created_at AS sort_created_at
          FROM automation_action_plans aap
        ) plans
        ORDER BY sort_created_at DESC NULLS LAST, id DESC
      `

      return { success: true, data: rows as ActionPlanDbRow[] }
    } catch (error) {
      console.warn("Query completa de action_plans falhou, usando fallback:", error)

      const rowsFallback = await sql`
        SELECT *
        FROM (
          SELECT
            ap.id,
            'CONTROLES'::text AS plan_type,
            ap.id_control,
            c.id_control AS control_code,
            COALESCE(c.framework, ap.framework, 'N/A') AS framework,
            ap.title,
            ap.description,
            COALESCE(ap.control_name, c.name_control, 'Controle não identificado') AS name_control,
            COALESCE(
              NULLIF(substring(ap.title from '(KPI ID [A-Za-z0-9-]+)'), ''),
              NULLIF(substring(ap.description from '(KPI ID [A-Za-z0-9-]+)'), ''),
              NULLIF(ap.title, ''),
              'KPI não identificado'
            ) AS kpi_affected,
            ap.owner,
            NULL::text AS responsavel,
            NULL::text AS responsible,
            c.owner_name,
            ap.status,
            ap.due_date,
            ap.created_at AS sort_created_at
          FROM action_plans ap
          LEFT JOIN controls c ON c.id_control = ap.id_control

          UNION ALL

          SELECT
            aap.id,
            'AUTOMACOES'::text AS plan_type,
            aap.id_control,
            COALESCE(aap.id_control, aap.automation_code, '') AS control_code,
            COALESCE(aap.framework, 'N/A') AS framework,
            aap.title,
            aap.description,
            COALESCE(aap.control_name, aap.automation_name, 'Automação não identificada') AS name_control,
            COALESCE(aap.automation_name, aap.title, 'Automação não identificada') AS kpi_affected,
            aap.owner,
            NULL::text AS responsavel,
            NULL::text AS responsible,
            NULL::text AS owner_name,
            aap.status,
            aap.due_date,
            aap.created_at AS sort_created_at
          FROM automation_action_plans aap
        ) plans
        ORDER BY sort_created_at DESC NULLS LAST, id DESC
      `

      return { success: true, data: rowsFallback as ActionPlanDbRow[] }
    }
  } catch (error) {
    console.error("Erro fetchActionPlans:", error)
    return { success: false, error: "Erro ao carregar planos de ação." }
  }
}

export async function createActionPlan(input: {
  plan_type?: "CONTROLES" | "AUTOMACOES" | string
  id_control?: string | null
  kpi_affected?: string | null
  description: string
  responsible: string
  due_date: string
  criticality: string
}): Promise<CreateActionPlanResult> {
  try {
    await ensureActionPlansJiraColumns()
    await ensureAutomationActionPlansSchema()

    const planType = safeText(input.plan_type).toUpperCase() === "AUTOMACOES" ? "AUTOMACOES" : "CONTROLES"
    const id_control = safeText(input.id_control) || null
    const kpiAffected = safeText(input.kpi_affected)
    const description = safeText(input.description)
    const responsible = safeText(input.responsible)
    const dueDate = safeText(input.due_date)
    const criticality = safeText(input.criticality) || "Alta"
    const controlContext = id_control
      ? await sql`
          SELECT
            COALESCE(name_control, '') AS name_control,
            COALESCE(framework, '') AS framework
          FROM controls
          WHERE id_control = ${id_control}
          LIMIT 1
        `
      : []
    const controlName = safeText(controlContext?.[0]?.name_control) || null
    const framework = safeText(controlContext?.[0]?.framework) || null

    if (!description) return { success: false, error: "Descrição do plano é obrigatória." }
    if (!responsible) return { success: false, error: "Responsável é obrigatório." }
    if (!dueDate) return { success: false, error: "Data limite é obrigatória." }

    const title = `Plano para ${kpiAffected || (planType === "AUTOMACOES" ? "automação crítica" : "KPI crítico")}`
    const descriptionWithMeta = `${description}

Responsável: ${responsible}
Criticidade: ${criticality}${kpiAffected ? `\nKPI: ${kpiAffected}` : ""}`

    if (planType === "AUTOMACOES") {
      const rows = await sql`
        INSERT INTO automation_action_plans (
          automation_code,
          id_control,
          control_name,
          framework,
          title,
          description,
          due_date,
          status,
          owner,
          criticality,
          plan_domain,
          source_type,
          created_at
        ) VALUES (
          ${id_control},
          ${id_control},
          ${controlName},
          ${framework},
          ${title},
          ${descriptionWithMeta},
          ${dueDate},
          'Aberto',
          ${responsible},
          ${criticality},
          'AUTOMACOES',
          'MANUAL',
          now()
        )
        RETURNING *
      `
      const created = (rows?.[0] as ActionPlanDbRow) || null
      if (created?.id) {
        await syncActionPlanToJira({
          planId: String(created.id),
          planDomain: "AUTOMACOES",
          description,
          controlId: id_control,
          controlName,
          kpiAffected: kpiAffected || "Automação",
          responsible,
          criticality,
          framework,
          dueDate,
        })
      }
      return { success: true, data: created }
    }

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
      const created = (rows?.[0] as ActionPlanDbRow) || null
      if (created?.id) {
        await syncActionPlanToJira({
          planId: String(created.id),
          description,
          controlId: id_control,
          controlName,
          kpiAffected,
          responsible,
          criticality,
          framework,
          dueDate,
        })
      }
      return { success: true, data: created }
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
      const created = (rowsFallback?.[0] as ActionPlanDbRow) || null
      if (created?.id) {
        await syncActionPlanToJira({
          planId: String(created.id),
          description,
          controlId: id_control,
          controlName,
          kpiAffected,
          responsible,
          criticality,
          framework,
          dueDate,
        })
      }
      return { success: true, data: created }
    }
  } catch (error: unknown) {
    console.error("Erro createActionPlan:", error)
    return { success: false, error: error instanceof Error ? error.message : "Erro ao criar plano de ação." }
  }
}
