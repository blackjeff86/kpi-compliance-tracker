"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { 
  Search,
  ChevronRight,
  ChevronLeft,
  Eye,
  AlertCircle,
  CalendarDays,
  ShieldCheck,
  History,
  AlertTriangle
} from "lucide-react"

export default function FilaRevisaoPage() {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [filterFramework, setFilterFramework] = useState("Framework")
  const [filterStatus, setFilterStatus] = useState("Status Revisão")
  const [filterCriticidade, setFilterCriticidade] = useState("Criticidade")
  
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const initialMonth = `${currentMonth} / ${currentYear}`;
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  // Mock de dados original
  const pendencias = [
    { id: "CTL-88921", controle: "SOX-04: Provisioning", framework: "SOX", kpi: "Acesso Semestral", periodo: "Q1 2026", status: "Atrasado", statusColor: "bg-red-500", executor: "André Fonseca", iniciais: "AF", revisao: "Aguardando", criticidade: "Alta" },
    { id: "CTL-44210", controle: "ISO-27001: Backup", framework: "ISO 27001", kpi: "Retenção Offsite", periodo: "Janeiro / 2026", status: "Alerta", statusColor: "bg-amber-500", executor: "Mariana Lima", iniciais: "ML", revisao: "Aguardando", criticidade: "Média" },
    { id: "CTL-11002", controle: "SOX-12: Firewalls", framework: "SOX", kpi: "Review de Regras", periodo: "Trimestral", status: "Falha", statusColor: "bg-red-500", executor: "Roberto Costa", iniciais: "RC", revisao: "Reprovado", criticidade: "Alta" },
    { id: "CTL-55612", controle: "GEN-01: Log Review", framework: "SOC2", kpi: "Auditoria SIEM", periodo: "Semana 06", status: "Não Iniciado", statusColor: "bg-red-500", executor: "João Pedro", iniciais: "JP", revisao: "Aguardando", criticidade: "Média" },
  ]

  // Lógica de Filtragem
  const filteredPendencias = useMemo(() => {
    return pendencias.filter((item) => {
      const matchSearch = item.controle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.executor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchFramework = filterFramework === "Framework" || item.framework === filterFramework;
      const matchStatus = filterStatus === "Status Revisão" || item.revisao === filterStatus;
      const matchCriticidade = filterCriticidade === "Criticidade" || item.criticidade === filterCriticidade;

      return matchSearch && matchFramework && matchStatus && matchCriticidade;
    });
  }, [searchTerm, filterFramework, filterStatus, filterCriticidade]);

  // Função para limpar filtros
  const limparFiltros = () => {
    setSearchTerm("");
    setFilterFramework("Framework");
    setFilterStatus("Status Revisão");
    setFilterCriticidade("Criticidade");
    setSelectedMonth(initialMonth);
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fila de Revisão</h1>
          <p className="text-slate-500 mt-1 font-medium">Valide as execuções e KPIs pendentes de auditoria.</p>
        </div>
      </header>

      {/* SEARCH & FILTERS */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
          
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f71866] h-4 w-4" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f71866]/5 border-transparent text-[#f71866] rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-[#f71866]/20 transition-all appearance-none cursor-pointer"
            >
              <option>{currentMonth} / {currentYear}</option>
              <option>dezembro / 2025</option>
            </select>
          </div>

          <div className="md:col-span-1 lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f71866]/20 focus:border-[#f71866] outline-none transition-all"
              placeholder="Buscar por controle, executor ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            value={filterFramework}
            onChange={(e) => setFilterFramework(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option>Framework</option>
            <option>SOX</option>
            <option>SOC2</option>
            <option>ISO 27001</option>
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option>Status Revisão</option>
            <option>Aguardando</option>
            <option>Reprovado</option>
          </select>
          
          <select 
            value={filterCriticidade}
            onChange={(e) => setFilterCriticidade(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-[#f71866]"
          >
            <option>Criticidade</option>
            <option>Alta</option>
            <option>Média</option>
          </select>

          <button 
            onClick={limparFiltros}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* REVISION TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Controle</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Framework</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI em Avaliação</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Execução</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Revisão</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPendencias.length > 0 ? (
                filteredPendencias.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-6 rounded-full ${item.statusColor}`}></div>
                        <div>
                          <div className="text-sm font-bold text-slate-700">{item.controle}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{item.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase">
                        {item.framework}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-600">{item.kpi}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-700">{item.periodo}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                        item.statusColor === "bg-red-500" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-600">{item.executor}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        item.revisao === 'Aguardando' ? 'bg-[#f71866]/5 text-[#f71866]' : 'bg-red-50 text-red-600'
                      }`}>
                        {item.revisao}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {item.revisao === 'Aguardando' ? (
                          <Link 
                            href={`/controles/${item.id}/registrar?periodo=${encodeURIComponent(item.periodo)}`}
                            className="px-4 py-1.5 text-[10px] font-bold text-[#f71866] border border-[#f71866]/20 hover:bg-[#f71866]/5 rounded transition-all uppercase tracking-widest"
                          >
                            Validar
                          </Link>
                        ) : (
                          <button className="p-2 text-slate-400 hover:text-[#f71866] transition-colors">
                            <Eye size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400 text-sm italic">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{filteredPendencias.length}</span> de <span className="font-bold text-slate-700">{pendencias.length}</span> pendências
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-all disabled:opacity-50">
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

      {/* FOOTER STATS REPLICADO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatSmallCard icon={<ShieldCheck className="text-emerald-500" />} label="Taxa de Aprovação" value="94.2%" bgColor="bg-emerald-50" />
        <StatSmallCard icon={<History className="text-[#f71866]" />} label="Média de Resposta" value="1.2 dias" bgColor="bg-red-50" />
        <StatSmallCard icon={<AlertTriangle className="text-amber-500" />} label="SLA Crítico" value="03 itens" bgColor="bg-amber-50" />
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