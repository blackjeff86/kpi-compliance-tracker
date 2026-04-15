"use server"

import { neon } from "@neondatabase/serverless"
import {
  fetchStoredJiraIntegrationConfig,
  normalizeJiraIntegrationConfig,
  testJiraConnection,
  type JiraIntegrationConfig,
} from "@/lib/jira"

const sql = neon(process.env.DATABASE_URL!)

export type AdminKpiRules = {
  yellow_ratio: number
  zero_meta_yellow_max: number
}

const DEFAULT_RULES: AdminKpiRules = {
  yellow_ratio: 0.9,
  zero_meta_yellow_max: 1,
}

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

function normalizeRules(input: Partial<AdminKpiRules> | null | undefined): AdminKpiRules {
  const yellow_ratio = safeNumber((input as any)?.yellow_ratio)
  const zero_meta_yellow_max = safeNumber((input as any)?.zero_meta_yellow_max)

  return {
    yellow_ratio: clamp(yellow_ratio ?? DEFAULT_RULES.yellow_ratio, 0.01, 0.999),
    zero_meta_yellow_max: clamp(zero_meta_yellow_max ?? DEFAULT_RULES.zero_meta_yellow_max, 0, 999999),
  }
}

/**
 * helpers internos (NÃO exportar em arquivo use server)
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

function computeKpiStatusWithRules(
  metaRaw: any,
  atualRaw: any,
  rules?: Partial<AdminKpiRules>
): "GREEN" | "YELLOW" | "RED" {
  const r = normalizeRules(rules || null)

  const metaN = parseNumberLoose(metaRaw)
  const atualN = parseNumberLoose(atualRaw)

  if (metaN === null || atualN === null) return "YELLOW"

  const lowerIsBetter = metaN === 0

  if (lowerIsBetter) {
    if (atualN === 0) return "GREEN"
    if (atualN > 0 && atualN <= r.zero_meta_yellow_max) return "YELLOW"
    return "RED"
  }

  const yellowFloor = metaN * r.yellow_ratio

  if (atualN >= metaN) return "GREEN"
  if (atualN >= yellowFloor) return "YELLOW"
  return "RED"
}

export type ControlRollup = {
  total_kpis: number
  executed_kpis: number
  green: number
  yellow: number
  red: number
  final_label: "Em aberto" | "Não conforme" | "Em atenção" | "Conforme"
}

function computeControlRollup(params: {
  totalKpis: number
  executedKpis: number
  green: number
  yellow: number
  red: number
}): ControlRollup {
  const total_kpis = Math.max(0, Number(params.totalKpis || 0))
  const executed_kpis = Math.max(0, Number(params.executedKpis || 0))
  const green = Math.max(0, Number(params.green || 0))
  const yellow = Math.max(0, Number(params.yellow || 0))
  const red = Math.max(0, Number(params.red || 0))

  let final_label: ControlRollup["final_label"] = "Em aberto"

  if (executed_kpis < total_kpis) {
    final_label = "Em aberto"
  } else if (red > 0) {
    final_label = "Não conforme"
  } else if (yellow > 0) {
    final_label = "Em atenção"
  } else {
    final_label = "Conforme"
  }

  return { total_kpis, executed_kpis, green, yellow, red, final_label }
}

/**
 * Server Actions reais (essas SIM exportadas)
 */

export async function fetchAdminKpiRules() {
  try {
    const rows = await sql`
      SELECT value_json
      FROM admin_settings
      WHERE key = 'kpi_rules'
      LIMIT 1
    `
    const raw = rows?.[0]?.value_json ?? null
    const rules = normalizeRules(raw)
    return { success: true as const, data: rules }
  } catch (e) {
    return {
      success: true as const,
      data: DEFAULT_RULES,
      warning: "Tabela admin_settings não encontrada. Usando regras padrão.",
    }
  }
}

export async function saveAdminKpiRules(input: Partial<AdminKpiRules>) {
  try {
    const rules = normalizeRules(input)

    await sql`
      INSERT INTO admin_settings (key, value_json, updated_at)
      VALUES ('kpi_rules', ${JSON.stringify(rules)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = now()
    `
    return { success: true as const, data: rules }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao salvar regras no banco." }
  }
}

type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"
type KpiValueType = "PERCENT" | "NUMBER" | "BOOLEAN"
type EvidenceProvider = "GOOGLE_DRIVE"

