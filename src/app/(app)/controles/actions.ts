// src/app/(app)/controles/actions.ts
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
 * ✅ Normaliza status para o enum do banco (kpi_status):
 * - GREEN | YELLOW | RED
 */
function normalizeKpiStatus(v: any): "GREEN" | "YELLOW" | "RED" | null {
  const s = (v ?? "").toString().trim()
  if (!s) return null

  const up = s.toUpperCase()

  // já vem certo
  if (up === "GREEN" || up === "YELLOW" || up === "RED") return up as any

  // legados / pt-br (caso algum lugar mande texto humano)
  if (up.includes("META ATINGIDA") || up.includes("ATINGIDA") || up.includes("OK") || up.includes("CONFORME"))
    return "GREEN"
  if (up.includes("CRIT") || up.includes("CRÍT") || up.includes("RED")) return "RED"
  if (up.includes("ATEN") || up.includes("PEND") || up.includes("YELLOW")) return "YELLOW"

  // fallback seguro
  return "YELLOW"
}

/**
 * ✅ Normaliza uma string de frequência para valores canônicos esperados:
 * DAILY | WEEKLY | MONTHLY | QUARTERLY | SEMI_ANNUAL | ANNUAL | ON_DEMAND
 */
function normalizeFrequencyValue(v: any) {
  const raw = safeText(v)
  if (!raw) return null

  // ✅ FIX: remove acentos antes de normalizar (evita DIÁRIO virar caso não reconhecido)
  const stripAccents = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

  // base para comparação (sem acento)
  const up = stripAccents(raw.toString().trim().toUpperCase())

  const key = up
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/__+/g, "_")

  // ✅ DAILY / DIÁRIO
  // cobre: DIARIO, DIARIA, DIARIAMENTE, TODO_DIA, TODOS_OS_DIAS, D+1, D1, DAILY, DAY
  if (
    key === "DAILY" ||
    key === "DAY" ||
    key.includes("DAILY") ||
    key.includes("DIAR") ||
    key.includes("DIARIA") ||
    key.includes("DIARIAMENTE") ||
    key.includes("TODO_DIA") ||
    key.includes("TODOS_OS_DIAS") ||
    key === "D1" ||
    key === "D+1" ||
    key.includes("D+1")
  )
    return "DAILY"

  // ✅ WEEKLY / SEMANAL
  if (key === "WEEKLY" || key.includes("WEEK") || key.includes("SEMAN")) return "WEEKLY"

  // ✅ MONTHLY / MENSAL
  if (key === "MONTHLY" || key.includes("MONTH") || key.includes("MENSAL")) return "MONTHLY"

  // ✅ QUARTERLY / TRIMESTRAL
  if (key === "QUARTERLY" || key === "QUARTER" || key.includes("QUART") || key.includes("TRIMEST"))
    return "QUARTERLY"

  // ✅ SEMI_ANNUAL / SEMESTRAL
  if (
    key === "SEMI_ANNUAL" ||
    key === "SEMIANNUAL" ||
    key === "SEMI-ANNUAL" ||
    key === "SEMI" ||
    key.includes("SEMI_ANNUAL") ||
    key.includes("SEMIANNUAL") ||
    key.includes("SEMIANNU") ||
    key.includes("SEMEST") ||
    key.includes("SEMESTRAL") ||
    key.includes("SEMESTRE") ||
    key.includes("SEMESTRALMENTE")
  )
    return "SEMI_ANNUAL"

  // ✅ ANNUAL / ANUAL (sem confundir com SEMI_ANNUAL)
  if (
    (key === "ANNUAL" ||
      key === "YEARLY" ||
      key === "YEAR" ||
      key.includes("ANNUAL") ||
      key.includes("ANUAL") ||
      key.includes("YEAR")) &&
    !key.startsWith("SEMI") &&
    !key.includes("SEMI_ANNUAL") &&
    !key.includes("SEMIANNUAL") &&
    !key.includes("SEMEST")
  )
    return "ANNUAL"

  // ✅ ON_DEMAND / ADHOC / SOB DEMANDA
  if (
    key === "ON_DEMAND" ||
    key.includes("ON_DEMAND") ||
    key.includes("ONDEMAND") ||
    key.includes("ON_DEM") ||
    key.includes("SOB_DEMANDA") ||
    key.includes("SOBDEMANDA") ||
    key.includes("AD_HOC") ||
    key.includes("ADHOC")
  )
    return "ON_DEMAND"

  // fallback: mantém como veio
  return raw
}

