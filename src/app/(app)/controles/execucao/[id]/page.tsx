"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import {
  Shield,
  Target,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
  UploadCloud,
  Loader2,
} from "lucide-react"

import { fetchExecucaoContext, saveKpiExecution, type AdminKpiRules, type KpiEvaluationMode } from "./actions"
import { fetchControleByCode } from "../../actions"

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

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

function parseBooleanLoose(v: any): boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === "boolean") return v

  const s = String(v).trim().toLowerCase()
  if (!s) return null

  if (["true", "t", "1", "sim", "s", "yes", "y", "ok", "conforme"].includes(s)) return true
  if (["false", "f", "0", "nao", "não", "n", "no", "fail", "não conforme"].includes(s)) return false

  return null
}

function normalizeMode(v: any): KpiEvaluationMode {
  const s = String(v || "").trim().toUpperCase()
  if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
  return "UP"
}

function computeStatusClient(params: {
  mode: KpiEvaluationMode
  target: any
  measured: any
  rules: AdminKpiRules
}): "GREEN" | "YELLOW" | "RED" | "PEND" {
  const mode = normalizeMode(params.mode)

  if (mode === "BOOLEAN") {
    const t = parseBooleanLoose(params.target)
    const m = parseBooleanLoose(params.measured)
    if (t === null || m === null) return "PEND"
    return m === t ? "GREEN" : "RED"
  }

  const targetN = parseNumberLoose(params.target)
  const measuredN = parseNumberLoose(params.measured)
  if (targetN === null || measuredN === null) return "PEND"

  if (mode === "UP") {
    const yellowFloor = targetN * params.rules.yellow_ratio
    if (measuredN >= targetN) return "GREEN"
    if (measuredN >= yellowFloor) return "YELLOW"
    return "RED"
  }

  // DOWN
  const bufferMax = targetN + params.rules.zero_meta_yellow_max
  if (measuredN <= targetN) return "GREEN"
  if (measuredN > targetN && measuredN <= bufferMax) return "YELLOW"
  return "RED"
}

function mapStatusToUi(s: string) {
  const up = String(s || "").toUpperCase()
  if (up === "GREEN") return { label: "Meta Atingida", dot: "bg-emerald-500", text: "text-emerald-600" }
  if (up === "RED") return { label: "Crítico", dot: "bg-red-500", text: "text-red-600" }
  if (up === "YELLOW") return { label: "Em Atenção", dot: "bg-amber-500", text: "text-amber-600" }
  return { label: "PEND.", dot: "bg-slate-300", text: "text-slate-500" }
}

function getDefaultPeriodoISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

function formatPeriodoLabel(periodoISO: string) {
  const s = safeText(periodoISO)
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (!m) return s || ""
  const year = Number(m[1])
  const month = Number(m[2])
  const monthName = MONTHS_PT[month - 1] || ""
  return `${monthName} / ${year}`
}

