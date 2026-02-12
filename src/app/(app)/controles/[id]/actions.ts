"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

function safeText(v: any) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

/**
 * ✅ Retorna o status mais recente (is_latest) de cada KPI UUID.
 * Prioriza o período informado; se não achar naquele período, faz fallback para qualquer período.
 * Saída: { [kpi_uuid]: "GREEN" | "YELLOW" | "RED" | ... }
 */
export async function fetchLatestKpiStatuses(kpiUuids: string[], period: string) {
    try {
      const periodoISO = String(period || "").trim()
      const uuids = Array.isArray(kpiUuids) ? kpiUuids.map((u) => String(u).trim()).filter(Boolean) : []
  
      if (!periodoISO || uuids.length === 0) {
        return { success: true as const, data: {} as Record<string, string> }
      }
  
      // ✅ DISTINCT ON pega 1 linha por kpi_uuid, escolhendo a mais recente (created_at DESC)
      const rows = await sql`
        SELECT DISTINCT ON (kpi_uuid)
          kpi_uuid,
          status
        FROM kpi_runs
        WHERE kpi_uuid = ANY(${uuids}::uuid[])
          AND period = ${periodoISO}
        ORDER BY kpi_uuid, created_at DESC
      `
  
      const map: Record<string, string> = {}
      for (const r of rows || []) {
        const key = String(r?.kpi_uuid || "").trim()
        if (!key) continue
        map[key] = String(r?.status || "").trim()
      }
  
      return { success: true as const, data: map }
    } catch (error: any) {
      console.error("Erro fetchLatestKpiStatuses:", error)
      return {
        success: false as const,
        error: `Erro ao buscar status dos KPIs. Detalhe: ${error?.message || "erro desconhecido"}`,
      }
    }
}

/**
 * ✅ Cria KPI vinculado ao controle (control_kpis)
 * - Gera kpi_uuid
 * - Gera kpi_id sequencial no formato: "KPI ID N"
 */
export async function createControlKpi(input: {
  id_control: string
  kpi_name: string
  kpi_description?: string | null
  kpi_type: string
  kpi_target: string
  reference_month?: string | null
}) {
  try {
    const id_control = safeText(input.id_control)
    const kpi_name = safeText(input.kpi_name)
    const kpi_description = safeText(input.kpi_description)
    const kpi_type = safeText(input.kpi_type) || "Manual"
    const kpi_target = safeText(input.kpi_target) || "0"
    const reference_month = safeText(input.reference_month)

    if (!id_control) return { success: false as const, error: "id_control é obrigatório." }
    if (!kpi_name) return { success: false as const, error: "kpi_name é obrigatório." }
    if (!kpi_type) return { success: false as const, error: "kpi_type é obrigatório." }

    // pega o maior número do "KPI ID N"
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
        ${reference_month},
        now(),
        now()
      )
      RETURNING
        id_control,
        kpi_uuid,
        kpi_id,
        kpi_name,
        kpi_description,
        kpi_type,
        kpi_target,
        reference_month
    `

    return { success: true as const, data: inserted?.[0] || null }
  } catch (error: any) {
    console.error("Erro createControlKpi:", error)
    return {
      success: false as const,
      error: `Erro ao criar KPI. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}
