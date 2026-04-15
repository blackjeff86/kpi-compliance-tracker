"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import React, { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react"
import { fetchReviewDetail, saveSecurityReviewByRun } from "../actions"

type ActionPlan = {
  id?: number
  title?: string
  description?: string
  due_date?: string
  plan_status?: string
  responsible_name?: string
}

type ReviewDetail = {
  run: {
    run_id: string
    kpi_uuid: string
    period: string
    kpi_code: string
    execution_status: string
    measured_value: string
    evidence_link: string
    executor_comment: string
    executor_email: string
    created_at: string
    updated_at: string
    id_control: string
    name_control: string
    framework: string
    risk_title: string
    owner_name: string
    owner_area: string
    focal_point_name: string
    kpi_id: string
    kpi_name: string
    kpi_target: string
    kpi_evaluation_mode: "UP" | "DOWN" | "BOOLEAN"
    grc_final_status: string
    kpi_rules: {
      yellow_ratio: number
      zero_meta_yellow_max: number
    }
    kpi_rules_raw?: {
      value_type?: string
      direction?: string
      warning_margin?: number
    } | null
  }
  latestReview: {
    review_status?: string
    override_status?: string
    analyst_comment?: string
    override_reason?: string
  } | null
  actionPlans: ActionPlan[]
}

type ReviewDecision = "APPROVED" | "NEEDS_ADJUSTMENTS" | "REJECTED" | ""
type ReviewFinalStatus = "GREEN" | "YELLOW" | "RED" | "REPROVADO" | ""

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function formatDateTime(v: any) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toLocaleString("pt-BR")
}

function formatDate(v: any) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toLocaleDateString("pt-BR")
}

function statusClass(status: string) {
  const up = safeText(status).toUpperCase()
  if (up === "GREEN") return "bg-emerald-50 text-emerald-700 border-emerald-100"
  if (up === "YELLOW") return "bg-amber-50 text-amber-700 border-amber-100"
  if (up === "RED") return "bg-red-50 text-red-700 border-red-100"
  if (up === "REPROVADO") return "bg-red-50 text-red-700 border-red-100"
  return "bg-slate-50 text-slate-600 border-slate-100"
}

function normalizeStatus(v: any): ReviewFinalStatus {
  const up = safeText(v).toUpperCase()
  if (up === "GREEN" || up === "YELLOW" || up === "RED" || up === "REPROVADO") return up
  return ""
}

function mapDecisionToFinalStatus(decision: ReviewDecision, executionStatus: ReviewFinalStatus) {
  if (decision === "APPROVED") return executionStatus
  if (decision === "NEEDS_ADJUSTMENTS") return "YELLOW"
  if (decision === "REJECTED") return "REPROVADO"
  return ""
}

function mapReviewStatusToDecision(v: any): ReviewDecision {
  const up = safeText(v).toUpperCase()
  if (up === "APPROVED" || up === "NEEDS_ADJUSTMENTS" || up === "REJECTED") return up
  return ""
}

function statusLabel(status: ReviewFinalStatus) {
  if (status === "GREEN") return "Conforme"
  if (status === "YELLOW") return "Em atenção"
  if (status === "RED") return "Não conforme"
  if (status === "REPROVADO") return "Reprovado"
  return "Pendente"
}

function mapManualFinalStatusToDecision(status: ReviewFinalStatus): ReviewDecision {
  if (status === "GREEN") return "APPROVED"
  if (status === "YELLOW") return "NEEDS_ADJUSTMENTS"
  if (status === "RED") return "NEEDS_ADJUSTMENTS"
  if (status === "REPROVADO") return "REJECTED"
  return ""
}

function parseNumberLoose(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const s = safeText(v).replace("%", "").replace(",", ".")
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function isTrueLike(v: any) {
  const s = safeText(v).toLowerCase()
  return ["true", "1", "sim", "yes", "ok", "conforme"].includes(s)
}

function formatKpiDirection(mode: "UP" | "DOWN" | "BOOLEAN") {
  if (mode === "UP") return "Quanto maior, melhor"
  if (mode === "DOWN") return "Quanto menor, melhor"
  return "Booleano (Sim/Não)"
}

function formatThresholdValue(n: number) {
  if (!Number.isFinite(n)) return "N/A"
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "")
}

