"use client"

import React, { useEffect, useMemo, useState } from "react"
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
  CheckCircle2,
  Clock,
  ChevronDown,
  Eye,
  Loader2,
} from "lucide-react"
import { fetchDashboardData } from "./actions"

type DashboardItem = {
  code: string
  title: string
  kpi: string
  status: "Red" | "Yellow"
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

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function getCurrentPeriodISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
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

function controlsSubValue(count: number, total: number) {
  return `${count} de ${total} Controles`
}

export default function DashboardPage() {
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterPeriodo, setFilterPeriodo] = useState(getCurrentPeriodISO())

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [frameworkOptions, setFrameworkOptions] = useState<string[]>([])
  const [periodOptions, setPeriodOptions] = useState<string[]>([])
  const [selectedPeriodResolved, setSelectedPeriodResolved] = useState("")

  const [summary, setSummary] = useState({
    greenCount: 0,
    yellowCount: 0,
    redCount: 0,
    total: 0,
    pendingReviews: 0,
    overduePlans: 0,
  })
  const [chartData, setChartData] = useState<ChartPoint[]>([])
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
      setPeriodOptions(payload.periodOptions)
      setSelectedPeriodResolved(payload.selectedPeriod)
      setSummary(payload.summary)
      setChartData(payload.chartData)
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
    return chartData.map((item) => ({
      name: formatPeriodLabel(item.period),
      Green: item.green,
      Yellow: item.yellow,
      Red: item.red,
    }))
  }, [chartData])

  const limparFiltros = () => {
    setFilterFramework("Todos")
    setFilterPeriodo(getCurrentPeriodISO())
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
            <StatusCard label="Green" value={toPercent(summary.greenCount, summary.total)} subValue={controlsSubValue(summary.greenCount, summary.total)} color="emerald" icon={<CheckCircle2 />} />
            <StatusCard label="Yellow" value={toPercent(summary.yellowCount, summary.total)} subValue={controlsSubValue(summary.yellowCount, summary.total)} color="amber" icon={<AlertCircle />} />
            <StatusCard label="Red" value={toPercent(summary.redCount, summary.total)} subValue={controlsSubValue(summary.redCount, summary.total)} color="red" icon={<AlertCircle />} />

            <div className="bg-slate-900 p-6 rounded-xl shadow-lg shadow-slate-200 group">
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pendências</p>
                <Clock className="text-slate-500 h-5 w-5" />
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
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Tendência - Últimos 6 Períodos</h3>
              <div className="text-xs text-slate-400 font-semibold">Período base: {safeText(selectedPeriodResolved) || "N/A"}</div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataUi} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: "30px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }} />
                  <Bar dataKey="Green" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="Yellow" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="Red" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
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
  color: "emerald" | "amber" | "red"
  icon: React.ReactElement<{ className?: string }>
}) {
  const colorMap: Record<string, string> = {
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

function TableRow({ code, title, kpi, status, risk, owner }: DashboardItem) {
  const initials = owner
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

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
          className={`inline-flex px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${
            status === "Red" ? "bg-red-50 text-red-600 border-red-100" : "bg-amber-50 text-amber-600 border-amber-100"
          }`}
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
        <button className="p-2 text-slate-400 hover:text-[#f71866] transition-colors">
          <Eye size={18} />
        </button>
      </td>
    </tr>
  )
}