/**
 * ✅ Resolve frequência a partir de múltiplas colunas possíveis do CSV/objeto.
 * Se houver conflito (ex.: frequency=ON_DEMAND mas outro campo=DAILY),
 * escolhe a MAIS PRIORITÁRIA.
 */
function resolveFrequencyFromRow(c: any) {
  const candidates = [
    c.frequency,
    c.frequencia,
    c.control_frequency,
    c.controlFrequency,
    c.frequency_name,
    c.frequencyName,
    c.frequency_title,
    c.frequencyTitle,

    // extras comuns em CSVs
    c.periodicity,
    c.periodicidade,
    c.cadence,
    c.cadencia,
    c.schedule,
    c.agenda,
  ]
    .map(normalizeFrequencyValue)
    .filter((x) => !!x) as string[]

  if (candidates.length === 0) return null

  // prioridade: se existir DAILY em qualquer lugar, ele vence
  const priority: Record<string, number> = {
    DAILY: 1,
    WEEKLY: 2,
    MONTHLY: 3,
    QUARTERLY: 4,
    SEMI_ANNUAL: 5,
    ANNUAL: 6,
    ON_DEMAND: 99,
  }

  candidates.sort((a, b) => (priority[a] ?? 50) - (priority[b] ?? 50))

  return candidates[0]
}

/**
 * ✅ Lista controles (1 por id_control)
 * ✅ Agora já traz:
 * - exec_done / exec_total
 * - green/yellow/red counts
 * - status_final (EM ABERTO | CONFORME | EM ATENÇÃO | NÃO CONFORME | NÃO APLICÁVEL)
 *
 * Regras de aplicabilidade por frequência (com base no mês do "period"):
 * - Mensal: sempre aplicável
 * - Trimestral: aplicável apenas em: Jan (Q4), Abr (Q1), Jul (Q2), Out (Q3)
 * - Semestral: aplicável apenas em: Jan (S2), Jul (S1)
 * - Anual: aplicável em Set-Out-Nov-Dez
 *
 * Obs: period deve ser ISO "YYYY-MM" (ex: "2026-02")
 */
