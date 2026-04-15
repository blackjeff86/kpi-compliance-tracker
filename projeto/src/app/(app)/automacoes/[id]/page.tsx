"use client"

import React, { Suspense, useMemo } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { getAutomacaoById, type AutomacaoInventario } from "@/data/automacoes-inventario"

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function displayValue(v: unknown) {
  const s = safeText(v)
  if (!s || s === "-") return "—"
  return s
}

function formatPtDate(iso: string | null | undefined) {
  const s = safeText(iso)
  if (!s || s === "-") return "—"
  const d = new Date(s + "T12:00:00")
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("pt-BR")
}

function jiraBrowseUrl(ticket: string): string | null {
  const t = safeText(ticket)
  if (!t || t === "-") return null
  return `https://vtex-dev.atlassian.net/browse/${encodeURIComponent(t)}`
}

function splitChips(raw: string | null | undefined): string[] {
  const s = safeText(raw)
  if (!s || s === "—") return []
  return s
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Normaliza para comparar se "Slack" na lista de apps já está coberto por "SlackApp" no tipo */
function normKey(s: string) {
  return safeText(s).toLowerCase().replace(/[^a-z0-9]/g, "")
}

function tipoMencionaSlack(tipoTokens: string[]) {
  return tipoTokens.some((t) => {
    const n = normKey(t)
    return n.includes("slack")
  })
}

/**
 * Remove da lista de aplicações itens redundantes quando o mesmo ecossistema já aparece em "Tipo de integração"
 * (ex.: tipo contém SlackApp e apps listam "Slack").
 */
function aplicacoesSemSobreporTipo(apps: string[], tipoTokens: string[]): string[] {
  if (!apps.length || !tipoTokens.length) return apps
  if (!tipoMencionaSlack(tipoTokens)) return apps
  return apps.filter((app) => !normKey(app).includes("slack"))
}

function formatTipoIntegracaoChip(t: string) {
  const s = safeText(t)
  if (!s) return s
  const up = s.toUpperCase()
  if (up === "API" || up === "WEBHOOK") return up
  if (normKey(s) === "slackapp") return "Slack App"
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function freqBadgeLabel(raw: string | null | undefined): string {
  const s = safeText(raw).toLowerCase()
  if (!s || s === "—") return "—"
  if (s.includes("diario") || s.includes("diária") || s.includes("diaria")) return "DIÁRIA"
  if (s.includes("demanda")) return "SOB DEMANDA"
  return s.toUpperCase()
}

function slackChannelLabel(raw: string | null | undefined): string {
  const s = safeText(raw)
  if (!s || s === "—") return "—"
  if (s.startsWith("#")) return s
  return `#${s.replace(/^#/, "")}`
}

function LinkifiedInline({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g)
  return (
    <span className="text-xs text-slate-600 leading-relaxed italic">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-audit-secondary font-semibold not-italic hover:underline break-all inline-flex items-center gap-0.5"
          >
            {part}
            <ExternalLink className="inline h-3 w-3 shrink-0 opacity-70" />
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

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

export default function AutomacaoDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Carregando...</div>}>
      <AutomacaoDetailContent />
    </Suspense>
  )
}

function AutomacaoDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const rawId = decodeURIComponent(String((params as { id?: string })?.id || ""))

  const backHref = useMemo(() => {
    const qs = searchParams?.toString() || ""
    return qs ? `/automacoes?${qs}` : "/automacoes"
  }, [searchParams])

  const row: AutomacaoInventario | undefined = useMemo(() => getAutomacaoById(rawId), [rawId])

  if (!row) {
    return (
      <div className="w-full max-w-lg rounded-xl border border-slate-100 bg-audit-surface-container-lowest p-6 shadow-sm">
        <div className="text-sm font-bold text-red-600">Registro não encontrado</div>
        <div className="mt-2 text-xs text-slate-500">O ID informado não existe no inventário.</div>
        <div className="mt-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            Voltar ao inventário
          </Link>
        </div>
      </div>
    )
  }

  const ticket = safeText(row["Ticket Jira"])
  const jiraUrl = jiraBrowseUrl(ticket)
  const nomeJira = safeText(row["Nome Jira"])
  const controle = safeText(row["Controle SOX"])
  const nomeAuto = safeText(row["Nome automação"])
  const objetivo = safeText(row["Objetivo automação"])
  const owner = safeText(row["Owner automação"])
  const usuario = safeText(row["Usuário automação"])
  const tipoRaw = row["Tipo de integração"]
  const tipoChips = splitChips(tipoRaw as string | null | undefined)
  const appsRaw = safeText(row["Aplicações integradas"])
  const appsList = splitChips(appsRaw || null).length ? splitChips(appsRaw || null) : appsRaw ? [appsRaw] : []
  const looker = safeText(row.Looker)
  const hasLooker = looker.startsWith("http")
  const obs = safeText(row.OBS)
  const canal = safeText(row["Canal Slack"])
  const objetivoCanal = safeText(row["Objetivo (Canal)"])

  const integrationTypeSummary = tipoChips.length ? tipoChips.join(", ") : displayValue(tipoRaw)
  const appsForDisplay = aplicacoesSemSobreporTipo(appsList, tipoChips)

  const tableFields: { label: string; value: React.ReactNode }[] = [
    { label: "Ticket Jira", value: <span className="text-audit-secondary font-semibold">{displayValue(row["Ticket Jira"])}</span> },
    { label: "Nome Jira", value: displayValue(row["Nome Jira"]) },
    { label: "Controle SOX", value: displayValue(row["Controle SOX"]) },
    { label: "Nome Automação", value: displayValue(row["Nome automação"]) },
    { label: "Objetivo Automação", value: displayValue(row["Objetivo automação"]) },
    { label: "Owner Automação", value: displayValue(row["Owner automação"]) },
    { label: "Usuário Automação", value: displayValue(row["Usuário automação"]) },
    { label: "Tipo de Integração", value: displayValue(row["Tipo de integração"]) },
    { label: "Aplicações Integradas", value: displayValue(row["Aplicações integradas"]) },
    { label: "Data Inicial", value: formatPtDate(row["Data inicial da automação"]) },
    { label: "Frequência", value: displayValue(row["Frequencia automação"]) },
    {
      label: "Alerta no sistema",
      value: row.kpiMonitoramentoHabilitado ? (
        <span className="font-semibold text-emerald-700">Sim</span>
      ) : (
        <span className="text-slate-500">Não</span>
      ),
    },
    { label: "Canal Slack", value: <span className="text-audit-secondary font-semibold">{slackChannelLabel(row["Canal Slack"])}</span> },
    { label: "Objetivo (Canal)", value: displayValue(row["Objetivo (Canal)"]) },
    {
      label: "Looker (link)",
      value: hasLooker ? (
        <a
          href={looker}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-audit-secondary font-semibold hover:underline break-all"
        >
          {looker.length > 64 ? `${looker.slice(0, 64)}…` : looker}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        displayValue(row.Looker)
      ),
    },
    {
      label: "OBS",
      value:
        obs && obs !== "—" ? (
          <span className="text-slate-600 not-italic font-medium">
            <LinkifiedInline text={obs} />
          </span>
        ) : (
          <span className="text-slate-400 italic">Não informado</span>
        ),
    },
  ]

  return (
    <div className="relative w-full pb-24 text-audit-on-surface animate-in fade-in duration-500">
      <div className="mx-auto max-w-[1400px] rounded-2xl bg-audit-background p-6 shadow-[0px_1px_0_rgba(20,29,35,0.06)] md:p-8">
        {/* Header */}
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-audit-secondary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-audit-on-secondary-fixed-variant">
                Control Detail
              </span>
              <span className="text-sm text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-500">{row.id}</span>
            </div>
            <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-audit-on-surface md:text-4xl">
              Detalhes da Automação SOX
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-audit-on-surface-variant">
              Painel técnico de auditoria para monitoramento de fluxos automatizados e conformidade de integridade de dados.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Alerta no sistema</span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                  row.kpiMonitoramentoHabilitado
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-100 text-slate-600"
                }`}
              >
                {row.kpiMonitoramentoHabilitado ? "Sim" : "Não"}
              </span>
              <span className="text-xs text-slate-500">
                {row.kpiMonitoramentoHabilitado ? (
                  <>
                    Com alerta ativo, ocorrências podem ser tratadas em{" "}
                    <Link href="/incidentes" className="font-semibold text-[#f71963] hover:underline">
                      Incidentes
                    </Link>
                    .
                  </>
                ) : (
                  "Sem alerta configurado — a fila de Incidentes não recebe automaticamente ocorrências desta automação."
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-audit-surface-container-highest px-6 py-2.5 text-sm font-semibold text-audit-on-secondary-container transition-colors hover:bg-audit-surface-container-high"
            >
              Editar Automação
            </button>
            <button
              type="button"
              className="rounded-lg bg-gradient-to-r from-audit-primary to-audit-primary-container px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-audit-primary/20 transition-all hover:opacity-90"
            >
              Validar Evidência
            </button>
            <Link
              href={backHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Voltar
            </Link>
          </div>
        </div>

        {/* Bento */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 grid grid-cols-2 gap-6 lg:col-span-8">
            {/* Identificação */}
            <div className="col-span-2 rounded-xl border-l-4 border-audit-primary bg-audit-surface-container-lowest p-6 shadow-[0px_4px_12px_rgba(20,29,35,0.03)]">
              <div className="mb-6">
                <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Identificação</h3>
                {/* Três colunas com larguras estáveis: evita texto cortado / colunas coladas */}
                <div className="grid grid-cols-1 gap-6 border-slate-100 sm:gap-8 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-8 xl:gap-x-10">
                  <div className="min-w-0 border-b border-slate-100 pb-6 sm:border-b-0 sm:pb-0 lg:border-b-0 lg:border-r lg:pr-8">
                    <p className="mb-1 text-xs text-slate-500">Ticket Jira</p>
                    {jiraUrl ? (
                      <a
                        href={jiraUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block break-all text-base font-bold text-audit-secondary underline decoration-2 underline-offset-4 hover:opacity-90"
                      >
                        {ticket}
                      </a>
                    ) : (
                      <p className="break-words text-base font-bold text-audit-secondary">{displayValue(row["Ticket Jira"])}</p>
                    )}
                  </div>
                  <div className="min-w-0 border-b border-slate-100 pb-6 sm:border-b-0 sm:pb-0 lg:border-b-0 lg:border-r lg:pr-8">
                    <p className="mb-1 text-xs text-slate-500">Controle SOX</p>
                    <p className="break-words text-sm font-bold leading-snug text-audit-on-surface lg:text-base">
                      {controle || "—"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-slate-500">Nome Jira</p>
                    <p className="break-words text-sm font-bold leading-snug text-audit-on-surface lg:text-base">
                      {nomeJira || "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-50 pt-4">
                <p className="mb-1 text-xs text-slate-500">Nome Automação</p>
                <p className="text-xl font-bold text-audit-on-surface">{nomeAuto || "—"}</p>
              </div>
            </div>

            {/* Objetivo */}
            <div className="col-span-2 rounded-xl bg-audit-surface-container-lowest p-6 shadow-[0px_4px_12px_rgba(20,29,35,0.03)] md:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <Ms name="target" className="text-audit-primary" size="text-sm" />
                <h3 className="text-xs font-bold tracking-tight text-audit-on-surface">Objetivo Automação</h3>
              </div>
              <p className="text-sm leading-relaxed text-audit-on-surface-variant">{objetivo || "—"}</p>
            </div>

            {/* Tipo + apps */}
            <div className="col-span-2 rounded-xl bg-audit-surface-container-lowest p-6 shadow-[0px_4px_12px_rgba(20,29,35,0.03)] md:col-span-1">
              <div className="mb-2 flex items-center gap-2">
                <Ms name="hub" className="text-audit-primary" size="text-sm" />
                <h3 className="text-xs font-bold tracking-tight text-audit-on-surface">Tipo de Integração</h3>
              </div>
              <p className="mb-3 text-[11px] leading-snug text-slate-500">
                Mecanismos de conexão (protocolo, app ou canal técnico).
              </p>
              <div className="flex flex-wrap gap-2">
                {tipoChips.length ? (
                  tipoChips.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-slate-200/80 bg-audit-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-audit-on-surface"
                    >
                      {formatTipoIntegracaoChip(t)}
                    </span>
                  ))
                ) : (
                  <span className="rounded-md border border-slate-200/80 bg-audit-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-audit-on-surface">
                    {integrationTypeSummary}
                  </span>
                )}
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-0.5 text-xs font-medium text-slate-600">Aplicações integradas</p>
                <p className="mb-3 text-[11px] leading-snug text-slate-500">
                  Sistemas e produtos de negócio tocados pela automação (não confundir com o tipo de integração acima).
                </p>
                <div className="flex flex-wrap gap-2">
                  {appsForDisplay.length > 0 ? (
                    appsForDisplay.slice(0, 12).map((app, idx) => (
                      <span
                        key={`${app}-${idx}`}
                        className="max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold leading-snug text-slate-800 shadow-sm break-words"
                        title={app}
                      >
                        {app}
                      </span>
                    ))
                  ) : appsList.length > 0 ? (
                    <p className="text-xs italic leading-relaxed text-slate-500">
                      O ecossistema Slack já está representado em{" "}
                      <span className="font-semibold not-italic">Tipo de integração</span> (ex.: Slack App).
                    </p>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Ownership */}
            <div className="col-span-2 rounded-xl border border-dashed border-audit-outline-variant/30 bg-audit-surface-container-low/50 p-6">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Ms name="person" className="text-audit-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Owner Automação</p>
                    <p className="text-sm font-bold text-audit-on-surface">{owner || "—"}</p>
                    <p className="text-[11px] text-slate-500">Security &amp; Compliance Ops</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Ms name="engineering" className="text-audit-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuário Automação</p>
                    <p className="text-sm font-bold text-audit-on-surface">{usuario || "—"}</p>
                    <p className="text-[11px] text-slate-500">Service Account (System)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna direita */}
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl bg-audit-surface-container-lowest p-6 shadow-[0px_12px_32px_-4px_rgba(20,29,35,0.06)]">
              <h3 className="mb-6 flex items-center gap-2 text-xs font-bold tracking-tight text-audit-on-surface">
                <Ms name="schedule" className="text-audit-primary" size="text-sm" />
                Cronograma &amp; Fluxo
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <div>
                    <p className="text-xs text-slate-500">Data Inicial</p>
                    <p className="text-sm font-bold text-audit-on-surface">
                      {formatPtDate(row["Data inicial da automação"])}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Frequência</p>
                    <span className="inline-block rounded-full bg-audit-tertiary/10 px-3 py-1 text-[10px] font-bold text-audit-tertiary">
                      {freqBadgeLabel(row["Frequencia automação"])}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="group cursor-pointer rounded-lg bg-audit-surface-container p-3 transition-colors hover:bg-audit-surface-container-high">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Ms name="forum" className="text-[#611f69]" size="text-xl" />
                        <div>
                          <p className="text-[10px] font-bold text-audit-on-surface">Canal Slack</p>
                          <p className="text-xs font-medium text-audit-secondary">{slackChannelLabel(canal)}</p>
                        </div>
                      </div>
                      <Ms
                        name="open_in_new"
                        className="text-sm text-slate-300 transition-colors group-hover:text-audit-primary"
                        size="text-sm"
                      />
                    </div>
                    {objetivoCanal && objetivoCanal !== "—" ? (
                      <p className="mt-2 text-[10px] italic leading-tight text-slate-500">
                        &quot;Objetivo: {objetivoCanal}&quot;
                      </p>
                    ) : null}
                  </div>

                  <div className="group cursor-pointer rounded-lg bg-audit-surface-container p-3 transition-colors hover:bg-audit-surface-container-high">
                    <a
                      href={hasLooker ? looker : undefined}
                      target={hasLooker ? "_blank" : undefined}
                      rel={hasLooker ? "noopener noreferrer" : undefined}
                      className={`flex items-center justify-between ${!hasLooker ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <Ms name="monitoring" className="text-audit-primary" />
                        <div>
                          <p className="text-[10px] font-bold text-audit-on-surface">Dashboard Looker</p>
                          <p className="text-xs font-medium text-audit-secondary break-all">
                            {hasLooker ? (looker.length > 48 ? `${looker.slice(0, 48)}…` : looker) : "—"}
                          </p>
                        </div>
                      </div>
                      <Ms
                        name="open_in_new"
                        className="text-sm text-slate-300 transition-colors group-hover:text-audit-primary"
                        size="text-sm"
                      />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-audit-outline-variant/20 bg-audit-surface-container-low/30 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Ms name="notes" className="text-sm text-slate-400" size="text-sm" />
                <h3 className="text-xs font-bold tracking-tight text-slate-500">Observações (OBS)</h3>
              </div>
              <div className="rounded-lg bg-white/50 p-4">
                {obs && obs !== "—" ? (
                  <LinkifiedInline text={obs} />
                ) : (
                  <p className="text-xs italic leading-relaxed text-slate-500">Não informado.</p>
                )}
              </div>
            </div>
          </div>

          {/* Tabela densa */}
          <div className="col-span-12 overflow-hidden rounded-xl bg-audit-surface-container-lowest shadow-[0px_4px_12px_rgba(20,29,35,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-audit-surface-container-high/50 px-6 py-4">
              <h3 className="text-sm font-bold text-audit-on-surface">Resumo Técnico de Atributos</h3>
              <span className="text-[10px] font-bold text-slate-400">16 CAMPOS MAPEADOS</span>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-50 md:grid-cols-3 md:divide-x">
              {tableFields.map((cell) => (
                <div key={cell.label} className="p-6 transition-colors hover:bg-slate-50/50">
                  <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">{cell.label}</p>
                  <div className="text-sm font-semibold text-audit-on-surface break-words">{cell.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="mt-12 flex flex-col gap-4 border-t border-slate-100 py-8 text-[10px] font-bold uppercase tracking-widest text-slate-400 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-6">
            <span>Inventário SOX — registro {row.id}</span>
            <span>Última consulta: {new Date().toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="text-right">KPI Compliance Tracker | VTEX governance UI</div>
        </footer>
      </div>

      <button
        type="button"
        className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-audit-primary text-white shadow-2xl transition-all hover:scale-110 active:scale-95"
        aria-label="Ação rápida"
      >
        <Ms name="add" filled size="text-2xl" />
      </button>
    </div>
  )
}
