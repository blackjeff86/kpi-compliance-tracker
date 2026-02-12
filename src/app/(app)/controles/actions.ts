"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

/** Utils */
function safeText(v: any) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function safeNumber(v: any) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * ✅ Lista controles (1 por id_control)
 */
export async function fetchControles() {
  try {
    const data = await sql`
      SELECT *
      FROM controls
      ORDER BY id_control ASC
    `
    return { success: true as const, data }
  } catch (error) {
    console.error("Erro fetchControles:", error)
    return { success: false as const, error: "Erro ao carregar lista de controles." }
  }
}

/**
 * ✅ Detalhe do controle + KPIs + histórico + planos
 * (Aceita 2º parâmetro opcional para compatibilidade com o front, mesmo que não use aqui)
 */
export async function fetchControleByCode(code: string, _periodoISO?: string) {
  try {
    const baseRows = await sql`
      SELECT * FROM controls WHERE id_control = ${code}
    `
    if (!baseRows || baseRows.length === 0) return { success: false as const, error: "Controle não encontrado" }

    const baseControl = baseRows[0]

    // ✅ KPIs do controle (AGORA TRAZ kpi_uuid)
    const kpis = await sql`
      SELECT 
        id_control,
        kpi_uuid,
        kpi_id,
        kpi_name,
        kpi_description,
        kpi_type,
        kpi_target,
        reference_month
      FROM control_kpis
      WHERE id_control = ${code}
      ORDER BY kpi_id ASC
    `

    let historico: any[] = []
    let planos: any[] = []

    try {
      historico = await sql`SELECT * FROM control_history WHERE id_control = ${code} ORDER BY executed_at DESC`
      planos = await sql`SELECT * FROM action_plans WHERE id_control = ${code}`
    } catch (e) {
      console.warn("Tabelas auxiliares vazias.")
    }

    return {
      success: true as const,
      data: {
        ...baseControl,
        all_kpis: kpis,
        historico,
        planos,
      },
    }
  } catch (error) {
    console.error("Erro fetchControleByCode:", error)
    return { success: false as const, error: "Erro ao buscar detalhes do controle." }
  }
}

/**
 * ✅ KPIs page:
 * - catálogo: control_kpis (agrupado por kpi_id)
 * - last/previous: kpi_runs usando kpi_code (TEXT) + period
 */
export async function fetchKPIs(params?: {
  month?: string
  page?: number
  pageSize?: number
  kpiType?: "Manual" | "Automated" | "Automated (API/Script)" | string
}) {
  try {
    const page = Math.max(1, Number(params?.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize || 12)))
    const offset = (page - 1) * pageSize
    const month = safeText(params?.month) // ex: "2026-01"
    const kpiType = safeText(params?.kpiType)

    const totalRows = await sql`
      SELECT COUNT(DISTINCT ck.kpi_id) AS total
      FROM control_kpis ck
      WHERE (${kpiType}::text IS NULL OR ck.kpi_type = ${kpiType})
    `
    const total = Number(totalRows?.[0]?.total || 0)

    const data = await sql`
      WITH kpi_catalog AS (
        SELECT
          ck.kpi_id,
          COALESCE(MAX(ck.kpi_name), 'Indicador')        AS kpi_name,
          COALESCE(MAX(ck.kpi_description), '')          AS kpi_description,
          COALESCE(MAX(ck.kpi_type), 'Manual')           AS kpi_type,
          COALESCE(MAX(ck.kpi_target), '0')              AS kpi_target,

          MIN(COALESCE(c.framework, 'N/A'))              AS framework,
          MIN(COALESCE(c.owner_area, 'Geral'))           AS kpi_category
        FROM control_kpis ck
        LEFT JOIN controls c ON c.id_control = ck.id_control
        WHERE (${kpiType}::text IS NULL OR ck.kpi_type = ${kpiType})
        GROUP BY ck.kpi_id
      ),

      last_run AS (
        SELECT DISTINCT ON (kr.kpi_code)
          kr.kpi_code,
          kr.period,
          kr.measured_value,
          kr.status,
          kr.evidence_link,
          kr.executor_comment,
          kr.created_by_email,
          kr.updated_at,
          kr.created_at
        FROM kpi_runs kr
        WHERE
          kr.is_latest = TRUE
          AND kr.kpi_code IS NOT NULL
          AND (
            ${month}::text IS NULL
            OR kr.period = ${month}
          )
        ORDER BY kr.kpi_code, kr.updated_at DESC NULLS LAST, kr.created_at DESC
      ),

      prev_run AS (
        SELECT DISTINCT ON (kr.kpi_code)
          kr.kpi_code,
          kr.period,
          kr.measured_value,
          kr.status,
          kr.updated_at,
          kr.created_at
        FROM kpi_runs kr
        WHERE
          kr.is_latest = TRUE
          AND kr.kpi_code IS NOT NULL
          AND (
            ${month}::text IS NULL
            OR kr.period <> ${month}
          )
        ORDER BY kr.kpi_code, kr.updated_at DESC NULLS LAST, kr.created_at DESC
      )

      SELECT
        kc.kpi_id,
        kc.kpi_name,
        kc.kpi_description,
        kc.kpi_type,
        kc.kpi_target,
        kc.framework,
        kc.kpi_category,

        lr.measured_value::text AS last_value,
        pr.measured_value::text AS previous_value,
        lr.period               AS last_period,
        lr.status               AS last_status

      FROM kpi_catalog kc
      LEFT JOIN last_run lr ON lr.kpi_code = kc.kpi_id
      LEFT JOIN prev_run pr ON pr.kpi_code = kc.kpi_id
      ORDER BY kc.kpi_id ASC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `

    return { success: true as const, data, total }
  } catch (error: any) {
    console.error("Erro fetchKPIs:", error)
    return { success: false as const, error: `Erro ao carregar KPIs do banco. Detalhe: ${error?.message || "erro desconhecido"}` }
  }
}

