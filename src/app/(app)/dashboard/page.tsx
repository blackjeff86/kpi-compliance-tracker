"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Eye,
  Loader2,
  ShieldCheck,
  Table2,
} from "lucide-react"
import { fetchDashboardData } from "./actions"
import { getPreviousMonthISO, resolveReferenceMonth } from "@/lib/utils"

type DashboardItem = {
  kpiRef: string
  code: string
  title: string
  kpi: string
  status: "Red"
  risk: string
  owner: string
  framework: string
  periodo: string
}

type ChartPoint = {
  period: string
  green: number
  yellow: number
  red: number
}

type FrameworkChartPoint = {
  framework: string
  green: number
  yellow: number
  red: number
  total: number
}

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function formatPeriodLabel(periodISO: string) {
  const m = periodISO.match(/^(\d{4})-(\d{2})$/)
  if (!m) return periodISO

  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  const yy = m[1].slice(2)
  const mm = Number(m[2])
  const month = months[mm - 1] || m[2]
  return `${month}/${yy}`
}

function formatPeriodOption(periodISO: string) {
  const m = periodISO.match(/^(\d{4})-(\d{2})$/)
  if (!m) return periodISO

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]
  const month = months[Number(m[2]) - 1] || m[2]
  return `${month} ${m[1]}`
}

function toPercent(value: number, total: number) {
  if (!total) return "0%"
  const pct = (value / total) * 100
  return `${Math.round(pct)}%`
}

