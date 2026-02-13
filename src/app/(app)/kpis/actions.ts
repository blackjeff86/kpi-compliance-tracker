"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

function safeText(v: any) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

/**
 * ✅ Retorna o run mais recente (preferindo is_latest) por kpi_uuid no período informado.
 * Saída:
 * {
 *   [kpi_uuid]: { measured_value: number | null, status: string }
 * }
 */
export async function fetchLatestKpiRunsForPeriod(kpiUuids: string[], period: string) {
  try {
    const periodoISO = safeText(period)
    const uuids = Array.isArray(kpiUuids) ? kpiUuids.map((u) => String(u).trim()).filter(Boolean) : []

    if (!periodoISO || uuids.length === 0) {
      return { success: true as const, data: {} as Record<string, { measured_value: number | null; status: string }> }
    }

    // ✅ 1) tenta pegar só is_latest = true
    const rowsLatest = await sql`
      SELECT DISTINCT ON (kpi_uuid)
        kpi_uuid,
        measured_value,
        status
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
              status
            FROM kpi_runs
            WHERE kpi_uuid = ANY(${uuids}::uuid[])
              AND period = ${periodoISO}
            ORDER BY kpi_uuid, updated_at DESC NULLS LAST, created_at DESC
          `

    const map: Record<string, { measured_value: number | null; status: string }> = {}

    for (const r of rows || []) {
      const key = String(r?.kpi_uuid || "").trim()
      if (!key) continue
      map[key] = {
        measured_value: r?.measured_value === null || r?.measured_value === undefined ? null : Number(r.measured_value),
        status: String(r?.status || "").trim(),
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