/**
 * ✅ Para salvar execução diretamente (opcional)
 * Mantive para compatibilidade, usando kpi_code.
 */
export async function upsertKpiRun(input: {
  kpi_code: string
  period: string
  measured_value: number | string
  status?: string
  evidence_link?: string | null
  executor_comment?: string | null
  created_by_email?: string | null
}) {
  try {
    const kpi_code = safeText(input.kpi_code)
    const period = safeText(input.period)
    const measured_value = safeNumber(
      typeof input.measured_value === "string"
        ? input.measured_value.replace("%", "").replace(",", ".").trim()
        : input.measured_value
    )

    if (!kpi_code) return { success: false as const, error: "kpi_code é obrigatório." }
    if (!period) return { success: false as const, error: "period é obrigatório." }
    if (measured_value === null) return { success: false as const, error: "measured_value inválido." }

    const status = safeText(input.status) || null
    const evidence_link = safeText(input.evidence_link)
    const executor_comment = safeText(input.executor_comment)
    const created_by_email = safeText(input.created_by_email)

    await sql`
      UPDATE kpi_runs
      SET is_latest = FALSE,
          updated_at = now()
      WHERE kpi_code = ${kpi_code}
        AND period = ${period}
        AND is_latest = TRUE
    `

    const inserted = await sql`
      INSERT INTO kpi_runs (
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
        ${kpi_code},
        ${period},
        ${measured_value},
        ${status},
        ${evidence_link},
        ${executor_comment},
        ${created_by_email},
        TRUE,
        now(),
        now()
      )
      RETURNING *
    `

    return { success: true as const, data: inserted?.[0] || null }
  } catch (error: any) {
    console.error("Erro upsertKpiRun:", error)
    return { success: false as const, error: `Erro ao salvar execução do KPI. Detalhe: ${error?.message || "erro desconhecido"}` }
  }
}

/**
 * Importação:
 * - Garante 1 linha por controle em `controls`
 * - Garante N linhas em `control_kpis`
 * ✅ AGORA garante kpi_uuid (UUID) para o botão Registrar funcionar
 * ✅ NÃO apaga todos os KPIs (para não quebrar kpi_runs já gravados)
 */
