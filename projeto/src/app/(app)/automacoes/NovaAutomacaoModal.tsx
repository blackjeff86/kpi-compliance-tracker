"use client"

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { X, Loader2, Sparkles, Search, ChevronDown } from "lucide-react"
import {
  createAutomationInventory,
  fetchControlsCatalogForAutomacao,
  type ControlCatalogRow,
  type CreateAutomationInventoryInput,
} from "./actions"

type NovaAutomacaoModalProps = {
  open: boolean
  onClose: () => void
  onCreated: () => void | Promise<void>
}

const FREQ_SUGGESTIONS = ["diario", "diário", "Sob demanda", "semanal", "mensal", "horário"]

function emptyForm() {
  return {
    inventoryId: "",
    ticketJira: "",
    nomeJira: "",
    controleSox: "",
    nomeAutomacao: "",
    objetivoAutomacao: "",
    ownerAutomacao: "",
    usuarioAutomacao: "",
    tipoIntegracao: "",
    aplicacoesIntegradas: "",
    dataInicial: "",
    frequencia: "",
    canalSlack: "",
    objetivoCanal: "",
    lookerUrl: "",
    obs: "",
    kpiMonitoramentoHabilitado: false,
  }
}

export function NovaAutomacaoModal({ open, onClose, onCreated }: NovaAutomacaoModalProps) {
  const titleId = useId()
  const [form, setForm] = useState(emptyForm)
  const [catalog, setCatalog] = useState<ControlCatalogRow[]>([])
  const [catalogHint, setCatalogHint] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [frameworkFilter, setFrameworkFilter] = useState("")
  const [controlQuery, setControlQuery] = useState("")
  const [controlListOpen, setControlListOpen] = useState(false)
  const [controlHighlight, setControlHighlight] = useState(0)
  const controlComboRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setForm(emptyForm())
    setError(null)
    setSubmitting(false)
    setFrameworkFilter("")
    setControlQuery("")
    setControlListOpen(false)
    setControlHighlight(0)
  }, [])

  const frameworkOptions = useMemo(() => {
    const s = new Set<string>()
    for (const c of catalog) {
      const f = (c.framework || "").trim()
      if (f) s.add(f)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
  }, [catalog])

  const filteredCatalog = useMemo(() => {
    const fw = frameworkFilter.trim()
    if (!fw) return catalog
    return catalog.filter((c) => (c.framework || "").trim() === fw)
  }, [catalog, frameworkFilter])

  const controlMatches = useMemo(() => {
    const q = controlQuery.trim().toLowerCase()
    const base = filteredCatalog
    if (!q) return base.slice(0, 80)
    return base
      .filter((c) => {
        const blob = `${c.label} ${c.id_control} ${c.framework || ""}`.toLowerCase()
        return blob.includes(q)
      })
      .slice(0, 80)
  }, [filteredCatalog, controlQuery])

  useEffect(() => {
    if (!controlListOpen) return
    setControlHighlight((h) => (controlMatches.length === 0 ? 0 : Math.min(h, controlMatches.length - 1)))
  }, [controlListOpen, controlMatches.length])

  useEffect(() => {
    if (!controlListOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = controlComboRef.current
      if (el && !el.contains(e.target as Node)) setControlListOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [controlListOpen])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await fetchControlsCatalogForAutomacao()
      if (cancelled) return
      if (res.success) {
        setCatalog(res.data)
        setCatalogHint(null)
      } else {
        setCatalog([])
        setCatalogHint(res.error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (controlListOpen) {
        e.preventDefault()
        e.stopPropagation()
        setControlListOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, controlListOpen])

  if (!open) return null

  const set =
    (key: keyof ReturnType<typeof emptyForm>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const v = e.target.value
      setForm((f) => ({ ...f, [key]: v }))
    }

  const pickControl = (c: ControlCatalogRow) => {
    setForm((f) => ({ ...f, controleSox: c.label }))
    setControlQuery("")
    setControlListOpen(false)
    setControlHighlight(0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.controleSox.trim()) {
      setError("Controle SOX é obrigatório.")
      return
    }
    if (!form.nomeJira.trim() && !form.nomeAutomacao.trim()) {
      setError("Informe ao menos Nome Jira ou Nome da automação.")
      return
    }
    setSubmitting(true)
    const payload: CreateAutomationInventoryInput = {
      inventoryId: form.inventoryId.trim() || null,
      ticketJira: form.ticketJira.trim() || null,
      nomeJira: form.nomeJira.trim() || null,
      controleSox: form.controleSox.trim() || null,
      nomeAutomacao: form.nomeAutomacao.trim() || null,
      objetivoAutomacao: form.objetivoAutomacao.trim() || null,
      ownerAutomacao: form.ownerAutomacao.trim() || null,
      usuarioAutomacao: form.usuarioAutomacao.trim() || null,
      tipoIntegracao: form.tipoIntegracao.trim() || null,
      aplicacoesIntegradas: form.aplicacoesIntegradas.trim() || null,
      dataInicial: form.dataInicial.trim() || null,
      frequencia: form.frequencia.trim() || null,
      canalSlack: form.canalSlack.trim() || null,
      objetivoCanal: form.objetivoCanal.trim() || null,
      lookerUrl: form.lookerUrl.trim() || null,
      obs: form.obs.trim() || null,
      kpiMonitoramentoHabilitado: form.kpiMonitoramentoHabilitado,
    }
    const res = await createAutomationInventory(payload)
    setSubmitting(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    await onCreated()
    reset()
    onClose()
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#f71866] focus:ring-2 focus:ring-[#f71866]/15"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Fechar modal"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-[#f71866]/6 to-white px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f71866]">Inventário SOX</p>
            <h2 id={titleId} className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Nova automação
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Preencha os campos alinhados à planilha corporativa. O vínculo com{" "}
              <span className="font-semibold text-slate-700">Controles e KPIs</span> ocorre quando o código antes de
              &quot; - &quot; no Controle SOX existir em <span className="font-semibold">controls.id_control</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {catalogHint ? (
              <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Catálogo de controles indisponível: {catalogHint}. Você ainda pode digitar o Controle SOX manualmente.
              </p>
            ) : null}
            {error ? (
              <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                {error}
              </p>
            ) : null}

            <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700">
                <Sparkles className="h-4 w-4 text-[#f71866]" />
                Sugestão a partir do cadastro de controles
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Framework (filtro)
                  </label>
                  <select
                    className={fieldClass + " cursor-pointer"}
                    value={frameworkFilter}
                    onChange={(e) => {
                      setFrameworkFilter(e.target.value)
                      setControlHighlight(0)
                    }}
                  >
                    <option value="">Todos os frameworks</option>
                    {frameworkOptions.map((fw) => (
                      <option key={fw} value={fw}>
                        {fw}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Restringe a lista ao lado conforme o framework cadastrado em Controles.
                  </p>
                </div>
                <div ref={controlComboRef} className="relative">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Controle cadastrado (buscar ou selecionar — preenche Controle SOX)
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className={fieldClass + " cursor-text pl-9 pr-10"}
                      value={controlQuery}
                      onChange={(e) => {
                        setControlQuery(e.target.value)
                        setControlListOpen(true)
                        setControlHighlight(0)
                      }}
                      onFocus={() => setControlListOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault()
                          if (!controlListOpen) setControlListOpen(true)
                          setControlHighlight((i) => Math.min(i + 1, Math.max(0, controlMatches.length - 1)))
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault()
                          setControlHighlight((i) => Math.max(0, i - 1))
                        } else if (e.key === "Enter") {
                          if (controlListOpen) {
                            e.preventDefault()
                            const m = controlMatches[controlHighlight]
                            if (m) pickControl(m)
                          }
                        } else if (e.key === "Escape") {
                          if (controlListOpen) {
                            e.preventDefault()
                            e.stopPropagation()
                            setControlListOpen(false)
                          }
                        }
                      }}
                      placeholder={
                        filteredCatalog.length === 0 && catalog.length > 0
                          ? "Nenhum controle neste framework — ajuste o filtro"
                          : catalog.length === 0
                            ? "Nenhum controle cadastrado"
                            : "Digite código, nome ou framework…"
                      }
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={controlListOpen}
                      aria-controls="control-combo-listbox"
                      disabled={catalog.length === 0}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Abrir lista de controles"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setControlListOpen((o) => !o)}
                      disabled={catalog.length === 0}
                    >
                      <ChevronDown className={`h-4 w-4 transition ${controlListOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {controlListOpen && catalog.length > 0 ? (
                    <ul
                      id="control-combo-listbox"
                      role="listbox"
                      className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
                    >
                      {controlMatches.length === 0 ? (
                        <li className="px-3 py-2.5 text-xs text-slate-500">Nenhum resultado para &quot;{controlQuery.trim()}&quot;.</li>
                      ) : (
                        controlMatches.map((c, i) => (
                          <li key={c.id_control} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={i === controlHighlight}
                              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs transition ${
                                i === controlHighlight ? "bg-[#f71866]/10 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                              }`}
                              onMouseEnter={() => setControlHighlight(i)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickControl(c)}
                            >
                              <span className="font-semibold leading-snug">{c.label}</span>
                              {c.framework ? (
                                <span className="text-[10px] font-medium text-slate-500">{c.framework}</span>
                              ) : null}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                  <p className="mt-1 text-[10px] text-slate-500">
                    Use ↑ ↓ e Enter, ou clique. O texto escolhido é copiado para o campo Controle SOX abaixo.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ID inventário (opcional)
                </label>
                <input
                  className={fieldClass + " font-mono text-xs"}
                  value={form.inventoryId}
                  onChange={set("inventoryId")}
                  placeholder="Ex.: inv-021 (vazio = automático)"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ticket Jira
                </label>
                <input className={fieldClass} value={form.ticketJira} onChange={set("ticketJira")} placeholder="TAP-…" />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Controle SOX <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={fieldClass + " min-h-[72px] resize-y"}
                  value={form.controleSox}
                  onChange={set("controleSox")}
                  placeholder="TEC_C92 - Logical access granting - …"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nome Jira
                </label>
                <input
                  className={fieldClass}
                  value={form.nomeJira}
                  onChange={set("nomeJira")}
                  placeholder="Título épico / story no Jira"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nome automação
                </label>
                <input className={fieldClass} value={form.nomeAutomacao} onChange={set("nomeAutomacao")} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Frequência
                </label>
                <input
                  className={fieldClass}
                  list="freq-list-nova-auto"
                  value={form.frequencia}
                  onChange={set("frequencia")}
                  placeholder="diario, Sob demanda…"
                />
                <datalist id="freq-list-nova-auto">
                  {FREQ_SUGGESTIONS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Objetivo automação
                </label>
                <textarea className={fieldClass + " min-h-[80px] resize-y"} value={form.objetivoAutomacao} onChange={set("objetivoAutomacao")} />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Owner automação
                </label>
                <input className={fieldClass} value={form.ownerAutomacao} onChange={set("ownerAutomacao")} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Usuário automação
                </label>
                <input className={fieldClass} value={form.usuarioAutomacao} onChange={set("usuarioAutomacao")} />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tipo de integração
                </label>
                <input
                  className={fieldClass}
                  value={form.tipoIntegracao}
                  onChange={set("tipoIntegracao")}
                  placeholder="API, SlackApp, Webhook…"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Aplicações integradas
                </label>
                <input className={fieldClass} value={form.aplicacoesIntegradas} onChange={set("aplicacoesIntegradas")} />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Data inicial da automação
                </label>
                <input className={fieldClass} type="date" value={form.dataInicial} onChange={set("dataInicial")} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Canal Slack
                </label>
                <input className={fieldClass} value={form.canalSlack} onChange={set("canalSlack")} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Objetivo (Canal)
                </label>
                <input className={fieldClass} value={form.objetivoCanal} onChange={set("objetivoCanal")} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Looker (URL)
                </label>
                <input
                  className={fieldClass}
                  type="text"
                  value={form.lookerUrl}
                  onChange={set("lookerUrl")}
                  placeholder="https://…"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">OBS</label>
                <textarea className={fieldClass + " min-h-[88px] resize-y"} value={form.obs} onChange={set("obs")} />
              </div>

              <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
                <input
                  id="kpi-nova-auto"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#f71866] focus:ring-[#f71866]"
                  checked={form.kpiMonitoramentoHabilitado}
                  onChange={(e) => setForm((f) => ({ ...f, kpiMonitoramentoHabilitado: e.target.checked }))}
                />
                <label htmlFor="kpi-nova-auto" className="text-sm font-medium text-slate-700">
                  Alerta / monitoramento habilitado no sistema (incidentes podem ser roteados para esta automação)
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="order-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 sm:order-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="order-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#f71866] to-[#e01558] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#f71866]/25 hover:opacity-95 disabled:opacity-60 sm:order-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar no inventário
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
