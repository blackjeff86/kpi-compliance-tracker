import sql from "@/lib/db"

export type PlanDomain = "CONTROLES" | "AUTOMACOES"

export type JiraIntegrationConfig = {
  enabled: boolean
  base_url: string
  user_email: string
  api_token: string
  project_key: string
  epic_controles_key: string
  epic_automacoes_key: string
  story_issue_type: string
  task_issue_type: string
  framework_field_id: string
  use_framework_labels: boolean
}

export type JiraIssueSyncResult =
  | {
      success: true
      epicKey: string
      epicUrl: string
      storyKey: string
      storyUrl: string
      issueKey: string
      issueUrl: string
    }
  | {
      success: false
      error: string
    }

const DEFAULT_JIRA_CONFIG: JiraIntegrationConfig = {
  enabled: false,
  base_url: "",
  user_email: "",
  api_token: "",
  project_key: "",
  epic_controles_key: "",
  epic_automacoes_key: "",
  story_issue_type: "Story",
  task_issue_type: "Task",
  framework_field_id: "",
  use_framework_labels: false,
}

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function safeBool(v: unknown) {
  if (v === true) return true
  return String(v || "")
    .trim()
    .toLowerCase() === "true"
}

function toPlanId(value: string) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function normalizeJiraIntegrationConfig(input: Partial<JiraIntegrationConfig> | null | undefined): JiraIntegrationConfig {
  return {
    enabled: safeBool(input?.enabled),
    base_url: safeText(input?.base_url).replace(/\/+$/, ""),
    user_email: safeText(input?.user_email),
    api_token: safeText(input?.api_token),
    project_key: safeText(input?.project_key).toUpperCase(),
    epic_controles_key: safeText(input?.epic_controles_key).toUpperCase(),
    epic_automacoes_key: safeText(input?.epic_automacoes_key).toUpperCase(),
    story_issue_type: safeText(input?.story_issue_type) || "Story",
    task_issue_type: safeText(input?.task_issue_type) || "Task",
    framework_field_id: safeText(input?.framework_field_id),
    use_framework_labels: safeBool(input?.use_framework_labels),
  }
}

export async function fetchStoredJiraIntegrationConfig() {
  try {
    const rows = await sql`
      SELECT value_json
      FROM admin_settings
      WHERE key = 'jira_integration_config'
      LIMIT 1
    `

    return {
      success: true as const,
      data: rows?.[0]?.value_json
        ? normalizeJiraIntegrationConfig(rows[0].value_json as Partial<JiraIntegrationConfig>)
        : DEFAULT_JIRA_CONFIG,
    }
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Falha ao carregar configuração do Jira.",
    }
  }
}

