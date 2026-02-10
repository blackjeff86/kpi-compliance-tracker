"use client"

import React, { useState, useMemo } from "react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts"
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Filter, 
  ChevronDown,
  Eye 
} from "lucide-react"

// Dados para os gráficos
const chartData = [
  { name: "Jul/25", Green: 7, Yellow: 2, Red: 1 },
  { name: "Ago/25", Green: 8, Yellow: 1, Red: 1 },
  { name: "Set/25", Green: 6, Yellow: 3, Red: 1 },
  { name: "Out/25", Green: 5, Yellow: 3, Red: 2 },
  { name: "Nov/25", Green: 7, Yellow: 2, Red: 1 },
  { name: "Dez/25", Green: 4, Yellow: 4, Red: 2 },
]

// Dados para a tabela (Atenção Imediata)
const tableItems = [
  { code: "SOX-ITGC-001", title: "Controle de Acesso a Sistemas", kpi: "% Revisões de Acesso", status: "Yellow", risk: "Alta", owner: "Ana Ferreira", framework: "SOX", periodo: "Dez 2025" },
  { code: "SOX-ITGC-004", title: "Monitoramento de Logs", kpi: "Alertas Críticos Tratados", status: "Red", risk: "Alta", owner: "Marcos Silva", framework: "SOX", periodo: "Dez 2025" },
  { code: "ISO-SEC-012", title: "Criptografia de Dados", kpi: "Volume de Dados Cripto", status: "Red", risk: "Crítica", owner: "Jorge Rocha", framework: "ISO 27001", periodo: "Dez 2025" },
  { code: "ISO-NET-005", title: "Segurança de Perímetro", kpi: "Intrusões Bloqueadas", status: "Yellow", risk: "Média", owner: "Mariana F.", framework: "ISO 27001", periodo: "Nov 2025" },
  { code: "SOX-FIN-008", title: "Conciliação de Contas", kpi: "Divergências > 30 dias", status: "Red", risk: "Alta", owner: "Ana Ferreira", framework: "SOX", periodo: "Nov 2025" },
]

export default function DashboardPage() {
  // Estados dos filtros
  const [filterFramework, setFilterFramework] = useState("Todos")
  const [filterPeriodo, setFilterPeriodo] = useState("Todos")

  // Lógica de filtragem
  const filteredTableData = useMemo(() => {
    return tableItems.filter(item => {
      const matchFramework = filterFramework === "Todos" || item.framework === filterFramework
      const matchPeriodo = filterPeriodo === "Todos" || item.periodo === filterPeriodo
      return matchFramework && matchPeriodo
    })
  }, [filterFramework, filterPeriodo])

  const limparFiltros = () => {
    setFilterFramework("Todos")
    setFilterPeriodo("Todos")
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DA PÁGINA */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Visão geral dos KPIs e status de remediação.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Filtro Framework */}
          <div className="relative">
            <select 
              value={filterFramework}
              onChange={(e) => setFilterFramework(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm outline-none appearance-none pr-10 cursor-pointer focus:border-[#f71866]"
            >
              <option value="Todos">Framework: Todos</option>
              <option value="SOX">Framework: SOX</option>
              <option value="ISO 27001">Framework: ISO 27001</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Filtro Período */}
          <div className="relative">
            <select 
              value={filterPeriodo}
              onChange={(e) => setFilterPeriodo(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm outline-none appearance-none pr-10 cursor-pointer focus:border-[#f71866]"
            >
              <option value="Todos">Período: Todos</option>
              <option value="Dez 2025">Período: Dez 2025</option>
              <option value="Nov 2025">Período: Nov 2025</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Botão Limpar Filtros */}
          <button 
            onClick={limparFiltros}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#f71866] transition-colors px-2"
          >
            Limpar Filtros
          </button>
        </div>
      </header>

      {/* CARDS DE STATUS & PENDÊNCIAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard label="Green" value="38%" subValue="3 de 8 KPIs" color="emerald" icon={<CheckCircle2 />} />
        <StatusCard label="Yellow" value="50%" subValue="4 de 8 KPIs" color="amber" icon={<AlertCircle />} />
        <StatusCard label="Red" value="13%" subValue="1 de 8 KPIs" color="red" icon={<AlertCircle />} />

        {/* Card Pendências */}
        <div className="bg-slate-900 p-6 rounded-xl shadow-lg shadow-slate-200 group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pendências</p>
            <Clock className="text-slate-500 h-5 w-5" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Revisões pendentes</span>
              <span className="text-[#f71866] font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded">07</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Planos atrasados</span>
              <span className="text-[#f71866] font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded">05</span>
            </div>
          </div>
        </div>
      </div>

      {/* GRÁFICO DE TENDÊNCIA */}
      <div className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Tendência - Últimos 6 Períodos</h3>
            <button className="text-slate-400 hover:text-[#f71866] transition-colors">
              <ArrowUpRight size={20} />
            </button>
        </div>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}} />
              <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{paddingTop: '30px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em'}} />
              <Bar dataKey="Green" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="Yellow" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="Red" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABELA ATENÇÃO IMEDIATA */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-lg font-bold text-slate-800">Atenção Imediata</h3>
            <span className="bg-[#f71866]/10 text-[#f71866] text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border border-[#f71866]/10">
              {filteredTableData.length} itens encontrados
            </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID / Controle</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI Afetado</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Criticidade</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTableData.length > 0 ? (
                filteredTableData.map((item, index) => (
                  <TableRow key={index} {...item} />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm italic">
                    Nenhum item crítico encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Componente auxiliar para os Cards
function StatusCard({ label, value, subValue, color, icon }: any) {
  const colorMap: any = {
    emerald: "text-emerald-600 border-emerald-200 bg-emerald-50",
    amber: "text-amber-500 border-amber-200 bg-amber-50",
    red: "text-red-600 border-red-200 bg-red-50",
  }

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm hover:border-slate-200 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <h3 className={`text-4xl font-bold mt-1 ${colorMap[color].split(' ')[0]}`}>{value}</h3>
          <p className={`text-[10px] font-bold mt-1 uppercase opacity-70`}>{subValue}</p>
        </div>
        <div className={`${colorMap[color].split(' ')[2]} p-2 rounded-lg`}>
          {React.cloneElement(icon, { className: `h-6 w-6 ${colorMap[color].split(' ')[0]}` })}
        </div>
      </div>
    </div>
  )
}

// Componente auxiliar para a Linha da Tabela
function TableRow({ code, title, kpi, status, risk, owner }: any) {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="py-4 px-8 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase">{code}</span>
          <span className="text-sm font-bold text-slate-700">{title}</span>
        </div>
      </td>
      <td className="py-4 px-8 text-xs font-medium text-slate-600">{kpi}</td>
      <td className="py-4 px-8 text-center">
        <span className={`inline-flex px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${
          status === "Red" ? "bg-red-50 text-red-600 border-red-100" : "bg-amber-50 text-amber-600 border-amber-100"
        }`}>
          {status}
        </span>
      </td>
      <td className="py-4 px-8 text-center">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-400 border border-red-100 uppercase">
          {risk}
        </span>
      </td>
      <td className="py-4 px-8">
        <div className="flex items-center gap-2">
           <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 uppercase">
             {owner.split(' ').map((n: string) => n[0]).join('')}
           </div>
           <span className="text-xs font-semibold text-slate-700">{owner}</span>
        </div>
      </td>
      <td className="py-4 px-8 text-right">
        <button className="p-2 text-slate-400 hover:text-[#f71866] transition-colors">
          <Eye size={18} />
        </button>
      </td>
    </tr>
  )
}