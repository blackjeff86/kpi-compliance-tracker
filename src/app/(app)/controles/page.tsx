// src/app/(app)/controles/page.tsx
"use client"

import React, { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
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

  exec_total: number
  exec_done: number
  green_count: number
  yellow_count: number
  red_count: number
  status_final: "EM ABERTO" | "CONFORME" | "EM ATENÇÃO" | "NÃO CONFORME" | string
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

function formatPeriodoLabel(periodoISO: string) {
  const s = safeText(periodoISO)
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (!m) return s || ""
  const year = Number(m[1])
  const month = Number(m[2])
  const monthName = MONTHS_PT[month - 1] || ""
  return `${monthName} / ${year}`
}

function getCurrentMonthISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function buildMonthOptions(startYear = 2025, endYear?: number) {
  const nowYear = new Date().getFullYear()
  const yEnd = Number.isFinite(endYear as any) ? Number(endYear) : nowYear + 1 // inclui próximo ano
  const out: string[] = []

  for (let y = yEnd; y >= startYear; y--) {
    for (let m = 12; m >= 1; m--) {
      out.push(`${y}-${String(m).padStart(2, "0")}`)
    }
  }
  return out
}

function clampPage(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 1) return 1
  return Math.floor(x)
}

function buildControlsQuery(params: {
  periodo?: string
  q?: string
  risco?: string
  owner?: string
  focal?: string
  page?: number
}) {
  const sp = new URLSearchParams()

  if (params.periodo) sp.set("periodo", params.periodo)
  if (params.q) sp.set("q", params.q)
  if (params.risco && params.risco !== "Todos") sp.set("risco", params.risco)
  if (params.owner && params.owner !== "Todos") sp.set("owner", params.owner)
  if (params.focal && params.focal !== "Todos") sp.set("focal", params.focal)
  if (params.page && params.page !== 1) sp.set("page", String(params.page))

  return sp.toString()
}

