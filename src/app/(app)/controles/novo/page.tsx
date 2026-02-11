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
  Loader2 
} from "lucide-react"

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
  const mode = searchParams.get('mode')

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
    { id: "r1", code: "RSK-LOG", title: "Acesso Lógico Indevido", class: "HIGH", desc: "Risco de usuários acessarem dados sensíveis sem permissão adequada." },
    { id: "r2", code: "RSK-CHG", title: "Mudança Não Homologada", class: "CRITICAL", desc: "Alterações em produção sem testes prévios ou aprovação." },
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
    goal_control: "",        // NOVA COLUNA
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
    risk_description: ""
  })

  useEffect(() => {
    if (selectedFramework !== "NEW") setCustomFramework("");
  }, [selectedFramework])

  const normalizarDados = (data: any[]) => {
    return data.map(row => {
      let rTitle = row.risk_title?.toString().trim().toLowerCase() || "";
      if (['high', 'alto', 'crítico', 'critical'].includes(rTitle)) rTitle = 'CRITICAL';
      else if (['medium', 'médio', 'medio'].includes(rTitle)) rTitle = 'MEDIUM';
      else if (['low', 'baixo'].includes(rTitle)) rTitle = 'LOW';

      let freq = row.frequency?.toString().trim().toLowerCase() || "";
      if (freq.includes('men')) freq = 'MONTHLY';
      else if (freq.includes('tri')) freq = 'QUARTERLY';
      else if (freq.includes('sem')) freq = 'SEMI_ANNUAL';
      else if (freq.includes('anual') || freq.includes('ann')) freq = 'ANNUAL';
      else freq = 'ON_DEMAND';

      let kType = row.kpi_type?.toString().trim().toLowerCase() || "";
      if (kType.includes('aut') || kType.includes('api')) kType = 'Automated';
      else kType = 'Manual';

      return { ...row, risk_title: rTitle, frequency: freq, kpi_type: kType };
    });
  };

  const baixarTemplateCSV = () => {
    const headers = [
      "id_control", "name_control", "description_control", "goal_control", "framework", "owner_name", "owner_email", 
      "owner_area", "focal_point_name", "focal_point_email", "focal_point_area", 
      "frequency", "risk_id", "risk_name", "risk_title", "risk_description", 
      "kpi_id", "kpi_name", "kpi_type", "kpi_target", "kpi_description", "status"
    ];
    
    const row = [
      "CONT-001", "Revisão de Logs", "Descrição detalhada do controle", "Objetivo do controle", "SOX", "João Silva", "joao@empresa.com",
      "TI", "Maria Souza", "maria@empresa.com", "Riscos", 
      "Mensal", "RSK-01", "Acesso Indevido", "Alto", "Descricao do risco aqui",
      "KPI-01", "Log Success", "Automated", "100%", "Descrição da métrica do KPI aqui", "Ativo"
    ];
    
    const csvContent = [headers, row].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_controles_v4.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: any) => {
    e.preventDefault();
    setDragActive(false);
    setUploadError(null);
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          if (results.data.length > 0) {
            if (!results.meta.fields?.includes("id_control")) {
              setUploadError("Arquivo inválido. Use o modelo correto com a coluna 'id_control'.");
              return;
            }
            const dadosTratados = normalizarDados(results.data);
            setPreviewData(dadosTratados);
          }
        },
        error: (error: any) => { setUploadError("Erro ao ler o arquivo CSV: " + error.message); }
      });
    } else { setUploadError("Por favor, selecione um arquivo .csv válido."); }
  };

  const handleRiskSearch = () => {
    const found = catalogoRiscos.find(r => 
      r.code.toLowerCase().includes(riskSearchId.toLowerCase()) || 
      r.id.toLowerCase() === riskSearchId.toLowerCase()
    )
    if (found) { setSelectedRisk(found); setIsCreatingRisk(false); } 
    else { alert("Risco não encontrado no catálogo."); }
  }

  const handlePublish = async () => {
    setIsSubmitting(true);
    let payload: any[] = [];

    if (metodoCadastro === "massivo") {
      if (previewData.length === 0) { alert("Nenhum dado para importar."); setIsSubmitting(false); return; }
      payload = previewData;
    } else {
      const individualData = {
        ...formIndividual,
        framework: selectedFramework === "NEW" ? customFramework : selectedFramework,
        risk_id: selectedRisk?.code || "NEW",
        risk_name: selectedRisk?.title || "Novo Risco",
        risk_title: selectedRisk?.class || "MEDIUM",
        status: "Ativo"
      };

      if (!individualData.id_control || !individualData.name_control) {
        alert("Preencha ao menos o Código e o Nome do Controle.");
        setIsSubmitting(false);
        return;
      }
      payload = [individualData];
    }

    try {
      const result = await importarControles(payload);
      if (result.success) {
        alert("Sucesso! Controles registrados.");
        if (metodoCadastro === "massivo") { setPreviewData([]); setUploadError(null); } 
        else {
          setFormIndividual({
            id_control: "", name_control: "", description_control: "", goal_control: "", owner_name: "", owner_email: "", owner_area: "",
            focal_point_name: "", focal_point_email: "", focal_point_area: "",
            frequency: "MONTHLY", kpi_id: "", kpi_name: "", kpi_description: "", kpi_type: "Manual",
            kpi_target: "", risk_description: ""
          });
          setSelectedRisk(null); setRiskSearchId("");
        }
        router.refresh();
      } else { alert(result.error); }
    } catch (err) { alert("Erro ao conectar com o servidor."); } 
    finally { setIsSubmitting(false); }
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
                    {frameworks.map(f => <option key={f} value={f}>{f}</option>)}
                    <option value="NEW" className="text-[#f71866] font-bold">+ Adicionar Novo...</option>
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
                    <input type="text" value={formIndividual.id_control} onChange={e => setFormIndividual({...formIndividual, id_control: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: ITGC-01" />
                  </div>
                )}

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Controle</label>
                  <input type="text" value={formIndividual.name_control} onChange={e => setFormIndividual({...formIndividual, name_control: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: User Access Review" />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição do Controle</label>
                  <textarea rows={2} value={formIndividual.description_control} onChange={e => setFormIndividual({...formIndividual, description_control: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none" placeholder="Explique o que é este controle..." />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Objetivo do Controle</label>
                  <input type="text" value={formIndividual.goal_control} onChange={e => setFormIndividual({...formIndividual, goal_control: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: Garantir que apenas usuários autorizados tenham acesso..." />
                </div>
              </div>
            </FormSection>

            <FormSection icon={<Users className="text-purple-500" />} title="Matriz de Responsabilidade">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Owner</label><input type="email" value={formIndividual.owner_email} onChange={e => setFormIndividual({...formIndividual, owner_email: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="owner@empresa.com" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área Owner</label><input type="text" value={formIndividual.owner_area} onChange={e => setFormIndividual({...formIndividual, owner_area: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: TI" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Ponto Focal</label><input type="email" value={formIndividual.focal_point_email} onChange={e => setFormIndividual({...formIndividual, focal_point_email: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="focal@empresa.com" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área Ponto Focal</label><input type="text" value={formIndividual.focal_point_area} onChange={e => setFormIndividual({...formIndividual, focal_point_area: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: Riscos" /></div>
              </div>
            </FormSection>

            <FormSection icon={<ShieldAlert className="text-red-500" />} title="Risco e Periodicidade">
                <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frequência</label>
                        <select value={formIndividual.frequency} onChange={e => setFormIndividual({...formIndividual, frequency: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
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
                            <input type="text" value={riskSearchId} onChange={(e) => setRiskSearchId(e.target.value)} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#f71866]/20" placeholder="Ex: RSK-LOG" />
                            <button onClick={handleRiskSearch} className="px-4 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"><Search size={18} /></button>
                        </div>
                    </div>
                    <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vincular Risco do Catálogo</label>
                        <select 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                            value={isCreatingRisk ? "NEW" : (selectedRisk?.id || "")}
                            onChange={(e) => {
                                if (e.target.value === "NEW") { setIsCreatingRisk(true); setSelectedRisk(null); }
                                else { setIsCreatingRisk(false); setSelectedRisk(catalogoRiscos.find(x => x.id === e.target.value)); }
                            }}
                        >
                            <option value="">Selecione um Risco...</option>
                            <option value="NEW" className="text-[#f71866] font-bold">+ Cadastrar Novo Risco...</option>
                            {catalogoRiscos.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
                        </select>
                    </div>

                    {isCreatingRisk && (
                      <div className="col-span-2 grid grid-cols-2 gap-4 border-l-4 border-[#f71866] bg-slate-50 p-4 rounded-r-xl animate-in slide-in-from-top-2">
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">ID do Risco</label>
                          <input type="text" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Ex: RSK-01" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">Título do Risco</label>
                          <input type="text" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Ex: Falha na integridade dos dados" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest">Descrição do Risco</label>
                          <textarea rows={2} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none" placeholder="Descreva as consequências e causas do risco..." />
                        </div>
                      </div>
                    )}
                </div>
            </FormSection>

            <FormSection icon={<Target className="text-emerald-500" />} title="Métricas e Evidências">
              <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID do KPI</label>
                      <input type="text" value={formIndividual.kpi_id} onChange={e => setFormIndividual({...formIndividual, kpi_id: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: KPI-01" />
                  </div>
                  <div className="col-span-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do KPI</label>
                      <input type="text" value={formIndividual.kpi_name} onChange={e => setFormIndividual({...formIndividual, kpi_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: % de Usuários" />
                  </div>
                  <div className="col-span-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de KPI</label>
                      <select value={formIndividual.kpi_type} onChange={e => setFormIndividual({...formIndividual, kpi_type: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                          <option value="Manual">Manual</option>
                          <option value="Automated">Automated (API/Script)</option>
                      </select>
                  </div>
                  <div className="col-span-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target (Meta)</label>
                      <input type="text" value={formIndividual.kpi_target} onChange={e => setFormIndividual({...formIndividual, kpi_target: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: 100%" />
                  </div>
                  <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição do KPI</label>
                      <textarea rows={2} value={formIndividual.kpi_description} onChange={e => setFormIndividual({...formIndividual, kpi_description: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none" placeholder="Descreva a regra de cálculo do KPI..." />
                  </div>
                  <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evidência Necessária (Descritivo)</label>
                      <textarea rows={3} value={formIndividual.risk_description} onChange={e => setFormIndividual({...formIndividual, risk_description: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none" placeholder="Descreva quais arquivos ou logs comprovam este controle..." />
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
                      <SummaryItem label="Framework" value={selectedFramework === "NEW" ? (customFramework || "Novo") : selectedFramework} />
                      <SummaryItem label="Risco Vinculado" value={isCreatingRisk ? "Novo Risco" : (selectedRisk ? selectedRisk.code : "Pendente")} />
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
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleFileUpload}
            className={`border-4 border-dashed rounded-[2.5rem] p-20 flex flex-col items-center justify-center transition-all duration-300 ${
              dragActive ? "border-[#f71866] bg-[#f71866]/5 scale-[1.01]" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 transition-colors ${
              dragActive ? "bg-[#f71866] text-white" : "bg-slate-50 text-slate-300"
            }`}>
              <FileSpreadsheet size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 text-center">Importação em Massa</h2>
            <p className="text-slate-500 text-center mt-3 max-w-sm font-medium">
              {dragActive ? "Pode soltar o arquivo!" : "Arraste seu CSV com as 22 colunas preenchidas ou use o seletor abaixo."}
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
                <Download size={18} /> Baixar Modelo (22 colunas)
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
                <span className="text-[10px] font-bold uppercase tracking-wider">O sistema aceita termos em Português ou Inglês para Risco, Frequência e Tipo de KPI</span>
            </div>
          </div>

          {previewData.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xl animate-in zoom-in-95">
               <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                    <TableIcon size={18} className="text-[#f71866]" /> Preview ({previewData.length} registros detectados)
                  </h3>
                  <button onClick={() => setPreviewData([])} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
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
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                item.risk_title === 'CRITICAL' ? 'bg-red-100 text-red-600' : 
                                item.risk_title === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {item.risk_title}
                            </span>
                         </td>
                         <td className="px-8 py-5">
                            <div className="flex items-center gap-1.5">
                                {item.kpi_type === 'Automated' ? <Cpu size={12} className="text-purple-500" /> : <Users size={12} className="text-slate-400" />}
                                <span className="text-[10px] uppercase font-bold text-slate-600">{item.kpi_type}</span>
                            </div>
                         </td>
                         <td className="px-8 py-5 text-slate-500 text-[10px]">{item.frequency}</td>
                         <td className="px-8 py-5 text-center"><CheckCircle2 size={18} className="text-emerald-500 mx-auto" /></td>
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