"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Download, Share2 } from "lucide-react"
import {
  formatIncidentDisplayId,
  getIncidenteById,
  severityLabel,
  statusLabel,
  type IncidentSeverity,
  type Incidente,
} from "@/data/incidentes"
import { fetchIncidenteById } from "@/app/(app)/incidentes/actions"

function Ms({
  name,
  className,
  filled,
  size = "text-base",
}: {
  name: string
  className?: string
  filled?: boolean
  size?: string
}) {
  return (
    <span
      className={`material-symbols-outlined ${size} ${className ?? ""}`}
      style={filled ? ({ fontVariationSettings: "'FILL' 1" } as React.CSSProperties) : undefined}
      aria-hidden
    >
      {name}
    </span>
  )
}

function formatDetectedLong(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const s = d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  return `${s.replace(",", "")} (GMT-3)`
}

function TechnicalSummaryBlock({ text }: { text: string }) {
  const parts = text.split(/(UPDATE|INSERT|DELETE|SELECT)/gi)
  return (
    <div className="rounded-lg border-l-4 border-audit-primary/20 bg-audit-surface-container-low p-4 font-mono text-[13px] leading-relaxed text-audit-on-surface-variant">
      {parts.map((part, i) =>
        /^(UPDATE|INSERT|DELETE|SELECT)$/i.test(part) ? (
          <span key={i} className="font-bold text-red-600 underline decoration-dotted">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  )
}

type Verdict = "false_positive" | "confirmed" | null

function severityHeaderClass(s: IncidentSeverity) {
  if (s === "CRITICAL") return "bg-red-100 text-red-900 border-red-200"
  if (s === "HIGH") return "bg-amber-100 text-amber-900 border-amber-200"
  if (s === "MEDIUM") return "bg-sky-100 text-sky-900 border-sky-200"
  return "bg-slate-100 text-slate-800 border-slate-200"
}

export default function IncidenteDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando incidente...</div>}>
      <IncidenteDetailContent />
    </Suspense>
  )
}

function IncidenteDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const rawId = decodeURIComponent(String((params as { id?: string })?.id || ""))

  const [inc, setInc] = useState<Incidente | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadState("loading")
      setInc(null)
      const res = await fetchIncidenteById(rawId)
      if (cancelled) return
      if (res.success && res.data) {
        setInc(res.data)
      } else {
        setInc(getIncidenteById(rawId) ?? null)
      }
      setLoadState("ready")
    })()
    return () => {
      cancelled = true
    }
  }, [rawId])

  const backHref = useMemo(() => {
    const qs = searchParams?.toString() || ""
    return qs ? `/incidentes?${qs}` : "/incidentes"
  }, [searchParams])

  const [verdict, setVerdict] = useState<Verdict>("confirmed")
  const [justificativa, setJustificativa] = useState("")
  const [finalizado, setFinalizado] = useState(false)

  if (loadState === "loading" && !inc) {
    return <div className="p-8 text-center text-sm text-slate-500">Carregando incidente…</div>
  }

  if (!inc) {
    return (
      <div className="max-w-lg rounded-xl border border-slate-100 bg-audit-surface-container-lowest p-6 shadow-sm">
        <p className="text-sm font-bold text-red-600">Incidente não encontrado</p>
        <Link
          href={backHref}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={14} />
          Voltar à lista
        </Link>
      </div>
    )
  }

  const critico = inc.severidade === "CRITICAL"

  return (
    <div className="relative w-full animate-in fade-in duration-500">
      <div className="pointer-events-none fixed top-0 right-0 -z-10 h-full w-1/3 bg-audit-surface-container-low opacity-50 blur-3xl" />

      <div className="mx-auto max-w-[1400px] rounded-2xl bg-audit-background p-6 shadow-sm md:p-8">
        <nav className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Link href={backHref} className="transition-colors hover:text-audit-primary">
            Incidentes
          </Link>
          <Ms name="chevron_right" className="text-[14px] text-slate-400" size="text-sm" />
          <span className="text-slate-400">Detalhes</span>
          <Ms name="chevron_right" className="text-[14px] text-slate-400" size="text-sm" />
          <span className="break-words text-audit-on-surface">{formatIncidentDisplayId(inc)}</span>
        </nav>

        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="max-w-full rounded bg-audit-surface-container-highest px-2 py-0.5 text-[10px] font-black tracking-widest text-audit-on-surface-variant break-words">
                ID: {formatIncidentDisplayId(inc)}
              </span>
              {critico ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-900">
                  <Ms name="priority_high" className="text-[12px]" filled size="text-sm" />
                  RISCO CRÍTICO
                </span>
              ) : (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityHeaderClass(inc.severidade)}`}
                >
                  {severityLabel(inc.severidade).toUpperCase()}
                </span>
              )}
              <span className="rounded-full bg-audit-secondary-fixed px-2 py-0.5 text-[10px] font-bold text-audit-on-secondary-fixed-variant">
                {statusLabel(inc.status).toUpperCase()}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-audit-on-surface md:text-4xl">
              {inc.titulo}
            </h2>
            {(inc.referenceMonth || inc.framework || inc.idControl) && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                {inc.referenceMonth ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-mono font-bold text-slate-700">
                    Mês ref.: {inc.referenceMonth}
                  </span>
                ) : null}
                {inc.framework ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold">
                    Framework: {inc.framework}
                  </span>
                ) : null}
                {inc.idControl ? (
                  <Link
                    href={`/controles/${encodeURIComponent(inc.idControl)}`}
                    className="rounded-full border border-[#f71866]/25 bg-[#f71866]/5 px-2.5 py-0.5 font-bold text-[#f71866] hover:bg-[#f71866]/10"
                  >
                    Controle: {inc.idControl}
                  </Link>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-audit-surface-container-highest px-5 py-2.5 text-sm font-semibold text-audit-on-surface transition-all hover:bg-audit-surface-container-high"
            >
              <Share2 className="h-4 w-4" />
              Vincular Jira
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-audit-surface-container-highest px-5 py-2.5 text-sm font-semibold text-audit-on-surface transition-all hover:bg-audit-surface-container-high"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Voltar
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-12 items-start gap-6">
          <div className="col-span-12 space-y-6 lg:col-span-8">
            <div className="rounded-xl bg-audit-surface-container-lowest p-8 shadow-[0px_4px_20px_rgba(20,29,35,0.04)]">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Ms name="analytics" className="text-audit-primary" />
                  <h3 className="text-lg font-bold text-audit-on-surface">Detalhes da Automação</h3>
                </div>
                {inc.automacaoInventarioId ? (
                  <Link
                    href={`/automacoes/${encodeURIComponent(inc.automacaoInventarioId)}`}
                    className="text-xs font-bold text-audit-secondary hover:underline"
                  >
                    Ver inventário → {inc.automacaoInventarioId}
                  </Link>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Trigger Name
                  </label>
                  <p className="text-sm font-semibold text-audit-on-surface">{inc.triggerName}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Timestamp
                  </label>
                  <p className="text-sm font-semibold text-audit-on-surface">{formatDetectedLong(inc.detectedAt)}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Affected Object
                  </label>
                  <p className="flex items-center gap-1 text-sm font-semibold text-audit-on-surface">
                    <Ms name="database" className="text-xs text-slate-500" size="text-sm" />
                    {inc.affectedObject}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Initiator User
                  </label>
                  <p className="flex items-center gap-1 text-sm font-semibold text-audit-on-surface">
                    <Ms name="person" className="text-xs text-slate-500" size="text-sm" />
                    {inc.initiatorUser}
                  </p>
                </div>
              </div>
              <div className="mt-8 border-t border-audit-outline-variant/10 pt-6">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Technical Summary
                </label>
                <TechnicalSummaryBlock text={inc.technicalSummary} />
              </div>
            </div>

            <div className="rounded-xl bg-audit-surface-container-lowest p-8 shadow-[0px_4px_20px_rgba(20,29,35,0.04)]">
              <div className="mb-6 flex items-center gap-2">
                <Ms name="gavel" className="text-audit-primary" />
                <h3 className="text-lg font-bold text-audit-on-surface">Análise do Auditor</h3>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setVerdict("false_positive")}
                  className={`flex items-center justify-center gap-3 rounded-xl border p-4 transition-all ${
                    verdict === "false_positive"
                      ? "border-audit-tertiary bg-emerald-50/80 ring-2 ring-audit-tertiary/30"
                      : "border-audit-outline-variant/30 bg-audit-surface-container-low hover:border-slate-300"
                  }`}
                >
                  <Ms name="check_circle" className="text-audit-tertiary" />
                  <span className="text-sm font-bold text-audit-on-surface">Falso Positivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVerdict("confirmed")}
                  className={`flex items-center justify-center gap-3 rounded-xl border p-4 transition-all ${
                    verdict === "confirmed"
                      ? "border-red-400 bg-red-50/80 ring-2 ring-red-200"
                      : "border-audit-outline-variant/30 bg-audit-surface-container-low hover:border-slate-300"
                  }`}
                >
                  <Ms name="report" className="text-red-600" />
                  <span className="text-sm font-bold text-audit-on-surface">Problema Confirmado</span>
                </button>
              </div>

              <div className="mb-8">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Justificativa / Plano de Ação
                </label>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border-0 border-b-2 border-audit-outline-variant/20 bg-white py-3 text-sm text-audit-on-surface shadow-sm transition-all focus:border-audit-secondary focus:ring-0 focus:outline-none"
                  placeholder="Descreva detalhadamente o contexto da investigação e os próximos passos para mitigação..."
                />
              </div>

              {finalizado ? (
                <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  Parecer registrado localmente (protótipo). Integre com API para persistir no banco.
                </p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFinalizado(true)}
                  className="rounded-lg bg-gradient-to-r from-audit-primary to-audit-primary-container px-10 py-3.5 font-bold text-white shadow-lg shadow-audit-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Finalizar Análise
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-12 space-y-6 lg:col-span-4">
            <div className="rounded-xl bg-audit-surface-container-lowest p-6 shadow-[0px_4px_20px_rgba(20,29,35,0.04)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-audit-on-surface">Evidências</h3>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-bold text-audit-primary hover:underline"
                >
                  <Ms name="add_a_photo" className="text-sm" size="text-sm" />
                  Upload
                </button>
              </div>
              <div className="space-y-3">
                {inc.evidencias.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma evidência anexada.</p>
                ) : (
                  inc.evidencias.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-audit-surface-container-low p-3 transition-all hover:border-audit-outline-variant/30"
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-white">
                        {ev.tipo === "IMAGE" && ev.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL externa de exemplo
                          <img src={ev.thumbUrl} alt="" className="h-full w-full object-cover opacity-90" />
                        ) : (
                          <Ms name="description" className="text-audit-secondary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-audit-on-surface">{ev.nome}</p>
                        <p className="text-[10px] text-slate-500">
                          {ev.tamanho} • {ev.tipo}
                        </p>
                      </div>
                      <Ms name="visibility" className="text-lg text-slate-400" size="text-lg" />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl bg-audit-surface-container-lowest p-6 shadow-[0px_4px_20px_rgba(20,29,35,0.04)]">
              <h3 className="mb-6 text-base font-bold text-audit-on-surface">Histórico</h3>
              <div className="relative space-y-6 pl-6">
                <div className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-audit-secondary-fixed" />
                {inc.historico.map((h, idx) => (
                  <div key={h.id} className="relative">
                    <div
                      className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                        idx === 0 ? "bg-audit-secondary" : "bg-audit-secondary-fixed"
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-audit-on-surface">{h.titulo}</p>
                      <p className="text-[10px] text-slate-500">
                        {h.quando} • {h.autor}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
