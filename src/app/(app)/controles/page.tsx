"use client"

import React, { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck,
  AlertTriangle,
  FileText,
  Database,
  CalendarDays,
  Loader2,
  User,
  Clock,
  CheckCircle2
} from "lucide-react"

// Importamos a Server Action
import { fetchControles } from "./actions"

interface Controle {
  id: string; // id_control do banco
  nome: string;
  framework: string;
  risco: string;
  status: string;
  pendencia: string;
  corStatus: string;
  reference_month: string;
  control_owner: string; 
}

export default function ControlesPage() {
  const router = useRouter()
  const ITEMS_PER_PAGE = 15;
  
  const [controles, setControles] = useState<Controle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRisco, setSelectedRisco] = useState("Todos")
  const [selectedOwner, setSelectedOwner] = useState("Todos")

  const getPreviousMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(getPreviousMonth());
  const [isNewControlModalOpen, setIsNewControlModalOpen] = useState(false)

  // BUSCA DE DADOS COM MAPEAMENTO REFORÇADO
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const result = await fetchControles()
        
        if (result.success && result.data) {
          const mappedData: Controle[] = result.data.map((item: any) => {
            // Log para debug (opcional: remova em produção)
            // console.log("Item recebido do banco:", item);

            return {
              // Prioriza id_control conforme solicitado
              id: item.id_control || item.id, 
              nome: item.name_control || item.name || "Sem nome",
              framework: item.framework || "N/A",
              risco: item.risk_title || item.risco || "Medium", 
              
              // Tenta capturar owner_name de todas as formas possíveis que o banco/action podem retornar
              control_owner: item.owner_name || item.control_owner || item.owner || "Não atribuído",
              
              status: item.status || "Pendente",
              pendencia: item.pendencia_kpi || "Pendente",
              reference_month: item.reference_month || "",
              corStatus: "" 
            };
          });
          setControles(mappedData)
          setError(false)
        } else {
          setError(true)
        }
      } catch (err) {
        console.error("Erro ao carregar controles:", err);
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const processedData = useMemo(() => {
    return controles.map(ctrl => {
      const isCompletedThisMonth = ctrl.reference_month === selectedMonth && 
                                   (ctrl.status === "Conforme" || ctrl.status === "Concluido");
      return {
        ...ctrl,
        displayStatus: isCompletedThisMonth ? "Finalizado" : "Em Aberto",
      };
    });
  }, [controles, selectedMonth]);

  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = (item.nome + item.id + item.control_owner).toLowerCase().includes(searchLower);
      const matchRisco = selectedRisco === "Todos" || item.risco === selectedRisco;
      const matchOwner = selectedOwner === "Todos" || item.control_owner === selectedOwner;
      return matchSearch && matchRisco && matchOwner;
    });
  }, [searchTerm, selectedRisco, selectedOwner, processedData])

  const ownersList = useMemo(() => {
    return Array.from(new Set(controles.map(c => c.control_owner)))
      .filter(o => o && o !== "Não atribuído")
      .sort();
  }, [controles]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedControles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedRisco, selectedOwner, selectedMonth]);

  const getRiskStyles = (risco: string) => {
    const r = (risco || "").toLowerCase();
    if (r.includes("low") || r.includes("baixo")) return "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (r.includes("medium") || r.includes("médio")) return "bg-yellow-50 text-yellow-600 border-yellow-100";
    if (r.includes("high") || r.includes("alto")) return "bg-orange-50 text-orange-600 border-orange-100";
    if (r.includes("critical") || r.includes("crítico")) return "bg-red-50 text-red-600 border-red-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Listagem de Controles</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Gestão de conformidade baseada na coluna owner_name.</p>
        </div>
        <button 
          onClick={() => setIsNewControlModalOpen(true)}
          className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" /> Novo Controle
        </button>
      </header>

      {/* FILTROS */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
          
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold outline-none cursor-pointer appearance-none"
            >
              <option value="2026-02">fevereiro / 2026</option>
              <option value="2026-01">janeiro / 2026</option>
              <option value="2025-12">dezembro / 2025</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm outline-none transition-all"
              placeholder="Buscar por ID, Nome ou Owner..."
            />
          </div>

          <select value={selectedRisco} onChange={(e) => setSelectedRisco(e.target.value)} className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none cursor-pointer">
            <option value="Todos">Risco (Todos)</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)} className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none cursor-pointer">
            <option value="Todos">Owner (Todos)</option>
            {ownersList.map(owner => <option key={owner} value={owner}>{owner}</option>)}
          </select>

          <button onClick={() => {setSearchTerm(""); setSelectedRisco("Todos"); setSelectedOwner("Todos"); setSelectedMonth(getPreviousMonth())}} className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors py-2 text-center">
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-[#f71866]" size={32} />
            <p className="text-sm font-medium">Carregando dados dos proprietários...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código (id_control)</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome & Framework</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control Owner</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Risco</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedControles.length > 0 ? (
                    paginatedControles.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-700">{item.nome}</div>
                          <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">{item.framework}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[#f71866]">
                              <User size={14} />
                            </div>
                            <span className="text-xs font-bold text-slate-600">{item.control_owner}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.displayStatus === "Em Aberto" ? (
                              <Clock size={12} className="text-amber-500" />
                            ) : (
                              <CheckCircle2 size={12} className="text-emerald-500" />
                            )}
                            <span className={`text-[11px] font-bold ${item.displayStatus === "Em Aberto" ? "text-amber-600" : "text-emerald-600"}`}>
                              {item.displayStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRiskStyles(item.risco)}`}>
                            {item.risco}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-4">
                            <Link href={`/controles/${item.id}`} className="text-[10px] font-bold text-slate-400 hover:text-[#f71866] uppercase transition-colors">Detalhes</Link>
                            <button 
                              onClick={() => router.push(`/controles/execucao/${item.id}?periodo=${selectedMonth}`)}
                              className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest ${item.displayStatus === "Em Aberto" ? "bg-[#f71866] text-white shadow-md shadow-red-100" : "border border-[#f71866] text-[#f71866]"}`}
                            >
                              {item.displayStatus === "Em Aberto" ? "Registrar" : "Revisar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-sm">Nenhum controle encontrado para os critérios selecionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="text-xs text-slate-500 font-medium">
                Exibindo <span className="font-bold text-slate-700">{paginatedControles.length}</span> de <span className="font-bold text-slate-700">{filteredData.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-white transition-all"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-white transition-all"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DASHBOARD RESUMIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard 
          icon={<ShieldCheck className="text-emerald-500" />} 
          label="Controles Finalizados" 
          value={processedData.filter(d => d.displayStatus === "Finalizado").length.toString()} 
          bgColor="bg-emerald-50" 
        />
        <StatSmallCard 
          icon={<Clock className="text-[#f71866]" />} 
          label="Aguardando KPIs" 
          value={processedData.filter(d => d.displayStatus === "Em Aberto").length.toString()} 
          bgColor="bg-red-50" 
        />
        <StatSmallCard 
          icon={<AlertTriangle className="text-amber-500" />} 
          label="Risco Crítico" 
          value={processedData.filter(d => (d.risco || "").toLowerCase().includes("crit")).length.toString()} 
          bgColor="bg-amber-50" 
        />
      </div>

      {/* MODAL DE ADIÇÃO */}
      {isNewControlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNewControlModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden">
            <div className="p-8 text-center border-b border-slate-50"><h3 className="text-xl font-bold text-slate-900">Novo Controle</h3></div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/controles/novo" className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all text-center">
                <FileText className="text-slate-400 mb-4" size={28} />
                <span className="font-bold text-slate-800 text-sm">Cadastro Manual</span>
              </Link>
              <button className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all text-center">
                <Database className="text-slate-400 mb-4" size={28} />
                <span className="font-bold text-slate-800 text-sm">Upload de CSV</span>
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex justify-center"><button onClick={() => setIsNewControlModalOpen(false)} className="text-[11px] font-bold text-slate-400 uppercase">Voltar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatSmallCard({ icon, label, value, bgColor }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm group hover:border-[#f71866]/20 transition-all">
      <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center`}>{React.cloneElement(icon, { size: 24 })}</div>
      <div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
    </div>
  )
}