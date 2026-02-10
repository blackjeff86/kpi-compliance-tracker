"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  Search, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays,
  Target,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"

// Mock de dados atualizado para incluir Framework explicitamente
const kpisData = [
  { id: "KPI-FIN-01", nome: "Eficácia de Conciliação", categoria: "Financeiro", framework: "SOX", meta: "100%", atual: "94%", status: "Em Atenção", tendencia: "down", corStatus: "bg-amber-500" },
  { id: "KPI-SEC-05", nome: "Uptime de Sistemas Críticos", categoria: "TI", framework: "ISO 27001", meta: "99.9%", atual: "99.95%", status: "Meta Atingida", tendencia: "up", corStatus: "bg-emerald-500" },
  { id: "KPI-CYB-12", nome: "Vulnerabilidades Críticas", categoria: "Segurança", framework: "NIST", meta: "0", atual: "3", status: "Crítico", tendencia: "down", corStatus: "bg-red-500" },
  { id: "KPI-OPS-03", nome: "Treinamento de Compliance", categoria: "RH", framework: "SOC2", meta: "95%", atual: "98%", status: "Meta Atingida", tendencia: "up", corStatus: "bg-emerald-500" },
]

export default function KPIsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFramework, setFilterFramework] = useState("Todos")
  
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(`${currentMonth} / ${currentYear}`);

  // Lógica de filtragem reativa
  const filteredKPIs = useMemo(() => {
    return kpisData.filter(kpi => {
      const matchSearch = kpi.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          kpi.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchFramework = filterFramework === "Todos" || kpi.framework === filterFramework
      
      return matchSearch && matchFramework
    })
  }, [searchTerm, filterFramework])

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Indicadores de Performance (KPIs)</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Monitore as métricas de conformidade e performance em tempo real.</p>
        </div>
        <button className="bg-[#f71866] hover:bg-[#d61556] text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#f71866]/20 transition-all active:scale-95">
          <Plus className="h-5 w-5" />
          Novo Indicador
        </button>
      </header>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          
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

          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar KPI..."
            />
          </div>

          <select 
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium"
          >
            <option value="Todos">Framework (Todos)</option>
            <option value="SOX">SOX</option>
            <option value="ISO 27001">ISO 27001</option>
            <option value="SOC2">SOC2</option>
            <option value="NIST">NIST</option>
          </select>
          
          <select className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866] cursor-pointer font-medium">
            <option>Status da Meta</option>
            <option>Meta Atingida</option>
            <option>Em Atenção</option>
          </select>

          {/* AJUSTE: BOTÃO LIMPAR FILTROS CONFORME A IMAGEM */}
          <button 
            onClick={() => {setSearchTerm(""); setFilterFramework("Todos")}}
            className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] hover:text-slate-600 transition-colors py-2"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* KPI TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Indicador & Categoria</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Framework</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Meta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Atual</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Trend</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKPIs.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded italic">
                      {item.id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">{item.nome}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">{item.categoria}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded bg-slate-50">
                      {item.framework}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-slate-400">{item.meta}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-sm">
                    <span className={
                      item.status === 'Meta Atingida' ? 'text-emerald-600' : 
                      item.status === 'Crítico' ? 'text-red-600' : 'text-amber-600'
                    }>{item.atual}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      {item.tendencia === 'up' ? (
                        <ArrowUpRight className="text-emerald-500 h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="text-red-500 h-4 w-4" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.corStatus}`}></span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase">{item.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-4 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest">
                      Analisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{filteredKPIs.length}</span> de <span className="font-bold text-slate-700">12</span> indicadores
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
        <StatSmallCard icon={<Target className="text-emerald-500" />} label="Metas Atingidas" value="75%" bgColor="bg-emerald-50" />
        <StatSmallCard icon={<TrendingUp className="text-[#f71866]" />} label="Performance Global" value="+4.2%" bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertCircle className="text-amber-500" />} label="Abaixo da Meta" value="03" bgColor="bg-amber-50" />
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