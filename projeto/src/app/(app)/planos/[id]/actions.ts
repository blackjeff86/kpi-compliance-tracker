"use server"

import sql from "@/lib/db"
import { ensureActionPlansJiraColumns } from "@/lib/jira"

type ActionPlanDetailDbRow = {
  [key: string]: unknown
}

type FetchActionPlanDetailResult =
  | { success: true; data: ActionPlanDetailDbRow | null }
  | { success: false; error: string }

type MutationResult = { success: true } | { success: false; error: string }

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function asIntOrNull(v: string): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (!Number.isInteger(n)) return null
  return n
}

async function ensureActionPlansSchema() {
  try {
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS progress_percent integer
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS progress_notes text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS finished_reason text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone
    `

    await sql`
      CREATE TABLE IF NOT EXISTS action_plan_history (
        id bigserial PRIMARY KEY,
        action_plan_id integer NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS idx_action_plan_history_plan_id
      ON action_plan_history (action_plan_id, created_at DESC)
    `
  } catch (error) {
    console.warn("Não foi possível garantir schema de action plans:", error)
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
    console.warn("Não foi possível garantir schema de automation action plans:", error)
  }
}

async function resolvePlanId(planIdRaw: string): Promise<number | null> {
  const planIdText = safeText(planIdRaw)
  const directId = asIntOrNull(planIdText)
  if (directId) return directId

  const fromSlug = planIdText.match(/(\d+)/)?.[1]
  if (!fromSlug) return null

  const slugNum = asIntOrNull(fromSlug)
  return slugNum ?? null
}

function normalizeStatusLabel(raw: string): string {
  const s = safeText(raw).toLowerCase()
  if (s.includes("concl")) return "Concluído"
  if (s.includes("abert")) return "Aberto"
  if (s.includes("atrasa")) return "Atrasado"
  if (s.includes("and")) return "Em andamento"
  return safeText(raw) || "Em andamento"
}

async function resolvePlanSource(planId: number) {
  const controlRows = await sql`
    SELECT id
    FROM action_plans
    WHERE id = ${planId}
    LIMIT 1
  `
  if (controlRows?.length) return "CONTROLES" as const

  const automationRows = await sql`
    SELECT id
    FROM automation_action_plans
    WHERE id = ${planId}
    LIMIT 1
  `
  if (automationRows?.length) return "AUTOMACOES" as const

  return null
}

export async function fetchActionPlanDetail(planIdRaw: string): Promise<FetchActionPlanDetailResult> {
  try {
    await ensureActionPlansSchema()
    await ensureAutomationActionPlansSchema()
    await ensureActionPlansJiraColumns()

    const planId = await resolvePlanId(planIdRaw)
    if (!planId) return { success: true, data: null }
    const source = await resolvePlanSource(planId)
    if (!source) return { success: true, data: null }

    const rows = source === "AUTOMACOES" ? await sql`
      SELECT
        aap.*,
        COALESCE(aap.id_control, aap.automation_code) AS control_code,
        COALESCE(aap.control_name, aap.automation_name, 'Automação não identificada') AS name_control,
        COALESCE(aap.framework, 'N/A') AS framework,
        COALESCE(aap.owner, 'Não atribuído') AS owner_name,
        NULL::text AS run_id,
        NULL::text AS run_status,
        NULL::text AS run_measured_value,
        NULL::text AS run_period,
        COALESCE(aap.automation_name, aap.title, 'Automação não identificada') AS catalog_kpi_name,
        NULL::text AS catalog_kpi_id,
        NULL::text AS catalog_kpi_target,
        'AUTOMACOES'::text AS plan_type
      FROM automation_action_plans aap
      WHERE aap.id = ${planId}
      LIMIT 1
    ` : await sql`
      SELECT
        ap.*,
        c.id_control AS control_code,
        c.name_control,
        c.framework,
        c.owner_name,
        kr.id AS run_id,
        kr.status AS run_status,
        kr.measured_value AS run_measured_value,
        kr.period AS run_period,
        kr.kpi_code AS run_kpi_code,
        ck.kpi_id AS catalog_kpi_id,
        ck.kpi_name AS catalog_kpi_name,
        ck.kpi_target AS catalog_kpi_target
      FROM action_plans ap
      LEFT JOIN controls c
        ON c.id_control = ap.id_control
      LEFT JOIN LATERAL (
        SELECT kr.*
        FROM kpi_runs kr
        WHERE
          (ap.kpi_run_id IS NOT NULL AND kr.id::text = ap.kpi_run_id)
          OR (
            ap.kpi_run_id IS NULL
            AND ap.kpi_uuid IS NOT NULL
            AND ap.period IS NOT NULL
            AND ap.period <> ''
            AND kr.kpi_uuid = ap.kpi_uuid
            AND kr.period = ap.period
          )
        ORDER BY
          CASE WHEN ap.kpi_run_id IS NOT NULL AND kr.id::text = ap.kpi_run_id THEN 0 ELSE 1 END,
          kr.is_latest DESC NULLS LAST,
          kr.updated_at DESC NULLS LAST,
          kr.created_at DESC NULLS LAST
        LIMIT 1
      ) kr ON TRUE
      LEFT JOIN control_kpis ck
        ON (
          (kr.kpi_uuid IS NOT NULL AND ck.kpi_uuid = kr.kpi_uuid)
          OR (
            kr.kpi_uuid IS NULL
            AND ap.kpi_id IS NOT NULL
            AND ck.id_control = ap.id_control
            AND ck.kpi_id = ap.kpi_id
          )
        )
        'CONTROLES'::text AS plan_type
      WHERE ap.id = ${planId}
      LIMIT 1
    `

    const base = rows?.[0]
    if (!base) return { success: true, data: null }

    const historyRows = source === "AUTOMACOES" ? await sql`
      SELECT *,
        automation_action_plan_id AS action_plan_id
      FROM automation_action_plan_history
      WHERE automation_action_plan_id = ${planId}
      ORDER BY created_at DESC, id DESC
    ` : await sql`
      SELECT *
      FROM action_plan_history
      WHERE action_plan_id = ${planId}
      ORDER BY created_at DESC, id DESC
    `

    return { success: true, data: { ...base, history_entries: historyRows } }
  } catch (error) {
    console.error("Erro fetchActionPlanDetail:", error)
    return { success: false, error: "Erro ao carregar detalhe do plano de ação." }
  }
}

export async function addActionPlanComment(input: {
  planId: string
  comment: string
  createdBy?: string | null
}): Promise<MutationResult> {
  try {
    await ensureActionPlansSchema()
    await ensureAutomationActionPlansSchema()

    const planId = await resolvePlanId(input.planId)
    const comment = safeText(input.comment)
    const createdBy = safeText(input.createdBy) || "system@grc.local"

    if (!planId) return { success: false, error: "Plano inválido." }
    if (!comment) return { success: false, error: "Comentário é obrigatório." }
    const source = await resolvePlanSource(planId)
    if (!source) return { success: false, error: "Plano não encontrado." }

    if (source === "AUTOMACOES") {
      await sql`
        UPDATE automation_action_plans
        SET updated_at = now()
        WHERE id = ${planId}
      `
      await sql`
        INSERT INTO automation_action_plan_history (
          automation_action_plan_id,
          event_type,
          comment,
          created_by,
          created_at
        ) VALUES (
          ${planId},
          'COMMENT',
          ${comment},
          ${createdBy},
          now()
        )
      `
    } else {
      await sql`
        UPDATE action_plans
        SET updated_at = now()
        WHERE id = ${planId}
      `
      await sql`
        INSERT INTO action_plan_history (
          action_plan_id,
          event_type,
          comment,
          created_by,
          created_at
        ) VALUES (
          ${planId},
          'COMMENT',
          ${comment},
          ${createdBy},
          now()
        )
      `
    }

    return { success: true }
  } catch (error) {
    console.error("Erro addActionPlanComment:", error)
    return { success: false, error: "Erro ao salvar comentário do plano." }
  }
}

export async function updateActionPlanProgress(input: {
  planId: string
  status: string
  progressPercent: number
  notes?: string | null
  createdBy?: string | null
}): Promise<MutationResult> {
  try {
    await ensureActionPlansSchema()
    await ensureAutomationActionPlansSchema()

    const planId = await resolvePlanId(input.planId)
    const status = normalizeStatusLabel(input.status)
    const notes = safeText(input.notes)
    const createdBy = safeText(input.createdBy) || "system@grc.local"
    const progressPercent = Math.max(0, Math.min(100, Number(input.progressPercent || 0)))

    if (!planId) return { success: false, error: "Plano inválido." }
    const source = await resolvePlanSource(planId)
    if (!source) return { success: false, error: "Plano não encontrado." }

    const currentRows = source === "AUTOMACOES" ? await sql`
      SELECT status
      FROM automation_action_plans
      WHERE id = ${planId}
      LIMIT 1
    ` : await sql`
      SELECT status
      FROM action_plans
      WHERE id = ${planId}
      LIMIT 1
    `
    if (!currentRows?.length) return { success: false, error: "Plano não encontrado." }
    const oldStatus = safeText(currentRows[0]?.status)
    if (source === "AUTOMACOES") {
      await sql`
        UPDATE automation_action_plans
        SET
          status = ${status},
          progress_percent = ${progressPercent},
          progress_notes = ${notes || null},
          updated_at = now()
        WHERE id = ${planId}
      `
      await sql`
        INSERT INTO automation_action_plan_history (
          automation_action_plan_id,
          event_type,
          old_status,
          new_status,
          comment,
          progress_percent,
          created_by,
          created_at
        ) VALUES (
          ${planId},
          'PROGRESS_UPDATE',
          ${oldStatus || null},
          ${status},
          ${notes || null},
          ${progressPercent},
          ${createdBy},
          now()
        )
      `
    } else {
      await sql`
        UPDATE action_plans
        SET
          status = ${status},
          progress_percent = ${progressPercent},
          progress_notes = ${notes || null},
          updated_at = now()
        WHERE id = ${planId}
      `
      await sql`
        INSERT INTO action_plan_history (
          action_plan_id,
          event_type,
          old_status,
          new_status,
          comment,
          progress_percent,
          created_by,
          created_at
        ) VALUES (
          ${planId},
          'PROGRESS_UPDATE',
          ${oldStatus || null},
          ${status},
          ${notes || null},
          ${progressPercent},
          ${createdBy},
          now()
        )
      `
    }

    return { success: true }
  } catch (error) {
    console.error("Erro updateActionPlanProgress:", error)
    return { success: false, error: "Erro ao atualizar progresso do plano." }
  }
}

export async function completeActionPlan(input: {
  planId: string
  reason: string
  createdBy?: string | null
}): Promise<MutationResult> {
  try {
    await ensureActionPlansSchema()
    await ensureAutomationActionPlansSchema()

    const planId = await resolvePlanId(input.planId)
    const reason = safeText(input.reason)
    const createdBy = safeText(input.createdBy) || "system@grc.local"

    if (!planId) return { success: false, error: "Plano inválido." }
    if (!reason) return { success: false, error: "Resumo da conclusão é obrigatório." }
    const source = await resolvePlanSource(planId)
    if (!source) return { success: false, error: "Plano não encontrado." }

    const currentRows = source === "AUTOMACOES" ? await sql`
      SELECT status
      FROM automation_action_plans
      WHERE id = ${planId}
      LIMIT 1
    ` : await sql`
      SELECT status
      FROM action_plans
      WHERE id = ${planId}
      LIMIT 1
    `
    if (!currentRows?.length) return { success: false, error: "Plano não encontrado." }
    const oldStatus = safeText(currentRows[0]?.status)
    if (source === "AUTOMACOES") {
      await sql`
        UPDATE automation_action_plans
        SET
          status = 'Concluído',
          progress_percent = 100,
          finished_reason = ${reason},
          updated_at = now()
        WHERE id = ${planId}
      `
      await sql`
        INSERT INTO automation_action_plan_history (
          automation_action_plan_id,
          event_type,
          old_status,
          new_status,
          comment,
          progress_percent,
          created_by,
          created_at
        ) VALUES (
          ${planId},
          'FINISH',
          ${oldStatus || null},
          'Concluído',
          ${reason},
          100,
          ${createdBy},
          now()
        )
      `
    } else {
      await sql`
        UPDATE action_plans
        SET
          status = 'Concluído',
          progress_percent = 100,
          finished_reason = ${reason},
          updated_at = now()
        WHERE id = ${planId}
      `
      await sql`
        INSERT INTO action_plan_history (
          action_plan_id,
          event_type,
          old_status,
          new_status,
          comment,
          progress_percent,
          created_by,
          created_at
        ) VALUES (
          ${planId},
          'FINISH',
          ${oldStatus || null},
          'Concluído',
          ${reason},
          100,
          ${createdBy},
          now()
        )
      `
    }

    return { success: true }
  } catch (error) {
    console.error("Erro completeActionPlan:", error)
    return { success: false, error: "Erro ao concluir plano." }
  }
}