export async function ensureActionPlansJiraColumns() {
  try {
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_epic_key text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_epic_url text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_story_key text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_story_url text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_issue_key text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_issue_url text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_sync_status text
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_last_synced_at timestamp without time zone
    `
    await sql`
      ALTER TABLE action_plans
      ADD COLUMN IF NOT EXISTS jira_last_error text
    `
  } catch (error) {
    console.warn("Não foi possível garantir colunas de integração Jira em action_plans:", error)
  }
}

async function ensureJiraStoryMapTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS jira_control_story_map (
        id bigserial PRIMARY KEY,
        plan_domain text NOT NULL,
        framework text,
        control_code text NOT NULL,
        control_name text NOT NULL,
        jira_epic_key text NOT NULL,
        jira_epic_url text,
        jira_story_key text NOT NULL,
        jira_story_url text,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now()
      )
    `
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_jira_control_story_map_domain_control
      ON jira_control_story_map (plan_domain, control_code)
    `
  } catch (error) {
    console.warn("Não foi possível garantir tabela jira_control_story_map:", error)
  }
}

function buildAuthHeader(config: JiraIntegrationConfig) {
  return `Basic ${Buffer.from(`${config.user_email}:${config.api_token}`).toString("base64")}`
}

function validateJiraConfig(config: JiraIntegrationConfig) {
  if (!config.enabled) return "A integração com Jira está desabilitada."
  if (!config.base_url) return "Informe a URL base do Jira."
  if (!config.user_email) return "Informe o usuário/e-mail técnico do Jira."
  if (!config.api_token) return "Informe o token de API do Jira."
  if (!config.project_key) return "Informe a chave do projeto no Jira."
  if (!config.epic_controles_key) return "Informe o Epic fixo para Controles."
  if (!config.epic_automacoes_key) return "Informe o Epic fixo para Automações."
  if (!config.story_issue_type) return "Informe o tipo de issue da Story."
  if (!config.task_issue_type) return "Informe o tipo de issue da Task."
  return ""
}

async function parseJiraError(response: Response) {
  try {
    const data = await response.json()
    const messages = [
      ...(Array.isArray(data?.errorMessages) ? data.errorMessages : []),
      ...(data?.errors ? Object.values(data.errors) : []),
    ]
      .map((item) => safeText(item))
      .filter(Boolean)

    return messages.join(" | ") || `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

async function jiraRequest<T>(config: JiraIntegrationConfig, path: string, init?: RequestInit): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(`${config.base_url}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(config),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return { success: false, error: await parseJiraError(response) }
    }

    const data = (await response.json()) as T
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Falha na comunicação com o Jira." }
  }
}

export async function testJiraConnection(configInput?: Partial<JiraIntegrationConfig>) {
  const baseConfigRes = await fetchStoredJiraIntegrationConfig()
  if (!baseConfigRes.success) return baseConfigRes

  const config = normalizeJiraIntegrationConfig({
    ...baseConfigRes.data,
    ...(configInput || {}),
  })

  const validationError = validateJiraConfig(config)
  if (validationError) return { success: false as const, error: validationError }

  const response = await jiraRequest<{ displayName?: string }>(config, "/rest/api/3/myself", { method: "GET" })
  if (!response.success) {
    return { success: false as const, error: `Falha ao conectar no Jira: ${response.error}` }
  }

  return {
    success: true as const,
    data: {
      displayName: safeText(response.data?.displayName) || config.user_email,
    },
  }
}

function toJiraDueDate(input: string | null | undefined) {
  const raw = safeText(input)
  if (!raw) return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

function buildIssueDescription(input: {
  planId: string
  description: string
  controlId?: string | null
  controlName?: string | null
  kpiAffected?: string | null
  responsible?: string | null
  criticality?: string | null
  framework?: string | null
  dueDate?: string | null
}) {
  const lines = [
    "Plano de ação criado automaticamente pelo KPIs Management.",
    "",
    `Plano ID: ${safeText(input.planId) || "N/A"}`,
    `Controle: ${safeText(input.controlId) || "N/A"}`,
    `Nome do controle: ${safeText(input.controlName) || "N/A"}`,
    `Framework: ${safeText(input.framework) || "N/A"}`,
    `KPI afetado: ${safeText(input.kpiAffected) || "N/A"}`,
    `Responsável: ${safeText(input.responsible) || "N/A"}`,
    `Criticidade: ${safeText(input.criticality) || "N/A"}`,
    `Prazo: ${safeText(input.dueDate) || "N/A"}`,
    "",
    "Descrição:",
    safeText(input.description) || "Sem descrição.",
  ]

  return lines.join("\n")
}

function buildStorySummary(controlId?: string | null, controlName?: string | null) {
  const code = safeText(controlId) || "CONTROLE"
  const name = safeText(controlName) || "Controle sem nome"
  return `[${code}] ${name}`
}

function buildTaskSummary(planId: string, kpiAffected?: string | null) {
  const kpi = safeText(kpiAffected) || "KPI crítico"
  return `[Plano ${planId}] Corrigir evidência do KPI ${kpi}`
}

function buildFrameworkLabels(framework?: string | null) {
  const value = safeText(framework).toLowerCase()
  if (!value) return ["grc", "action-plan"]
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return ["grc", "action-plan", `framework-${normalized}`]
}

function resolveEpicKey(config: JiraIntegrationConfig, planDomain: PlanDomain) {
  return planDomain === "AUTOMACOES" ? config.epic_automacoes_key : config.epic_controles_key
}

function issueUrl(config: JiraIntegrationConfig, key: string) {
  return `${config.base_url}/browse/${key}`
}

async function createJiraIssue(
  config: JiraIntegrationConfig,
  fields: Record<string, unknown>
): Promise<{ success: true; key: string; url: string } | { success: false; error: string }> {
  const response = await jiraRequest<{ key?: string }>(config, "/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  })

  if (!response.success) return response

  const key = safeText(response.data?.key)
  if (!key) return { success: false, error: "Jira não retornou a chave da issue criada." }

  return { success: true, key, url: issueUrl(config, key) }
}

async function fetchMappedStory(planDomain: PlanDomain, controlCode: string) {
  await ensureJiraStoryMapTable()

  const rows = await sql`
    SELECT *
    FROM jira_control_story_map
    WHERE plan_domain = ${planDomain}
      AND control_code = ${controlCode}
    LIMIT 1
  `

  return rows?.[0] || null
}

async function upsertMappedStory(input: {
  planDomain: PlanDomain
  framework?: string | null
  controlCode: string
  controlName: string
  epicKey: string
  epicUrl: string
  storyKey: string
  storyUrl: string
}) {
  await ensureJiraStoryMapTable()

  await sql`
    INSERT INTO jira_control_story_map (
      plan_domain,
      framework,
      control_code,
      control_name,
      jira_epic_key,
      jira_epic_url,
      jira_story_key,
      jira_story_url,
      created_at,
      updated_at
    ) VALUES (
      ${input.planDomain},
      ${safeText(input.framework) || null},
      ${input.controlCode},
      ${input.controlName},
      ${input.epicKey},
      ${input.epicUrl},
      ${input.storyKey},
      ${input.storyUrl},
      now(),
      now()
    )
    ON CONFLICT (plan_domain, control_code) DO UPDATE
    SET framework = EXCLUDED.framework,
        control_name = EXCLUDED.control_name,
        jira_epic_key = EXCLUDED.jira_epic_key,
        jira_epic_url = EXCLUDED.jira_epic_url,
        jira_story_key = EXCLUDED.jira_story_key,
        jira_story_url = EXCLUDED.jira_story_url,
        updated_at = now()
  `
}

async function resolveStoryHierarchy(input: {
  config: JiraIntegrationConfig
  planDomain: PlanDomain
  controlId?: string | null
  controlName?: string | null
  framework?: string | null
}) {
  const config = input.config
  const epicKey = resolveEpicKey(config, input.planDomain)
  const epicUrl = issueUrl(config, epicKey)
  const controlCode = safeText(input.controlId) || "CONTROLE"
  const controlName = safeText(input.controlName) || "Controle sem nome"

  const mapped = await fetchMappedStory(input.planDomain, controlCode)
  if (mapped?.jira_story_key) {
    return {
      success: true as const,
      epicKey,
      epicUrl,
      storyKey: safeText(mapped.jira_story_key),
      storyUrl: safeText(mapped.jira_story_url) || issueUrl(config, safeText(mapped.jira_story_key)),
    }
  }

  const storyFields: Record<string, unknown> = {
    project: { key: config.project_key },
    summary: buildStorySummary(controlCode, controlName),
    issuetype: { name: config.story_issue_type },
    parent: { key: epicKey },
  }

  if (config.framework_field_id && safeText(input.framework)) {
    storyFields[config.framework_field_id] = safeText(input.framework)
  }

  if (config.use_framework_labels) {
    storyFields.labels = buildFrameworkLabels(input.framework)
  }

  const storyRes = await createJiraIssue(config, storyFields)
  if (!storyRes.success) return storyRes

  await upsertMappedStory({
    planDomain: input.planDomain,
    framework: input.framework,
    controlCode,
    controlName,
    epicKey,
    epicUrl,
    storyKey: storyRes.key,
    storyUrl: storyRes.url,
  })

  return {
    success: true as const,
    epicKey,
    epicUrl,
    storyKey: storyRes.key,
    storyUrl: storyRes.url,
  }
}

async function enrichPlanContext(input: {
  planId: number
  planDomain: PlanDomain
  controlId?: string | null
  controlName?: string | null
  framework?: string | null
}) {
  if (safeText(input.controlId) && safeText(input.controlName) && safeText(input.framework)) {
    return {
      controlId: safeText(input.controlId),
      controlName: safeText(input.controlName),
      framework: safeText(input.framework),
    }
  }

  const rows =
    input.planDomain === "AUTOMACOES"
      ? await sql`
          SELECT
            aap.id_control,
            COALESCE(aap.control_name, c.name_control, aap.automation_name, '') AS control_name,
            COALESCE(aap.framework, c.framework, '') AS framework
          FROM automation_action_plans aap
          LEFT JOIN controls c ON c.id_control = aap.id_control
          WHERE aap.id = ${input.planId}
          LIMIT 1
        `
      : await sql`
          SELECT
            ap.id_control,
            COALESCE(ap.control_name, c.name_control, '') AS control_name,
            COALESCE(ap.framework, c.framework, '') AS framework
          FROM action_plans ap
          LEFT JOIN controls c ON c.id_control = ap.id_control
          WHERE ap.id = ${input.planId}
          LIMIT 1
        `

  const row = rows?.[0]
  return {
    controlId: safeText(input.controlId) || safeText(row?.id_control),
    controlName: safeText(input.controlName) || safeText(row?.control_name),
    framework: safeText(input.framework) || safeText(row?.framework),
  }
}

export async function syncActionPlanToJira(input: {
  planId: string
  planDomain?: PlanDomain
  summary?: string
  description: string
  controlId?: string | null
  controlName?: string | null
  kpiAffected?: string | null
  responsible?: string | null
  criticality?: string | null
  framework?: string | null
  dueDate?: string | null
}): Promise<JiraIssueSyncResult> {
  await ensureActionPlansJiraColumns()
  const planId = toPlanId(input.planId)
  if (!planId) return { success: false, error: "Plano inválido para sincronização com Jira." }
  const planDomain = input.planDomain || "CONTROLES"

  const updateSyncStatus = async (values: {
    epicKey?: string | null
    epicUrl?: string | null
    storyKey?: string | null
    storyUrl?: string | null
    issueKey?: string | null
    issueUrl?: string | null
    syncStatus: string
    lastError?: string | null
  }) => {
    if (planDomain === "AUTOMACOES") {
      await sql`
        UPDATE automation_action_plans
        SET jira_epic_key = ${values.epicKey || null},
            jira_epic_url = ${values.epicUrl || null},
            jira_story_key = ${values.storyKey || null},
            jira_story_url = ${values.storyUrl || null},
            jira_issue_key = ${values.issueKey || null},
            jira_issue_url = ${values.issueUrl || null},
            jira_sync_status = ${values.syncStatus},
            jira_last_error = ${values.lastError || null},
            jira_last_synced_at = now()
        WHERE id = ${planId}
      `
      return
    }

    await sql`
      UPDATE action_plans
      SET jira_epic_key = ${values.epicKey || null},
          jira_epic_url = ${values.epicUrl || null},
          jira_story_key = ${values.storyKey || null},
          jira_story_url = ${values.storyUrl || null},
          jira_issue_key = ${values.issueKey || null},
          jira_issue_url = ${values.issueUrl || null},
          jira_sync_status = ${values.syncStatus},
          jira_last_error = ${values.lastError || null},
          jira_last_synced_at = now()
      WHERE id = ${planId}
    `
  }

  const configRes = await fetchStoredJiraIntegrationConfig()
  if (!configRes.success) {
    await updateSyncStatus({ syncStatus: "ERROR", lastError: configRes.error })
    return { success: false, error: configRes.error }
  }

  const config = configRes.data
  if (!config.enabled) {
    await updateSyncStatus({ syncStatus: "DISABLED" })
    return { success: false, error: "Integração Jira desabilitada." }
  }

  const validationError = validateJiraConfig(config)
  if (validationError) {
    await updateSyncStatus({ syncStatus: "ERROR", lastError: validationError })
    return { success: false, error: validationError }
  }

  const context = await enrichPlanContext({
    planId,
    planDomain,
    controlId: input.controlId,
    controlName: input.controlName,
    framework: input.framework,
  })

  const hierarchy = await resolveStoryHierarchy({
    config,
    planDomain,
    controlId: context.controlId,
    controlName: context.controlName,
    framework: context.framework,
  })
  if (!hierarchy.success) {
    await updateSyncStatus({ syncStatus: "ERROR", lastError: hierarchy.error })
    return hierarchy
  }

  const taskFields: Record<string, unknown> = {
    project: { key: config.project_key },
    summary: safeText(input.summary) || buildTaskSummary(String(planId), input.kpiAffected),
    issuetype: { name: config.task_issue_type },
    description: buildIssueDescription({
      planId: String(planId),
      description: input.description,
      controlId: context.controlId,
      controlName: context.controlName,
      kpiAffected: input.kpiAffected,
      responsible: input.responsible,
      criticality: input.criticality,
      framework: context.framework,
      dueDate: input.dueDate,
    }),
    duedate: toJiraDueDate(input.dueDate),
    parent: { key: hierarchy.storyKey },
  }

  if (config.framework_field_id && context.framework) {
    taskFields[config.framework_field_id] = context.framework
  }

  if (config.use_framework_labels) {
    taskFields.labels = buildFrameworkLabels(context.framework)
  }

  const jiraRes = await createJiraIssue(config, taskFields)
  if (!jiraRes.success) {
    await updateSyncStatus({
      epicKey: hierarchy.epicKey,
      epicUrl: hierarchy.epicUrl,
      storyKey: hierarchy.storyKey,
      storyUrl: hierarchy.storyUrl,
      syncStatus: "ERROR",
      lastError: jiraRes.error,
    })
    return jiraRes
  }

  await updateSyncStatus({
    epicKey: hierarchy.epicKey,
    epicUrl: hierarchy.epicUrl,
    storyKey: hierarchy.storyKey,
    storyUrl: hierarchy.storyUrl,
    issueKey: jiraRes.key,
    issueUrl: jiraRes.url,
    syncStatus: "SYNCED",
  })

  return {
    success: true,
    epicKey: hierarchy.epicKey,
    epicUrl: hierarchy.epicUrl,
    storyKey: hierarchy.storyKey,
    storyUrl: hierarchy.storyUrl,
    issueKey: jiraRes.key,
    issueUrl: jiraRes.url,
  }
}
