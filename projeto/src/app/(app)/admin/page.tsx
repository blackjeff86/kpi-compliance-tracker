"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  Settings,
  Loader2,
  AlertTriangle,
  Search,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Save,
  UploadCloud,
  Target,
  Link2,
} from "lucide-react"
import {
  fetchAdminEvidenceUploadConfig,
  fetchAdminJiraIntegrationConfig,
  fetchAdminKpiMatrix,
  saveAdminEvidenceUploadConfig,
  saveAdminJiraIntegrationConfig,
  saveAdminKpiConfig,
  testAdminJiraIntegration,
} from "./actions"
import type { JiraIntegrationConfig } from "@/lib/jira"

type MatrixRow = {
  id_control: string
  name_control: string
  framework: string
  frequency: string
  owner_name: string
  focal_point_name: string
  risk_title: string

  kpi_uuid: string
  kpi_id: string
  kpi_name: string
  kpi_type: string
  kpi_target: string
  kpi_evaluation_mode: "UP" | "DOWN" | "BOOLEAN" | string
  kpi_rules_json?: {
    warning_margin?: number
    value_type?: "PERCENT" | "NUMBER" | "BOOLEAN" | string
    direction?: "UP" | "DOWN" | "BOOLEAN" | string
    yellow_ratio?: number
    zero_meta_yellow_max?: number
  } | null
}

type ValueType = "PERCENT" | "NUMBER" | "BOOLEAN"
type Direction = "UP" | "DOWN" | "BOOLEAN"
type AdminTab = "KPI_RULES" | "EVIDENCE_UPLOAD" | "JIRA"
type UploadProvider = "GOOGLE_DRIVE"

type UploadConfig = {
  enabled: boolean
  provider: UploadProvider
  drive_root_folder_id: string
}

type JiraConfig = JiraIntegrationConfig