export type AdminEvidenceUploadConfig = {
  enabled: boolean
  provider: EvidenceProvider
  drive_root_folder_id: string
}

const DEFAULT_EVIDENCE_UPLOAD_CONFIG: AdminEvidenceUploadConfig = {
  enabled: false,
  provider: "GOOGLE_DRIVE",
  drive_root_folder_id: "",
}

export async function fetchAdminJiraIntegrationConfig() {
  const result = await fetchStoredJiraIntegrationConfig()
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}

export async function saveAdminJiraIntegrationConfig(input: Partial<JiraIntegrationConfig>) {
  try {
    const payload = normalizeJiraIntegrationConfig(input)

    if (payload.enabled) {
      if (!payload.base_url) return { success: false as const, error: "Informe a URL base do Jira." }
      if (!payload.user_email) return { success: false as const, error: "Informe o usuário/e-mail técnico do Jira." }
      if (!payload.api_token) return { success: false as const, error: "Informe o token de API do Jira." }
      if (!payload.project_key) return { success: false as const, error: "Informe a chave do projeto no Jira." }
      if (!payload.epic_controles_key) return { success: false as const, error: "Informe o Epic fixo de Controles." }
      if (!payload.epic_automacoes_key) return { success: false as const, error: "Informe o Epic fixo de Automações." }
      if (!payload.story_issue_type) return { success: false as const, error: "Informe o tipo de issue da Story." }
      if (!payload.task_issue_type) return { success: false as const, error: "Informe o tipo de issue da Task." }
    }

    await sql`
      INSERT INTO admin_settings (key, value_json, updated_at)
      VALUES ('jira_integration_config', ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = now()
    `

    return { success: true as const, data: payload }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao salvar configuração do Jira." }
  }
}

export async function testAdminJiraIntegration(input: Partial<JiraIntegrationConfig>) {
  return testJiraConnection(input)
}

function normalizeMode(v: any): KpiEvaluationMode {
  const s = String(v || "").trim().toUpperCase()
  if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
  return "UP"
}