export default function ControlesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ITEMS_PER_PAGE = 15

  const [controles, setControles] = useState<Controle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRisco, setSelectedRisco] = useState("Todos")
  const [selectedOwner, setSelectedOwner] = useState("Todos")
  const [selectedFocal, setSelectedFocal] = useState("Todos")

  // ✅ FIXO: anos >= 2025 e meses jan-dez
  const [monthOptions, setMonthOptions] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  const [isNewControlModalOpen, setIsNewControlModalOpen] = useState(false)

  /**
   * ✅ Boot:
   * - monta lista de meses
   * - restaura filtros da URL (periodo, q, risco, owner, focal, page)
   * - garante mês válido
   */
  useEffect(() => {
    const opts = buildMonthOptions(2025)
    setMonthOptions(opts)

    const urlPeriodo = safeText(searchParams.get("periodo") || searchParams.get("period"))
    const urlQ = safeText(searchParams.get("q"))
    const urlRisco = safeText(searchParams.get("risco")) || "Todos"
    const urlOwner = safeText(searchParams.get("owner")) || "Todos"
    const urlFocal = safeText(searchParams.get("focal")) || "Todos"
    const urlPage = clampPage(Number(searchParams.get("page") || 1))

    if (urlQ) setSearchTerm(urlQ)
    if (urlRisco) setSelectedRisco(urlRisco)
    if (urlOwner) setSelectedOwner(urlOwner)
    if (urlFocal) setSelectedFocal(urlFocal)
    setCurrentPage(urlPage)

    const cur = getCurrentMonthISO()
    const fallbackMonth = opts.includes(cur) ? cur : (opts[0] || cur)

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
      risco: selectedRisco || "Todos",
      owner: selectedOwner || "Todos",
      focal: selectedFocal || "Todos",
      page: currentPage,
    })

    router.replace(qs ? `/controles?${qs}` : "/controles")
  }, [selectedMonth, searchTerm, selectedRisco, selectedOwner, selectedFocal, currentPage, router])

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
   * - Busca: id, nome, owner, focal, framework, risco
   * - Risco: compara por "contém"
   * - Owner/Focal: match exato
   */
  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return processedData.filter((item) => {
      const haystack = [
        item.id,
        item.nome,
        item.framework,
        item.risco,
        item.control_owner,
        item.focal_point_name,
      ]
        .map((x) => safeText(x).toLowerCase())
        .join(" ")

      const matchSearch = !q || haystack.includes(q)

      const riscoFilter = safeText(selectedRisco)
      const matchRisco =
        riscoFilter === "Todos" ||
        safeText(item.risco).toLowerCase().includes(riscoFilter.toLowerCase())

      const matchOwner = selectedOwner === "Todos" || safeText(item.control_owner) === safeText(selectedOwner)
      const matchFocal = selectedFocal === "Todos" || safeText(item.focal_point_name) === safeText(selectedFocal)

      return matchSearch && matchRisco && matchOwner && matchFocal
    })
  }, [searchTerm, selectedRisco, selectedOwner, selectedFocal, processedData])

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

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE))

  const paginatedControles = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filteredData.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredData, currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedRisco, selectedOwner, selectedFocal, selectedMonth])

  const getRiskStyles = (risco: string) => {
    const r = (risco || "").toLowerCase()
    if (r.includes("low") || r.includes("baixo")) return "bg-emerald-50 text-emerald-600 border-emerald-100"
    if (r.includes("medium") || r.includes("médio")) return "bg-yellow-50 text-yellow-600 border-yellow-100"
    if (r.includes("high") || r.includes("alto")) return "bg-orange-50 text-orange-600 border-orange-100"
    if (r.includes("critical") || r.includes("crítico")) return "bg-red-50 text-red-600 border-red-100"
    return "bg-slate-50 text-slate-600 border-slate-100"
  }

  const getFinalStatusStyle = (s: string) => {
    const up = (s || "").toUpperCase()
    if (up.includes("CONFORME") && !up.includes("NÃO")) return { text: "text-emerald-600", dot: "bg-emerald-500" }
    if (up.includes("NÃO")) return { text: "text-red-600", dot: "bg-red-500" }
    if (up.includes("ATEN")) return { text: "text-amber-600", dot: "bg-amber-500" }
    return { text: "text-amber-600", dot: "bg-amber-500" }
  }

  const pickStatusIcon = (s: string) => {
    const up = (s || "").toUpperCase()
    if (up.includes("CONFORME") && !up.includes("NÃO")) return <CheckCircle2 size={12} className="text-emerald-500" />
    if (up.includes("NÃO")) return <AlertTriangle size={12} className="text-red-500" />
    if (up.includes("ATEN")) return <AlertTriangle size={12} className="text-amber-500" />
    return <Clock size={12} className="text-amber-500" />
  }

  // ✅ query atual para propagar no "Detalhes" (isso é o que vai permitir o breadcrumb manter filtros)
  const currentQuery = useMemo(() => {
    return buildControlsQuery({
      periodo: selectedMonth,
      q: searchTerm || undefined,
      risco: selectedRisco,
      owner: selectedOwner,
      focal: selectedFocal,
      page: currentPage,
    })
  }, [selectedMonth, searchTerm, selectedRisco, selectedOwner, selectedFocal, currentPage])

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Listagem de Controles</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            Gestão de conformidade baseada na coluna owner_name.
          </p>
        </div>
        <button
          onClick={() => setIsNewControlModalOpen(true)}
          className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" /> Novo Controle
        </button>
      </header>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
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
              placeholder="Buscar por ID, Nome, Risco, Framework, Owner, Focal..."
            />
          </div>

          <select
            value={selectedRisco}
            onChange={(e) => setSelectedRisco(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none cursor-pointer"
          >
            <option value="Todos">Risco (Todos)</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none cursor-pointer"
          >
            <option value="Todos">Owner (Todos)</option>
            {ownersList.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>

          <select
            value={selectedFocal}
            onChange={(e) => setSelectedFocal(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none cursor-pointer"
          >
            <option value="Todos">Focal Point (Todos)</option>
            {focalsList.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearchTerm("")
              setSelectedRisco("Todos")
              setSelectedOwner("Todos")
              setSelectedFocal("Todos")

              const cur = getCurrentMonthISO()
              const nextMonth = monthOptions.includes(cur) ? cur : (monthOptions[0] || cur)
              setSelectedMonth(nextMonth)

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
                                <span className={`text-[11px] font-bold ${st.text}`}>{item.status_final}</span>
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
                      <td colSpan={7} className="px-6 py-20 text-center text-slate-400 text-sm">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard
          icon={<ShieldCheck className="text-emerald-500" />}
          label="Controles Finalizados"
          value={processedData.filter((d) => d.displayStatus === "Finalizado").length.toString()}
          bgColor="bg-emerald-50"
        />
        <StatSmallCard
          icon={<Clock className="text-[#f71866]" />}
          label="Aguardando KPIs"
          value={processedData.filter((d) => d.displayStatus === "Em Aberto").length.toString()}
          bgColor="bg-red-50"
        />
        <StatSmallCard
          icon={<AlertTriangle className="text-amber-500" />}
          label="Risco Crítico"
          value={processedData.filter((d) => (d.risco || "").toLowerCase().includes("crit")).length.toString()}
          bgColor="bg-amber-50"
        />
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
              <button className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all text-center">
                <Database className="text-slate-400 mb-4" size={28} />
                <span className="font-bold text-slate-800 text-sm">Upload de CSV</span>
              </button>
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