function safeText(v: any) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function safeNumber(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function inferValueType(row: MatrixRow): ValueType {
  const explicitType = safeText(row?.kpi_rules_json?.value_type).toUpperCase()
  if (explicitType === "BOOLEAN") return "BOOLEAN"
  if (explicitType === "PERCENT") return "PERCENT"
  if (explicitType === "NUMBER") return "NUMBER"

  const mode = safeText(row.kpi_evaluation_mode).toUpperCase()
  if (mode === "BOOLEAN") return "BOOLEAN"

  const kpiType = safeText(row.kpi_type).toLowerCase()
  if (kpiType.includes("percent") || kpiType.includes("%") || kpiType.includes("taxa")) return "PERCENT"

  return "NUMBER"
}

function inferDirection(row: MatrixRow): Direction {
  const explicit = safeText(row?.kpi_rules_json?.direction).toUpperCase()
  if (explicit === "UP" || explicit === "DOWN" || explicit === "BOOLEAN") return explicit

  const mode = safeText(row.kpi_evaluation_mode).toUpperCase()
  if (mode === "DOWN") return "DOWN"
  if (mode === "BOOLEAN") return "BOOLEAN"
  return "UP"
}

function inferWarningMargin(row: MatrixRow): number {
  const direct = safeNumber(row?.kpi_rules_json?.warning_margin)
  if (direct !== null) return Math.max(0, direct)

  const mode = inferDirection(row)
  const targetN = safeNumber(row.kpi_target)
  const rules = row.kpi_rules_json || {}

  if (mode === "DOWN") {
    const z = safeNumber(rules.zero_meta_yellow_max)
    return z !== null ? Math.max(0, z) : 0
  }

  const ratio = safeNumber(rules.yellow_ratio)
  if (ratio !== null && targetN !== null && targetN > 0) {
    return Math.max(0, targetN - targetN * ratio)
  }

  return 0
}

function inferBooleanTarget(row: MatrixRow): "SIM" | "NAO" {
  const t = safeText(row.kpi_target).toLowerCase()
  if (["true", "1", "sim", "yes", "y"].includes(t)) return "SIM"
  return "NAO"
}

function isKpiConfigured(row: MatrixRow) {
  const rules = row?.kpi_rules_json
  if (!rules) return false
  return Object.keys(rules).length > 0
}

export default function AdminConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("KPI_RULES")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingUpload, setSavingUpload] = useState(false)
  const [savingJira, setSavingJira] = useState(false)
  const [testingJira, setTestingJira] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterControlId, setFilterControlId] = useState("Todos")

  const [rows, setRows] = useState<MatrixRow[]>([])
  const [expandedControls, setExpandedControls] = useState<Record<string, boolean>>({})
  const [uploadConfig, setUploadConfig] = useState<UploadConfig>({
    enabled: false,
    provider: "GOOGLE_DRIVE",
    drive_root_folder_id: "",
  })
  const [jiraConfig, setJiraConfig] = useState<JiraConfig>({
    enabled: false,
    base_url: "",
    user_email: "",
    api_token: "",
    project_key: "",
    epic_controles_key: "",
    epic_automacoes_key: "",
    story_issue_type: "Story",
    task_issue_type: "Task",
    framework_field_id: "",
    use_framework_labels: false,
  })

  const [configOpen, setConfigOpen] = useState(false)
  const [selectedKpi, setSelectedKpi] = useState<MatrixRow | null>(null)
  const [valueType, setValueType] = useState<ValueType>("NUMBER")
  const [direction, setDirection] = useState<Direction>("UP")
  const [targetValue, setTargetValue] = useState("")
  const [targetBoolean, setTargetBoolean] = useState<"SIM" | "NAO">("SIM")
  const [warningMargin, setWarningMargin] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErrorMsg(null)
      setOkMsg(null)

      try {
        const [resKpis, resUpload, resJira] = await Promise.all([
          fetchAdminKpiMatrix(),
          fetchAdminEvidenceUploadConfig(),
          fetchAdminJiraIntegrationConfig(),
        ])

        if (!resKpis.success) {
          setRows([])
          setErrorMsg((resKpis as any).error || "Falha ao carregar matriz de KPIs.")
        } else {
          setRows((resKpis as any).data || [])
        }

        if (resUpload.success) {
          setUploadConfig((resUpload as any).data)
        } else {
          setErrorMsg((resUpload as any).error || "Falha ao carregar configuração de upload.")
        }

        if (resJira.success) {
          setJiraConfig((resJira as any).data)
        } else {
          setErrorMsg((resJira as any).error || "Falha ao carregar configuração do Jira.")
        }
      } catch (error) {
        console.error("Erro ao carregar admin matrix:", error)
        setRows([])
        setErrorMsg("Falha ao carregar matriz de KPIs.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const frameworkOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => safeText(r.framework)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const controlIdOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => safeText(r.id_control)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()

    return rows.filter((item) => {
      const matchesSearch =
        !q ||
        safeText(item.id_control).toLowerCase().includes(q) ||
        safeText(item.name_control).toLowerCase().includes(q) ||
        safeText(item.kpi_id).toLowerCase().includes(q) ||
        safeText(item.kpi_name).toLowerCase().includes(q) ||
        safeText(item.owner_name).toLowerCase().includes(q) ||
        safeText(item.focal_point_name).toLowerCase().includes(q)

      const matchesFramework = filterFramework === "Todos" || safeText(item.framework) === safeText(filterFramework)
      const matchesControlId = filterControlId === "Todos" || safeText(item.id_control) === safeText(filterControlId)

      return matchesSearch && matchesFramework && matchesControlId
    })
  }, [rows, searchTerm, filterFramework, filterControlId])

  const groupedControls = useMemo(() => {
    const groups = new Map<string, { base: MatrixRow; items: MatrixRow[] }>()

    for (const row of filteredRows) {
      const key = row.id_control || "N/A"
      const existing = groups.get(key)
      if (existing) existing.items.push(row)
      else groups.set(key, { base: row, items: [row] })
    }

    return Array.from(groups.values()).sort((a, b) => safeText(a.base.id_control).localeCompare(safeText(b.base.id_control)))
  }, [filteredRows])

  function toggleExpand(idControl: string) {
    setExpandedControls((prev) => ({ ...prev, [idControl]: !prev[idControl] }))
  }

  function openConfig(row: MatrixRow) {
    setSelectedKpi(row)
    const vt = inferValueType(row)
    const dir = inferDirection(row)
    setValueType(vt)
    setDirection(vt === "BOOLEAN" ? "BOOLEAN" : dir === "BOOLEAN" ? "UP" : dir)
    setTargetValue(safeText(row.kpi_target))
    setTargetBoolean(inferBooleanTarget(row))
    setWarningMargin(String(inferWarningMargin(row)))
    setConfigOpen(true)
  }

  async function handleSaveConfig() {
    if (!selectedKpi?.kpi_uuid) return

    setSaving(true)
    setErrorMsg(null)
    setOkMsg(null)

    try {
      const payload = {
        kpi_uuid: selectedKpi.kpi_uuid,
        value_type: valueType,
        direction: valueType === "BOOLEAN" ? "BOOLEAN" : direction,
        target_value: valueType === "BOOLEAN" ? null : targetValue,
        target_boolean: valueType === "BOOLEAN" ? targetBoolean : null,
        warning_margin: valueType === "BOOLEAN" ? 0 : warningMargin,
      }

      const res = await saveAdminKpiConfig(payload as any)
      if (!res.success) {
        setErrorMsg((res as any).error || "Falha ao salvar configuração do KPI.")
        return
      }

      const updated = (res as any).data
      setRows((prev) =>
        prev.map((r) => {
          if (r.kpi_uuid !== selectedKpi.kpi_uuid) return r
          return {
            ...r,
            kpi_target: safeText(updated?.kpi_target),
            kpi_evaluation_mode: safeText(updated?.kpi_evaluation_mode) || r.kpi_evaluation_mode,
            kpi_rules_json: (updated?.rules || null) as any,
          }
        })
      )

      setOkMsg("Configuração do KPI salva com sucesso.")
      setConfigOpen(false)
    } catch (error) {
      console.error("Erro ao salvar config KPI:", error)
      setErrorMsg("Falha ao salvar configuração do KPI.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveUploadConfig() {
    setSavingUpload(true)
    setErrorMsg(null)
    setOkMsg(null)

    try {
      const res = await saveAdminEvidenceUploadConfig(uploadConfig as any)
      if (!res.success) {
        setErrorMsg((res as any).error || "Falha ao salvar configuração de upload.")
        return
      }
      setUploadConfig((res as any).data)
      setOkMsg("Configuração de upload salva com sucesso.")
    } catch (error) {
      console.error("Erro ao salvar configuração de upload:", error)
      setErrorMsg("Falha ao salvar configuração de upload.")
    } finally {
      setSavingUpload(false)
    }
  }

  async function handleSaveJiraConfig() {
    setSavingJira(true)
    setErrorMsg(null)
    setOkMsg(null)

    try {
      const res = await saveAdminJiraIntegrationConfig(jiraConfig)
      if (!res.success) {
        setErrorMsg((res as any).error || "Falha ao salvar configuração do Jira.")
        return
      }
      setJiraConfig((res as any).data)
      setOkMsg("Configuração do Jira salva com sucesso.")
    } catch (error) {
      console.error("Erro ao salvar configuração do Jira:", error)
      setErrorMsg("Falha ao salvar configuração do Jira.")
    } finally {
      setSavingJira(false)
    }
  }

  async function handleTestJiraConfig() {
    setTestingJira(true)
    setErrorMsg(null)
    setOkMsg(null)

    try {
      const res = await testAdminJiraIntegration(jiraConfig)
      if (!res.success) {
        setErrorMsg((res as any).error || "Falha ao testar conexão com Jira.")
        return
      }
      setOkMsg(`Conexão com Jira validada para ${(res as any).data?.displayName || jiraConfig.user_email}.`)
    } catch (error) {
      console.error("Erro ao testar configuração do Jira:", error)
      setErrorMsg("Falha ao testar conexão com Jira.")
    } finally {
      setTestingJira(false)
    }
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <nav className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            <Link href="/controles" className="hover:text-[#f71963] transition-colors">Controles</Link>
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
          </div>

          <p className="text-slate-500 mt-2 font-medium text-sm">
            Configure regras de metas dos KPIs e o destino dos uploads de evidências.
          </p>
        </div>
      </header>

      <div className="bg-white rounded-xl p-2 shadow-sm border border-slate-100 inline-flex items-center gap-2">
        <button
          onClick={() => setActiveTab("KPI_RULES")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all ${
            activeTab === "KPI_RULES" ? "bg-[#f71963] text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Target size={14} /> Metas dos KPIs
        </button>
        <button
          onClick={() => setActiveTab("EVIDENCE_UPLOAD")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all ${
            activeTab === "EVIDENCE_UPLOAD" ? "bg-[#f71963] text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <UploadCloud size={14} /> Upload de Evidências
        </button>
        <button
          onClick={() => setActiveTab("JIRA")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 transition-all ${
            activeTab === "JIRA" ? "bg-[#f71963] text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Link2 size={14} /> Integração Jira
        </button>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      ) : null}

      {okMsg ? (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5" />
          <div>{okMsg}</div>
        </div>
      ) : null}

      {activeTab === "KPI_RULES" ? (
      <>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <div className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold">Catálogo de KPIs</div>
          </div>

          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar por controle, KPI, owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Todos">Framework (Todos)</option>
            {frameworkOptions.map((fw) => (
              <option key={fw} value={fw}>{fw}</option>
            ))}
          </select>

          <select
            value={filterControlId}
            onChange={(e) => setFilterControlId(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option value="Todos">Control ID (Todos)</option>
            {controlIdOptions.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearchTerm("")
              setFilterFramework("Todos")
              setFilterControlId("Todos")
            }}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 size={20} className="animate-spin text-[#f71866]" /> Carregando configuração de KPIs...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código (id_control)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome & Framework</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Frequência</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control Owner</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Focal Point</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Risco</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedControls.length > 0 ? (
                  groupedControls.map((group) => {
                    const item = group.base
                    const isExpanded = Boolean(expandedControls[item.id_control])
                    const configuredCount = group.items.filter((k) => isKpiConfigured(k)).length
                    const controlConfigured = group.items.length > 0 && configuredCount === group.items.length

                    return (
                      <React.Fragment key={item.id_control}>
                        <tr className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.id_control}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-700 inline-flex items-center gap-2">
                              <span>{item.name_control}</span>
                              {controlConfigured ? (
                                <span title="Todos os KPIs configurados">
                                  <CheckCircle2 size={14} className="text-emerald-600" />
                                </span>
                              ) : (
                                <span title="Configuração de KPIs pendente">
                                  <Clock3 size={14} className="text-amber-500" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">{item.framework}</div>
                            <div className="text-[11px] text-slate-400 mt-1">KPIs configurados: {configuredCount}/{group.items.length}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[11px] font-bold text-slate-600">{item.frequency || "N/A"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-600">{item.owner_name || "Não atribuído"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-600">{item.focal_point_name || "Não atribuído"}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-slate-50 text-slate-600 border-slate-100">{item.risk_title || "N/A"}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleExpand(item.id_control)}
                              className="mx-auto inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                            >
                              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              {isExpanded ? "Ocultar" : "Expandir"}
                            </button>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tipo de valor</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Direção</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Meta</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Warning</th>
                                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.items.map((kpi) => {
                                      const valueTypeNow = inferValueType(kpi)
                                      const directionNow = inferDirection(kpi)
                                      const warningNow = inferWarningMargin(kpi)
                                      const kpiConfigured = isKpiConfigured(kpi)
                                      return (
                                        <tr key={kpi.kpi_uuid}>
                                          <td className="px-4 py-3">
                                            <div className="text-xs font-semibold text-slate-700 inline-flex items-center gap-2">
                                              <span>{kpi.kpi_name}</span>
                                              {kpiConfigured ? (
                                                <span title="Regra configurada">
                                                  <CheckCircle2 size={13} className="text-emerald-600" />
                                                </span>
                                              ) : (
                                                <span title="Regra pendente">
                                                  <Clock3 size={13} className="text-amber-500" />
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{kpi.kpi_id}</div>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                                              {valueTypeNow === "PERCENT" ? "%" : valueTypeNow === "NUMBER" ? "NUM" : "SIM/NÃO"}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center text-xs text-slate-600 font-semibold">
                                            {directionNow === "UP" ? "Maior melhor" : directionNow === "DOWN" ? "Menor melhor" : "Booleano"}
                                          </td>
                                          <td className="px-4 py-3 text-center text-xs font-semibold text-slate-700">{safeText(kpi.kpi_target) || "N/A"}</td>
                                          <td className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                                            {valueTypeNow === "BOOLEAN" ? "N/A" : warningNow}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <button
                                              onClick={() => openConfig(kpi)}
                                              className="inline-flex items-center px-3 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded uppercase tracking-widest"
                                            >
                                              Configurar
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center text-slate-400 text-sm italic">Nenhum KPI encontrado para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {configOpen && selectedKpi ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfigOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Configurar KPI</h3>
              <p className="text-sm text-slate-500 mt-1">{selectedKpi.kpi_name} ({selectedKpi.kpi_id})</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Tipo de valor</label>
                  <select
                    value={valueType}
                    onChange={(e) => {
                      const next = e.target.value as ValueType
                      setValueType(next)
                      if (next === "BOOLEAN") setDirection("BOOLEAN")
                      else if (direction === "BOOLEAN") setDirection("UP")
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866]"
                  >
                    <option value="PERCENT">Percentual (%)</option>
                    <option value="NUMBER">Numérico</option>
                    <option value="BOOLEAN">Sim / Não</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Direção da meta</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as Direction)}
                    disabled={valueType === "BOOLEAN"}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866] disabled:opacity-50"
                  >
                    <option value="UP">Quanto maior, melhor</option>
                    <option value="DOWN">Quanto menor, melhor</option>
                    <option value="BOOLEAN">Booleano</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Meta</label>
                  {valueType === "BOOLEAN" ? (
                    <select
                      value={targetBoolean}
                      onChange={(e) => setTargetBoolean(e.target.value as "SIM" | "NAO")}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866]"
                    >
                      <option value="SIM">Sim</option>
                      <option value="NAO">Não</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866]"
                      placeholder={valueType === "PERCENT" ? "Ex: 90" : "Ex: 120"}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Faixa de warning (YELLOW)</label>
                <input
                  type="number"
                  value={warningMargin}
                  onChange={(e) => setWarningMargin(e.target.value)}
                  disabled={valueType === "BOOLEAN"}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71866] disabled:opacity-50"
                  placeholder={valueType === "PERCENT" ? "Ex: 5" : "Ex: 10"}
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  {valueType === "BOOLEAN"
                    ? "Para Sim/Não não existe faixa de warning."
                    : direction === "UP"
                    ? "Exemplo: meta 90 e warning 5 => GREEN >= 90 | YELLOW entre 85 e 89.99 | RED < 85"
                    : "Exemplo: meta 90 e warning 5 => GREEN <= 90 | YELLOW entre 90.01 e 95 | RED > 95"}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f71963] text-white text-sm font-bold hover:bg-[#d61556] disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
      ) : null}

      {activeTab === "EVIDENCE_UPLOAD" ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Configuração de Upload no Google Drive</h3>
            <p className="text-sm text-slate-500 mt-1">
              As evidências serão organizadas automaticamente em pastas: <b>Mês de Referência / Controle / KPI</b>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Provedor</label>
              <select
                value={uploadConfig.provider}
                onChange={(e) =>
                  setUploadConfig((p) => ({
                    ...p,
                    provider: (e.target.value as UploadProvider) || "GOOGLE_DRIVE",
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none"
              >
                <option value="GOOGLE_DRIVE">Google Drive</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status do Upload</label>
              <select
                value={uploadConfig.enabled ? "enabled" : "disabled"}
                onChange={(e) =>
                  setUploadConfig((p) => ({
                    ...p,
                    enabled: e.target.value === "enabled",
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none"
              >
                <option value="enabled">Habilitado</option>
                <option value="disabled">Desabilitado</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                ID da Pasta Raiz no Google Drive
              </label>
              <input
                type="text"
                value={uploadConfig.drive_root_folder_id}
                onChange={(e) => setUploadConfig((p) => ({ ...p, drive_root_folder_id: e.target.value }))}
                placeholder="Ex.: 1AbCdEfGhIjKlMnOpQrStUvWxYz"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                O sistema não cria duplicatas: reaproveita pastas existentes e cria apenas quando necessário.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveUploadConfig}
              disabled={savingUpload}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f71963] text-white text-sm font-bold hover:bg-[#d61556] disabled:opacity-60"
            >
              {savingUpload ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Configuração
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "JIRA" ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Integração com Jira</h3>
            <p className="text-sm text-slate-500 mt-1">
              Quando habilitada, cada plano de ação novo criado pelo sistema gera automaticamente uma issue no Jira.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status da Integração</label>
              <select
                value={jiraConfig.enabled ? "enabled" : "disabled"}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, enabled: e.target.value === "enabled" }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none"
              >
                <option value="enabled">Habilitada</option>
                <option value="disabled">Desabilitada</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Projeto Padrão</label>
              <input
                type="text"
                value={jiraConfig.project_key}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, project_key: e.target.value.toUpperCase() }))}
                placeholder="TAP"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">URL Base do Jira</label>
              <input
                type="text"
                value={jiraConfig.base_url}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, base_url: e.target.value }))}
                placeholder="https://suaempresa.atlassian.net"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Usuário / E-mail Técnico</label>
              <input
                type="email"
                value={jiraConfig.user_email}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, user_email: e.target.value }))}
                placeholder="grc-bot@empresa.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Epic Fixo Controles</label>
              <input
                type="text"
                value={jiraConfig.epic_controles_key}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, epic_controles_key: e.target.value.toUpperCase() }))}
                placeholder="TAP-189"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Epic Fixo Automações</label>
              <input
                type="text"
                value={jiraConfig.epic_automacoes_key}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, epic_automacoes_key: e.target.value.toUpperCase() }))}
                placeholder="TAP-190"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Issue Type da Story</label>
              <input
                type="text"
                value={jiraConfig.story_issue_type}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, story_issue_type: e.target.value }))}
                placeholder="Story"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Issue Type da Task</label>
              <input
                type="text"
                value={jiraConfig.task_issue_type}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, task_issue_type: e.target.value }))}
                placeholder="Task"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">API Token</label>
              <input
                type="password"
                value={jiraConfig.api_token}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, api_token: e.target.value }))}
                placeholder="Token gerado no Atlassian"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                O sistema usa autenticação Basic com e-mail técnico + API token do Atlassian Cloud.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Framework Field ID</label>
              <input
                type="text"
                value={jiraConfig.framework_field_id}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, framework_field_id: e.target.value }))}
                placeholder="customfield_16627"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-[#f71963]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Fallback de Framework</label>
              <select
                value={jiraConfig.use_framework_labels ? "labels" : "field-only"}
                onChange={(e) => setJiraConfig((prev) => ({ ...prev, use_framework_labels: e.target.value === "labels" }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none"
              >
                <option value="field-only">Somente campo customizado</option>
                <option value="labels">Campo + labels</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            O fluxo atual no Jira fica preparado para: Epic fixo por domínio, Story por controle e issue do plano abaixo da Story. O framework é enviado no campo configurado acima.
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleTestJiraConfig}
              disabled={testingJira}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {testingJira ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Testar Conexão
            </button>
            <button
              type="button"
              onClick={handleSaveJiraConfig}
              disabled={savingJira}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f71963] text-white text-sm font-bold hover:bg-[#d61556] disabled:opacity-60"
            >
              {savingJira ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Configuração
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