export async function fetchControles(params?: { period?: string }) {
  try {
    const period = safeText(params?.period)

    // Se não passar período, mantém comportamento antigo (sem quebrar nada)
    if (!period) {
      const data = await sql`
        SELECT *
        FROM controls
        ORDER BY id_control ASC
      `
      return { success: true as const, data }
    }

    // ✅ Query: consolida status do controle baseado nos KPIs do mês selecionado
    const data = await sql`
      WITH period_ctx AS (
        -- ✅ FIX: cast direto para date (mais estável que TO_DATE com parâmetro)
        SELECT EXTRACT(MONTH FROM ((${period} || '-01')::date))::int AS m
      ),
      kpi_total AS (
        SELECT
          ck.id_control,
          COUNT(*)::int AS exec_total
        FROM control_kpis ck
        GROUP BY ck.id_control
      ),
      runs_period AS (
        SELECT
          ck.id_control,
          kr.status
        FROM control_kpis ck
        LEFT JOIN kpi_runs kr
          ON kr.kpi_uuid = ck.kpi_uuid
          AND kr.period = ${period}
          AND kr.is_latest = TRUE
      ),
      agg AS (
        SELECT
          rp.id_control,
          COUNT(rp.status)::int AS exec_done,
          COUNT(*) FILTER (WHERE rp.status = 'GREEN')::int AS green_count,
          COUNT(*) FILTER (WHERE rp.status = 'YELLOW')::int AS yellow_count,
          COUNT(*) FILTER (WHERE rp.status = 'RED')::int AS red_count
        FROM runs_period rp
        GROUP BY rp.id_control
      )
      SELECT
        c.*,

        COALESCE(kt.exec_total, 0) AS exec_total,
        COALESCE(a.exec_done, 0) AS exec_done,
        COALESCE(a.green_count, 0) AS green_count,
        COALESCE(a.yellow_count, 0) AS yellow_count,
        COALESCE(a.red_count, 0) AS red_count,

        CASE
          -- ✅ Aplica "NÃO APLICÁVEL" quando o mês do período não é mês de execução para a frequência do controle

          WHEN (
            -- trimestral
            (
              COALESCE(c.frequency, '') ILIKE '%trim%'
              OR COALESCE(c.frequency, '') ILIKE '%trime%'
              OR COALESCE(c.frequency, '') ILIKE '%quarter%'
              OR COALESCE(c.frequency, '') ILIKE '%trimestral%'
              OR UPPER(TRIM(COALESCE(c.frequency, ''))) = 'QUARTERLY'
              OR UPPER(TRIM(COALESCE(c.frequency, ''))) = 'QUARTER'
            )
            AND (SELECT m FROM period_ctx) NOT IN (1, 4, 7, 10)
          ) THEN 'NÃO APLICÁVEL'

          WHEN (
            -- ✅ semestral (robusto: SEMI_ANNUAL / SEMESTRAL / SEMI / SEMEST.. etc)
            (
              COALESCE(c.frequency, '') ILIKE '%semest%'
              OR COALESCE(c.frequency, '') ILIKE '%semestral%'
              OR COALESCE(c.frequency, '') ILIKE '%semi_annual%'
              OR COALESCE(c.frequency, '') ILIKE '%semi-annual%'
              OR COALESCE(c.frequency, '') ILIKE '%semiannual%'
              OR UPPER(TRIM(COALESCE(c.frequency, ''))) IN ('SEMI_ANNUAL','SEMIANNUAL','SEMI-ANNUAL','SEMI')
            )
            AND (SELECT m FROM period_ctx) NOT IN (1, 7)
          ) THEN 'NÃO APLICÁVEL'

          WHEN (
            -- ✅ anual (sem confundir com SEMI_ANNUAL)
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
          ) THEN 'NÃO APLICÁVEL'

          -- mensal (ou qualquer outro default): segue regra atual
          WHEN COALESCE(kt.exec_total, 0) = 0 THEN 'EM ABERTO'
          WHEN COALESCE(a.exec_done, 0) < COALESCE(kt.exec_total, 0) THEN 'EM ABERTO'
          WHEN COALESCE(a.red_count, 0) > 0 THEN 'NÃO CONFORME'
          WHEN COALESCE(a.yellow_count, 0) > 0 THEN 'EM ATENÇÃO'
          ELSE 'CONFORME'
        END AS status_final

      FROM controls c
      LEFT JOIN kpi_total kt ON kt.id_control = c.id_control
      LEFT JOIN agg a ON a.id_control = c.id_control
      ORDER BY c.id_control ASC
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

    // ✅ KPIs do controle (TRAZ kpi_uuid)
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
 * Helpers de período para a tela de KPIs
 * - Aceita:
 *   - "fevereiro / 2026"
 *   - "2026-02"
 */
const MONTHS_PT_MAP: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  "março": "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
}

function monthLabelToISO(label: string | null) {
  const raw = (label || "").toString().trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}$/.test(raw)) return raw

  const m = raw.toLowerCase().match(/^([a-zçãõ]+)\s*\/\s*(\d{4})$/i)
  if (!m) return null

  const monthName = m[1]
  const year = m[2]
  const mm = MONTHS_PT_MAP[monthName]
  if (!mm) return null

  return `${year}-${mm}`
}

function prevMonthISO(periodISO: string) {
  const m = periodISO.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  let y = Number(m[1])
  let mm = Number(m[2])

  mm -= 1
  if (mm === 0) {
    mm = 12
    y -= 1
  }
  return `${y}-${String(mm).padStart(2, "0")}`
}

/**
 * ✅ KPIs page:
 * - catálogo: control_kpis (1 linha por kpi_id)
 * - last/previous: kpi_runs usando kpi_uuid + period
 * - NÃO usa MAX(uuid)
 * - month pode ser "fevereiro / 2026" (UI) ou "2026-02"
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

    const monthRaw = safeText(params?.month)
    const monthISO = monthLabelToISO(monthRaw)
    const prevISO = monthISO ? prevMonthISO(monthISO) : null

    const kpiType = safeText(params?.kpiType)

    const totalRows = await sql`
      SELECT COUNT(DISTINCT ck.kpi_id)::int AS total
      FROM control_kpis ck
      WHERE (${kpiType}::text IS NULL OR ck.kpi_type = ${kpiType})
    `
    const total = Number(totalRows?.[0]?.total || 0)

    if (total === 0) {
      return { success: true as const, data: [] as any[], total: 0 }
    }

    const data = await sql`
      WITH kpi_catalog AS (
        SELECT DISTINCT ON (ck.kpi_id)
          ck.kpi_id,
          ck.kpi_uuid,
          COALESCE(ck.kpi_name, 'Indicador')      AS kpi_name,
          COALESCE(ck.kpi_description, '')        AS kpi_description,
          COALESCE(ck.kpi_type, 'Manual')         AS kpi_type,
          COALESCE(ck.kpi_target, '0')            AS kpi_target,
          COALESCE(c.framework, 'N/A')            AS framework,
          COALESCE(c.owner_area, 'Geral')         AS kpi_category
        FROM control_kpis ck
        LEFT JOIN controls c ON c.id_control = ck.id_control
        WHERE (${kpiType}::text IS NULL OR ck.kpi_type = ${kpiType})
        ORDER BY ck.kpi_id, ck.updated_at DESC NULLS LAST, ck.created_at DESC
      ),

      last_run AS (
        SELECT DISTINCT ON (kr.kpi_uuid)
          kr.kpi_uuid,
          kr.period,
          kr.measured_value,
          kr.status,
          kr.updated_at,
          kr.created_at
        FROM kpi_runs kr
        WHERE
          kr.is_latest = TRUE
          AND kr.kpi_uuid IS NOT NULL
          AND (${monthISO}::text IS NOT NULL AND kr.period = ${monthISO})
        ORDER BY kr.kpi_uuid, kr.updated_at DESC NULLS LAST, kr.created_at DESC
      ),

      prev_run AS (
        SELECT DISTINCT ON (kr.kpi_uuid)
          kr.kpi_uuid,
          kr.period,
          kr.measured_value,
          kr.status,
          kr.updated_at,
          kr.created_at
        FROM kpi_runs kr
        WHERE
          kr.is_latest = TRUE
          AND kr.kpi_uuid IS NOT NULL
          AND (${prevISO}::text IS NOT NULL AND kr.period = ${prevISO})
        ORDER BY kr.kpi_uuid, kr.updated_at DESC NULLS LAST, kr.created_at DESC
      )

      SELECT
        kc.kpi_id,
        kc.kpi_uuid,
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
      LEFT JOIN last_run lr ON lr.kpi_uuid = kc.kpi_uuid
      LEFT JOIN prev_run pr ON pr.kpi_uuid = kc.kpi_uuid
      ORDER BY kc.kpi_id ASC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `

    return { success: true as const, data, total }
  } catch (error: any) {
    console.error("Erro fetchKPIs:", error)
    return {
      success: false as const,
      error: `Erro ao carregar KPIs do banco. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}

/**
 * ✅ Para salvar execução diretamente (opcional)
 * Agora resolve kpi_uuid via control_kpis
 * ✅ Normaliza status para o enum: GREEN|YELLOW|RED
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

    const status = normalizeKpiStatus(input.status)
    const evidence_link = safeText(input.evidence_link)
    const executor_comment = safeText(input.executor_comment)
    const created_by_email = safeText(input.created_by_email)

    const kpiRows = await sql`
      SELECT kpi_uuid
      FROM control_kpis
      WHERE kpi_id = ${kpi_code}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `
    if (!kpiRows?.length || !kpiRows[0]?.kpi_uuid) {
      return { success: false as const, error: "Não foi possível resolver kpi_uuid para este kpi_code." }
    }
    const kpi_uuid = kpiRows[0].kpi_uuid

    await sql`
      UPDATE kpi_runs
      SET is_latest = FALSE,
          updated_at = now()
      WHERE kpi_uuid = ${kpi_uuid}
        AND period = ${period}
        AND is_latest = TRUE
    `

    const inserted = await sql`
      INSERT INTO kpi_runs (
        kpi_id,
        kpi_uuid,
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
        NULL,
        ${kpi_uuid},
        ${kpi_code},
        ${period},
        ${String(measured_value)},
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
    return {
      success: false as const,
      error: `Erro ao salvar execução do KPI. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}

/**
 * Importação:
 * - Garante 1 linha por controle em `controls`
 * - Garante N linhas em `control_kpis`
 * ✅ garante kpi_uuid (UUID)
 * ✅ NÃO apaga todos os KPIs
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

      // ✅ FIX: resolve frequência considerando múltiplos campos e conflitos
      const frequency = resolveFrequencyFromRow(c)

      return { ...c, id_control, kpi_id, frequency }
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
    return {
      success: false as const,
      error: `Falha ao registrar dados. Detalhe: ${error?.message || "erro desconhecido"}`,
    }
  }
}
