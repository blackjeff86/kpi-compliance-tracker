"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import {
  ChevronRight,
  AlertTriangle,
  MessageSquarePlus,
  CheckCircle2,
  PencilLine,
  Info,
  Link2,
  History,
  Download,
  ExternalLink,
  Upload,
  User,
  CalendarDays,
  Clock3,
  FileText,
  X,
  Loader2,
} from "lucide-react"
import {
  addActionPlanComment,
  completeActionPlan,
  fetchActionPlanDetail,
  updateActionPlanProgress,
} from "./actions"

type Evidencia = {
  id: string
  nome: string
  tipo: "arquivo" | "link"
  detalhe: string
}

type Historico = {
  id: string
  versao: string
  data: string
  autor: string
  atual: boolean
  itens: string[]
}

type PlanoDetalhe = {
  id: string
  status: "Atrasado" | "Em andamento" | "Concluído" | "Aberto"
  descricao: string
  comentarios: string
  causaRaiz: string
  controleId: string
  controleNome: string
  kpiNome: string
  kpiValor: string
  kpiTarget: string
  responsavel: string
  cargo: string
  prazo: string
  atrasoDias: number
  criadoEm: string
  jiraIssueKey: string
  jiraIssueUrl: string
  jiraSyncStatus: string
  jiraLastError: string
  evidencias: Evidencia[]
  historico: Historico[]
}

type ActionPlanDetailDbRow = {
  [key: string]: unknown
}

type ActionPlanHistoryRow = {
  [key: string]: unknown
}

function getFallbackPlano(id: string): PlanoDetalhe {
  return {
    id,
    status: "Em andamento",
    descricao: "Plano de ação sem descrição cadastrada.",
    comentarios: "Sem comentários registrados.",
    causaRaiz: "Sem análise de causa raiz informada.",
    controleId: "N/A",
    controleNome: "Controle não informado",
    kpiNome: "KPI não informado",
    kpiValor: "N/A",
    kpiTarget: "N/A",
    responsavel: "Não atribuído",
    cargo: "N/A",
    prazo: "N/A",
    atrasoDias: 0,
    criadoEm: "N/A",
    jiraIssueKey: "",
    jiraIssueUrl: "",
    jiraSyncStatus: "",
    jiraLastError: "",
    evidencias: [],
    historico: [],
  }
}

function withFallback(value: string, fallback: string) {
  const s = String(value || "").trim()
  return s || fallback
}

function getPlanoByIdWithQuery(basePlano: PlanoDetalhe, id: string, searchParams: URLSearchParams): PlanoDetalhe {
  const statusFromQuery = String(searchParams.get("status") || "").trim()
  const statusNormalized: PlanoDetalhe["status"] =
    statusFromQuery.toLowerCase().includes("concl")
      ? "Concluído"
      : statusFromQuery.toLowerCase().includes("atrasa")
      ? "Atrasado"
      : statusFromQuery.toLowerCase().includes("abert")
      ? "Aberto"
      : statusFromQuery
      ? "Em andamento"
      : basePlano.status

  const descricaoFromQuery = String(searchParams.get("description") || "").trim()
  const titleFromQuery = String(searchParams.get("title") || "").trim()
  const dueDateFromQueryRaw = String(searchParams.get("due_date") || "").trim()
  const dueDateParsed = dueDateFromQueryRaw ? new Date(dueDateFromQueryRaw) : null
  const dueDateFromQuery =
    dueDateParsed && !Number.isNaN(dueDateParsed.getTime())
      ? dueDateParsed.toLocaleDateString("pt-BR")
      : basePlano.prazo

  return {
    ...basePlano,
    id,
    status: statusNormalized,
    descricao: withFallback(descricaoFromQuery, basePlano.descricao),
    comentarios: basePlano.comentarios,
    causaRaiz: titleFromQuery ? `Contexto do plano: ${titleFromQuery}.` : basePlano.causaRaiz,
    controleId: withFallback(String(searchParams.get("controle_id") || ""), basePlano.controleId),
    controleNome: withFallback(String(searchParams.get("controle_nome") || ""), basePlano.controleNome),
    kpiNome: withFallback(String(searchParams.get("kpi_nome") || ""), basePlano.kpiNome),
    kpiValor: withFallback(String(searchParams.get("kpi_valor") || ""), basePlano.kpiValor),
    kpiTarget: withFallback(String(searchParams.get("kpi_target") || ""), basePlano.kpiTarget),
    responsavel: withFallback(String(searchParams.get("responsavel") || ""), basePlano.responsavel),
    prazo: dueDateFromQuery,
    atrasoDias: statusNormalized === "Atrasado" ? Math.max(1, basePlano.atrasoDias) : 0,
    jiraIssueKey: basePlano.jiraIssueKey,
    jiraIssueUrl: basePlano.jiraIssueUrl,
    jiraSyncStatus: basePlano.jiraSyncStatus,
    jiraLastError: basePlano.jiraLastError,
  }
}