function buildKpiRuleSummary(run: ReviewDetail["run"]) {
  const mode = run.kpi_evaluation_mode || "UP"
  const targetText = safeText(run.kpi_target)

  if (!targetText) {
    return {
      targetLabel: "Não configurado",
      directionLabel: formatKpiDirection(mode),
      lines: ["Regra de avaliação não configurada."],
    }
  }

  if (mode === "BOOLEAN") {
    const expected = isTrueLike(targetText) ? "Sim" : "Não"
    return {
      targetLabel: expected,
      directionLabel: formatKpiDirection(mode),
      lines: [`Green quando o valor for ${expected}`, "Red quando o valor divergir do esperado"],
    }
  }

  const targetNumber = parseNumberLoose(targetText)
  if (targetNumber === null) {
    return {
      targetLabel: targetText,
      directionLabel: formatKpiDirection(mode),
      lines: ["Meta configurada, mas sem regra numérica legível."],
    }
  }

  if (mode === "UP") {
    const yellowFloor = targetNumber * (run.kpi_rules?.yellow_ratio ?? 0.9)
    return {
      targetLabel: targetText,
      directionLabel: formatKpiDirection(mode),
      lines: [
        `Green >= ${formatThresholdValue(targetNumber)}`,
        `Yellow entre ${formatThresholdValue(yellowFloor)} e ${formatThresholdValue(targetNumber)}`,
        `Red abaixo de ${formatThresholdValue(yellowFloor)}`,
      ],
    }
  }

  const redThreshold = targetNumber + (run.kpi_rules?.zero_meta_yellow_max ?? 1)
  return {
    targetLabel: targetText,
    directionLabel: formatKpiDirection(mode),
    lines: [
      `Green <= ${formatThresholdValue(targetNumber)}`,
      `Yellow até ${formatThresholdValue(redThreshold)}`,
      `Red acima de ${formatThresholdValue(redThreshold)}`,
    ],
  }
}

