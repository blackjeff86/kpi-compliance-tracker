"use server"

import sql from "@/lib/db"

type DashboardResult =
  | {
      success: true
      data: {
        selectedPeriod: string
        frameworkOptions: string[]
        periodOptions: string[]
        summary: {
          greenCount: number
          yellowCount: number
          redCount: number
          total: number
          pendingReviews: number
          overduePlans: number
        }
        chartData: Array<{
          period: string
          green: number
          yellow: number
          red: number
        }>
        immediateItems: Array<{
          code: string
          title: string
          kpi: string
          status: "Red" | "Yellow"
          risk: string
          owner: string
          framework: string
          periodo: string
        }>
      }
    }
  | { success: false; error: string }

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function toInt(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export async function fetchDashboardData(params?: {
  framework?: string
  period?: string
}): Promise<DashboardResult> {
  try {
    const framework = safeText(params?.framework)
    const periodInput = safeText(params?.period)
    const selectedPeriod = periodInput || ""

    const frameworkRows = await sql`
      SELECT DISTINCT framework
      FROM controls
      WHERE framework IS NOT NULL
        AND framework <> ''
      ORDER BY framework ASC
    `
    const frameworkOptions = frameworkRows.map((r) => safeText(r.framework)).filter(Boolean)

    const periodRows = await sql`
      SELECT DISTINCT period
      FROM kpi_runs
      WHERE period IS NOT NULL
        AND period <> ''
      ORDER BY period DESC
      LIMIT 24
    `
    const periodOptions = periodRows.map((r) => safeText(r.period)).filter(Boolean)
    const statusRows = selectedPeriod
      ? await sql`
          WITH last_run AS (
            SELECT DISTINCT ON (kr.kpi_uuid)
              kr.kpi_uuid,
              kr.status::text AS status
            FROM kpi_runs kr
            WHERE kr.period = ${selectedPeriod}
            ORDER BY kr.kpi_uuid, kr.is_latest DESC NULLS LAST, kr.updated_at DESC NULLS LAST, kr.created_at DESC NULLS LAST
          ),
          per_control AS (
            SELECT
              c.id_control,
              COUNT(*)::int AS total_kpis,
              SUM(CASE WHEN lr.kpi_uuid IS NOT NULL THEN 1 ELSE 0 END)::int AS with_run,
              SUM(CASE WHEN lr.status = 'GREEN' THEN 1 ELSE 0 END)::int AS green_count,
              SUM(CASE WHEN lr.status = 'YELLOW' THEN 1 ELSE 0 END)::int AS yellow_count,
              SUM(CASE WHEN lr.status = 'RED' THEN 1 ELSE 0 END)::int AS red_count
            FROM control_kpis ck
            JOIN controls c ON c.id_control = ck.id_control
            LEFT JOIN last_run lr ON lr.kpi_uuid = ck.kpi_uuid
            WHERE (${framework}::text IS NULL OR ${framework} = '' OR c.framework = ${framework})
            GROUP BY c.id_control
          )
          SELECT
            SUM(CASE WHEN pc.with_run = pc.total_kpis AND pc.red_count = 0 AND pc.yellow_count = 0 AND pc.green_count > 0 THEN 1 ELSE 0 END)::int AS green_count,
            SUM(CASE WHEN pc.with_run > 0 AND pc.red_count = 0 AND pc.yellow_count > 0 THEN 1 ELSE 0 END)::int AS yellow_count,
            SUM(CASE WHEN pc.red_count > 0 THEN 1 ELSE 0 END)::int AS red_count,
            COUNT(*)::int AS total,
            SUM(CASE WHEN pc.with_run < pc.total_kpis THEN 1 ELSE 0 END)::int AS pending_reviews
          FROM per_control pc
        `
      : [{ green_count: 0, yellow_count: 0, red_count: 0, total: 0, pending_reviews: 0 }]

    const summary = {
      greenCount: toInt(statusRows[0]?.green_count),
      yellowCount: toInt(statusRows[0]?.yellow_count),
      redCount: toInt(statusRows[0]?.red_count),
      total: toInt(statusRows[0]?.total),
      pendingReviews: 0,
      overduePlans: 0,
    }

    summary.pendingReviews = toInt(statusRows[0]?.pending_reviews)

    const overdueRows = selectedPeriod
      ? await sql`
      SELECT COUNT(*)::int AS overdue_plans
      FROM action_plans ap
      JOIN controls c ON c.id_control = ap.id_control
      WHERE ap.due_date IS NOT NULL
        AND ap.due_date < CURRENT_DATE
        AND COALESCE(ap.status, '') NOT ILIKE '%concl%'
        AND (
          ap.period = ${selectedPeriod}
          OR (COALESCE(ap.period, '') = '' AND to_char(ap.due_date, 'YYYY-MM') = ${selectedPeriod})
        )
        AND (${framework}::text IS NULL OR ${framework} = '' OR c.framework = ${framework})
    `
      : [{ overdue_plans: 0 }]
    const overdueRowsParsed = overdueRows
    const overdueRowsValue = overdueRowsParsed[0]?.overdue_plans
    summary.overduePlans = toInt(overdueRowsValue)

    const trendRows = await sql`
      WITH latest_per_period AS (
        SELECT DISTINCT ON (kr.period, kr.kpi_uuid)
          kr.period,
          kr.kpi_uuid,
          kr.status::text AS status
        FROM kpi_runs kr
        WHERE kr.period IS NOT NULL
          AND kr.period <> ''
        ORDER BY kr.period, kr.kpi_uuid, kr.is_latest DESC NULLS LAST, kr.updated_at DESC NULLS LAST, kr.created_at DESC NULLS LAST
      )
      SELECT
        lpp.period,
        SUM(CASE WHEN lpp.status = 'GREEN' THEN 1 ELSE 0 END)::int AS green,
        SUM(CASE WHEN lpp.status = 'YELLOW' THEN 1 ELSE 0 END)::int AS yellow,
        SUM(CASE WHEN lpp.status = 'RED' THEN 1 ELSE 0 END)::int AS red
      FROM latest_per_period lpp
      JOIN control_kpis ck ON ck.kpi_uuid = lpp.kpi_uuid
      JOIN controls c ON c.id_control = ck.id_control
      WHERE (${framework}::text IS NULL OR ${framework} = '' OR c.framework = ${framework})
      GROUP BY lpp.period
      ORDER BY lpp.period DESC
      LIMIT 6
    `
    const chartData = [...trendRows]
      .reverse()
      .map((row) => ({
        period: safeText(row.period),
        green: toInt(row.green),
        yellow: toInt(row.yellow),
        red: toInt(row.red),
      }))

    const immediateRows = selectedPeriod
      ? await sql`
          WITH last_run AS (
            SELECT DISTINCT ON (kr.kpi_uuid)
              kr.kpi_uuid,
              kr.status::text AS status,
              kr.period,
              kr.kpi_code
            FROM kpi_runs kr
            WHERE kr.period = ${selectedPeriod}
            ORDER BY kr.kpi_uuid, kr.is_latest DESC NULLS LAST, kr.updated_at DESC NULLS LAST, kr.created_at DESC NULLS LAST
          )
          SELECT
            c.id_control AS code,
            c.name_control AS title,
            COALESCE(ck.kpi_name, ck.kpi_id, lr.kpi_code, 'KPI não identificado') AS kpi,
            lr.status,
            COALESCE(c.risk_title, 'N/A') AS risk,
            COALESCE(c.owner_name, 'Não atribuído') AS owner,
            COALESCE(c.framework, 'N/A') AS framework,
            lr.period AS periodo
          FROM control_kpis ck
          JOIN controls c ON c.id_control = ck.id_control
          LEFT JOIN last_run lr ON lr.kpi_uuid = ck.kpi_uuid
          WHERE lr.status IN ('RED', 'YELLOW')
            AND (${framework}::text IS NULL OR ${framework} = '' OR c.framework = ${framework})
          ORDER BY
            CASE WHEN lr.status = 'RED' THEN 0 ELSE 1 END,
            c.id_control ASC
          LIMIT 50
        `
      : []

    const immediateItems = immediateRows.map((row) => ({
      code: safeText(row.code),
      title: safeText(row.title),
      kpi: safeText(row.kpi),
      status: safeText(row.status).toUpperCase() === "RED" ? ("Red" as const) : ("Yellow" as const),
      risk: safeText(row.risk),
      owner: safeText(row.owner),
      framework: safeText(row.framework),
      periodo: safeText(row.periodo),
    }))

    return {
      success: true,
      data: {
        selectedPeriod,
        frameworkOptions,
        periodOptions,
        summary,
        chartData,
        immediateItems,
      },
    }
  } catch (error) {
    console.error("Erro fetchDashboardData:", error)
    return { success: false, error: "Erro ao carregar dashboard." }
  }
}
