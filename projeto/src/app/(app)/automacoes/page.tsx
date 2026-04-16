"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Bot,
  CalendarDays,
  User,
  Plus,
} from "lucide-react"
import { type AutomacaoInventario } from "@/data/automacoes-inventario"
import { fetchAutomationInventoryList } from "@/app/(app)/automacoes/actions"
import { NovaAutomacaoModal } from "@/app/(app)/automacoes/NovaAutomacaoModal"

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function isEmptyValue(v: unknown) {
  const s = safeText(v)
  return !s || s === "-"
}

function formatPtDate(iso: string | null | undefined) {
  const s = safeText(iso)
  if (!s || s === "-") return "—"
  const d = new Date(s + "T12:00:00")
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("pt-BR")
}

function buildAutomacoesQuery(params: {
  q?: string
  controle?: string
  owner?: string
  freq?: string
  kpi?: string
  page?: number
}) {
  const sp = new URLSearchParams()
  if (params.q) sp.set("q", params.q)
  if (params.controle && params.controle !== "Todos") sp.set("controle", params.controle)
  if (params.owner && params.owner !== "Todos") sp.set("owner", params.owner)
  if (params.freq && params.freq !== "Todos") sp.set("freq", params.freq)
  if (params.kpi && params.kpi !== "Todos") sp.set("kpi", params.kpi)
  if (params.page && params.page !== 1) sp.set("page", String(params.page))
  return sp.toString()
}

function rowSearchBlob(row: AutomacaoInventario) {
  const base = Object.values(row)
    .filter((v) => v !== null && v !== undefined)
    .map((v) => String(v))
    .join(" ")
  const kpiHint = row.kpiMonitoramentoHabilitado
    ? "sim alerta configurado sistema incidentes"
    : "nao sem alerta configurado"
  return `${base} ${kpiHint}`.toLowerCase()
}

function clampPage(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 1) return 1
  return Math.floor(x)
}

export default function AutomacoesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando inventário...</div>}>
      <AutomacoesPageContent />
    </Suspense>
  )
}

function AutomacoesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [inventory, setInventory] = useState<AutomacaoInventario[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalNovaOpen, setModalNovaOpen] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterControle, setFilterControle] = useState("Todos")
  const [filterOwner, setFilterOwner] = useState("Todos")
  const [filterFreq, setFilterFreq] = useState("Todos")
  const [filterKpi, setFilterKpi] = useState("Todos")
  const [page, setPage] = useState(1)
  const pageSize = 12

  const loadInventory = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = Boolean(opts?.soft)
    if (!soft) {
      setLoading(true)
      setLoadError(null)
    }
    const res = await fetchAutomationInventoryList()
    if (!res.success) {
      setLoadError(res.error)
      setInventory([])
    } else {
      setInventory(res.data)
    }
    if (!soft) setLoading(false)
  }, [])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  useEffect(() => {
    const urlQ = safeText(searchParams.get("q"))
    const urlControle = safeText(searchParams.get("controle")) || "Todos"
    const urlOwner = safeText(searchParams.get("owner")) || "Todos"
    const urlFreq = safeText(searchParams.get("freq")) || "Todos"
    const urlKpi = safeText(searchParams.get("kpi")) || "Todos"
    const urlPage = clampPage(Number(searchParams.get("page") || 1))

    if (urlQ) setSearchTerm(urlQ)
    setFilterControle(urlControle)
    setFilterOwner(urlOwner)
    setFilterFreq(urlFreq)
    setFilterKpi(urlKpi === "Sim" || urlKpi === "Não" ? urlKpi : "Todos")
    setPage(urlPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const qs = buildAutomacoesQuery({
      q: searchTerm || undefined,
      controle: filterControle,
      owner: filterOwner,
      freq: filterFreq,
      kpi: filterKpi,
      page,
    })
    router.replace(qs ? `/automacoes?${qs}` : "/automacoes")
  }, [searchTerm, filterControle, filterOwner, filterFreq, filterKpi, page, router])

  const controleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of inventory) {
      const c = safeText(r["Controle SOX"])
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [inventory])

  const ownerOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of inventory) {
      const o = safeText(r["Owner automação"])
      if (o) set.add(o)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [inventory])

  const freqOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of inventory) {
      const f = safeText(r["Frequencia automação"])
      if (f) set.add(f)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [inventory])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return inventory.filter((row) => {
      const matchQ = !q || rowSearchBlob(row).includes(q)

      const c = safeText(row["Controle SOX"])
      const matchC = filterControle === "Todos" || c === filterControle

      const o = safeText(row["Owner automação"])
      const matchO = filterOwner === "Todos" || o === filterOwner

      const f = safeText(row["Frequencia automação"])
      const matchF = filterFreq === "Todos" || f === filterFreq

      const matchKpi =
        filterKpi === "Todos" ||
        (filterKpi === "Sim" && row.kpiMonitoramentoHabilitado) ||
        (filterKpi === "Não" && !row.kpiMonitoramentoHabilitado)

      return matchQ && matchC && matchO && matchF && matchKpi
    }).sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true, sensitivity: "base" }))
  }, [inventory, searchTerm, filterControle, filterOwner, filterFreq, filterKpi])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const canPrev = page > 1
  const canNext = page < totalPages

  const paginated = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, filterControle, filterOwner, filterFreq, filterKpi])

  const stats = useMemo(() => {
    const total = filtered.length
    const comKpi = filtered.filter((r) => r.kpiMonitoramentoHabilitado).length
    const incompletos = filtered.filter((r) => isEmptyValue(r["Nome automação"]) && isEmptyValue(r["Objetivo automação"])).length
    return { total, comKpi, incompletos }
  }, [filtered])

  const currentQuery = useMemo(() => {
    return buildAutomacoesQuery({
      q: searchTerm || undefined,
      controle: filterControle,
      owner: filterOwner,
      freq: filterFreq,
      kpi: filterKpi,
      page,
    })
  }, [searchTerm, filterControle, filterOwner, filterFreq, filterKpi, page])

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <NovaAutomacaoModal
        open={modalNovaOpen}
        onClose={() => setModalNovaOpen(false)}
        onCreated={() => loadInventory({ soft: true })}
      />

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventário de Automações</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            Visão consolidada das automações mapeadas no controle SOX (aba Inventário Automações). A tabela abaixo é
            carregada diretamente da tabela <span className="font-mono text-slate-600">automation_inventory</span> no
            banco de dados.
          </p>
          {loadError ? (
            <p className="mt-2 text-xs font-semibold text-red-600">
              Não foi possível carregar do banco: {loadError}
            </p>
          ) : null}
        </div>
        <div className="flex w-full shrink-0 justify-end md:w-auto">
          <button
            type="button"
            onClick={() => setModalNovaOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f71866] to-[#e01558] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#f71866]/25 transition hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            Nova automação
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <StatSmallCard
          icon={<Bot className="text-[#f71866]" />}
          label="Registros (filtro)"
          value={String(stats.total).padStart(2, "0")}
          bgColor="bg-[#f71866]/5"
        />
        <StatSmallCard
          icon={<CalendarDays className="text-emerald-500" />}
          label="Com alerta (filtro)"
          value={String(stats.comKpi).padStart(2, "0")}
          bgColor="bg-emerald-50"
        />
        <StatSmallCard
          icon={<AlertCircle className="text-amber-500" />}
          label="Cadastro incompleto"
          value={String(stats.incompletos).padStart(2, "0")}
          bgColor="bg-amber-50"
        />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7 lg:items-center">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all text-sm"
              placeholder="Buscar em qualquer campo..."
            />
          </div>

          <select
            value={filterControle}
            onChange={(e) => setFilterControle(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Controle SOX (Todos)</option>
            {controleOptions.map((c) => (
              <option key={c} value={c}>
                {c.length > 56 ? `${c.slice(0, 54)}…` : c}
              </option>
            ))}
          </select>

          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Owner (Todos)</option>
            {ownerOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={filterFreq}
            onChange={(e) => setFilterFreq(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Frequência (Todas)</option>
            {freqOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={filterKpi}
            onChange={(e) => setFilterKpi(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Alerta (Todos)</option>
            <option value="Sim">Com alerta configurado</option>
            <option value="Não">Sem alerta configurado</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("")
              setFilterControle("Todos")
              setFilterOwner("Todos")
              setFilterFreq("Todos")
              setFilterKpi("Todos")
              setPage(1)
            }}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-slate-600 transition-colors py-2"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm font-medium text-slate-500">Carregando inventário…</div>
        ) : null}
        <div className={`overflow-x-auto ${loading ? "hidden" : ""}`}>
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  ID
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">
                  Controle SOX
                </th>
                <th className="min-w-[220px] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Nome Jira
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  Owner
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                  Frequência
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                  Alerta KPI
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                  Data inicial
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                  Ação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <AlertCircle size={26} strokeWidth={1.5} />
                      <p className="text-sm font-medium">Nenhum registro encontrado com os filtros atuais.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((row) => {
                  const incompleto = isEmptyValue(row["Nome automação"]) && isEmptyValue(row["Objetivo automação"])
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {row.id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-medium text-slate-600 line-clamp-3">
                          {safeText(row["Controle SOX"]) || "—"}
                        </span>
                        {incompleto ? (
                          <span className="mt-1 inline-flex text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                            Incompleto
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="max-w-md text-[11px] font-semibold leading-snug text-slate-800">
                          {safeText(row["Nome Jira"]) || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {safeText(row["Owner automação"]) || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-600 border border-slate-200 px-2 py-1 rounded bg-white uppercase">
                          {safeText(row["Frequencia automação"]) || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            row.kpiMonitoramentoHabilitado
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.kpiMonitoramentoHabilitado ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap text-xs font-bold text-slate-500">
                        {formatPtDate(row["Data inicial da automação"])}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/automacoes/${encodeURIComponent(row.id)}${currentQuery ? `?${currentQuery}` : ""}`
                            )
                          }
                          className="px-4 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                        >
                          Detalhar
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading ? (
          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Mostrando <span className="font-bold text-slate-700">{paginated.length}</span> de{" "}
              <span className="font-bold text-slate-700">{filtered.length}</span> automações
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => canPrev && setPage((p) => p - 1)}
                disabled={!canPrev}
                className={`p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all ${
                  !canPrev ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-[11px] font-bold text-slate-400 px-2">
                {Math.min(page, totalPages)} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => canNext && setPage((p) => p + 1)}
                disabled={!canNext}
                className={`p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all ${
                  !canNext ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StatSmallCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  bgColor: string
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm group hover:border-[#f71866]/20 transition-all">
      <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center`}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { size: 24 } as { size?: number }) : icon}
      </div>
      <div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
    </div>
  )
}
