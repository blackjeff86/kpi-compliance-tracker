"use client"

import React, { useState, useMemo } from "react"
import { 
  Search, 
  Plus, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Eye
} from "lucide-react"

export default function PlanosAcaoPage() {
  // Estados para os filtros funcionais
  const [searchTerm, setSearchTerm] = useState("")
  const [filterResponsavel, setFilterResponsavel] = useState("Todos")
  const [filterStatus, setFilterStatus] = useState("Todos")
  const [filterFramework, setFilterFramework] = useState("Todos")
  
  // Dados simulados atualizados com Framework
  const data = [
    { id: "SOX-FIN-002", controle: "Conciliação Bancária Semanal", framework: "SOX", responsavel: "Mariana F.", iniciais: "MF", data: "12/10/2023", status: "Em andamento", atraso: 15, corStatus: "bg-amber-50 text-amber-600 border-amber-100" },
    { id: "ISO-SEC-015", controle: "Gestão de Identidades (IAM)", framework: "ISO 27001", responsavel: "Jorge Rocha", iniciais: "JR", data: "25/11/2023", status: "Aberto", atraso: 0, corStatus: "bg-blue-50 text-blue-600 border-blue-100" },
    { id: "SOX-PROC-044", controle: "Evidência de Segregação de Funções", framework: "SOX", responsavel: "Ana Lucia", iniciais: "AL", data: "05/10/2023", status: "Em andamento", atraso: 22, corStatus: "bg-amber-50 text-amber-600 border-amber-100" },
    { id: "ISO-ENV-001", controle: "Checklist de Resíduos", framework: "ISO 14001", responsavel: "Silas M.", iniciais: "SM", data: "20/10/2023", status: "Concluído", atraso: 0, corStatus: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    { id: "SOX-TAX-008", controle: "Cálculo de Provisão de Impostos", framework: "SOX", responsavel: "Mariana F.", iniciais: "MF", data: "15/12/2023", status: "Aberto", atraso: 0, corStatus: "bg-blue-50 text-blue-600 border-blue-100" },
  ]

  // Lógica de filtragem reativa
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.controle.toLowerCase().includes(searchTerm.toLowerCase())
      const matchResp = filterResponsavel === "Todos" || item.responsavel === filterResponsavel
      const matchStatus = filterStatus === "Todos" || item.status === filterStatus
      const matchFramework = filterFramework === "Todos" || item.framework === filterFramework
      
      return matchSearch && matchResp && matchStatus && matchFramework
    })
  }, [searchTerm, filterResponsavel, filterStatus, filterFramework])

  const limparFiltros = () => {
    setSearchTerm("")
    setFilterResponsavel("Todos")
    setFilterStatus("Todos")
    setFilterFramework("Todos")
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Planos de Ação</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2.5 py-1 rounded border border-red-100 flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                15 ATRASADOS
              </span>
              <span className="bg-slate-50 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 uppercase">
                40 TOTAL
              </span>
            </div>
          </div>
          <p className="text-slate-500 mt-1 font-medium text-sm">Gestão de remediação e planos de melhoria de compliance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-all shadow-sm">
            <Download size={18} className="text-slate-400" /> Exportar
          </button>
          <button className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#f71866]/20 transition-all active:scale-95">
            <Plus size={20} /> Novo Plano
          </button>
        </div>
      </header>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar por ID ou Controle..."
            />
          </div>

          <select 
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer appearance-none font-medium"
          >
            <option value="Todos">Framework: Todos</option>
            <option value="SOX">SOX</option>
            <option value="ISO 27001">ISO 27001</option>
            <option value="ISO 14001">ISO 14001</option>
          </select>

          <select 
            value={filterResponsavel}
            onChange={(e) => setFilterResponsavel(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer appearance-none font-medium"
          >
            <option value="Todos">Responsável: Todos</option>
            <option value="Mariana F.">Mariana F.</option>
            <option value="Jorge Rocha">Jorge Rocha</option>
            <option value="Silas M.">Silas M.</option>
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer appearance-none font-medium"
          >
            <option value="Todos">Status: Todos</option>
            <option value="Aberto">Aberto</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluído">Concluído</option>
          </select>

          <button 
            onClick={limparFiltros}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors flex items-center justify-center gap-2"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Controle</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Framework</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI Afetado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Responsável</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Due Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Atraso</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-700">{item.id}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded bg-slate-50 uppercase">
                        {item.framework}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-xs font-medium ${item.status === 'Concluído' ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                        {item.controle}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 uppercase">
                          {item.iniciais}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 hidden lg:block">{item.responsavel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <Calendar size={13} className="text-slate-400" />
                        {item.data}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${item.corStatus}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.atraso > 0 ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">{item.atraso}d</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center">
                        {item.status === 'Concluído' ? (
                           <button className="p-2 text-slate-400 hover:text-[#f71866] transition-colors">
                              <Eye size={18} />
                           </button>
                        ) : (
                          <button className="px-5 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/30 hover:bg-[#f71866] hover:text-white rounded-md transition-all uppercase tracking-widest shadow-sm">
                            Atualizar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                    Nenhum plano de ação encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{filteredData.length}</span> de <span className="font-bold text-slate-700">40</span> resultados
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all disabled:opacity-50" disabled>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#f71866] text-white text-xs font-bold shadow-sm">1</button>
            <button className="w-8 h-8 rounded-lg text-slate-600 text-xs font-bold hover:bg-white transition-all">2</button>
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* FOOTER STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<FileText className="text-[#f71866]" />} label="Total de Planos" value="40" bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertCircle className="text-amber-500" />} label="Em Andamento" value="12" bgColor="bg-amber-50" />
        <StatSmallCard icon={<CheckCircle2 className="text-emerald-500" />} label="Concluídos (Mês)" value="08" bgColor="bg-emerald-50" />
      </div>

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