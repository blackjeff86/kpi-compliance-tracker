"use server"

import sql from "@/lib/db"

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function normalizeGrcFinalStatus(v: any): "GREEN" | "YELLOW" | "RED" | null {
  const up = safeText(v).toUpperCase()
  if (!up) return null
  if (up === "GREEN" || up === "YELLOW" || up === "RED") return up
  return null
}

function mapFinalStatusToReviewStatus(finalStatus: "GREEN" | "YELLOW" | "RED") {
  if (finalStatus === "GREEN") return "APPROVED"
  if (finalStatus === "YELLOW") return "NEEDS_ADJUSTMENTS"
  return "REJECTED"
}

function isUuidLike(v: any) {
  const s = safeText(v)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export async function fetchRevisaoQueue(params: {
  period: string
  framework?: string
}) {
  try {
    const period = safeText(params?.period)
    const framework = safeText(params?.framework)

    if (!period) return { success: false as const, error: "Período é obrigatório." }

    const data = await sql`
      WITH period_ctx AS (
        SELECT EXTRACT(MONTH FROM ((${period} || '-01')::date))::int AS m
      ),
      latest_runs AS (
        SELECT DISTINCT ON (kr.kpi_uuid, kr.period)
          kr.id::text AS run_id,
          kr.kpi_uuid::text AS kpi_uuid,
          kr.period,
          COALESCE(kr.kpi_code, '') AS kpi_code,
          COALESCE(kr.status::text, '') AS execution_status,
          COALESCE(kr.evidence_link, '') AS evidence_link,
          COALESCE(kr.executor_comment, '') AS executor_comment,
          COALESCE(kr.created_by_email, '') AS executor_email,
          COALESCE(kr.updated_at, kr.created_at) AS run_updated_at
        FROM kpi_runs kr
        WHERE kr.period = ${period}
        ORDER BY kr.kpi_uuid, kr.period, kr.is_latest DESC NULLS LAST, kr.updated_at DESC NULLS LAST, kr.created_at DESC NULLS LAST
      ),
      latest_reviews AS (
        SELECT DISTINCT ON (sr.run_id)
          sr.run_id::text AS run_id,
          UPPER(
            TRIM(
              COALESCE(
                sr.override_status::text,
                CASE
                  WHEN sr.review_status::text = 'APPROVED' THEN 'GREEN'
                  WHEN sr.review_status::text = 'NEEDS_ADJUSTMENTS' THEN 'YELLOW'
                  WHEN sr.review_status::text = 'REJECTED' THEN 'RED'
                  ELSE NULL
                END,
                ''
              )
            )
          ) AS grc_final_status,
          COALESCE(sr.analyst_comment, '') AS grc_review_comment,
          sr.reviewed_at AS grc_reviewed_at,
          COALESCE(sr.reviewed_by_email, '') AS grc_reviewed_by_email
        FROM security_reviews sr
        ORDER BY sr.run_id, sr.is_latest DESC NULLS LAST, sr.reviewed_at DESC NULLS LAST, sr.created_at DESC NULLS LAST
      )
      SELECT
        c.id_control,
        c.name_control,
        COALESCE(c.framework, 'N/A') AS framework,
        COALESCE(c.risk_title, 'N/A') AS risk_title,
        COALESCE(c.frequency, 'N/A') AS frequency,
        COALESCE(c.owner_name, 'Não atribuído') AS owner_name,
        COALESCE(c.focal_point_name, 'Não atribuído') AS focal_point_name,
        ck.kpi_id,
        COALESCE(ck.kpi_name, ck.kpi_id, lr.kpi_code, 'KPI não identificado') AS kpi_name,
        lr.run_id,
        lr.kpi_uuid,
        lr.period,
        lr.execution_status,
        lr.evidence_link,
        lr.executor_comment,
        lr.executor_email,
        COALESCE(rv.grc_final_status, '') AS grc_final_status,
        COALESCE(rv.grc_review_comment, '') AS grc_review_comment,
        rv.grc_reviewed_at AS grc_reviewed_at,
        COALESCE(rv.grc_reviewed_by_email, '') AS grc_reviewed_by_email,
        lr.run_updated_at
      FROM latest_runs lr
      JOIN control_kpis ck ON ck.kpi_uuid::text = lr.kpi_uuid
      JOIN controls c ON c.id_control = ck.id_control
      LEFT JOIN latest_reviews rv ON rv.run_id = lr.run_id
      WHERE COALESCE(lr.execution_status, '') <> ''
        AND NOT (
          (
            (
              COALESCE(c.frequency, '') ILIKE '%trim%'
              OR COALESCE(c.frequency, '') ILIKE '%trime%'
              OR COALESCE(c.frequency, '') ILIKE '%quarter%'
              OR COALESCE(c.frequency, '') ILIKE '%trimestral%'
              OR UPPER(TRIM(COALESCE(c.frequency, ''))) IN ('QUARTERLY', 'QUARTER')
            )
            AND (SELECT m FROM period_ctx) NOT IN (1, 4, 7, 10)
          )
          OR
          (
            (
              COALESCE(c.frequency, '') ILIKE '%semest%'
              OR COALESCE(c.frequency, '') ILIKE '%semestral%'
              OR COALESCE(c.frequency, '') ILIKE '%semi_annual%'
              OR COALESCE(c.frequency, '') ILIKE '%semi-annual%'
              OR COALESCE(c.frequency, '') ILIKE '%semiannual%'
              OR UPPER(TRIM(COALESCE(c.frequency, ''))) IN ('SEMI_ANNUAL','SEMIANNUAL','SEMI-ANNUAL','SEMI')
            )
            AND (SELECT m FROM period_ctx) NOT IN (1, 7)
          )
          OR
          (
            (
              (
                COALESCE(c.frequency, '') ILIKE '%anual%'
                OR COALESCE(c.frequency, '') ILIKE '%annual%'
                OR COALESCE(c.frequency, '') ILIKE '%year%'
                OR UPPER(TRIM(COALESCE(c.frequency, ''))) IN ('ANNUAL','YEARLY','YEAR')
              )
              AND UPPER(TRIM(COALESCE(c.frequency, ''))) NOT LIKE 'SEMI%'
              AND COALESCE(c.frequency, '') NOT ILIKE '%semi_annual%'
              AND COALESCE(c.frequency, '') NOT ILIKE '%semiannual%'
              AND COALESCE(c.frequency, '') NOT ILIKE '%semi-annual%'
              AND COALESCE(c.frequency, '') NOT ILIKE '%semest%'
              AND COALESCE(c.frequency, '') NOT ILIKE '%semestral%'
            )
            AND (SELECT m FROM period_ctx) NOT IN (9, 10, 11, 12)
          )
        )
        AND (${framework}::text IS NULL OR ${framework} = '' OR c.framework = ${framework})
      ORDER BY
        CASE WHEN COALESCE(rv.grc_final_status, '') = '' THEN 0 ELSE 1 END,
        lr.run_updated_at DESC NULLS LAST,
        c.id_control ASC,
        ck.kpi_id ASC
    `

    return { success: true as const, data }
  } catch (error: any) {
    console.error("Erro fetchRevisaoQueue:", error)
    return {
      success: false as const,
      error: `Erro ao carregar fila de revisão. Detalhe: ${error?.message || "desconhecido"}`,
    }
  }
}

export async function fetchReviewDetail(runIdRaw: string) {
  try {
    const runId = safeText(runIdRaw)
    if (!isUuidLike(runId)) return { success: false as const, error: "Run ID inválido." }

    const runRows = await sql`
      SELECT
        kr.id::text AS run_id,
        kr.kpi_uuid::text AS kpi_uuid,
        kr.period,
        COALESCE(kr.kpi_code, '') AS kpi_code,
        COALESCE(kr.status::text, '') AS execution_status,
        kr.measured_value,
        COALESCE(kr.evidence_link, '') AS evidence_link,
        COALESCE(kr.executor_comment, '') AS executor_comment,
        COALESCE(kr.created_by_email, '') AS executor_email,
        kr.created_at,
        kr.updated_at,
        c.id_control,
        COALESCE(c.name_control, 'Controle') AS name_control,
        COALESCE(c.framework, 'N/A') AS framework,
        COALESCE(c.risk_title, 'N/A') AS risk_title,
        COALESCE(c.owner_name, 'Não atribuído') AS owner_name,
        COALESCE(c.owner_area, 'N/A') AS owner_area,
        COALESCE(c.focal_point_name, 'Não atribuído') AS focal_point_name,
        COALESCE(ck.kpi_id, '') AS kpi_id,
        COALESCE(ck.kpi_name, ck.kpi_id, kr.kpi_code, 'KPI não identificado') AS kpi_name,
        COALESCE(ck.kpi_target, '') AS kpi_target
      FROM kpi_runs kr
      LEFT JOIN control_kpis ck ON ck.kpi_uuid = kr.kpi_uuid
      LEFT JOIN controls c ON c.id_control = ck.id_control
      WHERE kr.id = (${runId})::uuid
      LIMIT 1
    `
    if (!runRows?.length) return { success: false as const, error: "Execução não encontrada." }

    const reviewRows = await sql`
      SELECT
        id::text AS review_id,
        run_id::text AS run_id,
        review_status::text AS review_status,
        analyst_comment,
        override_status::text AS override_status,
        override_reason,
        reviewed_by_email,
        reviewed_at,
        created_at,
        is_latest
      FROM security_reviews
      WHERE run_id = (${runId})::uuid
      ORDER BY is_latest DESC NULLS LAST, reviewed_at DESC NULLS LAST, created_at DESC NULLS LAST
    `

    const latestReview = reviewRows?.[0] || null

    const actionPlans = await sql`
      SELECT
        ap.*,
        COALESCE(ap.status, 'Aberto') AS plan_status,
        COALESCE(ap.owner, c.owner_name, 'Não atribuído') AS responsible_name
      FROM action_plans ap
      LEFT JOIN controls c ON c.id_control = ap.id_control
      WHERE
        ap.kpi_run_id = ${runId}
        OR (
          ap.kpi_run_id IS NULL
          AND ap.id_control = ${runRows[0].id_control}
          AND (
            (ap.period IS NOT NULL AND ap.period = ${runRows[0].period})
            OR ap.period IS NULL
          )
        )
      ORDER BY ap.created_at DESC NULLS LAST, ap.id DESC NULLS LAST
    `

    return {
      success: true as const,
      data: {
        run: runRows[0],
        latestReview,
        reviewHistory: reviewRows || [],
        actionPlans: actionPlans || [],
      },
    }
  } catch (error: any) {
    console.error("Erro fetchReviewDetail:", error)
    return { success: false as const, error: `Erro ao carregar detalhe da revisão. Detalhe: ${error?.message || "desconhecido"}` }
  }
}

export async function saveSecurityReviewByRun(input: {
  run_id: string
  review_status: string
  analyst_comment?: string | null
  override_reason?: string | null
  reviewed_by_email?: string | null
}) {
  try {
    const runId = safeText(input.run_id)
    const finalStatus = normalizeGrcFinalStatus(input.review_status)
    const analystComment = safeText(input.analyst_comment) || null
    const overrideReason = safeText(input.override_reason) || null
    const reviewedBy = safeText(input.reviewed_by_email) || "grc.analyst@local"

    if (!isUuidLike(runId)) return { success: false as const, error: "run_id inválido." }
    if (!finalStatus) return { success: false as const, error: "Status de revisão inválido. Use GREEN, YELLOW ou RED." }

    const finalStatusSafe = finalStatus as "GREEN" | "YELLOW" | "RED"
    const reviewStatus = mapFinalStatusToReviewStatus(finalStatusSafe)

    const runRows = await sql`
      SELECT id::text AS run_id
      FROM kpi_runs
      WHERE id = (${runId})::uuid
      LIMIT 1
    `
    if (!runRows?.length) return { success: false as const, error: "Execução não encontrada." }

    await sql`
      UPDATE security_reviews
      SET is_latest = FALSE
      WHERE run_id = (${runId})::uuid
        AND is_latest = TRUE
    `

    const insertedReview = await sql`
      INSERT INTO security_reviews (
        run_id,
        review_status,
        analyst_comment,
        override_status,
        override_reason,
        reviewed_by_email,
        reviewed_at,
        created_at,
        is_latest
      ) VALUES (
        (${runId})::uuid,
        ${reviewStatus},
        ${analystComment},
        ${finalStatusSafe},
        ${overrideReason},
        ${reviewedBy},
        now(),
        now(),
        TRUE
      )
      RETURNING *
    `

    return { success: true as const, data: insertedReview?.[0] || null }
  } catch (error: any) {
    console.error("Erro saveSecurityReviewByRun:", error)
    return { success: false as const, error: `Erro ao salvar revisão. Detalhe: ${error?.message || "desconhecido"}` }
  }
}

export async function saveGrcFinalReview(input: {
  id_control?: string | null
  kpi_uuid: string
  period: string
  final_status: string
  review_comment?: string | null
  reviewed_by_email?: string | null
}) {
  try {
    const kpiUuid = safeText(input?.kpi_uuid)
    const period = safeText(input?.period)

    if (!isUuidLike(kpiUuid)) return { success: false as const, error: "kpi_uuid inválido." }
    if (!period) return { success: false as const, error: "Período é obrigatório." }

    const runRows = await sql`
      SELECT id::text AS run_id
      FROM kpi_runs
      WHERE kpi_uuid = ${kpiUuid}
        AND period = ${period}
        AND is_latest = TRUE
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `

    if (!runRows?.length) {
      return { success: false as const, error: "Execução não encontrada para revisão final." }
    }

    return saveSecurityReviewByRun({
      run_id: safeText(runRows[0]?.run_id),
      review_status: input.final_status,
      analyst_comment: input.review_comment || null,
      reviewed_by_email: input.reviewed_by_email || null,
    })
  } catch (error: any) {
    console.error("Erro saveGrcFinalReview:", error)
    return {
      success: false as const,
      error: `Erro ao salvar avaliação final. Detalhe: ${error?.message || "desconhecido"}`,
    }
  }
}
