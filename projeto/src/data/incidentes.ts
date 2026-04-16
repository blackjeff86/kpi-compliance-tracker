/**
 * Incidentes gerados / detectados pelas automações SOX (dados de exemplo).
 * Substitua por API/banco quando houver backend.
 */

export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export type IncidentStatus = "EM_ANALISE" | "ABERTO" | "CONCLUIDO" | "AGUARDANDO_EVIDENCIA"

export type IncidentEvidence = {
  id: string
  nome: string
  tamanho: string
  tipo: string
  thumbUrl?: string
}

export type IncidentHistoryItem = {
  id: string
  titulo: string
  quando: string
  autor: string
}

export type Incidente = {
  id: string
  titulo: string
  severidade: IncidentSeverity
  status: IncidentStatus
  /** Referência ao inventário de automações, se aplicável */
  automacaoInventarioId: string | null
  nomeAutomacao: string
  triggerName: string
  detectedAt: string
  affectedObject: string
  initiatorUser: string
  technicalSummary: string
  evidencias: IncidentEvidence[]
  historico: IncidentHistoryItem[]
  /** Mês de competência (YYYY-MM), preenchido quando o registro vem do banco */
  referenceMonth?: string
  /** Controle cadastrado (controls.id_control) quando resolvido na ingestão */
  idControl?: string | null
  /** Framework do controle no momento do incidente (denormalizado) */
  framework?: string | null
  /** Rótulo para lista/detalhe (inventário ou controle) */
  controleSoxDisplay?: string | null
  nomeJiraDisplay?: string | null
}

