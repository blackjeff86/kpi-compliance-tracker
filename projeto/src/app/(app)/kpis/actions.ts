"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"

const sql = neon(process.env.DATABASE_URL!)

type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"

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

function normalizeMode(v: any): KpiEvaluationMode {
  const s = String(v || "").trim().toUpperCase()
  if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
  return "UP"
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
 * ✅ Retorna o run mais recente (preferindo is_latest) por kpi_uuid no período informado.
 * Saída:
 * {
 *   [kpi_uuid]: { measured_value: number | null, status: string, grc_final_status: string, grc_review_comment: string }
 * }
 */
export async function fetchLatestKpiRunsForPeriod(kpiUuids: string[], period: string) {
  try {
    const periodoISO = safeText(period)
    const uuids = Array.isArray(kpiUuids) ? kpiUuids.map((u) => String(u).trim()).filter(Boolean) : []

    if (!periodoISO || uuids.length === 0) {
      return {
        success: true as const,
        data: {} as Record<string, { measured_value: number | null; status: string; grc_final_status: string; grc_review_comment: string }>,
      }
    }

    // ✅ 1) tenta pegar só is_latest = true
    const rowsLatest = await sql`
      SELECT DISTINCT ON (kpi_uuid)
        kpi_uuid,
        measured_value,
        status,
        COALESCE(grc_final_status, '') AS grc_final_status,
        COALESCE(grc_review_comment, '') AS grc_review_comment
      FROM kpi_runs
      WHERE kpi_uuid = ANY(${uuids}::uuid[])
        AND period = ${periodoISO}
        AND is_latest = TRUE
      ORDER BY kpi_uuid, updated_at DESC NULLS LAST, created_at DESC
    `

    // Se por algum motivo não existir is_latest no período, faz fallback (igual seu detalhe já faz em outros pontos)
    const rows =
      rowsLatest?.length
        ? rowsLatest
        : await sql`
            SELECT DISTINCT ON (kpi_uuid)
              kpi_uuid,
              measured_value,
              status,
              COALESCE(grc_final_status, '') AS grc_final_status,
              COALESCE(grc_review_comment, '') AS grc_review_comment
            FROM kpi_runs
            WHERE kpi_uuid = ANY(${uuids}::uuid[])
              AND period = ${periodoISO}
            ORDER BY kpi_uuid, updated_at DESC NULLS LAST, created_at DESC
          `

    const map: Record<string, { measured_value: number | null; status: string; grc_final_status: string; grc_review_comment: string }> = {}

    for (const r of rows || []) {
      const key = String(r?.kpi_uuid || "").trim()
      if (!key) continue
      map[key] = {
        measured_value: r?.measured_value === null || r?.measured_value === undefined ? null : Number(r.measured_value),
        status: String(r?.status || "").trim(),
        grc_final_status: String(r?.grc_final_status || "").trim(),
        grc_review_comment: String(r?.grc_review_comment || "").trim(),
      }
    }

    return { success: true as const, data: map }
  } catch (error: any) {
    console.error("Erro fetchLatestKpiRunsForPeriod:", error)
    return {
      success: false as const,
      error: `Erro ao buscar runs dos KPIs. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}

/**
 * Retorna controles para o modal de criação de KPI:
 * - id_control
 * - nome do controle
 * - framework
 * - quantidade de KPIs já associados
 */
export async function fetchKpiCreationOptions() {
  try {
    const controls = await sql`
      WITH controls_base AS (
        SELECT DISTINCT ON (c.id_control)
          c.id_control,
          COALESCE(c.name_control, '') AS name_control,
          COALESCE(c.framework, 'N/A') AS framework
        FROM controls c
        ORDER BY c.id_control
      )
      SELECT
        cb.id_control,
        cb.name_control,
        cb.framework,
        COUNT(ck.kpi_uuid)::int AS kpi_count
      FROM controls_base cb
      LEFT JOIN control_kpis ck ON ck.id_control = cb.id_control
      GROUP BY cb.id_control, cb.name_control, cb.framework
      ORDER BY cb.framework ASC, cb.id_control ASC
    `

    const frameworks = Array.from(
      new Set(
        (controls || [])
          .map((r: any) => String(r?.framework || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))

    return {
      success: true as const,
      data: {
        frameworks,
        controls: (controls || []).map((r: any) => ({
          id_control: String(r?.id_control || "").trim(),
          name_control: String(r?.name_control || "").trim(),
          framework: String(r?.framework || "N/A").trim() || "N/A",
          kpi_count: Number(r?.kpi_count || 0),
        })),
      },
    }
  } catch (error: any) {
    console.error("Erro fetchKpiCreationOptions:", error)
    return {
      success: false as const,
      error: `Erro ao carregar opções de cadastro de KPI. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}

export async function createKpiFromCatalog(input: {
  id_control: string
  kpi_name: string
  kpi_description?: string | null
  kpi_type?: string | null
  kpi_target: string
  kpi_evaluation_mode: KpiEvaluationMode
  yellow_ratio?: number
  zero_meta_yellow_max?: number
  reference_month?: string | null
}) {
  try {
    const id_control = safeText(input?.id_control)
    const kpi_name = safeText(input?.kpi_name)
    const kpi_description = safeText(input?.kpi_description)
    const kpi_type = safeText(input?.kpi_type) || "Manual"
    const reference_month = safeText(input?.reference_month)

    if (!id_control) return { success: false as const, error: "Selecione o controle associado ao KPI." }
    if (!kpi_name) return { success: false as const, error: "Preencha o nome do KPI." }

    const controlRows = await sql`
      SELECT id_control
      FROM controls
      WHERE id_control = ${id_control}
      LIMIT 1
    `
    if (!controlRows?.length) return { success: false as const, error: "Controle selecionado não foi encontrado." }

    const mode = normalizeMode(input?.kpi_evaluation_mode)

    let kpi_target = safeText(input?.kpi_target) ?? "0"
    if (mode === "BOOLEAN") {
      const parsed = parseBooleanLoose(kpi_target)
      if (parsed === null) return { success: false as const, error: "Para modo BOOLEAN, informe meta Sim ou Não." }
      kpi_target = parsed ? "true" : "false"
    }

    const yellow_ratio = clamp(safeNumber(input?.yellow_ratio) ?? 0.9, 0.01, 0.999)
    const zero_meta_yellow_max = clamp(safeNumber(input?.zero_meta_yellow_max) ?? 1, 0, 999999)

    const maxRows = await sql`
      SELECT MAX(
        NULLIF(regexp_replace(kpi_id, '[^0-9]', '', 'g'), '')::int
      ) AS max_n
      FROM control_kpis
    `
    const maxN = Number(maxRows?.[0]?.max_n || 0)
    const nextN = maxN + 1
    const kpi_id = `KPI ID ${nextN}`

    const inserted = await sql`
      INSERT INTO control_kpis (
        id_control,
        kpi_uuid,
        kpi_id,
        kpi_name,
        kpi_description,
        kpi_type,
        kpi_target,
        kpi_evaluation_mode,
        reference_month,
        created_at,
        updated_at
      ) VALUES (
        ${id_control},
        gen_random_uuid(),
        ${kpi_id},
        ${kpi_name},
        ${kpi_description},
        ${kpi_type},
        ${kpi_target},
        ${mode},
        ${reference_month},
        now(),
        now()
      )
      RETURNING
        kpi_uuid,
        kpi_id,
        kpi_name,
        kpi_type,
        kpi_target,
        kpi_evaluation_mode,
        id_control
    `

    const created = inserted?.[0]
    const kpiUuid = safeText(created?.kpi_uuid)

    if (kpiUuid) {
      const key = `kpi_rules:${kpiUuid}`
      await sql`
        INSERT INTO admin_settings (key, value_json, updated_at)
        VALUES (
          ${key},
          ${JSON.stringify({ yellow_ratio, zero_meta_yellow_max })}::jsonb,
          now()
        )
        ON CONFLICT (key) DO UPDATE
        SET value_json = EXCLUDED.value_json,
            updated_at = now()
      `
    }

    revalidatePath("/kpis")
    revalidatePath(`/controles/${encodeURIComponent(id_control)}`)
    revalidatePath("/admin")

    return {
      success: true as const,
      data: {
        ...created,
        yellow_ratio,
        zero_meta_yellow_max,
      },
    }
  } catch (error: any) {
    console.error("Erro createKpiFromCatalog:", error)
    return {
      success: false as const,
      error: `Falha ao criar KPI. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}
