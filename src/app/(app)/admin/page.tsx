"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Settings, ShieldCheck, Save, Loader2, AlertTriangle, Info } from "lucide-react"
import { fetchAdminKpiRules, saveAdminKpiRules } from "./actions"

type Rules = {
  yellow_ratio: number
  zero_meta_yellow_max: number
}

function safeNumber(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function AdminConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [rules, setRules] = useState<Rules>({
    yellow_ratio: 0.9,
    zero_meta_yellow_max: 1,
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErrorMsg(null)
      setOkMsg(null)
      setLoadWarning(null)

      try {
        // fetchAdminKpiRules() foi desenhada pra sempre retornar success=true (com fallback).
        const res = await fetchAdminKpiRules()

        if (res?.data) {
          setRules(res.data)
        } else {
          // fallback extremo (não deveria acontecer)
          setRules({ yellow_ratio: 0.9, zero_meta_yellow_max: 1 })
          setLoadWarning("Usando regras padrão (resposta sem dados).")
        }

        if (res?.warning) setLoadWarning(res.warning)
      } catch {
        setErrorMsg("Falha ao carregar configurações.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const preview = useMemo(() => {
    const yellow_ratio = clamp(rules.yellow_ratio ?? 0.9, 0.01, 0.999)
    const zero_max = clamp(rules.zero_meta_yellow_max ?? 1, 0, 999999)

    const meta = 100
    const yellowFloor = Math.round(meta * yellow_ratio)

    return {
      yellow_ratio,
      zero_max,
      meta100: {
        green: `>= ${meta}`,
        yellow: `>= ${yellowFloor} e < ${meta}`,
        red: `< ${yellowFloor}`,
      },
      meta0: {
        green: `= 0`,
        yellow: `1..${zero_max}`,
        red: `> ${zero_max}`,
      },
    }
  }, [rules])

  const onSave = async () => {
    setSaving(true)
    setErrorMsg(null)
    setOkMsg(null)

    try {
      const res = await saveAdminKpiRules({
        yellow_ratio: rules.yellow_ratio,
        zero_meta_yellow_max: rules.zero_meta_yellow_max,
      })

      if (!res?.success) {
        // saveAdminKpiRules tem ramo de erro com { success:false, error:string }
        setErrorMsg((res as any)?.error || "Falha ao salvar.")
        return
      }

      setRules(res.data)
      setOkMsg("Configurações salvas com sucesso.")
    } catch {
      setErrorMsg("Falha ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-[#f71963]" size={40} />
      </div>
    )
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            <Link href="/controles" className="hover:text-[#f71963] transition-colors">
              Controles
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">Configurações</span>
          </nav>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <Settings size={18} className="text-[#f71963]" />
              Admin • Configurações
            </h1>

            <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded font-black tracking-wider bg-slate-100 text-slate-600">
              <ShieldCheck size={12} />
              Regras de KPI
            </span>
          </div>

          <p className="text-slate-500 mt-2 font-medium text-sm">
            Ajuste as faixas de classificação para permitir resultado <b>YELLOW</b> (em atenção) de forma consistente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className={`btn-vtex flex items-center gap-2 ${saving ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {loadWarning && (
        <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>{loadWarning}</div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {okMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <Info size={16} className="mt-0.5" />
          <div>{okMsg}</div>
        </div>
      )}

      {/* CARDS */}
      <div className="grid grid-cols-12 gap-8">
        {/* Config */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Faixas de classificação</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Essas faixas são usadas para classificar o KPI em <b>GREEN / YELLOW / RED</b>.
              </p>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldNumber
                  label="Faixa YELLOW para metas > 0 (yellow_ratio)"
                  hint="Ex: 0.90 => YELLOW quando o resultado ficar entre 90% da meta e a meta."
                  value={rules.yellow_ratio}
                  onChange={(v: number) => setRules((p) => ({ ...p, yellow_ratio: v }))}
                  min={0.01}
                  max={0.999}
                  step={0.01}
                />

                <FieldNumber
                  label="Faixa YELLOW para meta = 0 (zero_meta_yellow_max)"
                  hint="Ex: meta=0 => GREEN=0 | YELLOW=1..N | RED>N"
                  value={rules.zero_meta_yellow_max}
                  onChange={(v: number) => setRules((p) => ({ ...p, zero_meta_yellow_max: v }))}
                  min={0}
                  max={999999}
                  step={1}
                />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Exemplos rápidos</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="font-bold text-slate-700 mb-2">Meta = 100</div>
                    <div className="text-slate-600">
                      <div>🟢 GREEN: {preview.meta100.green}</div>
                      <div>🟡 YELLOW: {preview.meta100.yellow}</div>
                      <div>🔴 RED: {preview.meta100.red}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="font-bold text-slate-700 mb-2">Meta = 0</div>
                    <div className="text-slate-600">
                      <div>🟢 GREEN: {preview.meta0.green}</div>
                      <div>🟡 YELLOW: {preview.meta0.yellow}</div>
                      <div>🔴 RED: {preview.meta0.red}</div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-3 font-medium">
                  Obs: isso melhora muito a leitura do time (não vira tudo “8 ou 80”).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Boas práticas</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Recomendação para fluxo Ponto Focal → Segurança (revisão).
              </p>
            </div>

            <div className="p-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-[#f71963]/5 border border-[#f71963]/10 p-4">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Fluxo sugerido</div>
                <ul className="list-disc pl-5 space-y-2 text-[12px]">
                  <li>Ponto focal registra execução + evidência (dado “bruto”).</li>
                  <li>Security revisa evidência e valida o resultado consolidado do controle.</li>
                  <li>Se necessário, Security ajusta a classificação final (workflow futuro).</li>
                </ul>
              </div>

              <div className="text-[12px]">
                Aqui você está configurando somente as <b>faixas de cálculo</b>. Permissões e perfis você comentou que faremos depois.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* COMPONENTES */
type FieldNumberProps = {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}

function FieldNumber({ label, hint, value, onChange, min, max, step }: FieldNumberProps) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = safeNumber(e.target.value)
          if (n === null) return
          onChange(n)
        }}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#f71963]/10 focus:border-[#f71963]"
      />
      {hint ? <div className="text-[11px] text-slate-500 font-medium">{hint}</div> : null}
    </div>
  )
}