export const INCIDENTES: Incidente[] = [
  {
    id: "AL-1032",
    titulo: "PrivilegeGate: Tentativa de alteração em tabela de parâmetros fiscais",
    severidade: "CRITICAL",
    status: "EM_ANALISE",
    automacaoInventarioId: "inv-001",
    nomeAutomacao: "LogSentinel",
    triggerName: "FISCAL_PARAM_WATCHDOG_V2",
    detectedAt: "2023-10-24T17:32:11.000Z",
    affectedObject: "DBPROD.TAX_PARAMS_CORE",
    initiatorUser: "svc_app_integrator",
    technicalSummary:
      "Attempted UPDATE on restricted columns [TAX_RATE_MODIFIER, EXEMPTION_KEY]. Execution originated from non-whitelisted IP 10.42.11.203. Automated block triggered by SOX-Control-42.",
    evidencias: [
      { id: "ev-1", nome: "access_logs_1432.json", tamanho: "2.4 MB", tipo: "JSON" },
      {
        id: "ev-2",
        nome: "error_traceback.png",
        tamanho: "840 KB",
        tipo: "IMAGE",
        thumbUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAtlKMT_8IniRvrG91y_k3YNdcXSO6mubNO-DIAyloSMB9zgStdojsQd6-GHhPxuHYUlCntQJ9D5eA4BnhjCOf8-MllWIjXj32NsCJXeQbnDYnDR9frsbKqT2SNhwFqhOb8nrAWAov-NSJYB7KZXfmu864-wDNlFzlBjvbqh4kj5Z5HEnC_l6hv1-uy1aFHo0Z_MRBlRuq9xTD5H8c-r0grJKKTSBlhzYgYx1AgUjPOMHSPwD7-aC39JDMpLedZJQQ0y85-3XLcb2k",
      },
    ],
    historico: [
      { id: "h1", titulo: "Análise iniciada", quando: "Hoje, 09:15", autor: "Auditor Sênior" },
      { id: "h2", titulo: "Evidência anexada", quando: "Ontem, 17:42", autor: "Sistema (Auto-Log)" },
      { id: "h3", titulo: "Incidente detectado", quando: "Ontem, 14:32", autor: "FISCAL_WATCHDOG" },
    ],
  },
  {
    id: "AL-1033",
    titulo: "GrantSentinel: concessão sem ticket vinculado (ambiente OMS)",
    severidade: "HIGH",
    status: "ABERTO",
    automacaoInventarioId: "inv-007",
    nomeAutomacao: "GrantSentinel",
    triggerName: "GRANT_AUDIT_OMS",
    detectedAt: "2024-11-02T10:15:00.000Z",
    affectedObject: "LICENSE_MANAGER.ACCESS_GRANTS",
    initiatorUser: "batch_compliance",
    technicalSummary:
      "Grant detected for SOX-scoped role without matching Jira ticket in the last 24h window.",
    evidencias: [{ id: "ev-3", nome: "grant_snapshot.csv", tamanho: "120 KB", tipo: "CSV" }],
    historico: [
      { id: "h1", titulo: "Incidente detectado", quando: "02/11/2024, 10:15", autor: "GrantSentinel" },
    ],
  },
  {
    id: "AL-1034",
    titulo: "LogSentinel: falha na coleta de logs Google Admin",
    severidade: "MEDIUM",
    status: "AGUARDANDO_EVIDENCIA",
    automacaoInventarioId: "inv-005",
    nomeAutomacao: "LogSentinel",
    triggerName: "GOOGLE_LOG_PIPE_HEALTH",
    detectedAt: "2024-11-01T08:00:00.000Z",
    affectedObject: "CONNECTOR.GOOGLE_ADMIN",
    initiatorUser: "Compliance.apps",
    technicalSummary: "Pipeline returned 503 for 3 consecutive poll intervals; no data loss confirmed.",
    evidencias: [],
    historico: [{ id: "h1", titulo: "Incidente detectado", quando: "01/11/2024, 08:00", autor: "LogSentinel" }],
  },
  {
    id: "AL-1035",
    titulo: "HiBob groups: alteração em grupo fora do escopo SOX",
    severidade: "HIGH",
    status: "EM_ANALISE",
    automacaoInventarioId: "inv-009",
    nomeAutomacao: "Google Webscript",
    triggerName: "HIBOB_GROUP_DIFF",
    detectedAt: "2024-10-28T22:45:00.000Z",
    affectedObject: "GOOGLE.GROUP.HIBOB_SOX",
    initiatorUser: "script_compliance_daily",
    technicalSummary: "Diff vs prior day snapshot shows membership change on SOX-tagged group.",
    evidencias: [{ id: "ev-4", nome: "group_diff.txt", tamanho: "4 KB", tipo: "TEXT" }],
    historico: [
      { id: "h1", titulo: "Incidente detectado", quando: "28/10/2024, 22:45", autor: "HIBOB_GROUP_DIFF" },
    ],
  },
  {
    id: "AL-1036",
    titulo: "Revogação: ticket de desligamento sem evidência em canal IAM",
    severidade: "LOW",
    status: "CONCLUIDO",
    automacaoInventarioId: "inv-012",
    nomeAutomacao: "Google, Azure Revoke",
    triggerName: "OFFBOARDING_CHECK",
    detectedAt: "2024-10-20T14:00:00.000Z",
    affectedObject: "JIRA.OFFBOARDING + SLACK.doublecheck-iam",
    initiatorUser: "offboarding_bot",
    technicalSummary: "Closure confirmed; evidence uploaded to channel after manual review.",
    evidencias: [],
    historico: [
      { id: "h1", titulo: "Análise finalizada — falso positivo", quando: "21/10/2024, 11:00", autor: "Ana Clara Ribeiro Hernandes" },
      { id: "h2", titulo: "Incidente detectado", quando: "20/10/2024, 14:00", autor: "OFFBOARDING_CHECK" },
    ],
  },
]

export function getIncidenteById(id: string): Incidente | undefined {
  return INCIDENTES.find((r) => r.id === id)
}

/** Ex.: `AL-1032 — inv-001` quando houver automação vinculada; senão só o código AL. */
export function formatIncidentDisplayId(inc: Pick<Incidente, "id" | "automacaoInventarioId">): string {
  const al = String(inc.id || "").trim()
  const inv = String(inc.automacaoInventarioId || "").trim()
  if (inv) return `${al} — ${inv}`
  return al || "—"
}

export function severityLabel(s: IncidentSeverity): string {
  switch (s) {
    case "CRITICAL":
      return "Crítico"
    case "HIGH":
      return "Alto"
    case "MEDIUM":
      return "Médio"
    default:
      return "Baixo"
  }
}

export function statusLabel(s: IncidentStatus): string {
  switch (s) {
    case "EM_ANALISE":
      return "Em análise"
    case "ABERTO":
      return "Aberto"
    case "CONCLUIDO":
      return "Concluído"
    case "AGUARDANDO_EVIDENCIA":
      return "Aguardando evidência"
    default:
      return s
  }
}
