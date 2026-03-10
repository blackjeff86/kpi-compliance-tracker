"use client"

import Link from "next/link"
import React, { useEffect, useMemo, useState } from "react"
import { CalendarDays, Loader2, Search, AlertTriangle, CheckCircle2, Clock3, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { fetchRevisaoQueue } from "./actions"
import { buildMonthOptions, resolveReferenceMonth } from "@/lib/utils"

type RevisaoItem = {
  id_control: string
  name_control: string
  framework: string
  risk_title: string
  frequency: string
  owner_name: string
  focal_point_name: string
  kpi_id: string
  kpi_name: string
  run_id: string
  kpi_uuid: string
  period: string
  execution_status: string
  evidence_link: string
  executor_comment: string
  executor_email: string
  grc_final_status: string
  grc_review_comment: string
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

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function formatPeriodoLabel(periodoISO: string) {
  const m = safeText(periodoISO).match(/^(\d{4})-(\d{2})$/)
  if (!m) return safeText(periodoISO)

  const year = Number(m[1])
  const month = Number(m[2])
  return `${MONTHS_PT[month - 1] || ""} / ${year}`
}

function normalizeExecutionLabel(status: string) {
  const up = safeText(status).toUpperCase()
  if (up === "GREEN") return "GREEN"
  if (up === "YELLOW") return "YELLOW"
  if (up === "RED") return "RED"
  return up || "SEM STATUS"
}

function getExecutionStatusStyle(status: string) {
  const up = safeText(status).toUpperCase()
  if (up === "GREEN") return { text: "text-emerald-600", icon: <CheckCircle2 size={12} className="text-emerald-500" /> }
  if (up === "YELLOW") return { text: "text-amber-600", icon: <AlertTriangle size={12} className="text-amber-500" /> }
  if (up === "RED") return { text: "text-red-600", icon: <AlertTriangle size={12} className="text-red-500" /> }
  return { text: "text-slate-500", icon: <Clock size={12} className="text-slate-400" /> }
}

function getReviewBadgeClass(status: string) {
  const up = safeText(status).toUpperCase()
  if (up === "GREEN") return "bg-emerald-50 text-emerald-700 border border-emerald-100"
  if (up === "CONFORME") return "bg-emerald-50 text-emerald-700 border border-emerald-100"
  if (up === "YELLOW") return "bg-amber-50 text-amber-700 border border-amber-100"
  if (up === "RED") return "bg-red-50 text-red-700 border border-red-100"
  return "bg-[#f71866]/5 text-[#f71866] border border-[#f71866]/15"
}

function getRiskStyles(risco: string) {
  const r = safeText(risco).toLowerCase()
  if (r.includes("low") || r.includes("baixo")) return "bg-emerald-50 text-emerald-600 border-emerald-100"
  if (r.includes("medium") || r.includes("médio")) return "bg-yellow-50 text-yellow-600 border-yellow-100"
  if (r.includes("high") || r.includes("alto")) return "bg-orange-50 text-orange-600 border-orange-100"
  if (r.includes("critical") || r.includes("crítico")) return "bg-red-50 text-red-600 border-red-100"
  return "bg-slate-50 text-slate-600 border-slate-100"
}

export default function FilaRevisaoPage() {
  const [monthOptions, setMonthOptions] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterControlId, setFilterControlId] = useState("Todos")
  const [filterQueue, setFilterQueue] = useState<"Todos" | "Pendentes" | "Revisados">("Pendentes")

  const [rows, setRows] = useState<RevisaoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [expandedControls, setExpandedControls] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const opts = buildMonthOptions(2025)
    setMonthOptions(opts)
    setSelectedMonth(resolveReferenceMonth(opts))
  }, [])

  useEffect(() => {
    async function loadQueue() {
      if (!selectedMonth) return

      setLoading(true)
      setErrorMsg("")

      try {
        const res = await fetchRevisaoQueue({ period: selectedMonth })
        if (!res.success) {
          setRows([])
          setErrorMsg((res as any).error || "Falha ao carregar fila de revisão.")
          return
        }

        const mapped: RevisaoItem[] = ((res as any).data || []).map((r: any) => ({
          id_control: safeText(r.id_control),
          name_control: safeText(r.name_control),
          framework: safeText(r.framework),
          risk_title: safeText(r.risk_title),
          frequency: safeText(r.frequency),
          owner_name: safeText(r.owner_name),
          focal_point_name: safeText(r.focal_point_name),
          kpi_id: safeText(r.kpi_id),
          kpi_name: safeText(r.kpi_name),
          run_id: safeText(r.run_id),
          kpi_uuid: safeText(r.kpi_uuid),
          period: safeText(r.period),
          execution_status: safeText(r.execution_status),
          evidence_link: safeText(r.evidence_link),
          executor_comment: safeText(r.executor_comment),
          executor_email: safeText(r.executor_email),
          grc_final_status: safeText(r.grc_final_status),
          grc_review_comment: safeText(r.grc_review_comment),
        }))

        setRows(mapped)
      } catch (error) {
        console.error("Erro ao carregar revisão:", error)
        setRows([])
        setErrorMsg("Falha ao carregar fila de revisão.")
      } finally {
        setLoading(false)
      }
    }

    loadQueue()
  }, [selectedMonth])

  const frameworkOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => safeText(r.framework)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [rows])
  const controlIdOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => safeText(r.id_control)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()

    return rows.filter((item) => {
      const matchesSearch =
        !q ||
        item.id_control.toLowerCase().includes(q) ||
        item.name_control.toLowerCase().includes(q) ||
        item.kpi_name.toLowerCase().includes(q) ||
        item.kpi_id.toLowerCase().includes(q) ||
        item.executor_email.toLowerCase().includes(q) ||
        item.owner_name.toLowerCase().includes(q) ||
        item.focal_point_name.toLowerCase().includes(q) ||
        item.frequency.toLowerCase().includes(q)

      const matchesFramework = filterFramework === "Todos" || item.framework === filterFramework
      const matchesControlId = filterControlId === "Todos" || item.id_control === filterControlId

      const isReviewed = ["GREEN", "YELLOW", "RED"].includes(item.grc_final_status.toUpperCase())
      const matchesQueue =
        filterQueue === "Todos" ||
        (filterQueue === "Pendentes" && !isReviewed) ||
        (filterQueue === "Revisados" && isReviewed)

      return matchesSearch && matchesFramework && matchesControlId && matchesQueue
    })
  }, [rows, searchTerm, filterFramework, filterControlId, filterQueue])

  const pendingCount = useMemo(
    () => rows.filter((r) => !["GREEN", "YELLOW", "RED"].includes(safeText(r.grc_final_status).toUpperCase())).length,
    [rows]
  )
  const reviewedCount = rows.length - pendingCount
  const groupedControls = useMemo(() => {
    const groups = new Map<string, { base: RevisaoItem; items: RevisaoItem[] }>()

    for (const row of filteredRows) {
      const key = row.id_control || "N/A"
      const existing = groups.get(key)
      if (existing) {
        existing.items.push(row)
      } else {
        groups.set(key, { base: row, items: [row] })
      }
    }

    return Array.from(groups.values())
      .map((group) => {
        const greenCount = group.items.filter((i) => safeText(i.execution_status).toUpperCase() === "GREEN").length
        const yellowCount = group.items.filter((i) => safeText(i.execution_status).toUpperCase() === "YELLOW").length
        const redCount = group.items.filter((i) => safeText(i.execution_status).toUpperCase() === "RED").length
        const total = group.items.length

        const hasPendingReview = group.items.some((i) => !["GREEN", "YELLOW", "RED"].includes(safeText(i.grc_final_status).toUpperCase()))
        const hasRedReview = group.items.some((i) => safeText(i.grc_final_status).toUpperCase() === "RED")
        const hasYellowReview = group.items.some((i) => safeText(i.grc_final_status).toUpperCase() === "YELLOW")
        const greenReviewedCount = group.items.filter((i) => safeText(i.grc_final_status).toUpperCase() === "GREEN").length

        let reviewStatus = "PENDENTE"
        if (hasRedReview) reviewStatus = "RED"
        else if (hasYellowReview) reviewStatus = "YELLOW"
        else if (greenReviewedCount === group.items.length && group.items.length > 0) reviewStatus = "CONFORME"
        else if (hasPendingReview) reviewStatus = "PENDENTE"

        let executionStatus = "SEM STATUS"
        if (redCount > 0) executionStatus = "RED"
        else if (yellowCount > 0) executionStatus = "YELLOW"
        else if (greenCount > 0) executionStatus = "GREEN"

        return {
          ...group,
          total,
          greenCount,
          yellowCount,
          redCount,
          executionStatus,
          reviewStatus,
        }
      })
      .sort((a, b) => safeText(a.base.id_control).localeCompare(safeText(b.base.id_control)))
  }, [filteredRows])

  function toggleControlExpand(idControl: string) {
    setExpandedControls((prev) => ({ ...prev, [idControl]: !prev[idControl] }))
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fila de Revisão</h1>
          <p className="text-slate-500 mt-1 font-medium">Analista GRC valida a execução registrada e define o resultado final.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<Clock3 className="text-[#f71866]" />} label="Pendentes" value={String(pendingCount)} bgColor="bg-red-50" />
        <StatSmallCard icon={<CheckCircle2 className="text-emerald-500" />} label="Revisados" value={String(reviewedCount)} bgColor="bg-emerald-50" />
        <StatSmallCard icon={<AlertTriangle className="text-amber-500" />} label="Total na Fila" value={String(rows.length)} bgColor="bg-amber-50" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-[#f71866]/20 transition-all appearance-none cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {formatPeriodoLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar por controle, KPI, ID ou executor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Todos">Framework (Todos)</option>
            {frameworkOptions.map((fw) => (
              <option key={fw} value={fw}>
                {fw}
              </option>
            ))}
          </select>

          <select
            value={filterControlId}
            onChange={(e) => setFilterControlId(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Todos">Control ID (Todos)</option>
            {controlIdOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>

          <select
            value={filterQueue}
            onChange={(e) => setFilterQueue(e.target.value as any)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Pendentes">Fila (Pendentes)</option>
            <option value="Revisados">Fila (Revisados)</option>
            <option value="Todos">Fila (Todos)</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm("")
              setFilterFramework("Todos")
              setFilterControlId("Todos")
              setFilterQueue("Pendentes")
              setSelectedMonth(resolveReferenceMonth(monthOptions))
            }}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 size={20} className="animate-spin text-[#f71866]" /> Carregando fila de revisão...
          </div>
        ) : errorMsg ? (
          <div className="p-10 text-center text-red-600 text-sm font-medium">{errorMsg}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código (id_control)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome & Framework</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Frequência</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control Owner</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Focal Point</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Avaliação GRC</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Risco</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedControls.length > 0 ? (
                  groupedControls.map((group) => {
                    const item = group.base
                    const isExpanded = Boolean(expandedControls[item.id_control])
                    const execStyle = getExecutionStatusStyle(group.executionStatus)

                    return (
                      <React.Fragment key={item.id_control}>
                        <tr className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {item.id_control}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-700">{item.name_control || "Controle"}</div>
                          <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">{item.framework}</div>
                          <div className="text-[11px] text-slate-400 mt-1">KPIs registrados: {group.total}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[11px] font-bold text-slate-600">{item.frequency || "N/A"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-600">{item.owner_name || "Não atribuído"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-600">{item.focal_point_name || "Não atribuído"}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {execStyle.icon}
                              <span className={`text-[11px] font-bold ${execStyle.text}`}>{normalizeExecutionLabel(group.executionStatus)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                              <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100">{group.total}/{group.total}</span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>{group.greenCount}</span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                <span>{group.yellowCount}</span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                <span>{group.redCount}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[240px] text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-[10px] font-bold uppercase ${getReviewBadgeClass(group.reviewStatus)}`}>
                            {group.reviewStatus || "PENDENTE"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRiskStyles(item.risk_title)}`}>
                            {item.risk_title || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleControlExpand(item.id_control)}
                            className="mx-auto inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {isExpanded ? "Ocultar" : "Expandir"}
                          </button>
                        </td>
                        </tr>

                        {isExpanded ? (
                          <tr className="bg-slate-50/50">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Execução</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Avaliação GRC</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evidência</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.items.map((kpi) => {
                                      const kpiExec = getExecutionStatusStyle(kpi.execution_status)
                                      const kpiReview = safeText(kpi.grc_final_status).toUpperCase() || "PENDENTE"
                                      return (
                                        <tr key={`${kpi.run_id}|${kpi.kpi_uuid}`}>
                                          <td className="px-4 py-3">
                                            <div className="text-xs font-semibold text-slate-700">{kpi.kpi_name}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{kpi.kpi_id}</div>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${kpiExec.text}`}>
                                              {kpiExec.icon}
                                              {normalizeExecutionLabel(kpi.execution_status)}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getReviewBadgeClass(kpiReview)}`}>
                                              {kpiReview}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className={`text-[11px] font-semibold ${kpi.evidence_link ? "text-emerald-600" : "text-red-600"}`}>
                                              {kpi.evidence_link ? "Com evidência" : "Sem evidência"}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <Link
                                              href={`/revisao/${encodeURIComponent(kpi.run_id)}`}
                                              className="inline-flex items-center px-3 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded uppercase tracking-widest"
                                            >
                                              Revisar
                                            </Link>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-slate-400 text-sm italic">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatSmallCard({ icon, label, value, bgColor }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm group hover:border-[#f71866]/20 transition-all">
      <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center`}>
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
    </div>
  )
}
