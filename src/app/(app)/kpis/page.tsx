"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Target,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from "lucide-react"

// ✅ Buscando direto do banco via Server Action
import { fetchKPIs } from "../controles/actions"

type KPIType = "Manual" | "Automated" | "Automatizado" | "Manual" | "N/A"

type KPIRecord = {
  id: string
  nome: string
  framework: string
  kpi_type: string
  meta: string
  atual: string
  status: string
  tendencia: "up" | "down"
  corStatus: string
}

function parseNumberLoose(v: any): number | null {
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

function normalizePercentString(v: any): string {
  if (v === null || v === undefined) return "0"
  if (typeof v === "string") return v.trim() || "0"
  if (typeof v === "number") return `${v}`
  return "0"
}

function toPercentLabel(v: any): string {
  const s = normalizePercentString(v)
  if (s.includes("%")) return s
  const n = parseNumberLoose(s)
  if (n === null) return s
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  return `${isInt ? Math.round(n) : n}%`
}

function normalizeKpiType(v: any): string {
  const raw = (v ?? "").toString().trim()
  if (!raw) return "N/A"
  const s = raw.toLowerCase()

  if (s.includes("auto")) return "Automated"
  if (s.includes("api")) return "Automated"
  if (s.includes("script")) return "Automated"
  if (s.includes("manual")) return "Manual"

  // fallback: mantém o texto original (mas capitaliza simples)
  return raw
}

function computeStatusAndColor(metaRaw: any, atualRaw: any) {
  const metaN = parseNumberLoose(metaRaw)
  const atualN = parseNumberLoose(atualRaw)

  if (metaN === null || atualN === null) {
    return { status: "Em Atenção", corStatus: "bg-amber-500", atualColor: "text-amber-600" }
  }

  const lowerIsBetter = metaN === 0
  const ok = lowerIsBetter ? atualN <= metaN : atualN >= metaN
  const critical = !ok && lowerIsBetter && atualN > 0

  if (ok) return { status: "Meta Atingida", corStatus: "bg-emerald-500", atualColor: "text-emerald-600" }
  if (critical) return { status: "Crítico", corStatus: "bg-red-500", atualColor: "text-red-600" }
  return { status: "Em Atenção", corStatus: "bg-amber-500", atualColor: "text-amber-600" }
}

function computeTrend(prevRaw: any, atualRaw: any): "up" | "down" {
  const prev = parseNumberLoose(prevRaw)
  const atual = parseNumberLoose(atualRaw)
  if (prev === null || atual === null) return "up"
  return atual >= prev ? "up" : "down"
}

export default function KPIsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterKpiType, setFilterKpiType] = useState("Todos") // ✅ novo filtro

  const currentMonth = new Date().toLocaleString("pt-BR", { month: "long" })
  const currentYear = new Date().getFullYear()
  const [selectedMonth, setSelectedMonth] = useState(`${currentMonth} / ${currentYear}`)

  // ✅ pagination mantendo a UI/funcionalidade
  const [page, setPage] = useState(1)
  const pageSize = 12

  // ✅ dados do banco
  const [kpisData, setKpisData] = useState<KPIRecord[]>([])
  const [totalKPIs, setTotalKPIs] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const result = await fetchKPIs({
          month: selectedMonth,
          page,
          pageSize
        })

        if (!result?.success) {
          setLoadError(result?.error || "Falha ao carregar KPIs do banco.")
          setKpisData([])
          setTotalKPIs(0)
          setLoading(false)
          return
        }

        const rows = Array.isArray(result.data) ? result.data : []
        const mapped: KPIRecord[] = rows.map((r: any) => {
          const id = String(r.kpi_id || r.id || "").trim()
          const nome = String(r.kpi_name || r.nome || "Indicador").trim()
          const framework = String(r.framework || r.framework_name || "N/A").trim()

          // ✅ vem do control_kpis.kpi_type
          const kpi_type = normalizeKpiType(r.kpi_type)

          const meta = String(r.kpi_target ?? r.meta ?? "0").trim()

          // atual: último valor registrado (se não existir, 0)
          const atualValue = r.last_value ?? r.atual ?? r.latest_value ?? 0
          const atual = toPercentLabel(atualValue)

          const prevValue = r.previous_value ?? r.prev_value ?? r.last_prev_value ?? null
          const tendencia = computeTrend(prevValue, atualValue)

          const statusObj = computeStatusAndColor(meta, atualValue)

          return {
            id: id || `KPI-${Math.random().toString(16).slice(2)}`,
            nome,
            framework,
            kpi_type,
            meta: toPercentLabel(meta),
            atual,
            status: statusObj.status,
            tendencia,
            corStatus: statusObj.corStatus
          }
        })

        setKpisData(mapped)
        setTotalKPIs(typeof result.total === "number" ? result.total : mapped.length)
      } catch (e: any) {
        setLoadError("Erro ao conectar com o servidor.")
        setKpisData([])
        setTotalKPIs(0)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [selectedMonth, page])

  const frameworkOptions = useMemo(() => {
    const fromData = Array.from(new Set(kpisData.map(k => k.framework).filter(Boolean)))
    const fixed = ["SOX", "ISO 27001", "SOC2", "NIST"]
    return Array.from(new Set([...fixed, ...fromData]))
  }, [kpisData])

  const typeOptions = useMemo(() => {
    const fromData = Array.from(new Set(kpisData.map(k => k.kpi_type).filter(Boolean)))
    const fixed = ["Manual", "Automated"]
    return Array.from(new Set([...fixed, ...fromData]))
  }, [kpisData])

  const filteredKPIs = useMemo(() => {
    return kpisData.filter(kpi => {
      const matchSearch =
        kpi.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.id.toLowerCase().includes(searchTerm.toLowerCase())

      const matchFramework = filterFramework === "Todos" || kpi.framework === filterFramework
      const matchType = filterKpiType === "Todos" || kpi.kpi_type === filterKpiType

      return matchSearch && matchFramework && matchType
    })
  }, [kpisData, searchTerm, filterFramework, filterKpiType])

  const stats = useMemo(() => {
    const total = filteredKPIs.length
    const atingidas = filteredKPIs.filter(k => k.status === "Meta Atingida").length
    const abaixo = filteredKPIs.filter(k => k.status !== "Meta Atingida").length

    const perc = total > 0 ? Math.round((atingidas / total) * 100) : 0
    const perf = filteredKPIs.reduce((acc, k) => {
      const meta = parseNumberLoose(k.meta)
      const atual = parseNumberLoose(k.atual)
      if (meta === null || atual === null || meta === 0) return acc
      return acc + ((atual - meta) / meta) * 100
    }, 0)
    const perfAvg = total > 0 ? perf / total : 0

    const perfLabel = `${perfAvg >= 0 ? "+" : ""}${perfAvg.toFixed(1)}%`
    return { perc, perfLabel, abaixo }
  }, [filteredKPIs])

  const totalPages = Math.max(1, Math.ceil(totalKPIs / pageSize))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Indicadores de Performance (KPIs)</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Monitore as métricas de conformidade e performance em tempo real.</p>
        </div>
        <button className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#f71866]/20 transition-all active:scale-95">
          <Plus className="h-5 w-5" />
          Novo Indicador
        </button>
      </header>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 items-center">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold outline-none cursor-pointer appearance-none"
            >
              <option>{currentMonth} / {currentYear}</option>
              <option>dezembro / 2025</option>
            </select>
          </div>

          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar KPI..."
            />
          </div>

          <select
            value={filterFramework}
            onChange={(e) => { setFilterFramework(e.target.value); setPage(1) }}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Framework (Todos)</option>
            {frameworkOptions.map((fw) => (
              <option key={fw} value={fw}>{fw}</option>
            ))}
          </select>

          {/* ✅ NOVO: filtro por tipo (Manual/Automated) */}
          <select
            value={filterKpiType}
            onChange={(e) => { setFilterKpiType(e.target.value); setPage(1) }}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Categoria (Todos)</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium">
            <option>Status da Meta</option>
            <option>Meta Atingida</option>
            <option>Em Atenção</option>
            <option>Crítico</option>
          </select>

          <button
            onClick={() => { setSearchTerm(""); setFilterFramework("Todos"); setFilterKpiType("Todos"); setPage(1) }}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-slate-600 transition-colors py-2"
          >
            Limpar Filtros
          </button>
        </div>

        {loadError && (
          <div className="mt-4 text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {loadError}
          </div>
        )}
      </div>

      {/* KPI TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do KPI</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Framework</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Meta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Atual</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Trend</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10">
                    <div className="flex items-center justify-center gap-2 text-slate-400 font-bold text-sm">
                      <Loader2 className="animate-spin" size={18} />
                      Carregando KPIs do banco...
                    </div>
                  </td>
                </tr>
              ) : filteredKPIs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <AlertCircle size={26} strokeWidth={1.5} />
                      <p className="text-sm font-medium">Nenhum KPI encontrado com os filtros atuais.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKPIs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded italic">
                        {item.id}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-700">{item.nome}</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded bg-slate-50">
                        {item.framework}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-slate-600 border border-slate-200 px-2 py-1 rounded bg-white">
                        {item.kpi_type}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-slate-400">{item.meta}</span>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-sm">
                      <span
                        className={
                          item.status === "Meta Atingida"
                            ? "text-emerald-600"
                            : item.status === "Crítico"
                            ? "text-red-600"
                            : "text-amber-600"
                        }
                      >
                        {item.atual}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {item.tendencia === "up" ? (
                          <ArrowUpRight className="text-emerald-500 h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="text-red-500 h-4 w-4" />
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${item.corStatus}`}></span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase">{item.status}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/kpis/${encodeURIComponent(item.id)}`)}
                        className="px-4 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                      >
                        Analisar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{filteredKPIs.length}</span> de{" "}
            <span className="font-bold text-slate-700">{totalKPIs}</span> indicadores
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => canPrev && setPage(p => p - 1)}
              disabled={!canPrev || loading}
              className={`p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all ${
                !canPrev || loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button className="w-8 h-8 rounded-lg bg-[#f71866] text-white text-xs font-bold shadow-sm">
              {page}
            </button>

            <button
              onClick={() => canNext && setPage(p => p + 1)}
              disabled={!canNext || loading}
              className={`p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all ${
                !canNext || loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<Target className="text-emerald-500" />} label="Metas Atingidas" value={`${stats.perc}%`} bgColor="bg-emerald-50" />
        <StatSmallCard icon={<TrendingUp className="text-[#f71866]" />} label="Performance Global" value={stats.perfLabel} bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertCircle className="text-amber-500" />} label="Abaixo da Meta" value={String(stats.abaixo).padStart(2, "0")} bgColor="bg-amber-50" />
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
