"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronRight,
  User,
  Headset,
  RefreshCw,
  BarChart3,
  History,
  ClipboardCheck,
  PlusCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Loader2,
  Pencil,
  Calendar,
  Plus,
  X,
  Save,
} from "lucide-react"
import { fetchControleByCode } from "../actions"
import { fetchLatestKpiStatuses, createControlKpi } from "./actions"

type TabKey = "kpis" | "history" | "actions"

type KpiCardItem = {
  kpi_id_text: string
  kpi_uuid: string
  kpi_name: string
  description: string
  target: string
  hasExecutionValue: boolean
  executionValue: number | null
  canRegister: boolean
}

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

// ✅ type-guard (ajuda o TS e melhora o filter)
function isUuidLike(v: any): v is string {
  const s = safeText(v)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function toNumberOrNull(v: any) {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string") {
    const s = v.trim().replace("%", "").replace(",", ".")
    if (!s) return null
    const n = Number(s)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function formatPercent(n: number) {
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  const value = isInt ? String(Math.round(n)) : n.toFixed(1)
  return `${value}%`
}

// URL: YYYY-MM (ex.: 2026-01)
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

// ✅ agora entende GREEN/YELLOW/RED também
function statusLooksOk(status: string) {
  const s = safeText(status).toLowerCase()
  return (
    s.includes("green") ||
    s.includes("conforme") ||
    s.includes("conclu") ||
    s.includes("ok") ||
    s.includes("done") ||
    s.includes("aprov")
  )
}

function statusLooksPending(status: string) {
  const s = safeText(status).toLowerCase()
  return s.includes("yellow") || s.includes("pend") || s.includes("em aberto") || s.includes("open")
}

function statusLooksRed(status: string) {
  const s = safeText(status).toLowerCase()
  return s.includes("red") || s.includes("crit") || s.includes("crít")
}

export default function DetalheControlePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const id = params.id as string

  const periodoFromUrl = safeText(searchParams.get("periodo") || searchParams.get("period"))
  const [periodoISO, setPeriodoISO] = useState<string>(periodoFromUrl || getDefaultPeriodoISO())

  const [activeTab, setActiveTab] = useState<TabKey>("kpis")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [kpiRunStatusByUuid, setKpiRunStatusByUuid] = useState<Record<string, string>>({})

  const [isNewKpiModalOpen, setIsNewKpiModalOpen] = useState(false)
  const [savingNewKpi, setSavingNewKpi] = useState(false)
  const [newKpi, setNewKpi] = useState({
    kpi_name: "",
    kpi_description: "",
    kpi_type: "",
    kpi_target: "",
  })

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const result = await (fetchControleByCode as any)(id, periodoISO)
        if (result?.success) setData(result.data)
        else console.error(result?.error || "Erro ao carregar controle.")
      } finally {
        setLoading(false)
      }
    }
    if (id) loadData()
  }, [id, periodoISO])

  useEffect(() => {
    if (!id) return
    const qp = new URLSearchParams(Array.from(searchParams.entries()))
    qp.set("periodo", periodoISO)
    router.replace(`/controles/${encodeURIComponent(id)}?${qp.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoISO, id])

  const infoGeral = data

  const kpisList = useMemo<KpiCardItem[]>(() => {
    const list = Array.isArray(data?.all_kpis) ? data.all_kpis : []

    return list.map((item: any) => {
      const kpiIdText = safeText(item?.kpi_id || item?.kpi_code || "")
      const kpiUuid = safeText(item?.kpi_uuid || item?.id || item?.kpi_id_uuid)
      const kpiName = safeText(item?.kpi_name)

      const execValue =
        toNumberOrNull(item?.measured_value) ??
        toNumberOrNull(item?.latest_value) ??
        toNumberOrNull(item?.latest_result) ??
        toNumberOrNull(item?.value) ??
        null

      return {
        kpi_id_text: kpiIdText,
        kpi_uuid: kpiUuid,
        kpi_name: kpiName,
        description:
          item?.kpi_description ||
          item?.description ||
          `Monitoramento do framework ${item?.framework || infoGeral?.framework || "N/A"}`,
        target: item?.kpi_target ?? "0",
        hasExecutionValue: execValue !== null,
        executionValue: execValue,
        canRegister: isUuidLike(kpiUuid),
      }
    })
  }, [data?.all_kpis, infoGeral?.framework])

  // ✅ agora busca status POR PERÍODO também
  useEffect(() => {
    async function loadStatuses() {
      const uuids: string[] = kpisList
        .map((k: KpiCardItem) => k.kpi_uuid)
        .filter((u: string): u is string => isUuidLike(u))

      if (uuids.length === 0) {
        setKpiRunStatusByUuid({})
        return
      }

      const res = await fetchLatestKpiStatuses(uuids, periodoISO)
      if (res?.success && res.data) setKpiRunStatusByUuid(res.data)
      else setKpiRunStatusByUuid({})
    }

    loadStatuses()
  }, [kpisList, periodoISO])

  const onEditarDetalhesTecnicos = () => {
    router.push(`/controles/editar/${encodeURIComponent(id)}?periodo=${encodeURIComponent(periodoISO)}`)
  }

  const irParaExecucao = (kpiUuid: string) => {
    const qp = new URLSearchParams()
    qp.set("kpi", kpiUuid)
    qp.set("periodo", periodoISO)
    router.push(`/controles/execucao/${encodeURIComponent(id)}?${qp.toString()}`)
  }

  const showAddButton = activeTab === "kpis" || activeTab === "actions"

  const onClickAdd = () => {
    if (activeTab === "kpis") setIsNewKpiModalOpen(true)
  }

  const resetNewKpi = () => {
    setNewKpi({
      kpi_name: "",
      kpi_description: "",
      kpi_type: "",
      kpi_target: "",
    })
  }

  const validateNewKpi = () => {
    if (!safeText(newKpi.kpi_name)) return "Preencha o nome do KPI."
    if (!safeText(newKpi.kpi_type)) return "Preencha o tipo do KPI."
    if (!safeText(newKpi.kpi_target)) return "Preencha a meta (target) do KPI."
    return ""
  }

  const onSaveNewKpi = async () => {
    const err = validateNewKpi()
    if (err) {
      alert(err)
      return
    }

    try {
      setSavingNewKpi(true)

      const res = await createControlKpi({
        id_control: id,
        kpi_name: safeText(newKpi.kpi_name),
        kpi_description: safeText(newKpi.kpi_description) || null,
        kpi_type: safeText(newKpi.kpi_type),
        kpi_target: safeText(newKpi.kpi_target),
        reference_month: periodoISO,
      })

      if (!res?.success) {
        alert(res?.error || "Falha ao criar KPI.")
        return
      }

      const created = res.data

      setData((prev: any) => {
        const prevList = Array.isArray(prev?.all_kpis) ? prev.all_kpis : []
        return {
          ...prev,
          all_kpis: [
            {
              kpi_id: created.kpi_id,
              kpi_uuid: created.kpi_uuid,
              kpi_name: created.kpi_name,
              kpi_description: created.kpi_description,
              kpi_type: created.kpi_type,
              kpi_target: created.kpi_target,
              framework: prev?.framework,
            },
            ...prevList,
          ],
        }
      })

      setIsNewKpiModalOpen(false)
      resetNewKpi()
    } catch (e) {
      alert("Falha ao criar KPI.")
    } finally {
      setSavingNewKpi(false)
    }
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-[#f71866]" size={40} />
      </div>
    )

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            <Link href={`/controles?periodo=${encodeURIComponent(periodoISO)}`} className="hover:text-[#f71866] transition-colors">
              Controles
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">{id}</span>
          </nav>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {id} - {infoGeral?.name_control || "Controle não encontrado"}
            </h1>

            <span
              className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold tracking-wider ${
                infoGeral?.status === "Ativo" || infoGeral?.status === "Conforme"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {infoGeral?.status || "Ativo"}
            </span>

            <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded font-black tracking-wider bg-slate-100 text-slate-600">
              <Calendar size={12} />
              {formatPeriodoLabel(periodoISO)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mês referência</div>
          <input
            type="month"
            value={periodoISO}
            onChange={(e) => setPeriodoISO(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866]"
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard icon={<User size={16} />} label="Owner" value={infoGeral?.owner_name || "N/A"} />
            <InfoCard icon={<Headset size={16} />} label="Ponto Focal" value={infoGeral?.focal_point_name || "N/A"} />
            <InfoCard icon={<RefreshCw size={16} />} label="Frequência" value={infoGeral?.frequency || "N/A"} />
          </section>

          <section className="space-y-6">
            <div className="border-b border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <nav className="flex space-x-8">
                  <TabButton active={activeTab === "kpis"} onClick={() => setActiveTab("kpis")} icon={<BarChart3 size={16} />} label="KPIs" badge={kpisList.length} />
                  <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} icon={<History size={16} />} label="Histórico" />
                  <TabButton
                    active={activeTab === "actions"}
                    onClick={() => setActiveTab("actions")}
                    icon={<ClipboardCheck size={16} />}
                    label="Planos de Ação"
                    badge={infoGeral?.planos?.length || 0}
                  />
                </nav>

                {showAddButton ? (
                  <button
                    onClick={onClickAdd}
                    className="bg-[#f71866] hover:bg-[#d61556] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 text-xs"
                    title="Adicionar"
                  >
                    <Plus className="h-4 w-4" /> Adicionar
                  </button>
                ) : (
                  <div />
                )}
              </div>
            </div>

            <div className="space-y-4">
              {activeTab === "kpis" && (
                <>
                  {kpisList.length > 0 ? (
                    kpisList.map((kpi, index) => {
                      const runStatusRaw =
                        kpi.kpi_uuid && kpiRunStatusByUuid[kpi.kpi_uuid] ? kpiRunStatusByUuid[kpi.kpi_uuid] : ""

                      const hasRun = !!safeText(runStatusRaw)

                      // ✅ mostra status do banco (GREEN/YELLOW/RED) quando existir
                      const valueToShow = hasRun ? safeText(runStatusRaw) : "PEND."
                      const metaToShow = `Meta: ${safeText(kpi.target) || "0"}`

                      const left = kpi.kpi_id_text || "KPI"
                      const right = kpi.kpi_name ? ` | ${kpi.kpi_name}` : ""
                      const title = `${left}${right}`

                      const visualStatus = hasRun
                        ? statusLooksOk(runStatusRaw)
                          ? "success"
                          : statusLooksRed(runStatusRaw)
                          ? "warning"
                          : statusLooksPending(runStatusRaw)
                          ? "pending"
                          : "neutral"
                        : "pending"

                      return (
                        <KPIItem
                          key={`${kpi.kpi_uuid || kpi.kpi_id_text || "kpi"}-${index}`}
                          title={title}
                          desc={kpi.description}
                          value={valueToShow}
                          meta={metaToShow}
                          status={visualStatus}
                          disabled={!kpi.canRegister}
                          onRegister={() => {
                            if (!kpi.canRegister) {
                              console.error("KPI sem kpi_uuid válido no retorno do backend:", kpi)
                              return
                            }
                            irParaExecucao(kpi.kpi_uuid)
                          }}
                          showPendingIcon={!hasRun}
                        />
                      )
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-10 border border-dashed border-slate-200 rounded-xl text-slate-400 gap-2">
                      <AlertCircle size={32} strokeWidth={1} />
                      <p className="text-sm font-medium">Nenhum KPI vinculado a este controle no banco de dados.</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "history" && (
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden min-h-[200px] flex flex-col">
                  {infoGeral?.historico?.length > 0 ? (
                    infoGeral.historico.map((h: any) => (
                      <div key={h.id} className="p-4 border-b border-slate-50 flex justify-between items-center text-sm hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Clock size={14} className="text-slate-400" />
                          <span className="text-slate-600 font-medium">{new Date(h.executed_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <span
                          className={`font-bold px-2 py-1 rounded text-[10px] uppercase ${
                            h.status === "Conforme" || h.status === "Concluido"
                              ? "text-emerald-500 bg-emerald-50"
                              : "text-red-500 bg-red-50"
                          }`}
                        >
                          {h.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <History size={32} strokeWidth={1} />
                      <p className="text-sm font-medium">Nenhuma execução registrada no histórico.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "actions" && (
                <div className="space-y-3 min-h-[200px]">
                  {infoGeral?.planos?.length > 0 ? (
                    infoGeral.planos.map((p: any) => (
                      <KPIItem
                        key={p.id}
                        title={p.title}
                        desc={p.description}
                        value={p.status}
                        meta={`Prazo: ${new Date(p.due_date).toLocaleDateString("pt-BR")}`}
                        status="warning"
                      />
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-10 border border-dashed border-slate-200 rounded-xl text-slate-400 gap-2">
                      <ClipboardCheck size={32} strokeWidth={1} />
                      <p className="text-sm font-medium">Nenhum plano de ação pendente.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#f71866]" /> Detalhes Técnicos
              </h2>

              <button
                onClick={onEditarDetalhesTecnicos}
                className="p-2 rounded-full border border-slate-100 text-slate-400 hover:text-[#f71866] hover:bg-[#f71866]/5 transition-all"
                aria-label="Editar detalhes técnicos"
                title="Editar"
              >
                <Pencil size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ID do Controle</span>
                <p className="text-xs font-bold text-slate-700">{id}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Framework</span>
                <p className="text-xs font-bold text-slate-700">{infoGeral?.framework || "N/A"}</p>
              </div>

              {infoGeral?.description_control && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Descrição do Controle</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{infoGeral.description_control}</p>
                </div>
              )}

              {infoGeral?.goal_control && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Objetivo</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{infoGeral.goal_control}</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100" />

              {infoGeral?.risk_title && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Classificação do Risco</span>
                  <span
                    className={`inline-flex text-[10px] uppercase px-2 py-1 rounded font-bold tracking-wider ${
                      String(infoGeral.risk_title).toUpperCase() === "CRITICAL"
                        ? "bg-red-100 text-red-700"
                        : String(infoGeral.risk_title).toUpperCase() === "HIGH"
                        ? "bg-orange-100 text-orange-700"
                        : String(infoGeral.risk_title).toUpperCase() === "MEDIUM"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {String(infoGeral.risk_title).toUpperCase()}
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ID do Risco</span>
                <p className="text-xs font-bold text-slate-700">{infoGeral?.risk_id || "N/A"}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nome do Risco</span>
                <p className="text-xs font-bold text-slate-700">{infoGeral?.risk_name || "N/A"}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Descrição do Risco</span>
                {infoGeral?.risk_description ? (
                  <p className="text-[11px] text-slate-600 leading-relaxed">{infoGeral.risk_description}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">N/A</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {isNewKpiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (savingNewKpi) return
              setIsNewKpiModalOpen(false)
              resetNewKpi()
            }}
          />
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl relative z-10 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Adicionar KPI</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Esse KPI será vinculado ao controle <span className="font-mono font-bold">{id}</span>
                </p>
              </div>

              <button
                onClick={() => {
                  if (savingNewKpi) return
                  setIsNewKpiModalOpen(false)
                  resetNewKpi()
                }}
                className="p-2 rounded-full border border-slate-100 text-slate-400 hover:text-[#f71866] hover:bg-[#f71866]/5 transition-all"
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="kpi_name"
                  placeholder="Ex.: Continuidade revisada"
                  value={newKpi.kpi_name}
                  onChange={(v: string) => setNewKpi((p) => ({ ...p, kpi_name: v }))}
                />
                <Field
                  label="kpi_type"
                  placeholder="Manual ou Automatizado"
                  value={newKpi.kpi_type}
                  onChange={(v: string) => setNewKpi((p) => ({ ...p, kpi_type: v }))}
                />
              </div>

              <Field
                label="kpi_description"
                placeholder="Descreva o KPI"
                value={newKpi.kpi_description}
                onChange={(v: string) => setNewKpi((p) => ({ ...p, kpi_description: v }))}
                textarea
              />

              <Field
                label="kpi_target"
                placeholder="Ex.: 0 ou 100% (como você usa hoje)"
                value={newKpi.kpi_target}
                onChange={(v: string) => setNewKpi((p) => ({ ...p, kpi_target: v }))}
              />
            </div>

            <div className="p-4 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  if (savingNewKpi) return
                  setIsNewKpiModalOpen(false)
                  resetNewKpi()
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={onSaveNewKpi}
                disabled={savingNewKpi}
                className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
                  savingNewKpi ? "bg-slate-300 text-white" : "bg-[#f71866] hover:bg-[#d61556] text-white"
                }`}
              >
                {savingNewKpi ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salvar KPI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* COMPONENTES DE APOIO */
function TabButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 py-4 px-1 font-semibold text-sm flex items-center gap-2 transition-all ${
        active ? "border-[#f71866] text-[#f71866]" : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-[#f71866] text-white" : "bg-slate-100 text-slate-500"}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function InfoCard({ icon, label, value }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f71866]/5 flex items-center justify-center text-[#f71866]">{icon}</div>
        <span className="font-semibold text-slate-700 text-sm truncate">{value}</span>
      </div>
    </div>
  )
}

function KPIItem({ title, desc, value, meta, status, onRegister, disabled, showPendingIcon }: any) {
  const statusClass =
    status === "success"
      ? "text-emerald-500 text-lg"
      : status === "pending"
      ? "text-[#f71866] text-sm uppercase tracking-widest font-black"
      : status === "warning"
      ? "text-amber-600 text-lg"
      : "text-slate-600 text-lg"

  return (
    <div className="bg-white p-6 rounded-xl border transition-all flex items-center justify-between border-slate-100 shadow-sm hover:border-[#f71866]/20">
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold text-slate-800 uppercase tracking-tight text-xs flex items-center gap-2">{title}</h3>
        <p className="text-[11px] text-slate-500 font-medium max-w-sm leading-relaxed">{desc}</p>
      </div>

      <div className="flex items-center gap-10">
        <div className="text-right">
          <div className={`font-semibold tracking-tight flex items-center justify-end gap-1.5 ${statusClass}`}>
            {showPendingIcon ? <AlertCircle size={14} className="text-[#f71866]" /> : null}
            {value}
          </div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">{meta}</div>
        </div>

        {onRegister && (
          <button
            onClick={onRegister}
            disabled={!!disabled}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              disabled ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#f71866] text-white hover:bg-[#d61556]"
            }`}
            title={disabled ? "KPI sem kpi_uuid válido no retorno do backend" : "Registrar"}
          >
            <PlusCircle size={14} /> Registrar
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, textarea }: any) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[90px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866]"
        />
      )}
    </div>
  )
}
