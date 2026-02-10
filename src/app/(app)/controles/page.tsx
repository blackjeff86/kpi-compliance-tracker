"use client"

import React, { useState, useMemo } from "react"
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
  CalendarDays
} from "lucide-react"

// Mock de dados atualizado
const controles = [
  { id: "ITGC-01", nome: "Gerenciamento de Identidade", framework: "SOX • Acesso Lógico", risco: "Alto", status: "Não Conforme", pendencia: "2 atrasados", corStatus: "bg-red-500" },
  { id: "SEC-05", nome: "Backups e Recuperação", framework: "ISO 27001 • Disponibilidade", risco: "Médio", status: "Conforme", pendencia: "Em dia", corStatus: "bg-emerald-500" },
  { id: "OPS-12", nome: "Gerenciamento de Mudanças", framework: "SOC2 • Integridade", risco: "Baixo", status: "Em Atenção", pendencia: "1 pendente", corStatus: "bg-amber-500" },
  { id: "FIN-03", nome: "Segregação de Funções", framework: "SOX • Ciclo de Compras", risco: "Alto", status: "Conforme", pendencia: "Em dia", corStatus: "bg-emerald-500" },
]

export default function ControlesPage() {
  const router = useRouter()
  
  // Estados para Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRisco, setSelectedRisco] = useState("Todos")
  const [selectedFramework, setSelectedFramework] = useState("Todos")

  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(`${currentMonth} / ${currentYear}`);

  const [isNewControlModalOpen, setIsNewControlModalOpen] = useState(false)

  // Lógica de Filtragem
  const filteredControles = useMemo(() => {
    return controles.filter(item => {
      const matchSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchRisco = selectedRisco === "Todos" || item.risco === selectedRisco
      const matchFramework = selectedFramework === "Todos" || item.framework.includes(selectedFramework)
      
      return matchSearch && matchRisco && matchFramework
    })
  }, [searchTerm, selectedRisco, selectedFramework])

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
          
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold outline-none cursor-pointer appearance-none"
            >
              <option>{currentMonth} / {currentYear}</option>
              <option>dezembro / 2025</option>
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

          {/* BOTÃO LIMPAR FILTROS - ESTILO SOLICITADO */}
          <button 
            onClick={() => {setSearchTerm(""); setSelectedRisco("Todos"); setSelectedFramework("Todos")}}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-slate-600 transition-colors py-2"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* CONTROLS TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome & Framework</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Risco</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Atual</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendências</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredControles.map((item) => (
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
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">1</span> a <span className="font-bold text-slate-700">{filteredControles.length}</span> de <span className="font-bold text-slate-700">32</span> controles
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all disabled:opacity-50 cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#f71866] text-white text-xs font-bold shadow-sm">1</button>
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<ShieldCheck className="text-emerald-500" />} label="Conformidade Geral" value="82%" bgColor="bg-emerald-50" />
        <StatSmallCard icon={<History className="text-[#f71866]" />} label="Última Atualização" value="Hoje às 14:32" bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertTriangle className="text-amber-500" />} label="Evidências Pendentes" value="12" bgColor="bg-amber-50" />
      </div>

      {/* MODAL: SELEÇÃO DE TIPO DE NOVO CONTROLE */}
      {isNewControlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNewControlModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            
            <div className="p-8 text-center border-b border-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Como deseja criar o controle?</h3>
              <p className="text-sm text-slate-500 mt-1">Selecione o método de entrada de dados.</p>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link 
                href="/controles/novo"
                className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all group text-center"
              >
                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-[#f71866]/10 transition-colors">
                  <FileText className="text-slate-400 group-hover:text-[#f71866]" size={28} />
                </div>
                <span className="font-bold text-slate-800 text-sm">Cadastro Manual</span>
              </Link>

              <button className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-[#f71866] hover:bg-[#f71866]/5 transition-all group text-center">
                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-[#f71866]/10 transition-colors">
                  <Database className="text-slate-400 group-hover:text-[#f71866]" size={28} />
                </div>
                <span className="font-bold text-slate-800 text-sm">Upload de CSV</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 flex justify-center">
              <button 
                onClick={() => setIsNewControlModalOpen(false)}
                className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-slate-600 transition-colors"
              >
                Voltar para a listagem
              </button>
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