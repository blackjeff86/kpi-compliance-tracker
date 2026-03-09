"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  X,
} from "lucide-react"
import { createActionPlan, fetchActionPlans } from "./actions"

type ActionPlanRow = {
  planoId: string
  id: string
  controleNome: string
  kpiAfetado: string
  framework: string
  responsavel: string
  iniciais: string
  data: string
  status: "Aberto" | "Em andamento" | "Concluído"
  atraso: number
  corStatus: string
}

type ActionPlanDbRow = {
  id?: unknown
  plan_id?: unknown
  id_control?: unknown
  control_code?: unknown
  framework?: unknown
  title?: unknown
  description?: unknown
  name_control?: unknown
  kpi_affected?: unknown
  owner?: unknown
  responsavel?: unknown
  responsible?: unknown
  owner_name?: unknown
  status?: unknown
  due_date?: unknown
}

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  let d: Date | null = null

  if (value instanceof Date) d = value
  else if (typeof value === "string" || typeof value === "number") d = new Date(value)
  else return null

  return Number.isNaN(d.getTime()) ? null : d
}

function toPtBrDate(value: unknown) {
  const d = toDate(value)
  return d ? d.toLocaleDateString("pt-BR") : "N/A"
}

function getInitials(name: string) {
  const parts = safeText(name)
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return "NA"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function normalizeStatus(rawStatus: unknown, dueDateRaw: unknown): ActionPlanRow["status"] {
  const s = safeText(rawStatus).toLowerCase()

  if (s.includes("concl") || s.includes("done") || s.includes("close")) return "Concluído"
  if (s.includes("abert") || s.includes("open") || s.includes("novo")) return "Aberto"

  const dueDate = toDate(dueDateRaw)
  if (dueDate && dueDate.getTime() < Date.now()) return "Em andamento"

  return "Em andamento"
}

function statusClass(status: ActionPlanRow["status"]) {
  if (status === "Concluído") return "bg-emerald-50 text-emerald-600 border-emerald-100"
  if (status === "Aberto") return "bg-blue-50 text-blue-600 border-blue-100"
  return "bg-amber-50 text-amber-600 border-amber-100"
}

function calculateDelayDays(dueDateRaw: unknown, status: ActionPlanRow["status"]) {
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

function toPlanRow(item: ActionPlanDbRow): ActionPlanRow {
  const controlCode = safeText(item?.id_control || item?.control_code) || "N/A"
  const controlName = safeText(item?.name_control) || "Controle não identificado"
  const framework = safeText(item?.framework) || "N/A"
  const kpiAfetado =
    safeText(item?.kpi_affected) ||
    safeText(item?.title) ||
    safeText(item?.description) ||
    "KPI não identificado"

  const responsavel =
    safeText(item?.owner) ||
    safeText(item?.responsavel) ||
    safeText(item?.responsible) ||
    safeText(item?.owner_name) ||
    "Não atribuído"

  const status = normalizeStatus(item?.status, item?.due_date)
  const atraso = calculateDelayDays(item?.due_date, status)

  const rawId = safeText(item?.id || item?.plan_id)
  const fallbackSlug = `PA-${controlCode}-${safeText(item?.title || "plano")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toUpperCase()
    .slice(0, 24)}`

  return {
    planoId: rawId || fallbackSlug,
    id: controlCode,
    controleNome: controlName,
    kpiAfetado,
    framework,
    responsavel,
    iniciais: getInitials(responsavel),
    data: toPtBrDate(item?.due_date),
    status,
    atraso,
    corStatus: statusClass(status),
  }
}

export default function PlanosAcaoPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterResponsavel, setFilterResponsavel] = useState("Todos")
  const [filterStatus, setFilterStatus] = useState("Todos")
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ActionPlanRow[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    id_control: "",
    kpi_affected: "",
    description: "",
    responsible: "",
    due_date: "",
    criticality: "Alta",
  })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchActionPlans()

      if (!result.success) {
        setError(result.error || "Falha ao carregar planos de ação.")
        setData([])
        return
      }

      setData((result.data || []).map(toPlanRow))
    } catch (err) {
      console.error("Erro ao carregar action_plans:", err)
      setError("Falha ao carregar planos de ação.")
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.controleNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.kpiAfetado.toLowerCase().includes(searchTerm.toLowerCase())
      const matchResp = filterResponsavel === "Todos" || item.responsavel === filterResponsavel
      const matchStatus = filterStatus === "Todos" || item.status === filterStatus
      const matchFramework = filterFramework === "Todos" || item.framework === filterFramework

      return matchSearch && matchResp && matchStatus && matchFramework
    })
  }, [data, searchTerm, filterResponsavel, filterStatus, filterFramework])

  const responsavelOptions = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.responsavel))).sort((a, b) => a.localeCompare(b))
  }, [data])

  const frameworkOptions = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.framework))).sort((a, b) => a.localeCompare(b))
  }, [data])

  const statusOptions = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.status)))
  }, [data])

  const totalPlanos = data.length
  const totalAtrasados = data.filter((item) => item.atraso > 0).length
  const totalEmAndamento = data.filter((item) => item.status === "Em andamento").length
  const totalConcluidos = data.filter((item) => item.status === "Concluído").length

  const limparFiltros = () => {
    setSearchTerm("")
    setFilterResponsavel("Todos")
    setFilterStatus("Todos")
    setFilterFramework("Todos")
  }

  const closeCreateModal = (force = false) => {
    if (createSaving && !force) return
    setCreateOpen(false)
    setCreateError(null)
    setCreateForm({
      id_control: "",
      kpi_affected: "",
      description: "",
      responsible: "",
      due_date: "",
      criticality: "Alta",
    })
  }

  const onCreatePlan = async () => {
    setCreateError(null)

    if (!safeText(createForm.description)) {
      setCreateError("Descrição do plano é obrigatória.")
      return
    }
    if (!safeText(createForm.responsible)) {
      setCreateError("Responsável é obrigatório.")
      return
    }
    if (!safeText(createForm.due_date)) {
      setCreateError("Data limite é obrigatória.")
      return
    }
    if (!safeText(createForm.criticality)) {
      setCreateError("Criticidade é obrigatória.")
      return
    }

    setCreateSaving(true)
    try {
      const result = await createActionPlan({
        id_control: safeText(createForm.id_control) || null,
        kpi_affected: safeText(createForm.kpi_affected) || null,
        description: createForm.description,
        responsible: createForm.responsible,
        due_date: createForm.due_date,
        criticality: createForm.criticality,
      })

      if (!result.success) {
        setCreateError(result.error || "Falha ao criar plano de ação.")
        return
      }

      closeCreateModal(true)
      await loadData()
    } catch (err) {
      console.error("Erro ao criar plano:", err)
      setCreateError("Erro ao salvar plano de ação.")
    } finally {
      setCreateSaving(false)
    }
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Planos de Ação</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2.5 py-1 rounded border border-red-100 flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                {totalAtrasados} ATRASADOS
              </span>
              <span className="bg-slate-50 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 uppercase">
                {totalPlanos} TOTAL
              </span>
            </div>
          </div>
          <p className="text-slate-500 mt-1 font-medium text-sm">Gestão de remediação e planos de melhoria de compliance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-all shadow-sm">
            <Download size={18} className="text-slate-400" /> Exportar
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#f71866]/20 transition-all active:scale-95"
          >
            <Plus size={20} /> Novo Plano
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<FileText className="text-[#f71866]" />} label="Total de Planos" value={String(totalPlanos)} bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertCircle className="text-amber-500" />} label="Em Andamento" value={String(totalEmAndamento)} bgColor="bg-amber-50" />
        <StatSmallCard icon={<CheckCircle2 className="text-emerald-500" />} label="Concluídos" value={String(totalConcluidos)} bgColor="bg-emerald-50" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar por ID, Controle ou KPI..."
            />
          </div>

          <select
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer appearance-none font-medium"
          >
            <option value="Todos">Framework: Todos</option>
            {frameworkOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterResponsavel}
            onChange={(e) => setFilterResponsavel(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer appearance-none font-medium"
          >
            <option value="Todos">Responsável: Todos</option>
            {responsavelOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer appearance-none font-medium"
          >
            <option value="Todos">Status: Todos</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            onClick={limparFiltros}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors flex items-center justify-center gap-2"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Controle</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Framework</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI Afetado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Responsável</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Due Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Atraso</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando planos de ação...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500 text-sm italic">
                    {error}
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr key={`${item.planoId}-${index}`} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-700">{item.id}</div>
                      <div className="text-[11px] text-slate-500">{item.controleNome}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded bg-slate-50 uppercase">
                        {item.framework}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-xs font-medium ${item.status === "Concluído" ? "text-slate-400 line-through" : "text-slate-600"}`}>
                        {item.kpiAfetado}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 uppercase">
                          {item.iniciais}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 hidden lg:block">{item.responsavel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <Calendar size={13} className="text-slate-400" />
                        {item.data}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${item.corStatus}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.atraso > 0 ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">{item.atraso}d</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center">
                        {item.status === "Concluído" ? (
                          <Link href={`/planos/${encodeURIComponent(item.planoId)}`} className="p-2 text-slate-400 hover:text-[#f71866] transition-colors">
                            <Eye size={18} />
                          </Link>
                        ) : (
                          <Link
                            href={`/planos/${encodeURIComponent(item.planoId)}`}
                            className="px-5 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/30 hover:bg-[#f71866] hover:text-white rounded-md transition-all uppercase tracking-widest shadow-sm"
                          >
                            Atualizar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                    Nenhum plano de ação encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{filteredData.length}</span> de <span className="font-bold text-slate-700">{totalPlanos}</span> resultados
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all disabled:opacity-50" disabled>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#f71866] text-white text-xs font-bold shadow-sm">1</button>
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all" disabled>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => closeCreateModal()} />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Novo Plano de Ação</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Registre as ações de remediação, responsável e prazo para acompanhamento do plano.
                </p>
              </div>
              <button
                onClick={() => closeCreateModal()}
                disabled={createSaving}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID do Controle (opcional)</label>
                  <input
                    type="text"
                    value={createForm.id_control}
                    onChange={(e) => setCreateForm((p) => ({ ...p, id_control: e.target.value }))}
                    placeholder="Ex.: CYB_C01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KPI Afetado (opcional)</label>
                  <input
                    type="text"
                    value={createForm.kpi_affected}
                    onChange={(e) => setCreateForm((p) => ({ ...p, kpi_affected: e.target.value }))}
                    placeholder="Ex.: KPI ID CYB_K01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f71866]/15 focus:border-[#f71866]"
                  />
                </div>
              </div>

              <div className="border border-red-100 bg-red-50/40 rounded-xl p-5">
                <div className="flex items-center gap-2 text-red-700 mb-4">
                  <AlertCircle size={16} />
                  <h3 className="text-[11px] font-black uppercase tracking-widest">
                    Plano de Ação Obrigatório para Status Crítico
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descrição do Plano</label>
                    <textarea
                      rows={3}
                      value={createForm.description}
                      onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Descreva as ações de remediação para este KPI crítico..."
                      className="w-full bg-white border border-red-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Responsável</label>
                    <input
                      type="text"
                      value={createForm.responsible}
                      onChange={(e) => setCreateForm((p) => ({ ...p, responsible: e.target.value }))}
                      placeholder="Nome do responsável"
                      className="w-full bg-white border border-red-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Limite</label>
                    <input
                      type="date"
                      value={createForm.due_date}
                      onChange={(e) => setCreateForm((p) => ({ ...p, due_date: e.target.value }))}
                      className="w-full bg-white border border-red-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Criticidade do Plano</label>
                    <select
                      value={createForm.criticality}
                      onChange={(e) => setCreateForm((p) => ({ ...p, criticality: e.target.value }))}
                      className="w-full bg-white border border-red-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Crítica">Crítica</option>
                    </select>
                  </div>
                </div>
              </div>

              {createError && (
                <div className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {createError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
              <button
                onClick={() => closeCreateModal()}
                disabled={createSaving}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={onCreatePlan}
                disabled={createSaving}
                className="px-4 py-2 rounded-lg bg-[#f71866] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#d61556] transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {createSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                Criar Plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatSmallCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactElement<{ size?: number }>
  label: string
  value: string
  bgColor: string
}) {
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
