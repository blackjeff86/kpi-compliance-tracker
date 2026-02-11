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
  History,
  AlertTriangle,
  FileText,
  Database,
  CalendarDays,
  Loader2
} from "lucide-react"

// Importamos a Server Action atualizada
import { fetchControles } from "./actions"

interface Controle {
  id: string;
  nome: string;
  framework: string;
  risco: string;
  status: string;
  pendencia: string;
  corStatus: string;
  reference_month: string;
}

export default function ControlesPage() {
  const router = useRouter()
  
  // ESTADOS DE DADOS
  const [controles, setControles] = useState<Controle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ESTADOS DE FILTROS
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRisco, setSelectedRisco] = useState("Todos")
  const [selectedFramework, setSelectedFramework] = useState("Todos")

  // Lógica de Mês de Referência (Fotografia)
  const currentMonthDate = new Date();
  const currentMonthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthYear);
  
  const [isNewControlModalOpen, setIsNewControlModalOpen] = useState(false)

  // BUSCA DE DADOS VIA SERVER ACTION
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const result = await fetchControles()
        
        if (result.success && result.data) {
          const mappedData: Controle[] = result.data.map((item: any) => ({
            // Mapeado conforme sua nova planilha "Como precisa ser"
            id: item.id_control,
            nome: item.name_control || "Sem nome",
            framework: item.framework || "N/A",
            risco: item.risk_title || "Médio", 
            status: item.status || "Conforme",
            pendencia: item.status === "Não Conforme" ? "Ajuste pendente" : "Em dia",
            reference_month: item.reference_month,
            corStatus: item.status === "Não Conforme" ? "bg-red-500" : 
                       item.status === "Em Atenção" ? "bg-amber-500" : "bg-emerald-500"
          }));
          setControles(mappedData)
          setError(false)
        } else {
          setError(true)
        }
      } catch (err) {
        console.error("Erro ao carregar:", err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const filteredControles = useMemo(() => {
    return controles.filter(item => {
      const nomeSeguro = item.nome ? item.nome.toLowerCase() : "";
      const idSeguro = item.id ? item.id.toLowerCase() : "";
      const searchLower = searchTerm.toLowerCase();
      
      const matchSearch = nomeSeguro.includes(searchLower) || idSeguro.includes(searchLower);
      const matchRisco = selectedRisco === "Todos" || item.risco === selectedRisco;
      const matchFramework = selectedFramework === "Todos" || (item.framework && item.framework.includes(selectedFramework));
      
      // Filtro de Fotografia Mensal
      const matchMonth = item.reference_month === selectedMonth;
      
      return matchSearch && matchRisco && matchFramework && matchMonth
    })
  }, [searchTerm, selectedRisco, selectedFramework, selectedMonth, controles])

  const irParaExecucao = (id: string) => {
    router.push(`/controles/execucao/${id}?periodo=${encodeURIComponent(selectedMonth)}`)
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Listagem de Controles</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Gerencie a conformidade e auditoria de controles SOX, SOC e ISO.</p>
        </div>
        <button 
          onClick={() => setIsNewControlModalOpen(true)}
          className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#f71866]/20 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Novo Controle
        </button>
      </header>

      {/* SEARCH & FILTERS */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-center">
          
          {/* Seletor de Fotografia Mensal */}
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

          <div className="md:col-span-1 lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar controle..."
            />
          </div>

          <select 
            value={selectedRisco}
            onChange={(e) => setSelectedRisco(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer"
          >
            <option value="Todos">Risco (Todos)</option>
            <option value="Alto">Alto</option>
            <option value="Médio">Médio</option>
            <option value="Baixo">Baixo</option>
          </select>

          <select 
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer"
          >
            <option value="Todos">Framework</option>
            <option value="SOX">SOX</option>
            <option value="SOC2">SOC2</option>
            <option value="ISO 27001">ISO 27001</option>
          </select>

          <button 
            onClick={() => {setSearchTerm(""); setSelectedRisco("Todos"); setSelectedFramework("Todos"); setSelectedMonth(currentMonthYear)}}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-slate-600 transition-colors py-2"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* CONTROLS TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-[#f71866]" size={32} />
            <p className="text-sm font-medium">Lendo fotografia de {selectedMonth}...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-2">
            <AlertTriangle size={32} />
            <p className="text-sm font-bold text-center px-6">Erro ao carregar dados. Verifique se as novas colunas foram criadas no Neon.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome & Framework</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Risco</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status em {selectedMonth}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendências</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredControles.length > 0 ? (
                    filteredControles.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {item.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-700">{item.nome}</div>
                          <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">{item.framework}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                            item.risco === "Alto" ? "bg-red-50 text-red-600 border border-red-100" :
                            item.risco === "Médio" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                            "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          }`}>
                            {item.risco}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${item.corStatus} animate-pulse`}></span>
                            <span className="text-xs font-bold text-slate-600">{item.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[11px] font-bold px-2 py-1 rounded ${
                            item.pendencia === "Em dia" ? "text-slate-400 italic font-normal" : "bg-red-50 text-red-600"
                          }`}>
                            {item.pendencia}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Link 
                              href={`/controles/${item.id}`}
                              className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-[#f71866] uppercase tracking-widest transition-colors"
                            >
                              Detalhes
                            </Link>
                            <button 
                              onClick={() => irParaExecucao(item.id)}
                              className="px-3 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                            >
                              Registrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-sm">
                        Nenhum registro para o período de {selectedMonth}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="text-xs text-slate-500 font-medium">
                Mostrando <span className="font-bold text-slate-700">{filteredControles.length}</span> controles para o mês selecionado.
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="w-8 h-8 rounded-lg bg-[#f71866] text-white text-xs font-bold shadow-sm">1</button>
                <button className="p-2 rounded-lg border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<ShieldCheck className="text-emerald-500" />} label="Conformidade Geral" value="82%" bgColor="bg-emerald-50" />
        <StatSmallCard icon={<History className="text-[#f71866]" />} label="Última Atualização" value="Hoje às 14:32" bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertTriangle className="text-amber-500" />} label="Evidências Pendentes" value="12" bgColor="bg-amber-50" />
      </div>

      {isNewControlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNewControlModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden">
            <div className="p-8 text-center border-b border-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Como deseja criar o controle?</h3>
            </div>
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
            <div className="p-4 bg-slate-50 flex justify-center">
              <button onClick={() => setIsNewControlModalOpen(false)} className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatSmallCard({ icon, label, value, bgColor }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm group hover:border-[#f71866]/20 transition-all">
      <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center`}>
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
    </div>
  )
}