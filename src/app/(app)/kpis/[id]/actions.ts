"use server"

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

/**
 * Regras (mesmas do admin)
 */
export type AdminKpiRules = {
  yellow_ratio: number
  zero_meta_yellow_max: number
}

const DEFAULT_RULES: AdminKpiRules = {
  yellow_ratio: 0.9,
  zero_meta_yellow_max: 1,
}

/**
 * ✅ Novo: modo de avaliação do KPI
 * - UP: quanto maior melhor (>= meta)
 * - DOWN: quanto menor melhor (<= meta)
 * - BOOLEAN: sim/não
 */
export type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"

/** Utils (não exportar) */
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

function normalizeRules(input: any): AdminKpiRules {
  const yellow_ratio = safeNumber(input?.yellow_ratio)
  const zero_meta_yellow_max = safeNumber(input?.zero_meta_yellow_max)

  return {
    yellow_ratio: clamp(yellow_ratio ?? DEFAULT_RULES.yellow_ratio, 0.01, 0.999),
    zero_meta_yellow_max: clamp(zero_meta_yellow_max ?? DEFAULT_RULES.zero_meta_yellow_max, 0, 999999),
  }
}

function isUuidLike(v: any) {
  const s = String(v || "").trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function normalizeMode(v: any): KpiEvaluationMode {
  const s = String(v || "").trim().toUpperCase()
  if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
  return "UP"
}

/**
 * ✅ Parse numérico tolerante: "10%", "10,5", 10, etc.
 */
function parseNumberLoose(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const s = v.trim().replace("%", "").replace(",", ".")
    if (!s) return null
    const n = Number(s)
    return Number.isNaN(n) ? null : n
  }
  return null
}

/**
 * ✅ Parse boolean tolerante:
 * - aceita: true/false, "sim"/"não", "yes"/"no", "1"/"0", "ok"/"fail"
 */
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
 * ✅ Motor universal: calcula status usando mode + rules
 *
 * ⚠️ ATENÇÃO: NÃO EXPORTAR em arquivo com "use server"
 * (Server Actions exigem export async, então deixamos interno)
 */
function computeKpiStatusUniversal(params: {
  mode: KpiEvaluationMode
  target: any
  measured: any
  rules?: Partial<AdminKpiRules>
}): "GREEN" | "YELLOW" | "RED" {
  const r = normalizeRules(params.rules || null)
  const mode = normalizeMode(params.mode)

  if (mode === "BOOLEAN") {
    const t = parseBooleanLoose(params.target)
    const m = parseBooleanLoose(params.measured)
    if (t === null || m === null) return "YELLOW"
    return m === t ? "GREEN" : "RED"
  }

  const targetN = parseNumberLoose(params.target)
  const measuredN = parseNumberLoose(params.measured)
  if (targetN === null || measuredN === null) return "YELLOW"

  if (mode === "UP") {
    const yellowFloor = targetN * r.yellow_ratio
    if (measuredN >= targetN) return "GREEN"
    if (measuredN >= yellowFloor) return "YELLOW"
    return "RED"
  }

  // DOWN (menor melhor)
  const bufferMax = targetN + r.zero_meta_yellow_max
  if (measuredN <= targetN) return "GREEN"
  if (measuredN > targetN && measuredN <= bufferMax) return "YELLOW"
  return "RED"
}

async function fetchRulesForKpi(kpiUuid: string | null): Promise<{ rules: AdminKpiRules; warning?: string }> {
  try {
    // 1) tenta regra por KPI
    if (kpiUuid) {
      const key = `kpi_rules:${kpiUuid}`
      const r1 = await sql`
        SELECT value_json
        FROM admin_settings
        WHERE key = ${key}
        LIMIT 1
      `
      if (r1?.length) return { rules: normalizeRules(r1[0]?.value_json) }
    }

    // 2) tenta global
    const r2 = await sql`
      SELECT value_json
      FROM admin_settings
      WHERE key = 'kpi_rules'
      LIMIT 1
    `
    if (r2?.length) return { rules: normalizeRules(r2[0]?.value_json) }

    return { rules: DEFAULT_RULES, warning: "Nenhuma regra encontrada no admin_settings. Usando padrão." }
  } catch {
    return { rules: DEFAULT_RULES, warning: "Tabela admin_settings não disponível. Usando padrão." }
  }
}

/**
 * Resolve o KPI a partir do kpiRef:
 * - se for UUID => busca por kpi_uuid
 * - senão => busca por kpi_id (texto) ou kpi_name
 */
