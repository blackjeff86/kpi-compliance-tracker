"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
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
  FileSpreadsheet
} from "lucide-react"

export default function CadastroControlePage() {
  // --- CONTROLE DE NAVEGAÇÃO ENTRE MÉTODOS ---
  const [metodoCadastro, setMetodoCadastro] = useState<"individual" | "massivo">("individual")

  // --- ESTADOS: FRAMEWORK ---
  const [frameworks, setFrameworks] = useState(["SOX", "SOC", "PCI-DSS", "ISO27001", "ISO27701"])
  const [selectedFramework, setSelectedFramework] = useState("SOX")
  const [customFramework, setCustomFramework] = useState("") 
  
  // --- ESTADOS: RISCO ---
  const [catalogoRiscos, setCatalogoRiscos] = useState([
    { id: "r1", code: "RSK-LOG", title: "Acesso Lógico Indevido", class: "HIGH", desc: "Risco de usuários acessarem dados sensíveis sem permissão adequada." },
    { id: "r2", code: "RSK-CHG", title: "Mudança Não Homologada", class: "CRITICAL", desc: "Alterações em produção sem testes prévios ou aprovação." },
    { id: "r3", code: "RSK-BCK", title: "Perda de Dados", class: "MED", desc: "Falha na rotina de backup ou integridade das fitas/nuvem." },
  ])
  const [selectedRisk, setSelectedRisk] = useState<any>(null)
  const [riskSearchId, setRiskSearchId] = useState("")
  const [isCreatingRisk, setIsCreatingRisk] = useState(false)
  const [newRiskData, setNewRiskData] = useState({ code: "", title: "", class: "MED", desc: "" })

  // --- ESTADOS: CSV ---
  const [dragActive, setDragActive] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  // Efeito para limpar o campo customizado
  useEffect(() => {
    if (selectedFramework !== "NEW") setCustomFramework("");
  }, [selectedFramework])

  // Lógica para baixar o modelo de CSV com as 12 colunas exatas
  const baixarTemplateCSV = () => {
    const headers = [
      "Framework",
      "Codigo_Controle",
      "Nome_Controle",
      "Email_Owner",
      "Area_Owner",
      "Email_Ponto_Focal",
      "Area_Ponto_Focal",
      "Frequencia_Controle",
      "ID_Risco",
      "ID_KPI",
      "Nome_KPI",
      "Target_KPI"
    ];
    
    const row = [
      "SOX",
      "ITGC-01",
      "Review de Acessos Semestral",
      "owner@empresa.com",
      "TI",
      "focal@empresa.com",
      "Seguranca",
      "MONTHLY",
      "RSK-LOG",
      "KPI-01",
      "Taxa de Sucesso",
      "100%"
    ];
    
    const csvContent = [headers, row].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_controles.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: any) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      setPreviewData([
        { code: "CSV-IMPORT", name: file.name, area: "Importado", risk: "A verificar", status: "Pronto" },
      ]);
    }
  };

  const handleRiskSearch = () => {
    const found = catalogoRiscos.find(r => 
      r.code.toLowerCase().includes(riskSearchId.toLowerCase()) || 
      r.id.toLowerCase() === riskSearchId.toLowerCase()
    )
    if (found) {
      setSelectedRisk(found);
      setIsCreatingRisk(false);
    } else {
      alert("Risco não encontrado no catálogo.");
    }
  }

  const handlePublish = () => {
    alert("Controle publicado com sucesso!");
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER DA PÁGINA */}
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
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: ITGC-01" />
                  </div>
                )}

                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Controle</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: User Access Review" />
                </div>
              </div>
            </FormSection>

            <FormSection icon={<Users className="text-purple-500" />} title="Matriz de Responsabilidade">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Owner</label><input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="owner@empresa.com" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área Owner</label><input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: TI" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail Ponto Focal</label><input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="focal@empresa.com" /></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Área Ponto Focal</label><input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: Riscos" /></div>
              </div>
            </FormSection>

            <FormSection icon={<ShieldAlert className="text-red-500" />} title="Risco e Periodicidade">
                <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frequência</label>
                        <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
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

                    {/* CAMPOS PARA CADASTRO DE NOVO RISCO */}
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
                      <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: KPI-01" />
                  </div>
                  <div className="col-span-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do KPI</label>
                      <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: % de Usuários" />
                  </div>
                  <div className="col-span-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target (Meta)</label>
                      <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ex: 100%" />
                  </div>
                  <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evidência Necessária (Descritivo)</label>
                      <textarea rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none" placeholder="Descreva quais arquivos ou logs comprovam este controle..." />
                  </div>
              </div>
            </FormSection>
          </div>

          {/* SIDEBAR RESUMO */}
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
                    <button onClick={handlePublish} className="bg-[#f71866] hover:bg-[#d61556] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#f71866]/20">
                        <Save size={18} /> Finalizar Cadastro
                    </button>
                    <button className="text-slate-400 text-xs font-bold hover:text-white transition-colors py-2">Cancelar Alterações</button>
                  </div>
              </div>
          </div>
        </div>
      ) : (
        /* --- TELA DE UPLOAD CSV --- */
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
              {dragActive ? "Pode soltar o arquivo!" : "Arraste seu CSV com as 12 colunas preenchidas ou use o seletor abaixo."}
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
                <Download size={18} /> Baixar Modelo (12 colunas)
              </button>
            </div>

            <div className="mt-8 flex items-center gap-2 text-slate-400">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">A estrutura do CSV deve espelhar exatamente o cadastro manual</span>
            </div>
          </div>

          {/* TABELA DE PREVIEW */}
          {previewData.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xl animate-in zoom-in-95">
               <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                    <TableIcon size={18} className="text-[#f71866]" /> Preview dos Dados Detectados
                  </h3>
                  <button onClick={() => setPreviewData([])} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                     <tr>
                       <th className="px-8 py-4">Arquivo</th>
                       <th className="px-8 py-4">Área Responsável</th>
                       <th className="px-8 py-4 text-center">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 font-medium">
                     {previewData.map((item, idx) => (
                       <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                         <td className="px-8 py-5">
                           <div className="text-slate-900 font-bold">{item.name}</div>
                         </td>
                         <td className="px-8 py-5">
                           <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase">{item.area}</span>
                         </td>
                         <td className="px-8 py-5 text-center"><CheckCircle2 size={20} className="text-emerald-500 mx-auto" /></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               <div className="p-8 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-slate-500 font-medium italic">Dados validados. O arquivo contém as colunas necessárias para o framework.</p>
                  <button className="w-full sm:w-auto bg-[#f71866] text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-[#f71866]/20 hover:scale-[1.02] transition-all">
                    Importar Controles
                  </button>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// COMPONENTES AUXILIARES
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
            <span className="text-xs text-slate-400 font-medium">{label}</span>
            <span className={`text-xs font-bold ${value === 'Pendente' || value === 'Novo Risco' ? 'text-amber-500' : 'text-white'}`}>{value}</span>
        </div>
    )
}