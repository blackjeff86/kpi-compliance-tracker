// src/app/(app)/kpis/page.tsx
"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Target,
  TrendingUp,
  AlertCircle,
  Loader2,
  X,
  Save,
} from "lucide-react"
import { buildMonthOptions, getPreviousMonthISO, resolveReferenceMonth } from "@/lib/utils"

// ✅ Buscando direto do banco via Server Action
import { fetchKPIs } from "../controles/actions"

// ✅ NOVO: buscar runs do período (ATUAL + STATUS)
import { createKpiFromCatalog, fetchKpiCreationOptions, fetchLatestKpiRunsForPeriod } from "./actions"

type KPIRecord = {
  id: string
  kpi_uuid: string
  nome: string
  framework: string
  kpi_type: string
  meta: string
  atual: string
  status: string
  corStatus: string
  grc_final_status: string
  grc_review_comment: string
}

type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"

type ControlOption = {
  id_control: string
  name_control: string
  framework: string
  kpi_count: number
}

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
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

  return raw
}

/** Month helpers (ISO YYYY-MM) */
const MONTHS_PT = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
]

function formatPeriodoLabel(periodoISO: string) {
  const s = String(periodoISO || "").trim()
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (!m) return s || ""
  const year = Number(m[1])
  const month = Number(m[2])
  const monthName = MONTHS_PT[month - 1] || ""
  return `${monthName} / ${year}`
}

/** Status mapping do banco (kpi_runs.status) -> label da UI */
function mapRunStatusToUi(statusRaw: any): { label: string; dot: string; text: string } {
  const s = String(statusRaw || "").trim().toUpperCase()

  if (s.includes("REPROVADO")) return { label: "Reprovado", dot: "bg-red-500", text: "text-red-600" }
  if (s.includes("GREEN")) return { label: "Green", dot: "bg-emerald-500", text: "text-emerald-600" }
  if (s.includes("RED")) return { label: "Red", dot: "bg-red-500", text: "text-red-600" }
  if (s.includes("YELLOW")) return { label: "Yellow", dot: "bg-amber-500", text: "text-amber-600" }

  // fallback para manter a coluna restrita a Red/Yellow/Green
  return { label: "Yellow", dot: "bg-amber-500", text: "text-amber-600" }
}

function clampPage(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 1) return 1
  return Math.floor(x)
}

function buildKpisQuery(params: {
  periodo?: string
  q?: string
  framework?: string
  tipo?: string
  status?: string
  page?: number
}) {
  const sp = new URLSearchParams()

  if (params.periodo) sp.set("periodo", params.periodo)
  if (params.q) sp.set("q", params.q)
  if (params.framework && params.framework !== "Todos") sp.set("framework", params.framework)
  if (params.tipo && params.tipo !== "Todos") sp.set("tipo", params.tipo)
  if (params.status && params.status !== "Todos") sp.set("status", params.status)
  if (params.page && params.page !== 1) sp.set("page", String(params.page))

  return sp.toString()
}

// ✅ extrai o número do código para ordenar corretamente (01, 02, ... 100, 101)
function extractKpiNumber(code: any): number {
  const s = String(code || "").trim()
  if (!s) return Number.POSITIVE_INFINITY
  const matches = s.match(/\d+/g)
  if (!matches || matches.length === 0) return Number.POSITIVE_INFINITY
  const last = matches[matches.length - 1]
  const n = Number(last)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function normalizeMode(v: any): KpiEvaluationMode {
  const s = String(v || "").trim().toUpperCase()
  if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
  return "UP"
}

export default function KPIsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando KPIs...</div>}>
      <KPIsPageContent />
    </Suspense>
  )
}

function KPIsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterKpiType, setFilterKpiType] = useState("Todos")
  const [filterStatus, setFilterStatus] = useState("Todos")

  // ✅ FIXO: anos >= 2025 e meses jan-dez
  const [monthOptions, setMonthOptions] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  const [page, setPage] = useState(1)
  const pageSize = 12

  const [kpisData, setKpisData] = useState<KPIRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createOk, setCreateOk] = useState<string | null>(null)
  const [creationOptionsLoading, setCreationOptionsLoading] = useState(false)
  const [controlOptions, setControlOptions] = useState<ControlOption[]>([])
  const [creationFrameworks, setCreationFrameworks] = useState<string[]>([])

  const [createForm, setCreateForm] = useState<{
    framework: string
    id_control: string
    kpi_name: string
    kpi_description: string
    kpi_type: string
    kpi_evaluation_mode: KpiEvaluationMode
    kpi_target: string
    yellow_ratio: number
    zero_meta_yellow_max: number
  }>({
    framework: "",
    id_control: "",
    kpi_name: "",
    kpi_description: "",
    kpi_type: "Manual",
    kpi_evaluation_mode: "UP",
    kpi_target: "0",
    yellow_ratio: 0.9,
    zero_meta_yellow_max: 1,
  })

  /**
   * ✅ Boot:
   * - monta lista de meses
   * - restaura filtros da URL (periodo, q, framework, tipo, status, page)
   * - garante mês válido
   */
  useEffect(() => {
    const opts = buildMonthOptions(2025)
    setMonthOptions(opts)

    const urlPeriodo = safeText(searchParams.get("periodo") || searchParams.get("period"))
    const urlQ = safeText(searchParams.get("q"))
    const urlFramework = safeText(searchParams.get("framework")) || "Todos"
    const urlTipo = safeText(searchParams.get("tipo")) || "Todos"
    const urlStatus = safeText(searchParams.get("status")) || "Todos"
    const urlPage = clampPage(Number(searchParams.get("page") || 1))

    if (urlQ) setSearchTerm(urlQ)
    if (urlFramework) setFilterFramework(urlFramework)
    if (urlTipo) setFilterKpiType(urlTipo)
    if (urlStatus) setFilterStatus(urlStatus)
    setPage(urlPage)

    const fallbackMonth = resolveReferenceMonth(opts)
    const resolvedMonth = urlPeriodo && opts.includes(urlPeriodo) ? urlPeriodo : fallbackMonth
    setSelectedMonth(resolvedMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * ✅ Mantém filtros na URL (sem sujar histórico)
   */
  useEffect(() => {
    if (!selectedMonth) return

    const qs = buildKpisQuery({
      periodo: selectedMonth,
      q: searchTerm || undefined,
      framework: filterFramework || "Todos",
      tipo: filterKpiType || "Todos",
      status: filterStatus || "Todos",
      page,
    })

    router.replace(qs ? `/kpis?${qs}` : "/kpis")
  }, [selectedMonth, searchTerm, filterFramework, filterKpiType, filterStatus, page, router])

  useEffect(() => {
    async function load() {
      if (!selectedMonth) return

      setLoading(true)
      setLoadError(null)

      try {
        /**
         * ✅ FIX: o backend pode limitar em 100 por request.
         * Então buscamos em páginas com 100 para garantir o total correto (ex: 124).
         */
        const ALL_ROWS: any[] = []
        const FETCH_PAGE_SIZE = 100
        const MAX_PAGES = 500

        for (let p = 1; p <= MAX_PAGES; p++) {
          const result = await fetchKPIs({
            month: selectedMonth,
            page: p,
            pageSize: FETCH_PAGE_SIZE,
          })

          if (!result?.success) {
            setLoadError((result as any)?.error || "Falha ao carregar KPIs do banco.")
            setKpisData([])
            setLoading(false)
            return
          }

          const rowsPage = Array.isArray((result as any).data) ? (result as any).data : []
          if (rowsPage.length === 0) break

          ALL_ROWS.push(...rowsPage)

          if (rowsPage.length < FETCH_PAGE_SIZE) break
        }

        const rows = ALL_ROWS

        const uuids = rows
          .map((r: any) => String(r.kpi_uuid || "").trim())
          .filter(Boolean)

        // ✅ evita payload grande: busca runs em chunks
        const runMap: Record<string, any> = {}
        const CHUNK = 400
        for (let i = 0; i < uuids.length; i += CHUNK) {
          const slice = uuids.slice(i, i + CHUNK)
          const runsRes = await fetchLatestKpiRunsForPeriod(slice, selectedMonth)
          const partial = runsRes?.success && (runsRes as any).data ? (runsRes as any).data : {}
          Object.assign(runMap, partial)
        }

        const mapped: KPIRecord[] = rows.map((r: any) => {
          const id = String(r.kpi_id || r.id || "").trim()
          const kpi_uuid = String(r.kpi_uuid || "").trim()

          const nomeDb = String(r.kpi_name ?? "").trim()
          const nome = nomeDb ? nomeDb : "-"

          const framework = String(r.framework || r.framework_name || "N/A").trim()
          const kpi_type = normalizeKpiType(r.kpi_type)
          const meta = String(r.kpi_target ?? r.meta ?? "0").trim()

          const run = kpi_uuid ? runMap[kpi_uuid] : undefined
          const measuredValue = run?.measured_value ?? null
          const runStatus = run?.status ?? ""
          const grcFinalStatus = String(run?.grc_final_status || "").trim()

          const atual = measuredValue === null ? "-" : toPercentLabel(measuredValue)
          const uiStatus = mapRunStatusToUi(grcFinalStatus || runStatus)

          return {
            id: id || `KPI-${Math.random().toString(16).slice(2)}`,
            kpi_uuid,
            nome,
            framework,
            kpi_type,
            meta: toPercentLabel(meta),
            atual,
            status: uiStatus.label,
            corStatus: uiStatus.dot,
            grc_final_status: grcFinalStatus,
            grc_review_comment: String(run?.grc_review_comment || "").trim(),
          }
        })

        setKpisData(mapped)
      } catch {
        setLoadError("Erro ao conectar com o servidor.")
        setKpisData([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [selectedMonth, reloadTick])

  useEffect(() => {
    async function loadCreationOptions() {
      setCreationOptionsLoading(true)
      try {
        const res = await fetchKpiCreationOptions()
        if (!res?.success) return

        const controls = Array.isArray(res.data?.controls) ? (res.data.controls as ControlOption[]) : []
        const frameworks = Array.isArray(res.data?.frameworks) ? res.data.frameworks.map((f) => String(f)) : []

        setControlOptions(controls)
        setCreationFrameworks(frameworks)
      } finally {
        setCreationOptionsLoading(false)
      }
    }

    loadCreationOptions()
  }, [])

  const availableControlsForCreate = useMemo(() => {
    if (!createForm.framework) return controlOptions
    return controlOptions.filter((c) => safeText(c.framework) === safeText(createForm.framework))
  }, [controlOptions, createForm.framework])

  const resetCreateForm = () => {
    setCreateForm({
      framework: "",
      id_control: "",
      kpi_name: "",
      kpi_description: "",
      kpi_type: "Manual",
      kpi_evaluation_mode: "UP",
      kpi_target: "0",
      yellow_ratio: 0.9,
      zero_meta_yellow_max: 1,
    })
    setCreateError(null)
    setCreateOk(null)
  }

  const onOpenCreateModal = () => {
    resetCreateForm()
    setIsCreateModalOpen(true)
  }

  const onSaveNewIndicator = async () => {
    if (savingCreate) return
    setCreateError(null)
    setCreateOk(null)

    if (!safeText(createForm.id_control)) {
      setCreateError("Selecione o controle associado ao KPI.")
      return
    }
    if (!safeText(createForm.kpi_name)) {
      setCreateError("Preencha o nome do KPI.")
      return
    }
    if (!safeText(createForm.kpi_target)) {
      setCreateError("Preencha a meta do KPI.")
      return
    }

    setSavingCreate(true)
    try {
      const res = await createKpiFromCatalog({
        id_control: createForm.id_control,
        kpi_name: createForm.kpi_name,
        kpi_description: createForm.kpi_description,
        kpi_type: createForm.kpi_type,
        kpi_target: createForm.kpi_target,
        kpi_evaluation_mode: normalizeMode(createForm.kpi_evaluation_mode),
        yellow_ratio: createForm.yellow_ratio,
        zero_meta_yellow_max: createForm.zero_meta_yellow_max,
        reference_month: selectedMonth || null,
      })

      if (!res?.success) {
        setCreateError(res?.error || "Falha ao criar KPI.")
        return
      }

      setCreateOk("KPI criado com sucesso.")
      setIsCreateModalOpen(false)
      setReloadTick((v) => v + 1)
    } catch {
      setCreateError("Falha ao criar KPI.")
    } finally {
      setSavingCreate(false)
    }
  }

  const frameworkOptions = useMemo(() => {
    return Array.from(new Set(kpisData.map((k) => safeText(k.framework)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [kpisData])

  const typeOptions = useMemo(() => {
    const fromData = Array.from(new Set(kpisData.map((k) => safeText(k.kpi_type)).filter(Boolean)))
    const fixed = ["Manual", "Automated"]
    return Array.from(new Set([...fixed, ...fromData])).sort((a, b) => a.localeCompare(b))
  }, [kpisData])

  /**
   * ✅ Filtros garantidos:
   * - Busca: nome OU id
   * - Framework/Tipo: match exato (dropdown)
   * - Status: match exato (dropdown; usa labels da UI)
   * ✅ NOVO: ordena por Código do menor para o maior (01..100..)
   */
  const filteredKPIs = useMemo(() => {
    const s = searchTerm.trim().toLowerCase()

    const filtered = kpisData.filter((kpi) => {
      const matchSearch =
        !s ||
        safeText(kpi.nome).toLowerCase().includes(s) ||
        safeText(kpi.id).toLowerCase().includes(s)

      const matchFramework = filterFramework === "Todos" || safeText(kpi.framework) === safeText(filterFramework)
      const matchType = filterKpiType === "Todos" || safeText(kpi.kpi_type) === safeText(filterKpiType)
      const matchStatus = filterStatus === "Todos" || safeText(kpi.status) === safeText(filterStatus)

      return matchSearch && matchFramework && matchType && matchStatus
    })

    return filtered
      .slice()
      .sort((a, b) => {
        const na = extractKpiNumber(a.id)
        const nb = extractKpiNumber(b.id)
        if (na !== nb) return na - nb
        return String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true, sensitivity: "base" })
      })
  }, [kpisData, searchTerm, filterFramework, filterKpiType, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filteredKPIs.length / pageSize))
  const canPrev = page > 1
  const canNext = page < totalPages

  const paginatedKPIs = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * pageSize
    return filteredKPIs.slice(start, start + pageSize)
  }, [filteredKPIs, page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, filterFramework, filterKpiType, filterStatus, selectedMonth])

  const stats = useMemo(() => {
    const total = filteredKPIs.length
    const atingidas = filteredKPIs.filter((k) => k.status === "Green").length
    const abaixo = filteredKPIs.filter((k) => k.status !== "Green").length
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

  // ✅ query atual para propagar no "Analisar"
  const currentQuery = useMemo(() => {
    return buildKpisQuery({
      periodo: selectedMonth,
      q: searchTerm || undefined,
      framework: filterFramework,
      tipo: filterKpiType,
      status: filterStatus,
      page,
    })
  }, [selectedMonth, searchTerm, filterFramework, filterKpiType, filterStatus, page])

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Indicadores de Performance (KPIs)</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            Monitore as métricas de conformidade e performance em tempo real.
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#f71866]/20 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Novo Indicador
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<Target className="text-emerald-500" />} label="Metas Atingidas" value={`${stats.perc}%`} bgColor="bg-emerald-50" />
        <StatSmallCard icon={<TrendingUp className="text-[#f71866]" />} label="Performance Global" value={stats.perfLabel} bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertCircle className="text-amber-500" />} label="Abaixo da Meta" value={String(stats.abaixo).padStart(2, "0")} bgColor="bg-amber-50" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 items-center">
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

          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all text-sm"
              placeholder="Buscar por Código ou Nome..."
            />
          </div>

          <select
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Framework (Todos)</option>
            {frameworkOptions.map((fw) => (
              <option key={fw} value={fw}>
                {fw}
              </option>
            ))}
          </select>

          <select
            value={filterKpiType}
            onChange={(e) => setFilterKpiType(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Categoria (Todos)</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Status (Todos)</option>
            <option value="Green">Green</option>
            <option value="Yellow">Yellow</option>
            <option value="Red">Red</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm("")
              setFilterFramework("Todos")
              setFilterKpiType("Todos")
              setFilterStatus("Todos")

              setSelectedMonth(resolveReferenceMonth(monthOptions, getPreviousMonthISO()))

              setPage(1)
            }}
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

        {createOk && (
          <div className="mt-4 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {createOk}
          </div>
        )}
      </div>

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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10">
                    <div className="flex items-center justify-center gap-2 text-slate-400 font-bold text-sm">
                      <Loader2 className="animate-spin" size={18} />
                      Carregando KPIs do banco...
                    </div>
                  </td>
                </tr>
              ) : paginatedKPIs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <AlertCircle size={26} strokeWidth={1.5} />
                      <p className="text-sm font-medium">Nenhum KPI encontrado com os filtros atuais.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedKPIs.map((item) => {
                  const st = mapRunStatusToUi(item.status)
                  return (
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
                        <span className={st.text}>{item.atual}</span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${st.dot}`}></span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{item.status}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={() =>
                              router.push(
                                `/kpis/${encodeURIComponent(item.id)}${currentQuery ? `?${currentQuery}` : ""}`
                              )
                            }
                            className="px-4 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                          >
                            Analisar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{paginatedKPIs.length}</span> de{" "}
            <span className="font-bold text-slate-700">{filteredKPIs.length}</span> indicadores
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => canPrev && setPage((p) => p - 1)}
              disabled={!canPrev || loading}
              className={`p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all ${
                !canPrev || loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-[11px] font-bold text-slate-400 px-2">
              {Math.min(page, totalPages)} / {totalPages}
            </div>

            <button
              onClick={() => canNext && setPage((p) => p + 1)}
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (savingCreate) return
              setIsCreateModalOpen(false)
            }}
          />

          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cadastrar Novo KPI</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Defina o vínculo com framework/controle e as regras de avaliação da métrica.
                </p>
              </div>

              <button
                onClick={() => !savingCreate && setIsCreateModalOpen(false)}
                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 transition-all"
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Framework</label>
                  <select
                    value={createForm.framework}
                    onChange={(e) => {
                      const nextFramework = e.target.value
                      setCreateForm((prev) => {
                        const sameControl = controlOptions.find((c) => c.id_control === prev.id_control)
                        const keepControl = sameControl && sameControl.framework === nextFramework
                        return {
                          ...prev,
                          framework: nextFramework,
                          id_control: keepControl ? prev.id_control : "",
                        }
                      })
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                  >
                    <option value="">Selecione um framework</option>
                    {creationFrameworks.map((fw) => (
                      <option key={fw} value={fw}>
                        {fw}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle</label>
                  <select
                    value={createForm.id_control}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, id_control: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                  >
                    <option value="">{creationOptionsLoading ? "Carregando controles..." : "Selecione um controle"}</option>
                    {availableControlsForCreate.map((control) => (
                      <option key={control.id_control} value={control.id_control}>
                        {control.id_control} - {control.name_control || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do KPI</label>
                  <input
                    value={createForm.kpi_name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, kpi_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                    placeholder="Ex.: Cobertura de treinamento acima da meta"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</label>
                  <select
                    value={createForm.kpi_type}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, kpi_type: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Automated">Automated</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição e regra de métrica</label>
                <textarea
                  value={createForm.kpi_description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, kpi_description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866] min-h-[96px]"
                  placeholder="Descreva a fórmula, fonte de dados, periodicidade, limites e observações da métrica."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modo de avaliação</label>
                  <select
                    value={createForm.kpi_evaluation_mode}
                    onChange={(e) =>
                      setCreateForm((prev) => {
                        const mode = normalizeMode(e.target.value)
                        return {
                          ...prev,
                          kpi_evaluation_mode: mode,
                          kpi_target: mode === "BOOLEAN" ? "true" : prev.kpi_target || "0",
                        }
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                  >
                    <option value="UP">Quanto maior, melhor (UP)</option>
                    <option value="DOWN">Quanto menor, melhor (DOWN)</option>
                    <option value="BOOLEAN">Sim / Não (BOOLEAN)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Meta</label>
                  {createForm.kpi_evaluation_mode === "BOOLEAN" ? (
                    <select
                      value={String(createForm.kpi_target).toLowerCase() === "false" ? "false" : "true"}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, kpi_target: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                    >
                      <option value="true">Sim (true)</option>
                      <option value="false">Não (false)</option>
                    </select>
                  ) : (
                    <input
                      value={createForm.kpi_target}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, kpi_target: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                      placeholder="Ex.: 95"
                    />
                  )}
                </div>
              </div>

              {createForm.kpi_evaluation_mode !== "BOOLEAN" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Faixa YELLOW (yellow_ratio)</label>
                    <input
                      type="number"
                      min={0.01}
                      max={0.999}
                      step={0.01}
                      value={createForm.yellow_ratio}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, yellow_ratio: Number(e.target.value || 0.9) }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buffer YELLOW DOWN</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={createForm.zero_meta_yellow_max}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, zero_meta_yellow_max: Number(e.target.value || 1) }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f71866]"
                    />
                  </div>
                </div>
              )}

              {createError && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  {createError}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 p-5 flex items-center justify-end gap-2">
              <button
                onClick={() => !savingCreate && setIsCreateModalOpen(false)}
                disabled={savingCreate}
                className={`px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-widest hover:bg-white transition-all ${
                  savingCreate ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={onSaveNewIndicator}
                disabled={savingCreate}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-[#f71866] hover:bg-[#d61556] inline-flex items-center gap-2 ${
                  savingCreate ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {savingCreate ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Salvar KPI
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