function formatChartValue(value: number | string | readonly (number | string)[] | undefined, unit: "ABS" | "PCT") {
  if (Array.isArray(value)) {
    const first = value[0]
    const n = Number(first)
    if (!Number.isFinite(n)) return "-"
    return unit === "PCT" ? `${n}%` : n
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return "-"
  return unit === "PCT" ? `${n}%` : n
}

export default function DashboardPage() {
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterPeriodo, setFilterPeriodo] = useState(getPreviousMonthISO())

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chartView, setChartView] = useState<"TREND" | "FRAMEWORK">("TREND")
  const [chartUnit, setChartUnit] = useState<"ABS" | "PCT">("ABS")

  const [frameworkOptions, setFrameworkOptions] = useState<string[]>([])
  const [periodOptions, setPeriodOptions] = useState<string[]>([])
  const [selectedPeriodResolved, setSelectedPeriodResolved] = useState("")

  const [summary, setSummary] = useState({
    greenCount: 0,
    yellowCount: 0,
    redCount: 0,
    total: 0,
    applicableControls: 0,
    coveredApplicableControls: 0,
    partialApplicableControls: 0,
    notApplicableControls: 0,
    pendingReviews: 0,
    overduePlans: 0,
  })
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [chartByFramework, setChartByFramework] = useState<FrameworkChartPoint[]>([])
  const [tableItems, setTableItems] = useState<DashboardItem[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)

      const framework = filterFramework === "Todos" ? "" : filterFramework
      const period = filterPeriodo

      const result = await fetchDashboardData({ framework, period })
      if (!result.success) {
        setLoadError(result.error || "Erro ao carregar dashboard.")
        setLoading(false)
        return
      }

      const payload = result.data
      setFrameworkOptions(payload.frameworkOptions)
      setPeriodOptions((prev) => {
        const merged = new Set<string>([...prev, ...payload.periodOptions, filterPeriodo])
        return Array.from(merged).sort((a, b) => b.localeCompare(a))
      })
      setSelectedPeriodResolved(payload.selectedPeriod)
      setSummary(payload.summary)
      setChartData(payload.chartData)
      setChartByFramework(Array.isArray(payload.chartByFramework) ? payload.chartByFramework : [])
      setTableItems(payload.immediateItems)
      setLoading(false)
    }

    load()
  }, [filterFramework, filterPeriodo])

  const filteredTableData = useMemo(() => {
    return tableItems.filter((item) => {
      const matchFramework = filterFramework === "Todos" || item.framework === filterFramework
      const matchPeriodo = item.periodo === filterPeriodo
      return matchFramework && matchPeriodo
    })
  }, [tableItems, filterFramework, filterPeriodo])

  const chartDataUi = useMemo(() => {
    return chartData.map((item) => {
      const total = item.green + item.yellow + item.red || 1
      return {
        name: formatPeriodLabel(item.period),
        Green: chartUnit === "PCT" ? Number(((item.green / total) * 100).toFixed(1)) : item.green,
        Yellow: chartUnit === "PCT" ? Number(((item.yellow / total) * 100).toFixed(1)) : item.yellow,
        Red: chartUnit === "PCT" ? Number(((item.red / total) * 100).toFixed(1)) : item.red,
      }
    })
  }, [chartData, chartUnit])

  const chartByFrameworkUi = useMemo(() => {
    const sorted = [...chartByFramework]
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.framework.localeCompare(b.framework))

    const topLimit = 8
    const top = sorted.slice(0, topLimit)
    const tail = sorted.slice(topLimit)

    if (tail.length > 0) {
      const other = tail.reduce(
        (acc, item) => ({
          framework: "Outros",
          green: acc.green + item.green,
          yellow: acc.yellow + item.yellow,
          red: acc.red + item.red,
          total: acc.total + item.total,
        }),
        { framework: "Outros", green: 0, yellow: 0, red: 0, total: 0 },
      )
      top.push(other)
    }

    return top.map((row) => {
      const total = row.total || 1
      const greenPct = Number(((row.green / total) * 100).toFixed(1))
      const yellowPct = Number(((row.yellow / total) * 100).toFixed(1))
      const redPct = Number(((row.red / total) * 100).toFixed(1))

      return {
        name: row.framework,
        total: row.total,
        Green: chartUnit === "PCT" ? greenPct : row.green,
        Yellow: chartUnit === "PCT" ? yellowPct : row.yellow,
        Red: chartUnit === "PCT" ? redPct : row.red,
      }
    })
  }, [chartByFramework, chartUnit])

  const effectiveControls = summary.greenCount + summary.yellowCount
  const applicableControls = summary.applicableControls
  const coveredApplicableControls = summary.coveredApplicableControls
  const partialApplicableControls = summary.partialApplicableControls
  const notApplicableControls = summary.notApplicableControls

  const limparFiltros = () => {
    setFilterFramework("Todos")
    setFilterPeriodo(resolveReferenceMonth(periodOptions))
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Visão geral dos KPIs e status de remediação.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={filterFramework}
              onChange={(e) => setFilterFramework(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm outline-none appearance-none pr-10 cursor-pointer focus:border-[#f71866]"
            >
              <option value="Todos">Framework: Todos</option>
              {frameworkOptions.map((item) => (
                <option key={item} value={item}>{`Framework: ${item}`}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterPeriodo}
              onChange={(e) => setFilterPeriodo(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm outline-none appearance-none pr-10 cursor-pointer focus:border-[#f71866]"
            >
              {periodOptions.map((item) => (
                <option key={item} value={item}>{`Período: ${formatPeriodOption(item)}`}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={limparFiltros}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors px-2"
          >
            Limpar Filtros
          </button>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : null}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 h-[260px] flex items-center justify-center">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dashboard...
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatusCard
              label="Totalidade de Controles"
              value={String(summary.total)}
              subValue="Controles no escopo filtrado"
              color="slate"
              icon={<Table2 />}
            />
            <StatusCard
              label="KPI Coverage Rate"
              value={toPercent(coveredApplicableControls, applicableControls)}
              subValue={`${coveredApplicableControls} de ${applicableControls} controles com execução (${partialApplicableControls} parciais | ${notApplicableControls} N/A fora da conta)`}
              color="amber"
              icon={<BarChart3 />}
            />
            <StatusCard
              label="Effectiveness Rate"
              value={toPercent(effectiveControls, applicableControls)}
              subValue={`${effectiveControls} de ${applicableControls} controles efetivos (${partialApplicableControls} parciais | ${notApplicableControls} N/A fora da conta)`}
              color="emerald"
              icon={<ShieldCheck />}
            />

            <div className="bg-slate-900 p-6 rounded-xl shadow-lg shadow-slate-200 group">
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pendências</p>
                <AlertCircle className="text-slate-500 h-5 w-5" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Revisões pendentes</span>
                  <span className="text-[#f71866] font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded">{String(summary.pendingReviews).padStart(2, "0")}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Planos atrasados</span>
                  <span className="text-[#f71866] font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded">{String(summary.overduePlans).padStart(2, "0")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChartView("TREND")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${
                    chartView === "TREND" ? "bg-[#f71866] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Tendência
                </button>
                <button
                  onClick={() => setChartView("FRAMEWORK")}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${
                    chartView === "FRAMEWORK" ? "bg-[#f71866] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Por Framework
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChartUnit("ABS")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                    chartUnit === "ABS" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Qtd
                </button>
                <button
                  onClick={() => setChartUnit("PCT")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                    chartUnit === "PCT" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                {chartView === "TREND" ? "Tendência - Últimos 6 Períodos" : "Comparativo por Framework"}
              </h3>
              <div className="text-xs text-slate-400 font-semibold">Período base: {safeText(selectedPeriodResolved) || "N/A"}</div>
            </div>
            <div className="h-[320px] w-full">
              {chartView === "TREND" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataUi} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }} dy={10} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                      domain={chartUnit === "PCT" ? [0, 100] : undefined}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value) => formatChartValue(value, chartUnit)}
                    />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: "30px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }} />
                    <Bar dataKey="Green" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    <Bar dataKey="Yellow" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                    <Bar dataKey="Red" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : chartByFrameworkUi.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartByFrameworkUi} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                      domain={chartUnit === "PCT" ? [0, 100] : undefined}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value) => formatChartValue(value, chartUnit)}
                    />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: "30px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }} />
                    <Bar dataKey="Green" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={22} />
                    <Bar dataKey="Yellow" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={22} />
                    <Bar dataKey="Red" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-slate-400 font-medium">
                  Sem dados por framework no período selecionado.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-lg font-bold text-slate-800">Atenção Imediata</h3>
              <span className="bg-[#f71866]/10 text-[#f71866] text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border border-[#f71866]/10">
                {filteredTableData.length} itens encontrados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Controle</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI Afetado</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Criticidade</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTableData.length > 0 ? (
                    filteredTableData.map((item, index) => <TableRow key={`${item.code}-${item.kpi}-${index}`} {...item} />)
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-sm italic">
                        Nenhum item crítico encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatusCard({
  label,
  value,
  subValue,
  color,
  icon,
}: {
  label: string
  value: string
  subValue: string
  color: "slate" | "emerald" | "amber" | "red"
  icon: React.ReactElement<{ className?: string }>
}) {
  const colorMap: Record<string, string> = {
    slate: "text-slate-700 border-slate-200 bg-slate-100",
    emerald: "text-emerald-600 border-emerald-200 bg-emerald-50",
    amber: "text-amber-500 border-amber-200 bg-amber-50",
    red: "text-red-600 border-red-200 bg-red-50",
  }

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm hover:border-slate-200 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <h3 className={`text-4xl font-bold mt-1 ${colorMap[color].split(" ")[0]}`}>{value}</h3>
          <p className="text-[10px] font-bold mt-1 uppercase opacity-70">{subValue}</p>
        </div>
        <div className={`${colorMap[color].split(" ")[2]} p-2 rounded-lg`}>
          {React.cloneElement(icon, { className: `h-6 w-6 ${colorMap[color].split(" ")[0]}` })}
        </div>
      </div>
    </div>
  )
}

function TableRow({ kpiRef, code, title, kpi, status, risk, owner, periodo }: DashboardItem) {
  const initials = owner
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()


  const actionHref =
    code && kpiRef && periodo
      ? `/controles/execucao/${encodeURIComponent(code)}?periodo=${encodeURIComponent(periodo)}&kpi=${encodeURIComponent(kpiRef)}`
      : ""

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="py-4 px-8 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase">{code}</span>
          <span className="text-sm font-bold text-slate-700">{title}</span>
        </div>
      </td>
      <td className="py-4 px-8 text-xs font-medium text-slate-600">{kpi}</td>
      <td className="py-4 px-8 text-center">
        <span
          className="inline-flex px-2.5 py-1 rounded text-[10px] font-bold uppercase border bg-red-50 text-red-600 border-red-100"
        >
          {status}
        </span>
      </td>
      <td className="py-4 px-8 text-center">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-400 border border-red-100 uppercase">{risk}</span>
      </td>
      <td className="py-4 px-8">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 uppercase">{initials || "NA"}</div>
          <span className="text-xs font-semibold text-slate-700">{owner}</span>
        </div>
      </td>
      <td className="py-4 px-8 text-right">
        <Link
          href={actionHref || "#"}
          aria-disabled={!actionHref}
          className={`inline-flex p-2 transition-colors ${
            actionHref ? "text-slate-400 hover:text-[#f71866]" : "text-slate-300 pointer-events-none"
          }`}
          title={actionHref ? `Abrir execução do KPI no período ${periodo}` : "KPI indisponível"}
        >
          <Eye size={18} />
        </Link>
      </td>
    </tr>
  )
}
