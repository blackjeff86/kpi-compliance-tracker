"use server"

import { neon } from "@neondatabase/serverless"
import { revalidatePath } from "next/cache"

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
 * ✅ Retorna detalhes do run mais recente (is_latest) por KPI UUID.
 * Prioriza o período informado; se não encontrar no período, faz fallback para qualquer período.
 * Saída: { [kpi_uuid]: { measured_value, status, kpi_code } }
 */
export async function fetchLatestKpiRunDetails(kpiUuids: string[], period: string) {
  try {
    const periodoISO = String(period || "").trim()
    const uuids = Array.isArray(kpiUuids) ? kpiUuids.map((u) => String(u).trim()).filter(Boolean) : []

    if (uuids.length === 0) {
      return {
        success: true as const,
        data: {} as Record<string, { measured_value: string; status: string; kpi_code: string }>,
      }
    }

    const rowsPeriod =
      periodoISO
        ? await sql`
            SELECT DISTINCT ON (kpi_uuid)
              kpi_uuid,
              measured_value::text AS measured_value,
              status,
              COALESCE(kpi_code, '') AS kpi_code
            FROM kpi_runs
            WHERE kpi_uuid = ANY(${uuids}::uuid[])
              AND is_latest = TRUE
              AND period = ${periodoISO}
            ORDER BY kpi_uuid, updated_at DESC NULLS LAST, created_at DESC
          `
        : []

    const map: Record<string, { measured_value: string; status: string; kpi_code: string }> = {}
    for (const r of rowsPeriod || []) {
      const key = String(r?.kpi_uuid || "").trim()
      if (!key) continue
      map[key] = {
        measured_value: String(r?.measured_value ?? "").trim(),
        status: String(r?.status ?? "").trim(),
        kpi_code: String(r?.kpi_code ?? "").trim(),
      }
    }

    const missing = uuids.filter((u) => !map[u])
    if (missing.length > 0) {
      const rowsFallback = await sql`
        SELECT DISTINCT ON (kpi_uuid)
          kpi_uuid,
          measured_value::text AS measured_value,
          status,
          COALESCE(kpi_code, '') AS kpi_code
        FROM kpi_runs
        WHERE kpi_uuid = ANY(${missing}::uuid[])
          AND is_latest = TRUE
        ORDER BY kpi_uuid, updated_at DESC NULLS LAST, created_at DESC
      `

      for (const r of rowsFallback || []) {
        const key = String(r?.kpi_uuid || "").trim()
        if (!key) continue
        if (!map[key]) {
          map[key] = {
            measured_value: String(r?.measured_value ?? "").trim(),
            status: String(r?.status ?? "").trim(),
            kpi_code: String(r?.kpi_code ?? "").trim(),
          }
        }
      }
    }

    return { success: true as const, data: map }
  } catch (error: any) {
    console.error("Erro fetchLatestKpiRunDetails:", error)
    return {
      success: false as const,
      error: `Erro ao buscar runs dos KPIs. Detalhe: ${error?.message || "erro desconhecido"}`,
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

export async function updateControlTechnicalDetails(input: {
  current_id_control: string
  id_control: string
  framework?: string | null
  description_control?: string | null
  goal_control?: string | null
  risk_title?: string | null
  risk_id?: string | null
  risk_name?: string | null
  risk_description?: string | null
}) {
  try {
    const currentId = safeText(input.current_id_control)
    const nextId = safeText(input.id_control)

    if (!currentId) return { success: false as const, error: "current_id_control é obrigatório." }
    if (!nextId) return { success: false as const, error: "id_control é obrigatório." }

    const framework = safeText(input.framework)
    const descriptionControl = safeText(input.description_control)
    const goalControl = safeText(input.goal_control)
    const riskTitle = safeText(input.risk_title)
    const riskId = safeText(input.risk_id)
    const riskName = safeText(input.risk_name)
    const riskDescription = safeText(input.risk_description)

    const exists = await sql`
      SELECT id_control
      FROM controls
      WHERE id_control = ${currentId}
      LIMIT 1
    `
    if (!exists?.length) return { success: false as const, error: "Controle não encontrado." }

    if (nextId !== currentId) {
      const conflict = await sql`
        SELECT id_control
        FROM controls
        WHERE id_control = ${nextId}
        LIMIT 1
      `
      if (conflict?.length) return { success: false as const, error: "Já existe um controle com esse ID." }
    }

    const updated = await sql`
      UPDATE controls
      SET
        id_control = ${nextId},
        framework = ${framework},
        description_control = ${descriptionControl},
        goal_control = ${goalControl},
        risk_title = ${riskTitle},
        risk_id = ${riskId},
        risk_name = ${riskName},
        risk_description = ${riskDescription}
      WHERE id_control = ${currentId}
      RETURNING
        id_control,
        framework,
        description_control,
        goal_control,
        risk_title,
        risk_id,
        risk_name,
        risk_description
    `

    const row = updated?.[0]
    if (!row) return { success: false as const, error: "Falha ao atualizar detalhes técnicos." }

    if (nextId !== currentId) {
      // Se não houver FK com ON UPDATE CASCADE, mantém integridade manualmente.
      await sql`UPDATE control_kpis SET id_control = ${nextId} WHERE id_control = ${currentId}`
      try {
        await sql`UPDATE control_history SET id_control = ${nextId} WHERE id_control = ${currentId}`
      } catch {}
      try {
        await sql`UPDATE action_plans SET id_control = ${nextId} WHERE id_control = ${currentId}`
      } catch {}
    }

    revalidatePath("/controles")
    revalidatePath(`/controles/${encodeURIComponent(currentId)}`)
    revalidatePath(`/controles/${encodeURIComponent(nextId)}`)

    return { success: true as const, data: row }
  } catch (error: any) {
    console.error("Erro updateControlTechnicalDetails:", error)
    return {
      success: false as const,
      error: `Erro ao atualizar detalhes técnicos. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}