function safeText(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function toPtBrDate(value: unknown): string {
  const d = toDate(value)
  return d ? d.toLocaleDateString("pt-BR") : "N/A"
}

function mapStatus(raw: unknown, dueDateRaw: unknown): PlanoDetalhe["status"] {
  const s = safeText(raw).toLowerCase()
  if (s.includes("concl") || s.includes("done") || s.includes("close")) return "Concluído"
  if (s.includes("abert") || s.includes("open")) return "Aberto"

  const due = toDate(dueDateRaw)
  if (due && due.getTime() < Date.now()) return "Atrasado"

  return "Em andamento"
}

function calculateDelayDays(dueDateRaw: unknown, status: PlanoDetalhe["status"]): number {
  if (status === "Concluído") return 0
  const due = toDate(dueDateRaw)
  if (!due) return 0

  const now = new Date()
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = nowStart.getTime() - dueStart.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function parseKpiCodeFromText(...values: unknown[]): string {
  const text = values.map((v) => safeText(v)).join(" ")
  const m = text.match(/\bKPI(?:\s*ID)?\s*([A-Z0-9-]+)\b/i)
  if (!m) return ""
  return `KPI ID ${safeText(m[1])}`
}

function mapHistoryRows(rows: ActionPlanHistoryRow[], planoId: string, fallbackAuthor: string): Historico[] {
  if (!rows.length) return []

  return rows.map((row, index) => {
    const eventType = safeText(row?.event_type)
    const oldStatus = safeText(row?.old_status)
    const newStatus = safeText(row?.new_status)
    const comment = safeText(row?.comment)
    const progressRaw = safeText(row?.progress_percent)
    const createdBy = safeText(row?.created_by) || fallbackAuthor

    const itens: string[] = []
    if (oldStatus || newStatus) itens.push(`Status: ${oldStatus || "N/A"} → ${newStatus || "N/A"}.`)
    if (progressRaw) itens.push(`Progresso informado: ${progressRaw}%.`)
    if (comment) itens.push(comment)
    if (!itens.length) itens.push(`Evento ${eventType || "UPDATE"} registrado no plano.`)

    return {
      id: safeText(row?.id) || `h-${planoId}-${index + 1}`,
      versao: `Versão ${rows.length - index}`,
      data: toPtBrDate(row?.created_at),
      autor: createdBy,
      atual: index === 0,
      itens,
    }
  })
}

function mapDbToPlano(row: ActionPlanDetailDbRow, id: string): PlanoDetalhe {
  const status = mapStatus(row?.status, row?.due_date)
  const atrasoDias = calculateDelayDays(row?.due_date, status)
  const responsavel =
    safeText(row?.responsible) ||
    safeText(row?.responsavel) ||
    safeText(row?.owner) ||
    safeText(row?.owner_name) ||
    "Não atribuído"

  const kpiNome =
    safeText(row?.catalog_kpi_name) ||
    safeText(row?.run_kpi_code) ||
    safeText(row?.catalog_kpi_id) ||
    safeText(row?.kpi_id) ||
    parseKpiCodeFromText(row?.title, row?.description) ||
    "KPI não identificado"

  const kpiValor = safeText(row?.run_measured_value) || "N/A"
  const kpiTarget = safeText(row?.catalog_kpi_target) || "N/A"
  const historyRows = Array.isArray(row?.history_entries) ? (row.history_entries as ActionPlanHistoryRow[]) : []
  const historicoMapeado = mapHistoryRows(historyRows, id, responsavel)
  const comentarioAtual =
    safeText(row?.comment) ||
    historicoMapeado[0]?.itens.find((item) => !item.startsWith("Status:") && !item.startsWith("Progresso informado:")) ||
    "Sem comentários registrados."
  const fallbackHistorico: Historico[] = [
    {
      id: `h-${id}-1`,
      versao: "Versão 1",
      data: toPtBrDate(row?.created_at),
      autor: responsavel,
      atual: true,
      itens: [
        `Plano criado com status "${safeText(row?.status) || "Aberto"}".`,
        safeText(row?.run_period) ? `Período KPI associado: ${safeText(row?.run_period)}.` : "Período KPI não informado.",
      ],
    },
  ]

  return {
    id,
    status,
    descricao: safeText(row?.description) || "Plano de ação sem descrição cadastrada.",
    comentarios: comentarioAtual,
    causaRaiz: safeText(row?.title) ? `Contexto do plano: ${safeText(row?.title)}.` : "Sem análise de causa raiz informada.",
    controleId: safeText(row?.id_control || row?.control_code) || "N/A",
    controleNome: safeText(row?.name_control) || "Controle não informado",
    kpiNome,
    kpiValor,
    kpiTarget,
    responsavel,
    cargo: "N/A",
    prazo: toPtBrDate(row?.due_date),
    atrasoDias,
    criadoEm: toPtBrDate(row?.created_at),
    jiraIssueKey: safeText(row?.jira_issue_key),
    jiraIssueUrl: safeText(row?.jira_issue_url),
    jiraSyncStatus: safeText(row?.jira_sync_status),
    jiraLastError: safeText(row?.jira_last_error),
    evidencias: [],
    historico: historicoMapeado.length ? historicoMapeado : fallbackHistorico,
  }
}

function getStatusBadge(status: PlanoDetalhe["status"]) {
  if (status === "Atrasado") {
    return (
      <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2.5 py-1 rounded border border-red-100 inline-flex items-center gap-1.5 uppercase">
        <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
        Atrasado
      </span>
    )
  }
  if (status === "Concluído") {
    return (
      <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-100 uppercase">
        Concluído
      </span>
    )
  }
  if (status === "Aberto") {
    return (
      <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2.5 py-1 rounded border border-blue-100 uppercase">
        Aberto
      </span>
    )
  }
  return (
    <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2.5 py-1 rounded border border-amber-100 uppercase">
      Em andamento
    </span>
  )
}

export default function PlanoDetalhePage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const id = decodeURIComponent(params?.id || "PA-2023-084")
  const [plano, setPlano] = useState<PlanoDetalhe>(getFallbackPlano(id))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionSaving, setActionSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadPlano = useCallback(async () => {
      setLoading(true)
      setLoadError(null)
      const paramsForMerge = new URLSearchParams(searchParamsKey)

      try {
        const result = await fetchActionPlanDetail(id)

        if (!result.success) {
          setLoadError(result.error || "Erro ao carregar detalhe do plano.")
          setPlano(getPlanoByIdWithQuery(getFallbackPlano(id), id, paramsForMerge))
          return
        }

        if (!result.data) {
          setLoadError("Plano não encontrado no banco para este ID.")
          setPlano(getPlanoByIdWithQuery(getFallbackPlano(id), id, paramsForMerge))
          return
        }

        const dbPlano = mapDbToPlano(result.data as ActionPlanDetailDbRow, id)
        setPlano(getPlanoByIdWithQuery(dbPlano, id, paramsForMerge))
      } catch (error) {
        console.error("Erro ao carregar plano de ação:", error)
        setLoadError("Erro ao carregar detalhe do plano.")
        setPlano(getPlanoByIdWithQuery(getFallbackPlano(id), id, paramsForMerge))
      } finally {
        setLoading(false)
      }
  }, [id, searchParamsKey])

  useEffect(() => {
    loadPlano()
  }, [loadPlano])

  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [finishModalOpen, setFinishModalOpen] = useState(false)
  const [progressModalOpen, setProgressModalOpen] = useState(false)

  const [commentText, setCommentText] = useState("")
  const [finishReason, setFinishReason] = useState("")
  const [progressStatus, setProgressStatus] = useState("Em andamento")
  const [progressPercent, setProgressPercent] = useState("65")
  const [progressNotes, setProgressNotes] = useState("")

  async function handleSaveComment() {
    const comment = commentText.trim()
    if (!comment) {
      setActionError("Preencha o comentário antes de salvar.")
      return
    }

    setActionSaving(true)
    setActionError(null)
    const result = await addActionPlanComment({ planId: id, comment })
    setActionSaving(false)

    if (!result.success) {
      setActionError(result.error || "Não foi possível salvar comentário.")
      return
    }

    setCommentText("")
    setCommentModalOpen(false)
    await loadPlano()
  }

  async function handleFinishPlan() {
    const reason = finishReason.trim()
    if (!reason) {
      setActionError("Informe o resumo da conclusão.")
      return
    }

    setActionSaving(true)
    setActionError(null)
    const result = await completeActionPlan({ planId: id, reason })
    setActionSaving(false)

    if (!result.success) {
      setActionError(result.error || "Não foi possível concluir o plano.")
      return
    }

    setFinishReason("")
    setFinishModalOpen(false)
    await loadPlano()
  }

  async function handleUpdateProgress() {
    const percent = Number(progressPercent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setActionError("Percentual inválido. Use um valor entre 0 e 100.")
      return
    }

    setActionSaving(true)
    setActionError(null)
    const result = await updateActionPlanProgress({
      planId: id,
      status: progressStatus,
      progressPercent: percent,
      notes: progressNotes,
    })
    setActionSaving(false)

    if (!result.success) {
      setActionError(result.error || "Não foi possível atualizar progresso.")
      return
    }

    setProgressModalOpen(false)
    await loadPlano()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-[#f71866]" size={40} />
      </div>
    )
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <nav className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          <Link href="/planos" className="hover:text-[#f71866] transition-colors">
            Planos de Ação
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">{plano.id}</span>
        </nav>

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Detalhes do Plano de Ação</h1>
            {getStatusBadge(plano.status)}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCommentModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 inline-flex items-center gap-2 transition-all"
            >
              <MessageSquarePlus size={16} />
              Adicionar Comentário
            </button>
            <button
              onClick={() => setFinishModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 inline-flex items-center gap-2 transition-all"
            >
              <CheckCircle2 size={16} />
              Concluir Plano
            </button>
            <button
              onClick={() => setProgressModalOpen(true)}
              className="bg-[#f71866] hover:bg-[#d61556] text-white px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-all"
            >
              <PencilLine size={16} />
              Atualizar Progresso
            </button>
          </div>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {loadError}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest inline-flex items-center gap-2">
                <Info size={15} className="text-[#f71866]" />
                Informações do Plano
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Descrição da Ação Corretiva</h3>
                <p className="text-sm text-slate-700 leading-relaxed">{plano.descricao}</p>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Comentários</h3>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {plano.comentarios}
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Análise de Causa Raiz</h3>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">{plano.causaRaiz}</div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest inline-flex items-center gap-2">
                <Link2 size={15} className="text-[#f71866]" />
                KPI e Controle Relacionado
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Controle</p>
                <p className="text-sm font-bold text-slate-900">{plano.controleId}</p>
                <p className="text-xs text-slate-500 mt-1">{plano.controleNome}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">KPI Afetado</p>
                <p className="text-sm font-bold text-slate-900">{plano.kpiNome}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    Valor: {plano.kpiValor}
                  </span>
                  <span className="text-xs text-slate-400">Target: {plano.kpiTarget}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest inline-flex items-center gap-2">
                <History size={15} className="text-[#f71866]" />
                Histórico de Alterações
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">APPEND-ONLY LOG</span>
            </div>
            <div className="p-6 space-y-7">
              {plano.historico.map((item) => (
                <div key={item.id} className="relative pl-8 border-l-2 border-slate-100">
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ring-4 ring-white ${item.atual ? "bg-[#f71866]" : "bg-slate-200"}`} />
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {item.versao}
                      {item.atual ? <span className="text-[#f71866] text-xs ml-2">(Atual)</span> : <span className="text-slate-400 text-xs ml-2">(Original)</span>}
                    </h4>
                    <span className="text-[10px] text-slate-400">{item.data}</span>
                  </div>
                  <div className={`${item.atual ? "bg-slate-50 border border-slate-100" : "border border-dashed border-slate-200"} p-4 rounded-lg`}>
                    <p className="text-sm text-slate-600 mb-2">
                      Atualizado por <span className="font-bold text-slate-900">{item.autor}</span>
                    </p>
                    <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                      {item.itens.map((linha, idx) => (
                        <li key={`${item.id}-${idx}`}>{linha}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Metadados</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Responsável</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{plano.responsavel}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{plano.cargo}</p>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Prazo de Entrega</p>
                <p className="text-sm font-bold text-slate-900">{plano.prazo}</p>
                {plano.atrasoDias > 0 ? (
                  <p className="text-xs text-red-600 font-medium mt-1 inline-flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {plano.atrasoDias} dias de atraso
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600 font-medium mt-1 inline-flex items-center gap-1">
                    <Clock3 size={12} />
                    Dentro do prazo
                  </p>
                )}
              </div>

              <hr className="border-slate-100" />

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Data de Criação</p>
                <p className="text-sm text-slate-700 inline-flex items-center gap-2">
                  <CalendarDays size={14} className="text-slate-400" />
                  {plano.criadoEm}
                </p>
              </div>

              <hr className="border-slate-100" />

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Integração Jira</p>
                {plano.jiraIssueKey ? (
                  <div className="space-y-2">
                    <a
                      href={plano.jiraIssueUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#f71866] hover:text-[#d61556]"
                    >
                      <ExternalLink size={14} />
                      {plano.jiraIssueKey}
                    </a>
                    <p className="text-xs text-emerald-600 font-medium">Issue sincronizada com sucesso.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">
                      {plano.jiraSyncStatus === "DISABLED" ? "Integração Jira desabilitada." : "Issue Jira ainda não vinculada."}
                    </p>
                    {plano.jiraLastError ? <p className="text-xs text-red-600">{plano.jiraLastError}</p> : null}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Evidências</h2>
              <button className="text-[#f71866] hover:text-[#d61556] transition-colors" title="Upload de evidência">
                <Upload size={16} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {plano.evidencias.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    {ev.tipo === "arquivo" ? <FileText size={16} className="text-slate-400" /> : <Link2 size={16} className="text-slate-400" />}
                    <div>
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{ev.nome}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{ev.detalhe}</p>
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity">
                    {ev.tipo === "arquivo" ? <Download size={16} /> : <ExternalLink size={16} />}
                  </button>
                </div>
              ))}

              <div className="pt-2">
                <button className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs font-bold hover:bg-slate-50 transition-colors">
                  + Adicionar Documento
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {commentModalOpen && (
        <ModalShell
          title="Adicionar Comentário"
          subtitle={`Plano ${plano.id}`}
          onClose={() => {
            if (actionSaving) return
            setCommentModalOpen(false)
          }}
          onConfirm={handleSaveComment}
          confirmLabel="Salvar Comentário"
          confirmDisabled={actionSaving}
          confirmLoading={actionSaving}
          closeDisabled={actionSaving}
        >
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Comentário</label>
            <textarea
              rows={5}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Descreva o contexto da atualização..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
            />
          </div>
        </ModalShell>
      )}

      {finishModalOpen && (
        <ModalShell
          title="Concluir Plano de Ação"
          subtitle={`Plano ${plano.id}`}
          onClose={() => {
            if (actionSaving) return
            setFinishModalOpen(false)
          }}
          onConfirm={handleFinishPlan}
          confirmLabel="Confirmar Conclusão"
          confirmDisabled={actionSaving}
          confirmLoading={actionSaving}
          closeDisabled={actionSaving}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Esta ação marcará o plano como concluído e registrará a conclusão no histórico.
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Resumo da Conclusão</label>
              <textarea
                rows={4}
                value={finishReason}
                onChange={(e) => setFinishReason(e.target.value)}
                placeholder="Detalhe como o plano foi concluído..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
              />
            </div>
          </div>
        </ModalShell>
      )}

      {progressModalOpen && (
        <ModalShell
          title="Atualizar Progresso"
          subtitle={`Plano ${plano.id}`}
          onClose={() => {
            if (actionSaving) return
            setProgressModalOpen(false)
          }}
          onConfirm={handleUpdateProgress}
          confirmLabel="Salvar Atualização"
          confirmDisabled={actionSaving}
          confirmLoading={actionSaving}
          closeDisabled={actionSaving}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
              <select
                value={progressStatus}
                onChange={(e) => setProgressStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
              >
                <option>Aberto</option>
                <option>Em andamento</option>
                <option>Aguardando validação</option>
                <option>Concluído</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Percentual</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Notas da Atualização</label>
              <textarea
                rows={4}
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                placeholder="Informe o que foi executado nesta etapa..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
              />
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  confirmLoading,
  closeDisabled,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  confirmLoading?: boolean
  closeDisabled?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => (closeDisabled ? null : onClose())} />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500 font-medium mt-1">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            disabled={closeDisabled}
            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-6">{children}</div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={closeDisabled}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 rounded-lg bg-[#f71866] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#d61556] transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {confirmLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