export default function RevisaoDetalhePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ runId: string }>()
  const runId = safeText(params?.runId)
  const backHref = useMemo(() => {
    const qs = searchParams?.toString() || ""
    return qs ? `/revisao?${qs}` : "/revisao"
  }, [searchParams])

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [detail, setDetail] = useState<ReviewDetail | null>(null)

  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("")
  const [manualFinalStatus, setManualFinalStatus] = useState<ReviewFinalStatus>("")
  const [reason, setReason] = useState("")
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState("grc.analyst@local")

  useEffect(() => {
    if (typeof window === "undefined") return
    const fromStorage = safeText(window.localStorage.getItem("kpi_user_email"))
    if (fromStorage) setCurrentUserEmail(fromStorage)
  }, [])

  useEffect(() => {
    async function load() {
      if (!runId) return

      setLoading(true)
      setErrorMsg("")

      try {
        const res = await fetchReviewDetail(runId)
        if (!res.success) {
          setDetail(null)
          setErrorMsg((res as any).error || "Falha ao carregar detalhamento da revisão.")
          return
        }

        const payload = (res as any).data as ReviewDetail
        setDetail(payload)

        const latestDecision = mapReviewStatusToDecision(payload?.latestReview?.review_status)
        const currentFinalStatus = normalizeStatus((payload as any)?.run?.grc_final_status)
        const derivedFinalStatus = mapDecisionToFinalStatus(latestDecision, normalizeStatus(payload?.run?.execution_status))
        if (latestDecision) setReviewDecision(latestDecision)
        if (currentFinalStatus && currentFinalStatus !== derivedFinalStatus && currentFinalStatus !== "REPROVADO") {
          setManualFinalStatus(currentFinalStatus)
        }

        setComment(safeText(payload?.latestReview?.analyst_comment))
        setReason(safeText(payload?.latestReview?.override_reason))
      } catch (error) {
        console.error("Erro ao carregar detalhe da revisão:", error)
        setErrorMsg("Falha ao carregar detalhamento da revisão.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [runId])

  const executionStatus = useMemo(() => normalizeStatus(detail?.run?.execution_status), [detail])
  const kpiRuleSummary = useMemo(() => (detail?.run ? buildKpiRuleSummary(detail.run) : null), [detail])
  const reviewFinalStatus = useMemo(() => {
    if (reviewDecision === "REJECTED") return manualFinalStatus
    if (manualFinalStatus) return manualFinalStatus
    return mapDecisionToFinalStatus(reviewDecision, executionStatus)
  }, [manualFinalStatus, reviewDecision, executionStatus])
  const isManualOverrideMode = reviewDecision === "REJECTED"
  const shouldShowReviewFields = reviewDecision === "NEEDS_ADJUSTMENTS" || isManualOverrideMode

  async function handleFinalizeReview() {
    if (!detail?.run?.run_id) return

    if (!reviewDecision || !reviewFinalStatus) {
      if (!manualFinalStatus || !isManualOverrideMode) {
        alert("Selecione a decisão da revisão ou defina manualmente o resultado final.")
        return
      }
    }

    if (isManualOverrideMode && !manualFinalStatus) {
      alert("Selecione o resultado final manualmente: Green, Yellow ou Red.")
      return
    }

    const decisionToPersist = manualFinalStatus ? mapManualFinalStatusToDecision(reviewFinalStatus) : reviewDecision

    if (!decisionToPersist || !reviewFinalStatus) {
      alert("Não foi possível determinar a decisão a ser salva.")
      return
    }

    if (shouldShowReviewFields && !safeText(reason)) {
      alert("Selecione o motivo da revisão antes de finalizar.")
      return
    }

    if (shouldShowReviewFields && !safeText(comment)) {
      alert("Preencha os comentários da revisão antes de finalizar.")
      return
    }

    setSaving(true)
    try {
      const res = await saveSecurityReviewByRun({
        run_id: detail.run.run_id,
        review_status: decisionToPersist,
        final_status: reviewFinalStatus,
        analyst_comment: comment || null,
        override_reason: reason || null,
        reviewed_by_email: currentUserEmail,
      })

      if (!res.success) {
        alert((res as any).error || "Falha ao salvar revisão.")
        return
      }

      setShowSuccessModal(true)
    } catch (error) {
      console.error("Erro ao salvar revisão:", error)
      alert("Falha ao salvar revisão.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="space-y-3">
        <nav className="flex items-center gap-2 text-xs text-slate-500">
          <Link href={backHref} className="hover:text-[#f71866]">Fila de Revisão</Link>
          <span>/</span>
          <span className="text-slate-700 font-semibold">Revisar Execução</span>
        </nav>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Detalhamento da Revisão</h1>
            <p className="text-slate-500 text-sm mt-1">Validação final da execução registrada e dos planos de ação associados.</p>
          </div>
          <Link href={backHref} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50">
            <ArrowLeft size={14} /> Voltar
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 flex items-center justify-center gap-3 text-slate-500">
          <Loader2 size={20} className="animate-spin text-[#f71866]" /> Carregando detalhamento...
        </div>
      ) : errorMsg ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-red-600 text-sm font-medium">{errorMsg}</div>
      ) : !detail ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-500 text-sm font-medium">Registro não encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Controle e KPI</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Control ID</p>
                  <p className="font-semibold text-slate-800 mt-1">{detail.run.id_control}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Framework</p>
                  <p className="font-semibold text-slate-800 mt-1">{detail.run.framework}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Nome do Controle</p>
                  <p className="font-semibold text-slate-800 mt-1">{detail.run.name_control}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">KPI</p>
                  <p className="font-semibold text-slate-800 mt-1">{detail.run.kpi_name} ({detail.run.kpi_id || detail.run.kpi_code})</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Período</p>
                  <p className="font-semibold text-slate-800 mt-1">{detail.run.period}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Meta</p>
                  <p className="font-semibold text-slate-800 mt-1">{kpiRuleSummary?.targetLabel || "Não configurado"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Direção da Meta</p>
                  <p className="font-semibold text-slate-800 mt-1">{kpiRuleSummary?.directionLabel || "Não configurado"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Regra de Avaliação</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(kpiRuleSummary?.lines || ["Não configurado"]).map((line) => (
                      <span
                        key={line}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <User size={14} /> Dados do Executor
              </div>
              <div className="text-sm text-slate-700 space-y-1">
                <p><span className="text-slate-400">Executor:</span> {detail.run.executor_email || "N/A"}</p>
                <p><span className="text-slate-400">Registrado em:</span> {formatDateTime(detail.run.updated_at || detail.run.created_at)}</p>
                <p><span className="text-slate-400">Owner:</span> {detail.run.owner_name} ({detail.run.owner_area || "N/A"})</p>
                <p><span className="text-slate-400">Focal Point:</span> {detail.run.focal_point_name || "N/A"}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ClipboardCheck size={14} /> Resultado da Execução
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Valor Medido</p>
                  <p className="text-lg font-bold text-slate-800 mt-1">{safeText(detail.run.measured_value) || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Status Calculado</p>
                  <span className={`inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusClass(executionStatus)}`}>
                    {executionStatus || "N/A"}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Evidência</p>
                  {detail.run.evidence_link ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700 inline-flex items-center gap-1"><FileText size={12} /> {detail.run.evidence_link}</p>
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-red-600 inline-flex items-center gap-1"><ShieldAlert size={12} /> Sem evidência anexada</p>
                  )}
                </div>
              </div>

              <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Comentário do Executor</p>
                <p className="text-sm text-slate-600 italic">{detail.run.executor_comment || "Sem comentário do executor."}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle size={14} /> Planos de Ação da Execução
              </div>

              {detail.actionPlans.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum plano de ação associado a esta execução.</p>
              ) : (
                <div className="space-y-3">
                  {detail.actionPlans.map((plan, idx) => (
                    <div key={`${plan.id || idx}`} className="border border-slate-100 rounded-lg p-4 bg-slate-50/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{safeText(plan.title) || `Plano #${plan.id}`}</p>
                          <p className="text-xs text-slate-500 mt-1">{safeText(plan.description) || "Sem descrição"}</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {safeText(plan.plan_status) || "Aberto"}
                        </span>
                      </div>
                      <div className="mt-3 text-[11px] text-slate-500 flex gap-4">
                        <span>Responsável: {safeText(plan.responsible_name) || "N/A"}</span>
                        <span>Prazo: {formatDate(plan.due_date)}</span>
                        {plan.id ? <Link href={`/planos/${plan.id}`} className="text-[#f71866] font-semibold">Abrir plano</Link> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-100 rounded-xl p-6 sticky top-8 space-y-5">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Decisão do Analista GRC</div>
                <p className="text-xs text-slate-500">
                  Confirme o resultado apresentado pelo ponto focal, solicite ajuste quando houver inconsistências ou defina manualmente o resultado final quando quiser concluir a análise com outro status.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewDecision("APPROVED")
                    setManualFinalStatus("")
                  }}
                  className={`px-3 py-3 text-xs rounded-lg border flex flex-col items-center justify-center gap-1 text-center ${reviewDecision === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200"}`}
                >
                  <span className="inline-flex items-center gap-1 font-bold">
                    <ShieldCheck size={14} /> Confirmar
                  </span>
                  <span className="text-[11px] leading-tight">
                    Mantém {statusLabel(executionStatus)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewDecision("NEEDS_ADJUSTMENTS")
                    setManualFinalStatus("")
                  }}
                  className={`px-3 py-3 text-xs rounded-lg border flex flex-col items-center justify-center gap-1 text-center ${reviewDecision === "NEEDS_ADJUSTMENTS" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-500 border-slate-200"}`}
                >
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Clock3 size={14} /> Solicitar ajuste
                  </span>
                  <span className="text-[11px] leading-tight">
                    Resultado final fica Em atenção
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewDecision("REJECTED")
                  }}
                  className={`px-3 py-3 text-xs rounded-lg border flex flex-col items-center justify-center gap-1 text-center ${reviewDecision === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-500 border-slate-200"}`}
                >
                  <span className="inline-flex items-center gap-1 font-bold">
                    <XCircle size={14} /> Definir resultado
                  </span>
                  <span className="text-[11px] leading-tight">
                    Analista escolhe Green, Yellow ou Red
                  </span>
                </button>
              </div>

              {isManualOverrideMode ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Definição manual do resultado final</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Use esta opção quando o analista discordar do status registrado na execução e quiser concluir a revisão sem devolver para ajuste.
                    </p>
                  </div>
                  {manualFinalStatus ? (
                    <button
                      type="button"
                      onClick={() => setManualFinalStatus("")}
                      className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#f71866]"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "GREEN", label: "Green", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { value: "YELLOW", label: "Yellow", style: "bg-amber-50 text-amber-700 border-amber-200" },
                    { value: "RED", label: "Red", style: "bg-red-50 text-red-700 border-red-200" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setManualFinalStatus(option.value as ReviewFinalStatus)}
                      className={`px-3 py-3 text-xs rounded-lg border font-bold uppercase tracking-widest transition-all ${
                        manualFinalStatus === option.value ? option.style : "bg-white text-slate-500 border-slate-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {manualFinalStatus ? (
                  <div className="text-xs text-slate-600">
                    O resultado final será salvo manualmente como <span className="font-bold">{manualFinalStatus}</span>, prevalecendo sobre o status calculado da execução.
                  </div>
                ) : null}
              </div>
              ) : null}

              <div className={`rounded-lg border px-4 py-3 ${statusClass(reviewFinalStatus || executionStatus)}`}>
                <div className="text-[11px] font-bold uppercase tracking-widest opacity-70">Resultado final que será salvo</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{statusLabel(reviewFinalStatus)}</span>
                  <span className="text-[11px] uppercase font-bold">
                    {reviewFinalStatus || "PENDENTE"}
                  </span>
                </div>
              </div>

              {shouldShowReviewFields ? (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {isManualOverrideMode ? "Motivo da definição manual" : "Motivo do ajuste"}
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866]"
                >
                  <option value="">Selecione...</option>
                  <option value="Evidência incompleta ou ausente">Evidência incompleta ou ausente</option>
                  <option value="Dados inconsistentes com a medição">Dados inconsistentes com a medição</option>
                  <option value="Período de evidência incorreto">Período de evidência incorreto</option>
                  <option value="Outro">Outro motivo</option>
                </select>
              </div>
              ) : null}

              {shouldShowReviewFields ? (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {isManualOverrideMode ? "Comentários da definição manual" : "Comentários da revisão"}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866] min-h-[120px]"
                  placeholder={
                    isManualOverrideMode
                      ? "Explique por que o resultado final está sendo definido manualmente pelo analista..."
                      : "Detalhe os pontos que precisam ser ajustados pelo ponto focal..."
                  }
                />
              </div>
              ) : null}

              <div className="p-3 bg-blue-50 rounded border border-blue-100 text-[11px] text-blue-700">
                O registro será salvo em modo append-only na tabela de revisões (`security_reviews`) mantendo histórico auditável.
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinalizeReview}
                  disabled={saving}
                  className="w-full bg-[#f71866] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#d61556] transition-all disabled:opacity-60"
                >
                  {saving ? "Finalizando..." : "Finalizar Revisão"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setShowSuccessModal(false)
            router.push(backHref)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Revisão finalizada com sucesso</h3>
                <p className="text-sm text-slate-500 mt-1">Clique em OK para voltar à fila de revisão.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false)
                  router.push(backHref)
                }}
                className="px-5 py-2 rounded-full bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
