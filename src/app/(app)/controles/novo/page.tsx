// src/app/(app)/controles/novo/page.tsx
"use client"

import React, { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { importarControles } from "../actions" // Importação da Action
// @ts-ignore
import Papa from "papaparse"
import {
  ChevronLeft,
  Save,
  ShieldAlert,
  Users,
  Activity,
  Target,
  Info,
  CheckCircle2,
  Search,
  Plus,
  Upload,
  Download,
  Table as TableIcon,
  X,
  Check,
  FileSpreadsheet,
  AlertCircle,
  Cpu,
  Loader2,
} from "lucide-react"

const CSV_HEADERS = [
  "id_control",
  "name_control",
  "description_control",
  "goal_control",
  "framework",
  "owner_name",
  "owner_email",
  "owner_area",
  "focal_point_name",
  "focal_point_email",
  "focal_point_area",
  "frequency",
  "risk_id",
  "risk_name",
  "risk_title",
  "risk_description",
  "kpi_id",
  "kpi_name",
  "kpi_type",
  "kpi_target",
  "kpi_value_type",
  "kpi_direction",
  "kpi_warning_margin",
  "kpi_description",
  "status",
]

const CSV_REQUIRED_FIELDS = [
  { name: "id_control", description: "Identificador do controle. Cada controle pode aparecer em mais de uma linha quando tiver vários KPIs." },
  { name: "kpi_id", description: "Identificador do KPI. Linhas sem esse campo são ignoradas na importação." },
]

const CSV_COLUMN_GUIDE = [
  { name: "id_control", kind: "Obrigatória", description: "Código único do controle. Ex.: CONT-001 ou ITGC-01." },
  { name: "name_control", kind: "Recomendada", description: "Nome amigável do controle." },
  { name: "description_control", kind: "Opcional", description: "Descrição detalhada do controle." },
  { name: "goal_control", kind: "Opcional", description: "Objetivo do controle." },
  { name: "framework", kind: "Opcional", description: "Framework associado. Ex.: SOX, ISO27001, PCI-DSS." },
  { name: "owner_name", kind: "Opcional", description: "Nome do owner do controle." },
  { name: "owner_email", kind: "Opcional", description: "E-mail do owner." },
  { name: "owner_area", kind: "Opcional", description: "Área responsável pelo owner." },
  { name: "focal_point_name", kind: "Opcional", description: "Nome do ponto focal." },
  { name: "focal_point_email", kind: "Opcional", description: "E-mail do ponto focal." },
  { name: "focal_point_area", kind: "Opcional", description: "Área do ponto focal." },
  { name: "frequency", kind: "Opcional", description: "Periodicidade do controle. O sistema normaliza PT/EN." },
  { name: "risk_id", kind: "Opcional", description: "Código do risco relacionado." },
  { name: "risk_name", kind: "Opcional", description: "Nome do risco." },
  { name: "risk_title", kind: "Opcional", description: "Classificação do risco." },
  { name: "risk_description", kind: "Opcional", description: "Descrição do risco." },
  { name: "kpi_id", kind: "Obrigatória", description: "Código único do KPI dentro do controle." },
  { name: "kpi_name", kind: "Recomendada", description: "Nome do KPI." },
  { name: "kpi_type", kind: "Opcional", description: "Tipo do KPI. Manual ou Automated." },
  { name: "kpi_target", kind: "Opcional", description: "Meta do KPI. Ex.: 95, 100%, Sim." },
  { name: "kpi_value_type", kind: "Opcional", description: "Tipo do valor da meta: NUMBER, PERCENT ou BOOLEAN." },
  { name: "kpi_direction", kind: "Opcional", description: "Direção da meta: UP, DOWN ou BOOLEAN." },
  { name: "kpi_warning_margin", kind: "Opcional", description: "Faixa de warning. Ex.: 5 ou 10%." },
  { name: "kpi_description", kind: "Opcional", description: "Descrição da lógica do KPI." },
  { name: "status", kind: "Opcional", description: "Status textual do controle. Recomendado usar Ativo ou Inativo." },
]

const CSV_ACCEPTED_OPTIONS = [
  {
    column: "frequency",
    helper: "Pode ser enviada em português ou inglês; o sistema converte para o padrão interno.",
    values: [
      "DAILY: diário, diaria, diariamente, daily, day, todo_dia, todos_os_dias, D1, D+1",
      "WEEKLY: semanal, weekly, week, w, wk, w1",
      "MONTHLY: mensal, monthly, month, m, mo, mon",
      "QUARTERLY: trimestral, quarterly, quarter, quart, q, qtr, q1-q4",
      "SEMI_ANNUAL: semestral, semestre, semi_annual, semiannual, semi, half, h1, h2",
      "ANNUAL: anual, annual, yearly, year, y, yr",
      "ON_DEMAND: sob demanda, on_demand, on-demand, ondemand, ad hoc, adhoc, event, as needed",
    ],
  },
  {
    column: "risk_title",
    helper: "A classificação do risco é normalizada para três níveis internos.",
    values: [
      "CRITICAL: high, alto, critical, crítico",
      "MEDIUM: medium, médio, medio",
      "LOW: low, baixo",
    ],
  },
  {
    column: "kpi_type",
    helper: "Qualquer valor com 'aut' ou 'api' vira Automated; os demais viram Manual.",
    values: ["Manual", "Automated", "Automated (API/Script)"],
  },
  {
    column: "kpi_value_type",
    helper: "Se não for informado, o sistema tenta inferir pela meta.",
    values: [
      "BOOLEAN: boolean, bool, sim_nao, sim/nao, yes_no, yes/no",
      "PERCENT: percent, percentual, percentage, %",
      "NUMBER: number, numeric, numeral, numero, número",
    ],
  },
  {
    column: "kpi_direction",
    helper: "Define se a meta é melhor quando sobe ou quando desce.",
    values: [
      "UP: up, higher_better, maior_melhor, maior, asc, ascendente, increase",
      "DOWN: down, lower_better, menor_melhor, menor, desc, descendente, decrease",
      "BOOLEAN: boolean, bool",
    ],
  },
  {
    column: "kpi_target",
    helper: "Formato esperado depende do tipo do KPI.",
    values: [
      "BOOLEAN: Sim, Não, Yes, No, True, False, 1, 0, Conforme, Não Conforme",
      "PERCENT: 95%, 100%, 87,5%",
      "NUMBER: 10, 42, 99.5",
    ],
  },
  {
    column: "kpi_warning_margin",
    helper: "Aceita número puro ou percentual. O sistema remove '%' quando necessário.",
    values: ["5", "10", "2.5", "7,5", "10%"],
  },
  {
    column: "status",
    helper: "Esse campo é gravado como texto. Para consistência operacional, recomendamos padronizar.",
    values: ["Ativo", "Inativo"],
  },
]

export default function CadastroControlePage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-bold text-slate-400">Carregando formulário...</div>}>
      <CadastroControleContent />
    </Suspense>
  )
}

function CadastroControleContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const mode = searchParams.get("mode")

  const [metodoCadastro, setMetodoCadastro] = useState<"individual" | "massivo">("individual")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (mode === "massivo") {
      setMetodoCadastro("massivo")
    } else {
      setMetodoCadastro("individual")
    }
  }, [mode])

  const [frameworks, setFrameworks] = useState(["SOX", "SOC", "PCI-DSS", "ISO27001", "ISO27701"])
  const [selectedFramework, setSelectedFramework] = useState("SOX")
  const [customFramework, setCustomFramework] = useState("")

  const [catalogoRiscos, setCatalogoRiscos] = useState([
    {
      id: "r1",
      code: "RSK-LOG",
      title: "Acesso Lógico Indevido",
      class: "HIGH",
      desc: "Risco de usuários acessarem dados sensíveis sem permissão adequada.",
    },
    {
      id: "r2",
      code: "RSK-CHG",
      title: "Mudança Não Homologada",
      class: "CRITICAL",
      desc: "Alterações em produção sem testes prévios ou aprovação.",
    },
    { id: "r3", code: "RSK-BCK", title: "Perda de Dados", class: "MED", desc: "Falha na rotina de backup ou integridade das fitas/nuvem." },
  ])
  const [selectedRisk, setSelectedRisk] = useState<any>(null)
  const [riskSearchId, setRiskSearchId] = useState("")
  const [isCreatingRisk, setIsCreatingRisk] = useState(false)
  const [newRiskData, setNewRiskData] = useState({ code: "", title: "", class: "MED", desc: "" })

  const [dragActive, setDragActive] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [formIndividual, setFormIndividual] = useState<any>({
    id_control: "",
    name_control: "",
    description_control: "", // NOVA COLUNA
    goal_control: "", // NOVA COLUNA
    owner_name: "",
    owner_email: "",
    owner_area: "",
    focal_point_name: "",
    focal_point_email: "",
    focal_point_area: "",
    frequency: "MONTHLY",
    kpi_id: "",
    kpi_name: "",
    kpi_description: "",
    kpi_type: "Manual",
    kpi_target: "",
    risk_description: "",
  })

  useEffect(() => {
    if (selectedFramework !== "NEW") setCustomFramework("")
  }, [selectedFramework])

  const normalizarDados = (data: any[]) => {
    const stripAccents = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()

    const normalizeFrequency = (v: any) => {
      const raw = (v ?? "").toString().trim()
      if (!raw) return "ON_DEMAND"

      // normaliza: lower + sem acento + tokens
      const base = stripAccents(raw).toLowerCase()
      const key = base
        .replace(/\s+/g, "_")
        .replace(/-+/g, "_")
        .replace(/__+/g, "_")

      // se já vier canônico (em qualquer casing)
      const canonical = new Set([
        "daily",
        "weekly",
        "monthly",
        "quarterly",
        "semi_annual",
        "semiannual",
        "annual",
        "on_demand",
        "on_demand",
        "on-demand",
        "ondemand",
      ])
      if (canonical.has(key)) {
        if (key === "semiannual") return "SEMI_ANNUAL"
        if (key === "on-demand" || key === "ondemand") return "ON_DEMAND"
        return key.toUpperCase()
      }

      // DAILY / DIÁRIO
      if (
        key.includes("diar") || // diario, diaria, diariamente
        key.includes("daily") ||
        key === "day" ||
        key.includes("todo_dia") ||
        key.includes("todos_os_dias") ||
        key === "d1" ||
        key === "d+1" ||
        key.includes("d+1")
      ) {
        return "DAILY"
      }

      // WEEKLY / SEMANAL
      if (
        key.includes("seman") || // semanal, semana
        key.includes("weekly") ||
        key.includes("week") ||
        key === "w" ||
        key === "wk" ||
        key === "w1"
      ) {
        return "WEEKLY"
      }

      // MONTHLY / MENSAL
      if (key.includes("men") || key.includes("month") || key === "m" || key === "mo" || key === "mon") {
        return "MONTHLY"
      }

      // QUARTERLY / TRIMESTRAL
      if (key.includes("tri") || key.includes("quart") || key === "q" || key === "qtr" || /^q[1-4]$/.test(key)) {
        return "QUARTERLY"
      }

      // SEMI_ANNUAL / SEMESTRAL
      if (key.includes("semest") || key.includes("semi") || key.includes("half") || key === "h1" || key === "h2") {
        return "SEMI_ANNUAL"
      }

      // ANNUAL / ANUAL
      if (key.includes("anual") || key.includes("annu") || key.includes("year") || key === "y" || key === "yr") {
        return "ANNUAL"
      }

      // ON_DEMAND / SOB DEMANDA
      if (
        key.includes("sob") ||
        key.includes("demand") ||
        key.includes("ad_hoc") ||
        key.includes("adhoc") ||
        key.includes("event") ||
        key.includes("as_need") ||
        key.includes("needed")
      ) {
        return "ON_DEMAND"
      }

      // fallback seguro
      return "ON_DEMAND"
    }

    const normalizeKpiValueType = (v: any, targetRaw: any) => {
      const s = (v ?? "")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
      if (["BOOLEAN", "BOOL", "SIM_NAO", "SIM/NAO", "YES_NO", "YES/NO"].includes(s)) return "BOOLEAN"
      if (["PERCENT", "PERCENTUAL", "PERCENTAGE", "%"].includes(s)) return "PERCENT"
      if (["NUMBER", "NUMERIC", "NUMERAL", "NUMERO", "NÚMERO"].includes(s)) return "NUMBER"

      const t = (targetRaw ?? "").toString().trim()
      const tLow = t.toLowerCase()
      if (["sim", "nao", "não", "true", "false", "yes", "no", "1", "0"].includes(tLow)) return "BOOLEAN"
      if (t.includes("%")) return "PERCENT"
      return "NUMBER"
    }

    const normalizeKpiDirection = (v: any, valueType: string) => {
      if (valueType === "BOOLEAN") return "BOOLEAN"
      const s = (v ?? "")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
      if (["DOWN", "LOWER_BETTER", "MENOR_MELHOR", "MENOR", "DESC"].includes(s)) return "DOWN"
      return "UP"
    }

    const normalizeWarningMargin = (v: any) => {
      const raw = (v ?? "").toString().trim()
      if (!raw) return ""
      const numeric = Number(raw.replace("%", "").replace(",", "."))
      return Number.isFinite(numeric) ? String(numeric) : raw
    }

    return data.map((row) => {
      let rTitle = row.risk_title?.toString().trim().toLowerCase() || ""
      if (["high", "alto", "crítico", "critical"].includes(rTitle)) rTitle = "CRITICAL"
      else if (["medium", "médio", "medio"].includes(rTitle)) rTitle = "MEDIUM"
      else if (["low", "baixo"].includes(rTitle)) rTitle = "LOW"

      // ✅ NORMALIZAÇÃO DE FREQUÊNCIA (agora inclui DAILY e WEEKLY)
      const freq = normalizeFrequency(row.frequency)

      let kType = row.kpi_type?.toString().trim().toLowerCase() || ""
      if (kType.includes("aut") || kType.includes("api")) kType = "Automated"
      else kType = "Manual"

      const kpiValueType = normalizeKpiValueType(row.kpi_value_type, row.kpi_target)
      const kpiDirection = normalizeKpiDirection(row.kpi_direction || row.kpi_evaluation_mode, kpiValueType)
      const kpiWarningMargin = normalizeWarningMargin(row.kpi_warning_margin)

      return {
        ...row,
        risk_title: rTitle,
        frequency: freq,
        kpi_type: kType,
        kpi_value_type: kpiValueType,
        kpi_direction: kpiDirection,
        kpi_warning_margin: kpiWarningMargin,
      }
    })
  }

  const baixarTemplateCSV = () => {
    const headers = [
      "id_control",
      "name_control",
      "description_control",
      "goal_control",
      "framework",
      "owner_name",
      "owner_email",
      "owner_area",
      "focal_point_name",
      "focal_point_email",
      "focal_point_area",
      "frequency",
      "risk_id",
      "risk_name",
      "risk_title",
      "risk_description",
      "kpi_id",
      "kpi_name",
      "kpi_type",
      "kpi_target",
      "kpi_value_type",
      "kpi_direction",
      "kpi_warning_margin",
      "kpi_description",
      "status",
    ]

    const row = [
      "CONT-001",
      "Revisão de Logs",
      "Descrição detalhada do controle",
      "Objetivo do controle",
      "SOX",
      "João Silva",
      "joao@empresa.com",
      "TI",
      "Maria Souza",
      "maria@empresa.com",
      "Riscos",
      "Mensal",
      "RSK-01",
      "Acesso Indevido",
      "Alto",
      "Descricao do risco aqui",
      "KPI-01",
      "Log Success",
      "Automated",
      "100%",
      "PERCENT",
      "UP",
      "5",
      "Descrição da métrica do KPI aqui",
      "Ativo",
    ]

    const csvContent = [headers, row].map((e) => e.join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "modelo_controles_v5.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (e: any) => {
    e.preventDefault()
    setDragActive(false)
    setUploadError(null)
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0]
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          if (results.data.length > 0) {
            if (!results.meta.fields?.includes("id_control")) {
              setUploadError("Arquivo inválido. Use o modelo correto com a coluna 'id_control'.")
              return
            }
            const dadosTratados = normalizarDados(results.data)
            setPreviewData(dadosTratados)
          }
        },
        error: (error: any) => {
          setUploadError("Erro ao ler o arquivo CSV: " + error.message)
        },
      })
    } else {
      setUploadError("Por favor, selecione um arquivo .csv válido.")
    }
  }

  const handleRiskSearch = () => {
    const found = catalogoRiscos.find(
      (r) => r.code.toLowerCase().includes(riskSearchId.toLowerCase()) || r.id.toLowerCase() === riskSearchId.toLowerCase()
    )
    if (found) {
      setSelectedRisk(found)
      setIsCreatingRisk(false)
    } else {
      alert("Risco não encontrado no catálogo.")
    }
  }

  const handlePublish = async () => {
    setIsSubmitting(true)
    let payload: any[] = []

    if (metodoCadastro === "massivo") {
      if (previewData.length === 0) {
        alert("Nenhum dado para importar.")
        setIsSubmitting(false)
        return
      }
      payload = previewData
    } else {
      const individualData = {
        ...formIndividual,
        framework: selectedFramework === "NEW" ? customFramework : selectedFramework,
        risk_id: selectedRisk?.code || "NEW",
        risk_name: selectedRisk?.title || "Novo Risco",
        risk_title: selectedRisk?.class || "MEDIUM",
        status: "Ativo",
      }

      if (!individualData.id_control || !individualData.name_control) {
        alert("Preencha ao menos o Código e o Nome do Controle.")
        setIsSubmitting(false)
        return
      }
      payload = [individualData]
    }

    try {
      const result = await importarControles(payload)
      if (result.success) {
        alert("Sucesso! Controles registrados.")
        if (metodoCadastro === "massivo") {
          setPreviewData([])
          setUploadError(null)
        } else {
          setFormIndividual({
            id_control: "",
            name_control: "",
            description_control: "",
            goal_control: "",
            owner_name: "",
            owner_email: "",
            owner_area: "",
            focal_point_name: "",
            focal_point_email: "",
            focal_point_area: "",
            frequency: "MONTHLY",
            kpi_id: "",
            kpi_name: "",
            kpi_description: "",
            kpi_type: "Manual",
            kpi_target: "",
            risk_description: "",
          })
          setSelectedRisk(null)
          setRiskSearchId("")
        }
        router.refresh()
      } else {
        alert(result.error)
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/controles"
            className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors mb-2"
          >
            <ChevronLeft size={14} /> Voltar para Controles
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Novo Controle</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Configure o controle ou importe via planilha.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setMetodoCadastro("individual")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              metodoCadastro === "individual" ? "bg-white text-[#f71866] shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setMetodoCadastro("massivo")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              metodoCadastro === "massivo" ? "bg-white text-[#f71866] shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Upload CSV
          </button>
        </div>
      </header>

      {metodoCadastro === "individual" ? (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <FormSection icon={<Info className="text-blue-500" />} title="Identificação do Controle">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Framework</label>
                  <select
                    value={selectedFramework}
                    onChange={(e) => setSelectedFramework(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition-all"
                  >
                    {frameworks.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value="NEW" className="text-[#f71866] font-bold">
                      + Adicionar Novo...
                    </option>
                  </select>
                </div>

                {selectedFramework === "NEW" ? (
                  <div className="col-span-1 space-y-2 animate-in slide-in-from-left-2 duration-300">
                    <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">Novo Framework</label>
                    <input
                      type="text"
                      value={customFramework}
                      onChange={(e) => setCustomFramework(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border-2 border-[#f71866]/30 rounded-xl text-sm outline-none"
                      placeholder="Ex: LGPD"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="col-span-1 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código do Controle</label>
                    <input
                      type="text"
                      value={formIndividual.id_control}
                      onChange={(e) => setFormIndividual({ ...formIndividual, id_control: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                      placeholder="Ex: ITGC-01"
                    />
                  </div>
                )}

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Controle</label>
                  <input
                    type="text"
                    value={formIndividual.name_control}
                    onChange={(e) => setFormIndividual({ ...formIndividual, name_control: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: User Access Review"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição do Controle</label>
                  <textarea
                    rows={2}
                    value={formIndividual.description_control}
                    onChange={(e) => setFormIndividual({ ...formIndividual, description_control: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
                    placeholder="Explique o que é este controle..."
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Objetivo do Controle</label>
                  <input
                    type="text"
                    value={formIndividual.goal_control}
                    onChange={(e) => setFormIndividual({ ...formIndividual, goal_control: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: Garantir que apenas usuários autorizados tenham acesso..."
                  />
                </div>
              </div>
            </FormSection>

            <FormSection icon={<Users className="text-purple-500" />} title="Matriz de Responsabilidade">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Owner</label>
                  <input
                    type="email"
                    value={formIndividual.owner_email}
                    onChange={(e) => setFormIndividual({ ...formIndividual, owner_email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="owner@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área Owner</label>
                  <input
                    type="text"
                    value={formIndividual.owner_area}
                    onChange={(e) => setFormIndividual({ ...formIndividual, owner_area: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: TI"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Ponto Focal</label>
                  <input
                    type="email"
                    value={formIndividual.focal_point_email}
                    onChange={(e) => setFormIndividual({ ...formIndividual, focal_point_email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="focal@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área Ponto Focal</label>
                  <input
                    type="text"
                    value={formIndividual.focal_point_area}
                    onChange={(e) => setFormIndividual({ ...formIndividual, focal_point_area: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: Riscos"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection icon={<ShieldAlert className="text-red-500" />} title="Risco e Periodicidade">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frequência</label>
                  <select
                    value={formIndividual.frequency}
                    onChange={(e) => setFormIndividual({ ...formIndividual, frequency: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  >
                    <option value="DAILY">Diário</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensal</option>
                    <option value="QUARTERLY">Trimestral</option>
                    <option value="SEMI_ANNUAL">Semestral</option>
                    <option value="ANNUAL">Anual</option>
                    <option value="ON_DEMAND">Sob Demanda</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buscar Risco (ID)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={riskSearchId}
                      onChange={(e) => setRiskSearchId(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#f71866]/20"
                      placeholder="Ex: RSK-LOG"
                    />
                    <button onClick={handleRiskSearch} className="px-4 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                      <Search size={18} />
                    </button>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vincular Risco do Catálogo</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    value={isCreatingRisk ? "NEW" : selectedRisk?.id || ""}
                    onChange={(e) => {
                      if (e.target.value === "NEW") {
                        setIsCreatingRisk(true)
                        setSelectedRisk(null)
                      } else {
                        setIsCreatingRisk(false)
                        setSelectedRisk(catalogoRiscos.find((x) => x.id === e.target.value))
                      }
                    }}
                  >
                    <option value="">Selecione um Risco...</option>
                    <option value="NEW" className="text-[#f71866] font-bold">
                      + Cadastrar Novo Risco...
                    </option>
                    {catalogoRiscos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} - {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                {isCreatingRisk && (
                  <div className="col-span-2 grid grid-cols-2 gap-4 border-l-4 border-[#f71866] bg-slate-50 p-4 rounded-r-xl animate-in slide-in-from-top-2">
                    <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">ID do Risco</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                        placeholder="Ex: RSK-01"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">Título do Risco</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                        placeholder="Ex: Falha na integridade dos dados"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">Descrição do Risco</label>
                      <textarea
                        rows={2}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none"
                        placeholder="Descreva as consequências e causas do risco..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection icon={<Target className="text-emerald-500" />} title="Métricas e Evidências">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID do KPI</label>
                  <input
                    type="text"
                    value={formIndividual.kpi_id}
                    onChange={(e) => setFormIndividual({ ...formIndividual, kpi_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: KPI-01"
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do KPI</label>
                  <input
                    type="text"
                    value={formIndividual.kpi_name}
                    onChange={(e) => setFormIndividual({ ...formIndividual, kpi_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: % de Usuários"
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de KPI</label>
                  <select
                    value={formIndividual.kpi_type}
                    onChange={(e) => setFormIndividual({ ...formIndividual, kpi_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Automated">Automated (API/Script)</option>
                  </select>
                </div>
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target (Meta)</label>
                  <input
                    type="text"
                    value={formIndividual.kpi_target}
                    onChange={(e) => setFormIndividual({ ...formIndividual, kpi_target: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    placeholder="Ex: 100%"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição do KPI</label>
                  <textarea
                    rows={2}
                    value={formIndividual.kpi_description}
                    onChange={(e) => setFormIndividual({ ...formIndividual, kpi_description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
                    placeholder="Descreva a regra de cálculo do KPI..."
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evidência Necessária (Descritivo)</label>
                  <textarea
                    rows={3}
                    value={formIndividual.risk_description}
                    onChange={(e) => setFormIndividual({ ...formIndividual, risk_description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
                    placeholder="Descreva quais arquivos ou logs comprovam este controle..."
                  />
                </div>
              </div>
            </FormSection>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="bg-slate-900 rounded-2xl p-6 text-white sticky top-8 shadow-xl">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                <Activity size={20} className="text-[#f71866]" />
                Resumo da Operação
              </h3>
              <div className="space-y-4">
                <SummaryItem label="Modo" value="Manual" />
                <SummaryItem label="Framework" value={selectedFramework === "NEW" ? customFramework || "Novo" : selectedFramework} />
                <SummaryItem label="Risco Vinculado" value={isCreatingRisk ? "Novo Risco" : selectedRisk ? selectedRisk.code : "Pendente"} />
              </div>
              <hr className="my-8 border-white/10" />
              <div className="space-y-3 flex flex-col">
                <button
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="bg-[#f71866] hover:bg-[#d61556] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#f71866]/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {isSubmitting ? "Gravando..." : "Finalizar Cadastro"}
                </button>
                <button className="text-slate-400 text-xs font-bold hover:text-white transition-colors py-2">Cancelar Alterações</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --- TELA DE UPLOAD CSV (MASSIVO) --- */
        <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragActive(false)
            }}
            onDrop={handleFileUpload}
            className={`border-4 border-dashed rounded-[2.5rem] p-20 flex flex-col items-center justify-center transition-all duration-300 ${
              dragActive ? "border-[#f71866] bg-[#f71866]/5 scale-[1.01]" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 transition-colors ${
                dragActive ? "bg-[#f71866] text-white" : "bg-slate-50 text-slate-300"
              }`}
            >
              <FileSpreadsheet size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 text-center">Importação em Massa</h2>
            <p className="text-slate-500 text-center mt-3 max-w-sm font-medium">
              {dragActive ? "Pode soltar o arquivo!" : "Arraste seu CSV com as 25 colunas preenchidas ou use o seletor abaixo."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full justify-center">
              <label className="flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm cursor-pointer hover:bg-black transition-all active:scale-95">
                <Upload size={18} /> Selecionar CSV
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv" />
              </label>
              <button
                onClick={baixarTemplateCSV}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                <Download size={18} /> Baixar Modelo (25 colunas)
              </button>
            </div>

            {uploadError && (
              <div className="mt-6 flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-lg animate-in fade-in">
                <AlertCircle size={16} />
                <span className="text-xs font-bold">{uploadError}</span>
              </div>
            )}

            <div className="mt-8 flex items-center gap-2 text-slate-400">
              <Info size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                O sistema aceita termos em Português/Inglês para Risco, Frequência, Tipo de KPI e regras de meta
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Guia da Planilha CSV</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Use os cabeçalhos exatamente como no modelo. Os analistas podem repetir o mesmo <span className="font-semibold">id_control</span> em várias linhas para cadastrar mais de um KPI no mesmo controle.
                </p>
              </div>

              <div className="p-6 space-y-6">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Campos obrigatórios</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {CSV_REQUIRED_FIELDS.map((field) => (
                      <div key={field.name} className="rounded-2xl bg-white/90 border border-emerald-100 px-4 py-3">
                        <p className="font-bold text-sm text-slate-900">{field.name}</p>
                        <p className="text-xs text-slate-600 mt-1 leading-5">{field.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">25 colunas do modelo</p>
                      <p className="text-xs text-slate-500 mt-1">A ordem abaixo corresponde ao arquivo disponibilizado para download.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CSV_HEADERS.map((header) => (
                      <span
                        key={header}
                        className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold tracking-wide"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 mb-3">O que preencher em cada coluna</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {CSV_COLUMN_GUIDE.map((column) => (
                      <div key={column.name} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-sm text-slate-900">{column.name}</p>
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              column.kind === "Obrigatória"
                                ? "bg-[#f71866] text-white"
                                : column.kind === "Recomendada"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {column.kind}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 leading-5">{column.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 text-white rounded-[2rem] shadow-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-white/10">
                <h3 className="text-lg font-bold">Valores aceitos nas colunas padronizadas</h3>
                <p className="text-sm text-slate-300 mt-1">
                  Estas colunas passam por normalização automática. Preenchendo conforme os exemplos abaixo, a importação fica mais previsível.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {CSV_ACCEPTED_OPTIONS.map((section) => (
                  <div key={section.column} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="font-bold text-sm tracking-tight">{section.column}</p>
                    <p className="text-xs text-slate-300 mt-1 leading-5">{section.helper}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {section.values.map((value) => (
                        <span key={value} className="px-3 py-1.5 rounded-full bg-white text-slate-800 text-[11px] font-semibold">
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Boas práticas para o preenchimento</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200 leading-6 list-disc pl-5">
                    <li>Mantenha uma linha por combinação de controle + KPI.</li>
                    <li>Repita os dados do controle quando houver mais de um KPI para o mesmo <span className="font-semibold">id_control</span>.</li>
                    <li>Evite renomear cabeçalhos ou inserir colunas extras no meio do arquivo.</li>
                    <li>Para reduzir retrabalho, use o botão <span className="font-semibold">Baixar Modelo</span> como ponto de partida.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {previewData.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xl animate-in zoom-in-95">
              <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <TableIcon size={18} className="text-[#f71866]" /> Preview ({previewData.length} registros detectados)
              </h3>
                <button onClick={() => setPreviewData([])} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest sticky top-0 z-10">
                    <tr>
                      <th className="px-8 py-4">ID Controle</th>
                      <th className="px-8 py-4">Nome</th>
                      <th className="px-8 py-4">Risco (Normalizado)</th>
                      <th className="px-8 py-4">Tipo KPI</th>
                      <th className="px-8 py-4">Freq.</th>
                      <th className="px-8 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {previewData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-8 py-5 font-bold text-[#f71866]">{item.id_control}</td>
                        <td className="px-8 py-5 text-slate-900">{item.name_control}</td>
                        <td className="px-8 py-5">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              item.risk_title === "CRITICAL"
                                ? "bg-red-100 text-red-600"
                                : item.risk_title === "MEDIUM"
                                ? "bg-amber-100 text-amber-600"
                                : "bg-emerald-100 text-emerald-600"
                            }`}
                          >
                            {item.risk_title}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-1.5">
                            {item.kpi_type === "Automated" ? (
                              <Cpu size={12} className="text-purple-500" />
                            ) : (
                              <Users size={12} className="text-slate-400" />
                            )}
                            <span className="text-[10px] uppercase font-bold text-slate-600">{item.kpi_type}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-slate-500 text-[10px]">{item.frequency}</td>
                        <td className="px-8 py-5 text-center">
                          <CheckCircle2 size={18} className="text-emerald-500 mx-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                  <Check size={16} /> Dados Validados com Sucesso
                </div>
                <button
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-[#f71866] text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-[#f71866]/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                  {isSubmitting ? "Importando..." : `Importar ${previewData.length} Controles`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FormSection({ icon, title, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
        {React.cloneElement(icon, { size: 18 })}
        <h2 className="font-bold text-slate-800 text-sm tracking-tight">{title}</h2>
      </div>
      <div className="p-8">{children}</div>
    </div>
  )
}

function SummaryItem({ label, value }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  )
}