export async function importarControles(controles: any[]) {
  try {
    if (!Array.isArray(controles) || controles.length === 0) {
      return { success: false as const, error: "Nenhum registro recebido para importação." }
    }

    const sanitized = controles.map((c: any) => {
      const id_control = (c.id_control ?? "").toString().trim()
      const kpi_id_raw = c.kpi_id
      const kpi_id = kpi_id_raw === null || kpi_id_raw === undefined ? "" : kpi_id_raw.toString().trim()
      return { ...c, id_control, kpi_id }
    })

    const invalidNoKpi = sanitized.filter((r) => r.id_control && !r.kpi_id)
    const valid = sanitized.filter((r) => r.id_control && r.kpi_id)

    if (valid.length === 0) {
      return { success: false as const, error: "Nenhuma linha válida para importar: todas estão sem kpi_id." }
    }

    const byControl = new Map<string, any[]>()
    for (const row of valid) {
      if (!byControl.has(row.id_control)) byControl.set(row.id_control, [])
      byControl.get(row.id_control)!.push(row)
    }

    for (const [id_control, rows] of byControl.entries()) {
      const base = rows[0]

      await sql`
        INSERT INTO controls (
          id_control, name_control, description_control, goal_control,
          framework, owner_name, owner_email, owner_area,
          focal_point_name, focal_point_email, focal_point_area,
          frequency, risk_id, risk_name, risk_title, risk_description,
          status, reference_month
        ) VALUES (
          ${base.id_control},
          ${base.name_control},
          ${base.description_control || null},
          ${base.goal_control || null},
          ${base.framework || null},
          ${base.owner_name || null},
          ${base.owner_email || null},
          ${base.owner_area || null},
          ${base.focal_point_name || null},
          ${base.focal_point_email || null},
          ${base.focal_point_area || null},
          ${base.frequency || null},
          ${base.risk_id || null},
          ${base.risk_name || null},
          ${base.risk_title || null},
          ${base.risk_description || null},
          ${base.status || null},
          ${base.reference_month || null}
        )
        ON CONFLICT (id_control) DO UPDATE SET
          name_control = EXCLUDED.name_control,
          description_control = EXCLUDED.description_control,
          goal_control = EXCLUDED.goal_control,
          framework = EXCLUDED.framework,
          owner_name = EXCLUDED.owner_name,
          owner_email = EXCLUDED.owner_email,
          owner_area = EXCLUDED.owner_area,
          focal_point_name = EXCLUDED.focal_point_name,
          focal_point_email = EXCLUDED.focal_point_email,
          focal_point_area = EXCLUDED.focal_point_area,
          frequency = EXCLUDED.frequency,
          risk_id = EXCLUDED.risk_id,
          risk_name = EXCLUDED.risk_name,
          risk_title = EXCLUDED.risk_title,
          risk_description = EXCLUDED.risk_description,
          status = EXCLUDED.status,
          reference_month = EXCLUDED.reference_month
      `

      const seen = new Set<string>()
      for (const row of rows) {
        if (seen.has(row.kpi_id)) continue
        seen.add(row.kpi_id)

        // ✅ garante kpi_uuid:
        // - no insert: gen_random_uuid()
        // - no update: se estiver NULL, preenche com gen_random_uuid()
        await sql`
          INSERT INTO control_kpis (
            id_control,
            kpi_uuid,
            kpi_id,
            kpi_name,
            kpi_description,
            kpi_type,
            kpi_target,
            reference_month
          ) VALUES (
            ${row.id_control},
            gen_random_uuid(),
            ${row.kpi_id},
            ${row.kpi_name || null},
            ${row.kpi_description || null},
            ${row.kpi_type || null},
            ${row.kpi_target || null},
            ${row.reference_month || null}
          )
          ON CONFLICT (id_control, kpi_id) DO UPDATE SET
            kpi_uuid = COALESCE(control_kpis.kpi_uuid, gen_random_uuid()),
            kpi_name = EXCLUDED.kpi_name,
            kpi_description = EXCLUDED.kpi_description,
            kpi_type = EXCLUDED.kpi_type,
            kpi_target = EXCLUDED.kpi_target,
            reference_month = EXCLUDED.reference_month,
            updated_at = now()
        `
      }

      // ✅ (Opcional e seguro): se existir algum KPI antigo sem kpi_uuid, preenche
      await sql`
        UPDATE control_kpis
        SET kpi_uuid = COALESCE(kpi_uuid, gen_random_uuid()),
            updated_at = now()
        WHERE id_control = ${id_control}
          AND kpi_uuid IS NULL
      `
    }

    return {
      success: true as const,
      warning:
        invalidNoKpi.length > 0
          ? `Importação ok, mas ${invalidNoKpi.length} linha(s) foram ignoradas por estarem sem kpi_id (ex.: ${invalidNoKpi[0]?.id_control}).`
          : undefined,
    }
  } catch (error: any) {
    console.error("Erro ao importar controles:", error)
    return { success: false as const, error: `Falha ao registrar dados. Detalhe: ${error?.message || "erro desconhecido"}` }
  }
}