async function resolveKpiDetail(kpiRef: string) {
  const ref = safeText(kpiRef)
  if (!ref) return null

  if (isUuidLike(ref)) {
    const rows = await sql`
      SELECT
        ck.kpi_uuid,
        ck.kpi_id,
        ck.kpi_name,
        ck.kpi_description,
        ck.kpi_type,
        ck.kpi_target,
        ck.kpi_evaluation_mode,
        ck.reference_month,

        ck.id_control,
        c.name_control as control_name,
        c.framework,
        c.risk_title,
        c.focal_point_name
      FROM control_kpis ck
      LEFT JOIN controls c ON c.id_control = ck.id_control
      WHERE ck.kpi_uuid = (${ref})::uuid
      ORDER BY ck.updated_at DESC NULLS LAST, ck.created_at DESC
      LIMIT 1
    `
    return rows?.[0] ?? null
  }

  const rows = await sql`
    SELECT
      ck.kpi_uuid,
      ck.kpi_id,
      ck.kpi_name,
      ck.kpi_description,
      ck.kpi_type,
      ck.kpi_target,
      ck.kpi_evaluation_mode,
      ck.reference_month,

      ck.id_control,
      c.name_control as control_name,
      c.framework,
      c.risk_title,
      c.focal_point_name
    FROM control_kpis ck
    LEFT JOIN controls c ON c.id_control = ck.id_control
    WHERE (ck.kpi_id = ${ref} OR ck.kpi_name = ${ref})
    ORDER BY ck.updated_at DESC NULLS LAST, ck.created_at DESC
    LIMIT 1
  `
  return rows?.[0] ?? null
}

/**
 * ✅ BUSCA detalhe do KPI + regras (kpi_rules:<uuid> ou global)
 */
export async function fetchKpiDetail(kpiRef: string) {
  try {
    const detail = await resolveKpiDetail(kpiRef)
    if (!detail) return { success: false as const, error: "KPI não encontrado." }

    const kpiUuid = detail?.kpi_uuid ? String(detail.kpi_uuid) : null
    const { rules, warning } = await fetchRulesForKpi(kpiUuid)

    return {
      success: true as const,
      data: {
        detail: {
          kpi_uuid: detail.kpi_uuid ?? null,
          kpi_id: detail.kpi_id ?? "",
          kpi_name: detail.kpi_name ?? "Indicador",
          kpi_description: detail.kpi_description ?? null,

          // continua como está (manual/automatizado etc.)
          kpi_type: detail.kpi_type ?? null,

          // novo
          kpi_evaluation_mode: normalizeMode(detail.kpi_evaluation_mode),

          kpi_target: detail.kpi_target ?? null,
          reference_month: detail.reference_month ?? null,

          id_control: detail.id_control ?? "",
          control_name: detail.control_name ?? null,
          framework: detail.framework ?? null,
          risk_title: detail.risk_title ?? null,

          focal_point_name: detail.focal_point_name ?? null,
        },
        rules,
      },
      ...(warning ? { warning } : {}),
    }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao carregar KPI." }
  }
}

/**
 * ✅ SALVA:
 * 1) kpi_target + kpi_evaluation_mode no control_kpis
 * 2) regras por KPI em admin_settings (key = kpi_rules:<kpi_uuid>)
 */
export async function saveKpiTargetAndRules(input: {
  kpiRef: string
  kpi_target: string
  kpi_evaluation_mode: KpiEvaluationMode
  yellow_ratio: number
  zero_meta_yellow_max: number
}) {
  try {
    const kpiRef = safeText(input.kpiRef)
    if (!kpiRef) return { success: false as const, error: "kpiRef é obrigatório." }

    const detail = await resolveKpiDetail(kpiRef)
    if (!detail) return { success: false as const, error: "KPI não encontrado." }

    const kpiUuid = detail?.kpi_uuid ? String(detail.kpi_uuid) : null
    if (!kpiUuid) return { success: false as const, error: "KPI sem kpi_uuid." }

    const mode = normalizeMode(input.kpi_evaluation_mode)

    // target:
    // - BOOLEAN: guarda "true" / "false"
    // - UP/DOWN: guarda texto (seu padrão atual)
    let kpi_target = safeText(input.kpi_target) ?? "0"
    if (mode === "BOOLEAN") {
      const t = parseBooleanLoose(kpi_target)
      if (t === null) return { success: false as const, error: "Meta inválida para modo BOOLEAN (use Sim/Não)." }
      kpi_target = t ? "true" : "false"
    }

    const rules = normalizeRules({
      yellow_ratio: input.yellow_ratio,
      zero_meta_yellow_max: input.zero_meta_yellow_max,
    })

    // 1) atualiza target + mode no control_kpis
    await sql`
      UPDATE control_kpis
      SET kpi_target = ${kpi_target},
          kpi_evaluation_mode = ${mode},
          updated_at = now()
      WHERE kpi_uuid = (${kpiUuid})::uuid
    `

    // 2) salva regras por KPI (se falhar, não quebra)
    let warning: string | undefined
    try {
      const key = `kpi_rules:${kpiUuid}`
      await sql`
        INSERT INTO admin_settings (key, value_json, updated_at)
        VALUES (${key}, ${JSON.stringify(rules)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE
        SET value_json = EXCLUDED.value_json,
            updated_at = now()
      `
    } catch {
      warning = "Não foi possível salvar regras no admin_settings. A meta/modo foram salvos, mas a regra ficou padrão."
    }

    return {
      success: true as const,
      data: {
        kpi_target,
        kpi_evaluation_mode: mode,
        rules: warning ? DEFAULT_RULES : rules,
      },
      ...(warning ? { warning } : {}),
    }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao salvar." }
  }
}
