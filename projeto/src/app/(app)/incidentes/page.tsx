"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
} from "lucide-react"
import {
  INCIDENTES,
  formatIncidentDisplayId,
  type Incidente,
  type IncidentSeverity,
  type IncidentStatus,
  severityLabel,
  statusLabel,
} from "@/data/incidentes"
import { getAutomacaoById } from "@/data/automacoes-inventario"

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function controleSoxForIncident(row: Incidente): string {
  if (!row.automacaoInventarioId) return ""
  const auto = getAutomacaoById(row.automacaoInventarioId)
  return safeText(auto?.["Controle SOX"])
}

function nomeJiraForIncident(row: Incidente): string {
  if (!row.automacaoInventarioId) return ""
  const auto = getAutomacaoById(row.automacaoInventarioId)
  return safeText(auto?.["Nome Jira"])
}

function rowSearchBlob(row: Incidente) {
  return [
    row.id,
    row.titulo,
    row.nomeAutomacao,
    row.triggerName,
    row.affectedObject,
    controleSoxForIncident(row),
    nomeJiraForIncident(row),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function clampPage(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 1) return 1
  return Math.floor(x)
}

function buildIncidentesQuery(params: { q?: string; severidade?: string; status?: string; page?: number }) {
  const sp = new URLSearchParams()
  if (params.q) sp.set("q", params.q)
  if (params.severidade && params.severidade !== "Todos") sp.set("severidade", params.severidade)
  if (params.status && params.status !== "Todos") sp.set("status", params.status)
  if (params.page && params.page !== 1) sp.set("page", String(params.page))
  return sp.toString()
}

function formatDetected(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function severityBadgeClass(s: IncidentSeverity) {
  if (s === "CRITICAL") return "bg-red-50 text-red-800 border-red-100"
  if (s === "HIGH") return "bg-amber-50 text-amber-900 border-amber-100"
  if (s === "MEDIUM") return "bg-sky-50 text-sky-900 border-sky-100"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function statusBadgeClass(s: IncidentStatus) {
  if (s === "CONCLUIDO") return "bg-emerald-50 text-emerald-800 border-emerald-100"
  if (s === "EM_ANALISE") return "bg-[#dae2ff] text-[#00337e] border-[#b1c5ff]"
  if (s === "AGUARDANDO_EVIDENCIA") return "bg-violet-50 text-violet-800 border-violet-100"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default function IncidentesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando incidentes...</div>}>
      <IncidentesPageContent />
    </Suspense>
  )
}

function IncidentesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [filterSev, setFilterSev] = useState("Todos")
  const [filterStatus, setFilterStatus] = useState("Todos")
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    const urlQ = safeText(searchParams.get("q"))
    const urlSev = safeText(searchParams.get("severidade")) || "Todos"
    const urlSt = safeText(searchParams.get("status")) || "Todos"
    const urlPage = clampPage(Number(searchParams.get("page") || 1))

    if (urlQ) setSearchTerm(urlQ)
    setFilterSev(urlSev)
    setFilterStatus(urlSt)
    setPage(urlPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const qs = buildIncidentesQuery({
      q: searchTerm || undefined,
      severidade: filterSev,
      status: filterStatus,
      page,
    })
    router.replace(qs ? `/incidentes?${qs}` : "/incidentes")
  }, [searchTerm, filterSev, filterStatus, page, router])

  const sevOptions: IncidentSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
  const statusOptions: IncidentStatus[] = ["EM_ANALISE", "ABERTO", "AGUARDANDO_EVIDENCIA", "CONCLUIDO"]

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return INCIDENTES.filter((row) => {
      const matchQ = !q || rowSearchBlob(row).includes(q)
      const matchSev = filterSev === "Todos" || row.severidade === filterSev
      const matchSt = filterStatus === "Todos" || row.status === filterStatus
      return matchQ && matchSev && matchSt
    }).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  }, [searchTerm, filterSev, filterStatus])

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
  }, [searchTerm, filterSev, filterStatus])

  const stats = useMemo(() => {
    const total = filtered.length
    const criticos = filtered.filter((r) => r.severidade === "CRITICAL").length
    const abertos = filtered.filter((r) => r.status !== "CONCLUIDO").length
    return { total, criticos, abertos }
  }, [filtered])

  const currentQuery = useMemo(() => {
    return buildIncidentesQuery({
      q: searchTerm || undefined,
      severidade: filterSev,
      status: filterStatus,
      page,
    })
  }, [searchTerm, filterSev, filterStatus, page])

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Incidentes</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            Acompanhe alertas gerados pelas automações, analise e registre o parecer final de cada incidente.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-3">
        <StatSmallCard
          icon={<AlertTriangle className="text-[#f71866]" />}
          label="No filtro"
          value={String(stats.total).padStart(2, "0")}
          bgColor="bg-[#f71866]/5"
        />
        <StatSmallCard
          icon={<AlertCircle className="text-red-600" />}
          label="Críticos"
          value={String(stats.criticos).padStart(2, "0")}
          bgColor="bg-red-50"
        />
        <StatSmallCard
          icon={<CheckCircle2 className="text-amber-500" />}
          label="Em aberto / análise"
          value={String(stats.abertos).padStart(2, "0")}
          bgColor="bg-amber-50"
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-[#f71866] focus:ring-2 focus:ring-[#f71866]/20"
              placeholder="Buscar por ID, título, automação, trigger..."
            />
          </div>

          <select
            value={filterSev}
            onChange={(e) => setFilterSev(e.target.value)}
            className="cursor-pointer rounded-lg border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Todos">Severidade (Todas)</option>
            {sevOptions.map((s) => (
              <option key={s} value={s}>
                {severityLabel(s)}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="cursor-pointer rounded-lg border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Todos">Status (Todos)</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchTerm("")
              setFilterSev("Todos")
              setFilterStatus("Todos")
              setPage(1)
            }}
            className="py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 transition-colors hover:text-slate-600"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="min-w-[200px] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  ID (AL + automação)
                </th>
                <th className="min-w-[260px] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Controle SOX
                </th>
                <th className="min-w-[220px] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Nome Jira
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Severidade
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Status
                </th>
                <th className="min-w-[140px] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Automação
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Detectado
                  </span>
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
                      <p className="text-sm font-medium">Nenhum incidente com os filtros atuais.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((row) => (
                  <tr key={row.id} className="group transition-colors hover:bg-slate-50/30">
                    <td className="px-6 py-4">
                      <span className="inline-block max-w-[320px] rounded bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold leading-snug text-slate-700 break-words">
                        {formatIncidentDisplayId(row)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="line-clamp-4 text-[11px] font-semibold leading-snug text-slate-800">
                        {controleSoxForIncident(row) || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md text-[11px] font-semibold leading-snug text-slate-800">
                        {nomeJiraForIncident(row) || "—"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityBadgeClass(row.severidade)}`}
                      >
                        {severityLabel(row.severidade)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(row.status)}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-slate-600">{row.nomeAutomacao}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                      {formatDetected(row.detectedAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/incidentes/${encodeURIComponent(row.id)}${currentQuery ? `?${currentQuery}` : ""}`
                          )
                        }
                        className="rounded border border-[#f71866]/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#f71866] transition-all hover:bg-[#f71866]/5"
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

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="text-xs font-medium text-slate-500">
            Mostrando <span className="font-bold text-slate-700">{paginated.length}</span> de{" "}
            <span className="font-bold text-slate-700">{filtered.length}</span> incidentes
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canPrev && setPage((p) => p - 1)}
              disabled={!canPrev}
              className={`rounded-lg border border-slate-200 p-2 text-slate-400 transition-all hover:bg-white ${
                !canPrev ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-2 text-[11px] font-bold text-slate-400">
              {Math.min(page, totalPages)} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext}
              className={`rounded-lg border border-slate-200 p-2 text-slate-400 transition-all hover:bg-white ${
                !canNext ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
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
    <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all group-hover:border-[#f71866]/20">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${bgColor}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { size: 24 } as { size?: number }) : icon}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
    </div>
  )
}