function normalizeValueType(v: any): KpiValueType {
  const s = String(v || "").trim().toUpperCase()
  if (s === "BOOLEAN") return "BOOLEAN"
  if (s === "PERCENT" || s === "PERCENTUAL" || s === "%") return "PERCENT"
  return "NUMBER"
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

function normalizeEvidenceUploadConfig(input: any): AdminEvidenceUploadConfig {
  const enabledRaw = input?.enabled
  const enabled =
    enabledRaw === true ||
    String(enabledRaw || "")
      .trim()
      .toLowerCase() === "true"

  const providerRaw = String(input?.provider || "").trim().toUpperCase()
  const provider: EvidenceProvider = providerRaw === "GOOGLE_DRIVE" ? "GOOGLE_DRIVE" : "GOOGLE_DRIVE"
  const drive_root_folder_id = String(input?.drive_root_folder_id || "").trim()

  return {
    enabled,
    provider,
    drive_root_folder_id,
  }
}

export async function fetchAdminEvidenceUploadConfig() {
  try {
    const rows = await sql`
      SELECT value_json
      FROM admin_settings
      WHERE key = 'evidence_upload_config'
      LIMIT 1
    `
    const raw = rows?.[0]?.value_json || null
    const data = raw ? normalizeEvidenceUploadConfig(raw) : DEFAULT_EVIDENCE_UPLOAD_CONFIG
    return { success: true as const, data }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao carregar configuração de upload." }
  }
}

export async function saveAdminEvidenceUploadConfig(input: Partial<AdminEvidenceUploadConfig>) {
  try {
    const payload = normalizeEvidenceUploadConfig({
      ...DEFAULT_EVIDENCE_UPLOAD_CONFIG,
      ...(input || {}),
    })

    if (payload.enabled && !payload.drive_root_folder_id) {
      return { success: false as const, error: "Informe o ID da pasta raiz do Google Drive para habilitar o upload." }
    }

    await sql`
      INSERT INTO admin_settings (key, value_json, updated_at)
      VALUES ('evidence_upload_config', ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = now()
    `

    return { success: true as const, data: payload }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao salvar configuração de upload." }
  }
}

export async function fetchAdminKpiMatrix() {
  try {
    const rows = await sql`
      SELECT
        c.id_control,
        c.name_control,
        COALESCE(c.framework, 'N/A') AS framework,
        COALESCE(c.frequency, 'N/A') AS frequency,
        COALESCE(c.owner_name, 'Não atribuído') AS owner_name,
        COALESCE(c.focal_point_name, 'Não atribuído') AS focal_point_name,
        COALESCE(c.risk_title, 'N/A') AS risk_title,

        ck.kpi_uuid::text AS kpi_uuid,
        COALESCE(ck.kpi_id, '') AS kpi_id,
        COALESCE(ck.kpi_name, ck.kpi_id, 'KPI não identificado') AS kpi_name,
        COALESCE(ck.kpi_type, '') AS kpi_type,
        COALESCE(ck.kpi_target::text, '') AS kpi_target,
        COALESCE(ck.kpi_evaluation_mode, 'UP') AS kpi_evaluation_mode,

        aset.value_json AS kpi_rules_json
      FROM controls c
      JOIN control_kpis ck ON ck.id_control = c.id_control
      LEFT JOIN admin_settings aset
        ON aset.key = ('kpi_rules:' || ck.kpi_uuid::text)
      ORDER BY c.id_control ASC, ck.kpi_id ASC
    `

    return { success: true as const, data: rows }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao carregar matriz de KPIs." }
  }
}

export async function saveAdminKpiConfig(input: {
  kpi_uuid: string
  value_type: KpiValueType | string
  direction: KpiEvaluationMode | string
  target_value?: string | number | null
  target_boolean?: string | null
  warning_margin?: string | number | null
}) {
  try {
    const kpiUuid = safeText(input.kpi_uuid)
    if (!kpiUuid) return { success: false as const, error: "kpi_uuid é obrigatório." }

    const valueType = normalizeValueType(input.value_type)
    const direction = normalizeMode(input.direction)

    let targetToStore = "0"
    let modeToStore: KpiEvaluationMode = direction
    let warningMargin = 0
    let rules: AdminKpiRules = { ...DEFAULT_RULES }

    if (valueType === "BOOLEAN") {
      modeToStore = "BOOLEAN"
      const boolTarget = parseBooleanLoose(input.target_boolean)
      if (boolTarget === null) {
        return { success: false as const, error: "Para KPI booleano, a meta deve ser Sim ou Não." }
      }
      targetToStore = boolTarget ? "true" : "false"
      warningMargin = 0
      rules = { ...DEFAULT_RULES }
    } else {
      modeToStore = direction === "DOWN" ? "DOWN" : "UP"
      const targetN = safeNumber(input.target_value)
      const warningN = safeNumber(input.warning_margin)

      if (targetN === null) {
        return { success: false as const, error: "Meta numérica inválida." }
      }
      if (warningN === null || warningN < 0) {
        return { success: false as const, error: "Faixa de warning inválida." }
      }

      targetToStore = String(targetN)
      warningMargin = warningN

      if (modeToStore === "UP") {
        if (targetN <= 0) {
          return {
            success: false as const,
            error: "Para 'Quanto maior melhor', a meta deve ser maior que 0 para aplicar faixa de warning.",
          }
        }
        const ratio = (targetN - warningN) / targetN
        rules = {
          yellow_ratio: clamp(ratio, 0.01, 0.999),
          zero_meta_yellow_max: clamp(warningN, 0, 999999),
        }
      } else {
        rules = {
          yellow_ratio: DEFAULT_RULES.yellow_ratio,
          zero_meta_yellow_max: clamp(warningN, 0, 999999),
        }
      }
    }

    await sql`
      UPDATE control_kpis
      SET
        kpi_target = ${targetToStore},
        kpi_evaluation_mode = ${modeToStore},
        updated_at = now()
      WHERE kpi_uuid = (${kpiUuid})::uuid
    `

    const key = `kpi_rules:${kpiUuid}`
    const payload = {
      ...rules,
      warning_margin: warningMargin,
      value_type: valueType,
      direction: modeToStore,
    }

    await sql`
      INSERT INTO admin_settings (key, value_json, updated_at)
      VALUES (${key}, ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = now()
    `

    return {
      success: true as const,
      data: {
        kpi_uuid: kpiUuid,
        kpi_target: targetToStore,
        kpi_evaluation_mode: modeToStore,
        rules: payload,
      },
    }
  } catch (e: any) {
    return { success: false as const, error: e?.message || "Falha ao salvar configuração do KPI." }
  }
}
