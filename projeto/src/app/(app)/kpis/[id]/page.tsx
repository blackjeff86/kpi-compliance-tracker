"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronRight,
  Settings,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Save,
  X,
  Trash2,
  FileText,
  User,
  Tag,
  Hash,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
} from "lucide-react"
import { deleteKpiByRef, fetchKpiDetail, saveKpiTargetAndRules } from "./actions"

type Rules = {
  yellow_ratio: number
  zero_meta_yellow_max: number
}

type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"

type KpiDetail = {
  kpi_uuid: string | null
  kpi_id: string
  kpi_name: string
  kpi_description: string | null
  kpi_type: string | null

  kpi_evaluation_mode: KpiEvaluationMode
  kpi_target: string | null

  reference_month: string | null

  id_control: string
  control_name: string | null
  framework: string | null
  risk_title: string | null

  focal_point_name: string | null
}

type KpiLatestReview = {
  execution_status: string | null
  grc_final_status: string | null
  grc_review_comment: string | null
  grc_reviewed_at: string | null
  grc_reviewed_by_email: string | null
  review_status: string | null
}

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function safeNumber(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizeTypeLabel(v: any) {
  const s = String(v || "").trim().toLowerCase()
  if (!s) return "N/A"
  if (s.includes("auto")) return "Automatizado"
  if (s.includes("manual")) return "Manual"
  return String(v || "N/A")
}

function modeLabel(mode: KpiEvaluationMode) {
  if (mode === "UP") return "Quanto maior, melhor"
  if (mode === "DOWN") return "Quanto menor, melhor"
  return "Sim / Não (Booleano)"
}

function isTrueLike(v: any) {
  const s = String(v ?? "").trim().toLowerCase()
  return s === "true" || s === "1" || s === "sim" || s === "yes" || s === "ok"
}

function formatDateTime(v: any) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toLocaleString("pt-BR")
}

function getReviewBadgeClass(status: string) {
  const up = safeText(status).toUpperCase()
  if (up === "GREEN" || up === "CONFORME") return "bg-emerald-50 text-emerald-700 border-emerald-100"
  if (up === "YELLOW" || up.includes("ATEN")) return "bg-amber-50 text-amber-700 border-amber-100"
  if (up === "RED" || up === "REPROVADO" || up.includes("NÃO CONFORME") || up.includes("NAO CONFORME")) return "bg-red-50 text-red-700 border-red-100"
  return "bg-slate-50 text-slate-600 border-slate-100"
}

function reviewStatusLabel(status: string) {
  const up = safeText(status).toUpperCase()
  if (up === "GREEN") return "Conforme"
  if (up === "YELLOW") return "Em atenção"
  if (up === "RED") return "Não conforme"
  if (up === "REPROVADO") return "Reprovado"
  return "Sem revisão"
}

export default function KpiDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando KPI...</div>}>
      <KpiDetailPageContent />
    </Suspense>
  )
}

function KpiDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const kpiRef = decodeURIComponent(String((params as any)?.id || ""))

  // ✅ mantém contexto ao voltar pelo link interno
  const backHref = useMemo(() => {
    const qs = searchParams?.toString() || ""
    return qs ? `/kpis?${qs}` : "/kpis"
  }, [searchParams])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [warnMsg, setWarnMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [detail, setDetail] = useState<KpiDetail | null>(null)
  const [latestReview, setLatestReview] = useState<KpiLatestReview | null>(null)

  const [modalOpen, setModalOpen] = useState(false)

  // config
  const [kpiIdEdit, setKpiIdEdit] = useState<string>("")
  const [kpiNameEdit, setKpiNameEdit] = useState<string>("")
  const [kpiDescriptionEdit, setKpiDescriptionEdit] = useState<string>("")
  const [kpiTarget, setKpiTarget] = useState<string>("0")
  const [mode, setMode] = useState<KpiEvaluationMode>("UP")
  const [rules, setRules] = useState<Rules>({ yellow_ratio: 0.9, zero_meta_yellow_max: 1 })

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErrorMsg(null)
      setWarnMsg(null)
      setOkMsg(null)

      try {
        const res = await fetchKpiDetail(kpiRef)

        if (!res?.success) {
          setErrorMsg(res?.error || "Falha ao carregar KPI.")
          setDetail(null)
          setLoading(false)
          return
        }

        setDetail(res.data.detail)
        setLatestReview(res.data.latestReview || null)
        setKpiIdEdit(res.data.detail.kpi_id ?? "")
        setKpiNameEdit(res.data.detail.kpi_name ?? "")
        setKpiDescriptionEdit(res.data.detail.kpi_description ?? "")
        setMode(res.data.detail.kpi_evaluation_mode ?? "UP")
        setKpiTarget(res.data.detail.kpi_target ?? "0")
        setRules(res.data.rules)

        if (res.warning) setWarnMsg(res.warning)
      } catch {
        setErrorMsg("Falha ao carregar KPI.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [kpiRef])

  const preview = useMemo(() => {
    const yellow_ratio = clamp(rules.yellow_ratio ?? 0.9, 0.01, 0.999)
    const zero_max = clamp(rules.zero_meta_yellow_max ?? 1, 0, 999999)

    if (mode === "BOOLEAN") {
      const t = isTrueLike(kpiTarget)
      return {
        title: "Booleano (Sim / Não)",
        green: `GREEN: quando = ${t ? "Sim" : "Não"}`,
        yellow: `YELLOW: somente se não der pra interpretar (valor inválido)`,
        red: `RED: quando diferente de ${t ? "Sim" : "Não"}`,
      }
    }

    const meta = safeNumber(String(kpiTarget).replace(",", ".").replace("%", ""))
    if (meta === null) {
      return {
        title: "Meta inválida",
        green: "—",
        yellow: "—",
        red: "—",
      }
    }

    if (mode === "UP") {
      const yellowFloor = Math.round(meta * yellow_ratio)
      return {
        title: "Numérico (Quanto maior, melhor)",
        green: `GREEN: >= ${meta}`,
        yellow: `YELLOW: >= ${yellowFloor} e < ${meta}`,
        red: `RED: < ${yellowFloor}`,
      }
    }

    // DOWN
    return {
      title: "Numérico (Quanto menor, melhor)",
      green: `GREEN: <= ${meta}`,
      yellow: `YELLOW: ${meta + 1} .. ${meta + zero_max} (buffer: +${zero_max})`,
      red: `RED: > ${meta + zero_max}`,
    }
  }, [rules, kpiTarget, mode])

  const onSave = async () => {
    setSaving(true)
    setErrorMsg(null)
    setWarnMsg(null)
    setOkMsg(null)

    try {
      const res = await saveKpiTargetAndRules({
        kpiRef,
        kpi_id: kpiIdEdit,
        kpi_name: kpiNameEdit,
        kpi_description: kpiDescriptionEdit,
        kpi_target: kpiTarget,
        kpi_evaluation_mode: mode,
        yellow_ratio: rules.yellow_ratio,
        zero_meta_yellow_max: rules.zero_meta_yellow_max,
      })

      if (!res?.success) {
        setErrorMsg(res?.error || "Falha ao salvar.")
        setSaving(false)
        return
      }

      if (res.warning) setWarnMsg(res.warning)
      setOkMsg("Configurações salvas com sucesso.")
      setModalOpen(false)

      setKpiIdEdit(res.data.kpi_id)
      setKpiNameEdit(res.data.kpi_name)
      setKpiDescriptionEdit(res.data.kpi_description ?? "")
      setKpiTarget(res.data.kpi_target)
      setMode(res.data.kpi_evaluation_mode)
      setRules(res.data.rules)

      setDetail((p) =>
        p
          ? {
              ...p,
              kpi_id: res.data.kpi_id,
              kpi_name: res.data.kpi_name,
              kpi_description: res.data.kpi_description,
              kpi_target: res.data.kpi_target,
              kpi_evaluation_mode: res.data.kpi_evaluation_mode,
            }
          : p
      )
    } catch {
      setErrorMsg("Falha ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  const onDeleteConfirmed = async () => {
    if (!detail) return

    setDeleting(true)
    setErrorMsg(null)
    setWarnMsg(null)
    setOkMsg(null)

    try {
      const res = await deleteKpiByRef({ kpiRef })
      if (!res?.success) {
        setErrorMsg(res?.error || "Falha ao excluir KPI.")
        setDeleting(false)
        return
      }

      setDeleteConfirmOpen(false)
      setModalOpen(false)
      router.replace(backHref)
    } catch {
      setErrorMsg("Falha ao excluir KPI.")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-[#f71963]" size={40} />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="w-full p-10">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-sm font-bold text-red-600">KPI não encontrado</div>
          <div className="text-xs text-slate-500 mt-2">{errorMsg || "Tente voltar e selecionar outro KPI."}</div>
          <div className="mt-4">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
              Voltar
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            <Link href={backHref} className="hover:text-[#f71963] transition-colors">
              KPIs
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">{detail.kpi_id}</span>
          </nav>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#f71963]" />
              {detail.kpi_name}
            </h1>

            <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded font-black tracking-wider bg-slate-100 text-slate-600">
              <Hash size={12} />
              {detail.kpi_id}
            </span>

            <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded font-black tracking-wider bg-[#f71963]/10 text-[#f71963] border border-[#f71963]/10">
              <Tag size={12} />
              {normalizeTypeLabel(detail.kpi_type)}
            </span>
          </div>

          <p className="text-slate-500 mt-2 font-medium text-sm">
            Detalhamento do KPI e configuração da meta/regra de pontuação.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            Voltar
          </Link>
          <button
            onClick={() => {
              setKpiIdEdit(detail.kpi_id ?? "")
              setKpiNameEdit(detail.kpi_name ?? "")
              setKpiDescriptionEdit(detail.kpi_description ?? "")
              setKpiTarget(detail.kpi_target ?? "0")
              setMode(detail.kpi_evaluation_mode ?? "UP")
              setModalOpen(true)
            }}
            className="btn-vtex flex items-center gap-2"
            title="Configurar KPI"
          >
            <Settings size={14} />
            Configurar
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {warnMsg && (
        <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>{warnMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {okMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5" />
          <div>{okMsg}</div>
        </div>
      )}

      {/* GRID CONTENT */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <Card title="Informações do KPI" subtitle="Dados principais do indicador e configuração atual.">
            <div className="space-y-4">
              <InfoRow icon={<Hash size={14} />} label="KPI ID" value={detail.kpi_id} />
              <InfoRow icon={<FileText size={14} />} label="Descrição" value={detail.kpi_description || "—"} />
              <InfoRow icon={<Tag size={14} />} label="Tipo" value={normalizeTypeLabel(detail.kpi_type)} />
              <InfoRow icon={<Settings size={14} />} label="Modo de avaliação" value={modeLabel(detail.kpi_evaluation_mode)} />
              <InfoRow icon={<ShieldCheck size={14} />} label="Meta (Target)" value={detail.kpi_target ?? "0"} />

              <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Regra ativa (preview)
                </div>
                <div className="text-xs text-slate-700 font-bold">{preview.title}</div>
                <div className="text-xs text-slate-600 mt-2 space-y-1">
                  <div>🟢 {preview.green}</div>
                  <div>🟡 {preview.yellow}</div>
                  <div>🔴 {preview.red}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card title="Vínculo com Controle" subtitle="De onde esse KPI vem e quem é o ponto focal.">
            <div className="space-y-4">
              <InfoRow
                icon={<Hash size={14} />}
                label="Controle (id_control)"
                value={
                  <Link
                    href={`/controles/${encodeURIComponent(detail.id_control)}`}
                    className="text-[#f71963] font-bold hover:underline"
                  >
                    {detail.id_control}
                  </Link>
                }
              />
              <InfoRow icon={<FileText size={14} />} label="Nome do Controle" value={detail.control_name || "—"} />
              <InfoRow icon={<Tag size={14} />} label="Framework" value={detail.framework || "—"} />
              <InfoRow icon={<AlertTriangle size={14} />} label="Classificação de Risco" value={detail.risk_title || "—"} />
              <InfoRow icon={<User size={14} />} label="Ponto Focal" value={detail.focal_point_name || "—"} />
            </div>
          </Card>

          {latestReview?.grc_final_status ? (
            <Card title="Última Revisão GRC" subtitle="Motivo mais recente registrado pelo analista para este KPI.">
              <div className="space-y-4">
                <InfoRow
                  icon={<ShieldCheck size={14} />}
                  label="Status final"
                  value={
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getReviewBadgeClass(latestReview.grc_final_status || "")}`}>
                      {reviewStatusLabel(latestReview.grc_final_status || "")}
                    </span>
                  }
                />
                <InfoRow icon={<Tag size={14} />} label="Status calculado" value={safeText(latestReview.execution_status) || "—"} />
                <InfoRow icon={<User size={14} />} label="Revisado por" value={safeText(latestReview.grc_reviewed_by_email) || "—"} />
                <InfoRow icon={<FileText size={14} />} label="Data da revisão" value={formatDateTime(latestReview.grc_reviewed_at)} />

                {safeText(latestReview.grc_review_comment) ? (
                  <div className={`rounded-xl border p-4 ${getReviewBadgeClass(latestReview.grc_final_status || "")}`}>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Comentário do analista GRC</div>
                    <div className="mt-2 text-sm font-medium leading-relaxed">
                      {latestReview.grc_review_comment}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {/* MODAL CONFIG */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !(saving || deleting) && setModalOpen(false)} />

          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configurações</div>
                <div className="text-lg font-semibold text-slate-900 flex items-center gap-2 mt-1">
                  <Settings size={16} className="text-[#f71963]" />
                  Configuração do KPI
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Edite identificação, texto e também o modo/meta de avaliação do KPI.
                </div>
              </div>

              <button
                onClick={() => !(saving || deleting) && setModalOpen(false)}
                className={`p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 transition-all ${
                  saving || deleting ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldText
                  label="KPI ID"
                  hint="Código único do indicador. Ex: KPI-01."
                  value={kpiIdEdit}
                  onChange={(v: string) => setKpiIdEdit(v)}
                />
                <FieldText
                  label="Texto do KPI"
                  hint="Título principal exibido no detalhamento."
                  value={kpiNameEdit}
                  onChange={(v: string) => setKpiNameEdit(v)}
                />
              </div>

              <FieldTextArea
                label="Descrição do KPI"
                hint="Texto explicativo detalhado do indicador."
                value={kpiDescriptionEdit}
                onChange={(v: string) => setKpiDescriptionEdit(v)}
              />

              {/* Modo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldSelect
                  label="Modo de avaliação (kpi_evaluation_mode)"
                  hint="Define como o KPI será julgado: maior melhor, menor melhor, ou sim/não."
                  value={mode}
                  onChange={(v) => {
                    const next = v as KpiEvaluationMode
                    setMode(next)

                    // UX: quando muda pra boolean, ajusta target padrão
                    if (next === "BOOLEAN") {
                      if (!["true", "false"].includes(String(kpiTarget).trim().toLowerCase())) setKpiTarget("true")
                    }
                  }}
                  options={[
                    { value: "UP", label: "Quanto maior, melhor (UP)" },
                    { value: "DOWN", label: "Quanto menor, melhor (DOWN)" },
                    { value: "BOOLEAN", label: "Sim / Não (BOOLEAN)" },
                  ]}
                />

                {/* Target */}
                {mode === "BOOLEAN" ? (
                  <FieldSelect
                    label="Meta (Target)"
                    hint="Ex: Sim = esperado / Não = não esperado."
                    value={isTrueLike(kpiTarget) ? "true" : "false"}
                    onChange={(v) => setKpiTarget(String(v))}
                    options={[
                      { value: "true", label: "Sim (true)" },
                      { value: "false", label: "Não (false)" },
                    ]}
                  />
                ) : (
                  <FieldText
                    label="Meta (Target)"
                    hint='Ex: "95" | "0" (pendências) | "99.5"'
                    value={kpiTarget}
                    onChange={(v: string) => setKpiTarget(v)}
                  />
                )}
              </div>

              {/* Regras só fazem sentido pro numérico */}
              {mode !== "BOOLEAN" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldNumber
                    label="Faixa YELLOW (yellow_ratio)"
                    hint="Ex: 0.90 => cria uma faixa YELLOW (próximo da meta)."
                    value={rules.yellow_ratio}
                    onChange={(v: number) => setRules((p) => ({ ...p, yellow_ratio: v }))}
                    min={0.01}
                    max={0.999}
                    step={0.01}
                  />

                  <FieldNumber
                    label="Buffer YELLOW para DOWN (zero_meta_yellow_max)"
                    hint="No modo DOWN, isso vira o 'buffer' acima da meta antes de virar RED. Ex: meta=0 => YELLOW 1..N"
                    value={rules.zero_meta_yellow_max}
                    onChange={(v: number) => setRules((p) => ({ ...p, zero_meta_yellow_max: v }))}
                    min={0}
                    max={999999}
                    step={1}
                  />
                </div>
              )}

              {/* Preview simples */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Preview</div>

                <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs">
                  <div className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    {mode === "UP" ? <ArrowUp size={14} className="text-emerald-600" /> : null}
                    {mode === "DOWN" ? <ArrowDown size={14} className="text-amber-600" /> : null}
                    {mode === "BOOLEAN" ? <ToggleLeft size={14} className="text-[#f71963]" /> : null}
                    {preview.title}
                  </div>
                  <div className="text-slate-600 space-y-1">
                    <div>🟢 {preview.green}</div>
                    <div>🟡 {preview.yellow}</div>
                    <div>🔴 {preview.red}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={saving || deleting}
                className={`mr-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest hover:bg-red-100 transition-all ${
                  saving || deleting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                Excluir KPI
              </button>

              <button
                onClick={() => setModalOpen(false)}
                disabled={saving || deleting}
                className={`px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-widest hover:bg-white transition-all ${
                  saving || deleting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Cancelar
              </button>

              <button
                onClick={onSave}
                disabled={saving || deleting}
                className={`btn-vtex flex items-center gap-2 ${saving || deleting ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirmOpen(false)} />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Confirmação</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
                <AlertTriangle size={16} className="text-red-500" />
                Excluir KPI
              </div>
              <div className="mt-2 text-sm font-medium text-slate-600">
                Você está prestes a excluir o KPI <b>{detail?.kpi_id}</b>. Essa ação também remove execuções e revisões relacionadas.
              </div>
            </div>

            <div className="border-b border-slate-100 bg-red-50/60 p-4 text-xs font-semibold text-red-700">
              Essa ação é permanente e não pode ser desfeita.
            </div>

            <div className="flex items-center justify-end gap-2 bg-slate-50 p-5">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className={`rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-all hover:bg-white ${
                  deleting ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                Cancelar
              </button>

              <button
                onClick={onDeleteConfirmed}
                disabled={deleting}
                className={`inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-red-600 ${
                  deleting ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* UI helpers */
function Card({ title, subtitle, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="bg-slate-50/50 p-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-sm">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoRow({ icon, label, value }: any) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#f71963]">
          {icon}
        </span>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      </div>
      <div className="text-sm font-bold text-slate-700 text-right max-w-[60%] break-words">{value}</div>
    </div>
  )
}

function FieldNumber({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = safeNumber(e.target.value)
          if (n === null) return
          onChange(n)
        }}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71963]/10 focus:border-[#f71963]"
      />
      {hint ? <div className="text-[11px] text-slate-500 font-medium">{hint}</div> : null}
    </div>
  )
}

function FieldText({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71963]/10 focus:border-[#f71963]"
      />
      {hint ? <div className="text-[11px] text-slate-500 font-medium">{hint}</div> : null}
    </div>
  )
}

function FieldTextArea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71963]/10 focus:border-[#f71963] resize-y"
      />
      {hint ? <div className="text-[11px] text-slate-500 font-medium">{hint}</div> : null}
    </div>
  )
}

function FieldSelect({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71963]/10 focus:border-[#f71963]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <div className="text-[11px] text-slate-500 font-medium">{hint}</div> : null}
    </div>
  )
}
