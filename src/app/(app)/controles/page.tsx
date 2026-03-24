// src/app/(app)/controles/page.tsx
"use client"

import React, { Suspense, useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Database,
  CalendarDays,
  Loader2,
  User,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { buildMonthOptions, getPreviousMonthISO, resolveReferenceMonth } from "@/lib/utils"

// Importamos a Server Action
import { fetchControles } from "./actions"

interface Controle {
  id: string
  nome: string
  framework: string
  risco: string
  status: string
  pendencia: string
  corStatus: string
  reference_month: string
  control_owner: string
  focal_point_name: string

  // ✅ NOVO: frequência do controle
  frequencia: string

  exec_total: number
  exec_done: number
  green_count: number
  yellow_count: number
  red_count: number
  status_final: "EM ABERTO" | "PARCIAL" | "CONFORME" | "EM ATENÇÃO" | "NÃO CONFORME" | "REPROVADO" | "NÃO APLICÁVEL" | string
  grc_final_status: "GREEN" | "YELLOW" | "RED" | "PENDENTE" | "SEM EXECUÇÃO" | "NÃO APLICÁVEL" | string
}

/** helpers mês */
const MONTHS_PT = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
]

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function normalizeControlStatusLabel(s: string) {
  const up = safeText(s).toUpperCase()
  if (up.includes("NÃO APLIC") || up.includes("NAO APLIC")) return "Não aplicável"
  if (up.includes("PARCIAL")) return "Parcial"
  if (up.includes("EM ABERTO") || up.includes("PENDENTE") || up.includes("SEM EXEC")) return "Pendente"
  if (up.includes("CONFORME") && !up.includes("NÃO") && !up.includes("NAO")) return "Conforme"
  if (up.includes("REPROV")) return "Reprovado"
  if (up.includes("NÃO CONFORME") || up.includes("NAO CONFORME") || up === "RED") return "Não conforme"
  if (up.includes("ATEN") || up === "YELLOW") return "Em atenção"
  return "Em atenção"
}

function formatPeriodoLabel(periodoISO: string) {
  const s = safeText(periodoISO)
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (!m) return s || ""
  const year = Number(m[1])
  const month = Number(m[2])
  const monthName = MONTHS_PT[month - 1] || ""
  return `${monthName} / ${year}`
}

function clampPage(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 1) return 1
  return Math.floor(x)
}

function parseMultiParam(raw: string) {
  const text = safeText(raw)
  if (!text) return []
  if (text === "Todos") return []
  return Array.from(
    new Set(
      text
        .split(",")
        .map((v) => safeText(v))
        .filter(Boolean),
    ),
  )
}

function buildControlsQuery(params: {
  periodo?: string
  q?: string
  risco?: string[]
  status?: string[]
  owner?: string[]
  focal?: string[]
  frequencia?: string[]
  page?: number
}) {
  const sp = new URLSearchParams()

  if (params.periodo) sp.set("periodo", params.periodo)
  if (params.q) sp.set("q", params.q)
  if (params.risco && params.risco.length > 0) sp.set("risco", params.risco.join(","))
  if (params.status && params.status.length > 0) sp.set("status", params.status.join(","))
  if (params.owner && params.owner.length > 0) sp.set("owner", params.owner.join(","))
  if (params.focal && params.focal.length > 0) sp.set("focal", params.focal.join(","))
  if (params.frequencia && params.frequencia.length > 0) sp.set("frequencia", params.frequencia.join(","))
  if (params.page && params.page !== 1) sp.set("page", String(params.page))

  return sp.toString()
}

export default function ControlesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando controles...</div>}>
      <ControlesPageContent />
    </Suspense>
  )
}

function ControlesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ITEMS_PER_PAGE = 15

  const [controles, setControles] = useState<Controle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRiscos, setSelectedRiscos] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [selectedFocals, setSelectedFocals] = useState<string[]>([])

  // ✅ NOVO: filtro de frequência
  const [selectedFrequencias, setSelectedFrequencias] = useState<string[]>([])

  // ✅ FIXO: anos >= 2025 e meses jan-dez
  const [monthOptions, setMonthOptions] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  const [isNewControlModalOpen, setIsNewControlModalOpen] = useState(false)

  /**
   * ✅ Boot:
   * - monta lista de meses
   * - restaura filtros da URL (periodo, q, risco, status, owner, focal, frequencia, page)
   * - garante mês válido
   */
  useEffect(() => {
    const opts = buildMonthOptions(2025)
    setMonthOptions(opts)

    const urlPeriodo = safeText(searchParams.get("periodo") || searchParams.get("period"))
    const urlQ = safeText(searchParams.get("q"))
    const urlRiscos = parseMultiParam(safeText(searchParams.get("risco")))
    const urlStatuses = parseMultiParam(safeText(searchParams.get("status")))
    const urlOwners = parseMultiParam(safeText(searchParams.get("owner")))
    const urlFocals = parseMultiParam(safeText(searchParams.get("focal")))
    const urlFrequencias = parseMultiParam(safeText(searchParams.get("frequencia")))
    const urlPage = clampPage(Number(searchParams.get("page") || 1))

    if (urlQ) setSearchTerm(urlQ)
    setSelectedRiscos(urlRiscos)
    setSelectedStatuses(urlStatuses)
    setSelectedOwners(urlOwners)
    setSelectedFocals(urlFocals)
    setSelectedFrequencias(urlFrequencias)
    setCurrentPage(urlPage)

    const fallbackMonth = resolveReferenceMonth(opts)

    // se veio periodo na URL e ele existe na lista, usa ele; senão usa fallback
    const resolvedMonth = urlPeriodo && opts.includes(urlPeriodo) ? urlPeriodo : fallbackMonth
    setSelectedMonth(resolvedMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * ✅ Mantém filtros na URL
   * (router.replace não “sujará” o histórico e o back funciona do jeito esperado)
   */
  useEffect(() => {
    if (!selectedMonth) return

    const qs = buildControlsQuery({
      periodo: selectedMonth,
      q: searchTerm || undefined,
      risco: selectedRiscos,
      status: selectedStatuses,
      owner: selectedOwners,
      focal: selectedFocals,
      frequencia: selectedFrequencias,
      page: currentPage,
    })

    router.replace(qs ? `/controles?${qs}` : "/controles")
  }, [
    selectedMonth,
    searchTerm,
    selectedRiscos,
    selectedStatuses,
    selectedOwners,
    selectedFocals,
    selectedFrequencias,
    currentPage,
    router,
  ])

  useEffect(() => {
    async function loadData() {
      if (!selectedMonth) return

      try {
        setLoading(true)
        const result = await fetchControles({ period: selectedMonth })

        if (result.success && (result as any).data) {
          const mappedData: Controle[] = (result as any).data.map((item: any) => {
            return {
              id: item.id_control || item.id,
              nome: item.name_control || item.name || "Sem nome",
              framework: item.framework || "N/A",

              // ⚠️ risco: mantém como texto vindo do banco (risk_title)
              risco: item.risk_title || item.risco || "Medium",

              control_owner: item.owner_name || item.control_owner || item.owner || "Não atribuído",
              focal_point_name: item.focal_point_name || item.focal || "Não atribuído",

              // ✅ NOVO: frequência (tenta cobrir nomes comuns de coluna)
              frequencia:
                item.control_frequency ||
                item.frequency ||
                item.frequencia ||
                item.frequency_title ||
                item.frequency_name ||
                "N/A",

              status: item.status || "Pendente",
              pendencia: item.pendencia_kpi || "Pendente",
              reference_month: item.reference_month || "",
              corStatus: "",

              exec_total: Number(item.exec_total || 0),
              exec_done: Number(item.exec_done || 0),
              green_count: Number(item.green_count || 0),
              yellow_count: Number(item.yellow_count || 0),
              red_count: Number(item.red_count || 0),
              status_final: String(item.status_final || "EM ABERTO"),
              grc_final_status: String(item.grc_final_status || "PENDENTE"),
            }
          })
          setControles(mappedData)
          setError(false)
        } else {
          setError(true)
        }
      } catch (err) {
        console.error("Erro ao carregar controles:", err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedMonth])

  const processedData = useMemo(() => {
    return controles.map((ctrl) => {
      const total = Number(ctrl.exec_total || 0)
      const done = Number(ctrl.exec_done || 0)
      const displayStatus = total > 0 && done >= total ? "Finalizado" : "Em Aberto"
      return { ...ctrl, displayStatus }
    })
  }, [controles])

  /**
   * ✅ Filtros garantidos:
   * - Busca: id, nome, owner, focal, framework, risco, frequencia
   * - Risco: compara por "contém"
   * - Status: match do status final normalizado
   * - Owner/Focal/Frequencia: match exato
   */
  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return processedData.filter((item) => {
      const haystack = [
        item.id,
        item.nome,
        item.framework,
        item.risco,
        item.frequencia,
        item.control_owner,
        item.focal_point_name,
      ]
        .map((x) => safeText(x).toLowerCase())
        .join(" ")

      const matchSearch = !q || haystack.includes(q)

      const matchRisco =
        selectedRiscos.length === 0 ||
        selectedRiscos.some((risk) => safeText(item.risco).toLowerCase().includes(safeText(risk).toLowerCase()))

      const normalizedStatus = normalizeControlStatusLabel(item.status_final)
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(normalizedStatus)

      const matchOwner = selectedOwners.length === 0 || selectedOwners.includes(safeText(item.control_owner))
      const matchFocal = selectedFocals.length === 0 || selectedFocals.includes(safeText(item.focal_point_name))
      const matchFrequencia =
        selectedFrequencias.length === 0 || selectedFrequencias.includes(safeText(item.frequencia))

      return matchSearch && matchRisco && matchStatus && matchOwner && matchFocal && matchFrequencia
    })
  }, [searchTerm, selectedRiscos, selectedStatuses, selectedOwners, selectedFocals, selectedFrequencias, processedData])

  const ownersList = useMemo(() => {
    return Array.from(new Set(controles.map((c) => safeText(c.control_owner))))
      .filter((o) => o && o !== "Não atribuído")
      .sort((a, b) => a.localeCompare(b))
  }, [controles])

  const focalsList = useMemo(() => {
    return Array.from(new Set(controles.map((c) => safeText(c.focal_point_name))))
      .filter((f) => f && f !== "Não atribuído")
      .sort((a, b) => a.localeCompare(b))
  }, [controles])

  // ✅ NOVO: lista de frequências
  const frequenciasList = useMemo(() => {
    return Array.from(new Set(controles.map((c) => safeText(c.frequencia))))
      .filter((f) => f && f !== "N/A")
      .sort((a, b) => a.localeCompare(b))
  }, [controles])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE))

  const paginatedControles = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filteredData.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredData, currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedRiscos, selectedStatuses, selectedOwners, selectedFocals, selectedFrequencias, selectedMonth])

  const getRiskStyles = (risco: string) => {
    const r = (risco || "").toLowerCase()
    if (r.includes("low") || r.includes("baixo")) return "bg-emerald-50 text-emerald-600 border-emerald-100"
    if (r.includes("medium") || r.includes("médio")) return "bg-yellow-50 text-yellow-600 border-yellow-100"
    if (r.includes("high") || r.includes("alto")) return "bg-orange-50 text-orange-600 border-orange-100"
    if (r.includes("critical") || r.includes("crítico")) return "bg-red-50 text-red-600 border-red-100"
    return "bg-slate-50 text-slate-600 border-slate-100"
  }

  const getFinalStatusStyle = (s: string) => {
    const label = normalizeControlStatusLabel(s)
    if (label === "Conforme") return { text: "text-emerald-600", dot: "bg-emerald-500" }
    if (label === "Não conforme" || label === "Reprovado") return { text: "text-red-600", dot: "bg-red-500" }
    if (label === "Parcial") return { text: "text-amber-600", dot: "bg-amber-500" }
    if (label === "Pendente") return { text: "text-slate-600", dot: "bg-slate-400" }
    if (label === "Não aplicável") return { text: "text-slate-500", dot: "bg-slate-300" }
    return { text: "text-amber-600", dot: "bg-amber-500" }
  }

  const pickStatusIcon = (s: string) => {
    const label = normalizeControlStatusLabel(s)
    if (label === "Conforme") return <CheckCircle2 size={12} className="text-emerald-500" />
    if (label === "Não conforme" || label === "Reprovado") return <AlertTriangle size={12} className="text-red-500" />
    if (label === "Parcial") return <Clock size={12} className="text-amber-500" />
    if (label === "Pendente" || label === "Não aplicável") return <Clock size={12} className="text-slate-500" />
    return <Clock size={12} className="text-amber-500" />
  }

  const getGrcStatusStyle = (s: string) => {
    const up = safeText(s).toUpperCase()
    if (up === "GREEN") return "bg-emerald-50 text-emerald-700 border-emerald-100"
    if (up === "CONFORME") return "bg-emerald-50 text-emerald-700 border-emerald-100"
    if (up === "YELLOW") return "bg-amber-50 text-amber-700 border-amber-100"
    if (up.includes("ATEN")) return "bg-amber-50 text-amber-700 border-amber-100"
    if (up === "RED") return "bg-red-50 text-red-700 border-red-100"
    if (up.includes("REPROV")) return "bg-red-50 text-red-700 border-red-100"
    if (up.includes("NÃO CONFORME") || up.includes("NAO CONFORME")) return "bg-red-50 text-red-700 border-red-100"
    if (up.includes("NÃO APLIC") || up.includes("NAO APLIC")) return "bg-slate-50 text-slate-500 border-slate-200"
    if (up.includes("SEM EXEC")) return "bg-slate-50 text-slate-500 border-slate-200"
    return "bg-[#f71866]/5 text-[#f71866] border-[#f71866]/20"
  }

  // ✅ query atual para propagar no "Detalhes" (isso é o que vai permitir o breadcrumb manter filtros)
  const currentQuery = useMemo(() => {
    return buildControlsQuery({
      periodo: selectedMonth,
      q: searchTerm || undefined,
      risco: selectedRiscos,
      status: selectedStatuses,
      owner: selectedOwners,
      focal: selectedFocals,
      frequencia: selectedFrequencias,
      page: currentPage,
    })
  }, [selectedMonth, searchTerm, selectedRiscos, selectedStatuses, selectedOwners, selectedFocals, selectedFrequencias, currentPage])

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Listagem de Controles</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            Acompanhe status, responsáveis e evidências dos controles em um só lugar.
          </p>
        </div>
        <button
          onClick={() => setIsNewControlModalOpen(true)}
          className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" /> Novo Controle
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard
          icon={<ShieldCheck className="text-emerald-500" />}
          label="Controles Finalizados"
          value={filteredData.filter((d) => d.displayStatus === "Finalizado").length.toString()}
          bgColor="bg-emerald-50"
        />
        <StatSmallCard
          icon={<Clock className="text-[#f71866]" />}
          label="Aguardando KPIs"
          value={filteredData.filter((d) => d.displayStatus === "Em Aberto").length.toString()}
          bgColor="bg-red-50"
        />
        <StatSmallCard
          icon={<AlertTriangle className="text-amber-500" />}
          label="Risco Crítico"
          value={filteredData.filter((d) => (d.risco || "").toLowerCase().includes("crit")).length.toString()}
          bgColor="bg-amber-50"
        />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-8 gap-4 items-center">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={monthOptions.length === 0}
              className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold outline-none cursor-pointer appearance-none disabled:opacity-60"
            >
              {monthOptions.length === 0 ? (
                <option value="">Sem meses disponíveis</option>
              ) : (
                monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatPeriodoLabel(m)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm outline-none transition-all"
              placeholder="Buscar por ID, Nome, Risco, Status, Framework, Owner, Focal..."
            />
          </div>

          <MultiSelectFilter
            label="Risco"
            options={["Critical", "High", "Medium", "Low"]}
            selected={selectedRiscos}
            onChange={setSelectedRiscos}
          />

          <MultiSelectFilter
            label="Status"
            options={["Conforme", "Parcial", "Em atenção", "Não conforme", "Reprovado", "Pendente", "Não aplicável"]}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />

          <MultiSelectFilter
            label="Owner"
            options={ownersList}
            selected={selectedOwners}
            onChange={setSelectedOwners}
          />

          <MultiSelectFilter
            label="Focal Point"
            options={focalsList}
            selected={selectedFocals}
            onChange={setSelectedFocals}
          />

          <MultiSelectFilter
            label="Frequência"
            options={frequenciasList}
            selected={selectedFrequencias}
            onChange={setSelectedFrequencias}
          />

          <button
            onClick={() => {
              setSearchTerm("")
              setSelectedRiscos([])
              setSelectedStatuses([])
              setSelectedOwners([])
              setSelectedFocals([])
              setSelectedFrequencias([])

              setSelectedMonth(resolveReferenceMonth(monthOptions, getPreviousMonthISO()))

              setCurrentPage(1)
            }}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors py-2 text-center"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-[#f71866]" size={32} />
            <p className="text-sm font-medium">Carregando dados dos proprietários...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 p-10">
            <AlertTriangle className="text-amber-500" size={28} />
            <p className="text-sm font-medium">Falha ao carregar controles para o período selecionado.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Código (id_control)
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Nome & Framework
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Frequência
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Control Owner
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Focal Point
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Status
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Avaliação GRC
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Risco
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedControles.length > 0 ? (
                    paginatedControles.map((item) => {
                      const st = getFinalStatusStyle(item.status_final)
                      const normalizedStatus = normalizeControlStatusLabel(item.status_final)
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              {item.id}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-700">{item.nome}</div>
                            <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">
                              {item.framework}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span className="text-[11px] font-bold text-slate-600">
                              {safeText(item.frequencia) || "N/A"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[#f71866]">
                                <User size={14} />
                              </div>
                              <span className="text-xs font-bold text-slate-600">{item.control_owner}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[#f71866]">
                                <User size={14} />
                              </div>
                              <span className="text-xs font-bold text-slate-600">{item.focal_point_name}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {pickStatusIcon(item.status_final)}
                                <span className={`text-[11px] font-bold ${st.text}`}>{normalizedStatus}</span>
                              </div>

                              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100">
                                  {item.exec_done}/{item.exec_total}
                                </span>

                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  <span>{item.green_count}</span>
                                </span>

                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  <span>{item.yellow_count}</span>
                                </span>

                                <span className="inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                  <span>{item.red_count}</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getGrcStatusStyle(item.grc_final_status)}`}
                            >
                              {item.grc_final_status || "PENDENTE"}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRiskStyles(item.risco)}`}>
                              {item.risco}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-4">
                              {/* ✅ AQUI É O PONTO: leva a query completa para o detalhe */}
                              <Link
                                href={`/controles/${encodeURIComponent(item.id)}${currentQuery ? `?${currentQuery}` : ""}`}
                                className="text-[10px] font-bold text-slate-400 hover:text-[#f71866] uppercase transition-colors"
                              >
                                Detalhes
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center text-slate-400 text-sm">
                        Nenhum controle encontrado para os critérios selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="text-xs text-slate-500 font-medium">
                Exibindo <span className="font-bold text-slate-700">{paginatedControles.length}</span> de{" "}
                <span className="font-bold text-slate-700">{filteredData.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-white transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="text-[11px] font-bold text-slate-400 px-2">
                  {Math.min(currentPage, totalPages)} / {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-white transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isNewControlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNewControlModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden">
            <div className="p-8 text-center border-b border-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Novo Controle</h3>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/controles/novo"
                className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all text-center"
              >
                <FileText className="text-slate-400 mb-4" size={28} />
                <span className="font-bold text-slate-800 text-sm">Cadastro Manual</span>
              </Link>
              <Link
                href="/controles/novo?mode=massivo"
                className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all text-center"
              >
                <Database className="text-slate-400 mb-4" size={28} />
                <span className="font-bold text-slate-800 text-sm">Upload de CSV</span>
              </Link>
            </div>
            <div className="p-4 bg-slate-50 flex justify-center">
              <button onClick={() => setIsNewControlModalOpen(false)} className="text-[11px] font-bold text-slate-400 uppercase">
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(event.target as Node)) setOpen(false)
    }

    if (open) document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const selectedLabel = selected.length > 0 ? `${label} (${selected.length})` : `${label} (Todos)`

  const toggleOption = (value: string) => {
    const exists = selected.includes(value)
    if (exists) onChange(selected.filter((v) => v !== value))
    else onChange([...selected, value])
  }

  const clearAll = () => onChange([])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none cursor-pointer inline-flex items-center justify-between"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-full min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-lg p-2">
          <button
            type="button"
            onClick={clearAll}
            className="w-full text-left px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
          >
            Limpar seleção
          </button>
          <div className="max-h-56 overflow-auto space-y-1 mt-1">
            {options.length > 0 ? (
              options.map((opt) => {
                const checked = selected.includes(opt)
                return (
                  <label key={opt} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(opt)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#f71866] focus:ring-[#f71866]"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                )
              })
            ) : (
              <div className="px-2 py-2 text-xs text-slate-400">Sem opções</div>
            )}
          </div>
        </div>
      ) : null}
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
