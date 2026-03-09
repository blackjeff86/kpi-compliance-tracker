"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
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
  }
  latestReview: {
    review_status?: string
    analyst_comment?: string
    override_reason?: string
  } | null
  actionPlans: ActionPlan[]
}

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
  return "bg-slate-50 text-slate-600 border-slate-100"
}

export default function RevisaoDetalhePage() {
  const router = useRouter()
  const params = useParams<{ runId: string }>()
  const runId = safeText(params?.runId)

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [detail, setDetail] = useState<ReviewDetail | null>(null)

  const [reviewStatus, setReviewStatus] = useState<"GREEN" | "YELLOW" | "RED" | "">("")
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

        const latestStatus = safeText(payload?.latestReview?.review_status).toUpperCase()
        if (["GREEN", "YELLOW", "RED"].includes(latestStatus)) {
          setReviewStatus(latestStatus as any)
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

  const executionStatus = useMemo(() => safeText(detail?.run?.execution_status).toUpperCase(), [detail])

  async function handleFinalizeReview() {
    if (!detail?.run?.run_id) return

    if (!["GREEN", "YELLOW", "RED"].includes(reviewStatus)) {
      alert("Selecione o resultado da revisão (Aprovar, Ajuste ou Reprovar).")
      return
    }

    setSaving(true)
    try {
      const res = await saveSecurityReviewByRun({
        run_id: detail.run.run_id,
        review_status: reviewStatus,
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
          <Link href="/revisao" className="hover:text-[#f71866]">Fila de Revisão</Link>
          <span>/</span>
          <span className="text-slate-700 font-semibold">Revisar Execução</span>
        </nav>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Detalhamento da Revisão</h1>
            <p className="text-slate-500 text-sm mt-1">Validação final da execução registrada e dos planos de ação associados.</p>
          </div>
          <Link href="/revisao" className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
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
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Parecer do Analista GRC</div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewStatus("GREEN")}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${reviewStatus === "GREEN" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200"}`}
                >
                  <ShieldCheck size={14} /> Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatus("YELLOW")}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${reviewStatus === "YELLOW" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-500 border-slate-200"}`}
                >
                  <Clock3 size={14} /> Ajuste
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatus("RED")}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 ${reviewStatus === "RED" ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-500 border-slate-200"}`}
                >
                  <XCircle size={14} /> Reprovar
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Motivo (se ajuste/reprovação)</label>
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

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Comentários da Revisão</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866] min-h-[120px]"
                  placeholder="Detalhe os pontos validados na revisão final..."
                />
              </div>

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
            router.push("/revisao")
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
                  router.push("/revisao")
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