export default function RegistrarExecucaoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const id = (params.id as string) || ""
  const kpiParam = safeText(searchParams.get("kpi"))
  const periodoISO = safeText(searchParams.get("periodo") || searchParams.get("period")) || getDefaultPeriodoISO()
  const periodoLabel = formatPeriodoLabel(periodoISO)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [control, setControl] = useState<any>(null)
  const [kpi, setKpi] = useState<any>(null)
  const [run, setRun] = useState<any>(null)
  const [rules, setRules] = useState<AdminKpiRules>({ yellow_ratio: 0.9, zero_meta_yellow_max: 1 })

  // ✅ valor medido (string) — para permitir "90", "90.5", etc.
  const [resultado, setResultado] = useState<string>("")
  // ✅ boolean selection (guardamos "true"/"false")
  const [resultadoBool, setResultadoBool] = useState<string>("")

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [notes, setNotes] = useState<string>("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        if (!id) {
          setLoadError("Parâmetros inválidos: faltando id na URL.")
          return
        }

        // ✅ resolve KPI: usa URL ou pega o primeiro KPI do controle
        let resolvedKpi = kpiParam

        if (!resolvedKpi) {
          const ctrlRes = await fetchControleByCode(id)
          if (!ctrlRes?.success || !ctrlRes.data) {
            setLoadError(ctrlRes?.error || "Falha ao carregar controle.")
            return
          }

          const all = Array.isArray(ctrlRes.data.all_kpis) ? ctrlRes.data.all_kpis : []
          if (all.length === 0) {
            setLoadError("Este controle não possui KPIs cadastrados.")
            return
          }

          resolvedKpi = safeText(all[0]?.kpi_uuid || all[0]?.kpi_id || "")
          if (!resolvedKpi) {
            setLoadError("Não foi possível identificar o KPI deste controle.")
            return
          }
        }

        type ExecucaoContextSuccess = {
          success: true
          warning?: string
          data: {
            control: any
            kpi: any
            run: any | null
            rules: AdminKpiRules
          }
        }
        
        type ExecucaoContextFail = {
          success: false
          error: string
        }
        
        type ExecucaoContextResult = ExecucaoContextSuccess | ExecucaoContextFail
        
        const res = (await fetchExecucaoContext({
          id_control: id,
          kpi: resolvedKpi,
          period: periodoISO,
        })) as ExecucaoContextResult
        
        if (!res.success) {
          setLoadError(res.error || "Falha ao carregar dados.")
          return
        }
        
        const { control, kpi, run, rules } = res.data
        setControl(control)
        setKpi(kpi)
        setRun(run || null)
        if (rules) setRules(rules)

        const mode = normalizeMode(kpi?.kpi_evaluation_mode)

        // ✅ Se já existe run, preenche campos
        if (mode === "BOOLEAN") {
          const mv = run?.measured_value
          // salvamos boolean como 1/0 no backend, então converte:
          const b = mv === "1" || mv === 1 || String(mv).trim() === "1"
          setResultadoBool(run ? (b ? "true" : "false") : "")
          setResultado("")
        } else {
          if (run?.measured_value !== null && run?.measured_value !== undefined) {
            const n = parseNumberLoose(run.measured_value)
            setResultado(n === null ? "" : String(n))
          } else {
            setResultado("")
          }
          setResultadoBool("")
        }

        if (run?.executor_comment) setNotes(String(run.executor_comment))
      } catch {
        setLoadError("Erro ao conectar com o servidor.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, kpiParam, periodoISO])

  const mode: KpiEvaluationMode = useMemo(() => normalizeMode(kpi?.kpi_evaluation_mode), [kpi?.kpi_evaluation_mode])

  const computedStatus = useMemo(() => {
    if (!kpi) return "PEND"
    const measured = mode === "BOOLEAN" ? resultadoBool : resultado
    return computeStatusClient({
      mode,
      target: kpi?.kpi_target,
      measured,
      rules,
    })
  }, [kpi, mode, resultado, resultadoBool, rules])

  const stUi = useMemo(() => mapStatusToUi(computedStatus), [computedStatus])

  const thresholdLabel = useMemo(() => {
    const target = kpi?.kpi_target
    if (mode === "BOOLEAN") return `Esperado: ${parseBooleanLoose(target) ? "Sim" : "Não"}`
    const t = parseNumberLoose(target)
    if (t === null) return "Meta inválida"
    if (mode === "UP") return `Meta: ≥ ${t}`
    return `Meta: ≤ ${t}`
  }, [kpi?.kpi_target, mode])

  async function onSave() {
    const kpiUuid = safeText(kpi?.kpi_uuid)
    if (!kpiUuid) {
      setSaveError("Este KPI ainda não possui kpi_uuid em control_kpis.")
      return
    }

    // ✅ valida conforme modo
    let measuredToSend: any = null
    if (mode === "BOOLEAN") {
      const b = parseBooleanLoose(resultadoBool)
      if (b === null) {
        setSaveError("Selecione Sim/Não no Resultado da Verificação.")
        return
      }
      measuredToSend = b ? "true" : "false"
    } else {
      const n = parseNumberLoose(resultado)
      if (n === null) {
        setSaveError("Preencha o Resultado da Verificação com um número válido.")
        return
      }
      measuredToSend = n
    }

    setSaving(true)
    setSaveError(null)

    try {
      const res = await saveKpiExecution({
        id_control: id,
        kpi_id: kpiUuid, // ✅ sempre por UUID
        period: periodoISO,
        measured_value: measuredToSend,
        executor_comment: notes || null,
        evidence_link: arquivo ? arquivo.name : null,
        created_by_email: null,
      })

      if (!res.success) {
        setSaveError((res as any).error || "Falha ao salvar.")
        return
      }

      router.push(`/controles/${encodeURIComponent(id)}?periodo=${encodeURIComponent(periodoISO)}`)
    } catch {
      setSaveError("Erro ao salvar no servidor.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={22} />
        <span className="ml-2 font-bold text-sm">Carregando execução...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-red-100 rounded-2xl p-6 max-w-lg w-full">
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <AlertCircle size={18} /> Erro
          </div>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <div className="mt-4">
            <Link href={`/controles?periodo=${encodeURIComponent(periodoISO)}`} className="text-[#f71866] font-bold text-sm">
              Voltar para Controles
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const kpiIdText = safeText(kpi?.kpi_id || "")
  const kpiNameText = safeText(kpi?.kpi_name || "")
  const kpiDescText = safeText(kpi?.kpi_description || "")
  const kpiTypeText = safeText(kpi?.kpi_type || "")
  const kpiTargetText = safeText(kpi?.kpi_target || "")

  return (
    <div className="min-h-screen bg-[#f8f5f6] text-slate-800 font-sans animate-in fade-in duration-500">
      <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            <Link href={`/controles?periodo=${encodeURIComponent(periodoISO)}`} className="hover:text-[#f71866] transition-colors">
              Controles
            </Link>
            <span>/</span>
            <Link href={`/controles/${encodeURIComponent(id)}?periodo=${encodeURIComponent(periodoISO)}`} className="hover:text-[#f71866] transition-colors">
              {id}
            </Link>
            <span>/</span>
            <span className="text-slate-600">Execução</span>
          </nav>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Registrar Execução de KPI</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#f71866]/20">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-3">Controle Relacionado</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f71866]/5 flex items-center justify-center text-[#f71866]">
                <Shield size={18} />
              </div>
              <span className="font-semibold text-slate-700 text-sm tracking-tight">{id} - {control?.name_control || "Controle"}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#f71866]/20">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-3">KPI em Avaliação</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Target size={18} />
              </div>
              <span className="font-semibold text-slate-700 text-sm tracking-tight">{kpi?.kpi_name || kpi?.kpi_id || "KPI"}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#f71866]/20">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-3">Período de Referência</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <Calendar size={18} />
              </div>
              <span className="font-semibold text-slate-700 text-sm tracking-tight capitalize">{periodoLabel}</span>
            </div>
          </div>
        </section>

        {/* ✅ Detalhes do KPI */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-[#f71866]" />
              <h2 className="font-bold text-slate-800 text-[11px] uppercase tracking-widest">Detalhes do KPI</h2>
            </div>

            {!!kpiTypeText && (
              <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border border-slate-200 text-slate-600 bg-white">
                {kpiTypeText} • {mode}
              </div>
            )}
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-2">KPI ID</span>
                <div className="text-sm font-extrabold text-slate-800 break-words">{kpiIdText || "N/A"}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-2">Nome do KPI</span>
                <div className="text-sm font-extrabold text-slate-800 break-words">{kpiNameText || "N/A"}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-2">Meta (Target)</span>
                <div className="text-sm font-extrabold text-slate-800 break-words">{kpiTargetText || "N/A"}</div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-2">Descrição do KPI</span>
              <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{kpiDescText || "N/A"}</p>
            </div>
          </div>
        </section>

        {/* ✅ Evidência + Execução */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#f71866]" />
              <h2 className="font-bold text-slate-800 text-[11px] uppercase tracking-widest">Registro de Execução</h2>
            </div>

            {/* ✅ preview automático do status */}
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${stUi.dot}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${stUi.text}`}>{stUi.label}</span>
            </div>
          </div>

          <form className="p-8 space-y-8" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest block border-l-2 border-[#f71866] pl-3">
                  Resultado da Verificação
                </label>

                {/* ✅ input muda conforme modo */}
                {mode === "BOOLEAN" ? (
                  <select
                    value={resultadoBool}
                    onChange={(e) => setResultadoBool(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866]"
                  >
                    <option value="">Selecione...</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                ) : (
                  <div className="relative group">
                    <input
                      type="number"
                      value={resultado}
                      onChange={(e) => setResultado(e.target.value)}
                      className={`w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-xl font-bold outline-none transition-all focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866] ${stUi.text}`}
                      placeholder=""
                    />
                    {/* se você não quiser % sempre, é só remover esse span */}
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">%</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium italic">
                  <Info size={12} /> {thresholdLabel} • Yellow:{" "}
                  {mode === "UP"
                    ? `>= meta*${rules.yellow_ratio}`
                    : mode === "DOWN"
                      ? `até meta+${rules.zero_meta_yellow_max}`
                      : "comparação Sim/Não"}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest block border-l-2 border-[#f71866] pl-3">
                  Upload da Evidência
                </label>
                <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all cursor-pointer min-h-[95px] relative group hover:border-[#f71866]/30">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => setArquivo(e.target.files ? e.target.files[0] : null)}
                  />
                  <UploadCloud size={24} className="text-slate-300 group-hover:text-[#f71866] transition-colors" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight text-center">
                    {arquivo ? arquivo.name : "Arraste o documento ou clique para selecionar"}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest block border-l-2 border-[#f71866] pl-3">
                  Notas e comentários do ponto focal
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Descreva o processo de coleta e as validações realizadas para este período..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866] resize-none"
                />
              </div>
            </div>

            {saveError && (
              <div className="mt-6 text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {saveError}
              </div>
            )}
          </form>
        </section>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <Link
            href={`/controles/${encodeURIComponent(id)}?periodo=${encodeURIComponent(periodoISO)}`}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-700 transition-all group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Descartar Alterações
          </Link>

          <button
            onClick={onSave}
            disabled={saving}
            className={`w-full md:w-auto bg-[#f71866] hover:bg-[#d61556] text-white px-10 py-4 rounded-xl text-xs font-bold shadow-xl shadow-[#f71866]/20 transition-all flex items-center justify-center gap-3 group active:scale-95 tracking-widest ${
              saving ? "opacity-80 cursor-not-allowed" : ""
            }`}
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />}
            {saving ? "SALVANDO..." : "FINALIZAR REGISTRO"}
          </button>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-8 pb-12 text-center md:text-left">
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Sync Status: <span className="text-emerald-500">Connected</span> • 2026 GRC Platform
        </p>
      </footer>
    </div>
  )
}
