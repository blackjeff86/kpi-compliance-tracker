"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { 
  ChevronRight, User, Headset, RefreshCw, BarChart3, 
  History, ClipboardCheck, PlusCircle, AlertCircle,
  Clock, ShieldCheck, Bell, Loader2
} from "lucide-react"
import { fetchControleByCode } from "../actions";

export default function DetalheControlePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const [activeTab, setActiveTab] = useState<'kpis' | 'history' | 'actions'>('kpis')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const result = await fetchControleByCode(id)
      if (result.success) {
        setData(result.data)
      } else {
        console.error(result.error)
      }
      setLoading(false)
    }
    loadData()
  }, [id])

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="animate-spin text-[#f71866]" size={40} />
    </div>
  )

  const irParaExecucao = (kpiName: string) => {
    router.push(`/controles/execucao/${id}?kpi=${encodeURIComponent(kpiName)}`)
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            <Link href="/controles" className="hover:text-[#f71866] transition-colors">Controles</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">{id}</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {id} - {data?.name_control || "Controle não encontrado"}
            </h1>
            <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold tracking-wider ${
              data?.status === 'Conforme' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {data?.status || 'Ativo'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button className="p-2.5 rounded-full border border-slate-100 text-slate-400 hover:text-[#f71866] hover:bg-[#f71866]/5 transition-all">
                <Bell size={18} />
            </button>
            <div className="h-9 w-9 rounded-full bg-[#f71866] flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-[#f71866]/20">
                {data?.owner_name?.substring(0,1).toUpperCase() || "C"}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ajustado: Owner Name */}
            <InfoCard icon={<User size={16} />} label="Owner" value={data?.owner_name || "N/A"} />
            
            {/* Ajustado: Focal Point Name */}
            <InfoCard icon={<Headset size={16} />} label="Ponto Focal" value={data?.focal_point_name || "N/A"} />
            
            <InfoCard icon={<RefreshCw size={16} />} label="Frequência" value={data?.frequency || "N/A"} />
          </section>

          <section className="space-y-6">
            <div className="border-b border-slate-200">
              <nav className="flex space-x-8">
                <TabButton 
                  active={activeTab === 'kpis'} 
                  onClick={() => setActiveTab('kpis')} 
                  icon={<BarChart3 size={16} />} 
                  label="KPIs" 
                />
                <TabButton 
                  active={activeTab === 'history'} 
                  onClick={() => setActiveTab('history')} 
                  icon={<History size={16} />} 
                  label="Histórico" 
                />
                <TabButton 
                  active={activeTab === 'actions'} 
                  onClick={() => setActiveTab('actions')} 
                  icon={<ClipboardCheck size={16} />} 
                  label="Planos de Ação" 
                  badge={data?.planos?.length || 0}
                />
              </nav>
            </div>

            <div className="space-y-4">
              {activeTab === 'kpis' && (
                <>
                  <KPIItem 
                    title={data?.kpi_name || "Métrica de Controle"} 
                    desc={`Monitoramento do framework ${data?.framework || 'N/A'}`}
                    value={data?.kpi_target || "0%"}
                    meta={`Meta: ${data?.kpi_target || '100%'}`}
                    status="success"
                    onRegister={() => irParaExecucao(data?.kpi_name || "Geral")}
                  />
                  {!data?.kpi_id && <p className="text-slate-400 text-[10px] italic px-2">Nenhum KPI adicional vinculado a este controle no banco.</p>}
                </>
              )}

              {activeTab === 'history' && (
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden min-h-[200px] flex flex-col">
                  {data?.historico?.length > 0 ? data.historico.map((h: any) => (
                    <div key={h.id} className="p-4 border-b border-slate-50 flex justify-between items-center text-sm hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-slate-600 font-medium">{new Date(h.executed_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <span className={`font-bold px-2 py-1 rounded text-[10px] uppercase ${h.status === 'Conforme' ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                        {h.status}
                      </span>
                    </div>
                  )) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <History size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">Nenhuma execução registrada no banco.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'actions' && (
                <div className="space-y-3 min-h-[200px]">
                  {data?.planos?.length > 0 ? data.planos.map((p: any) => (
                    <KPIItem 
                        key={p.id} 
                        title={p.title} 
                        desc={p.description} 
                        value={p.status} 
                        meta={`Prazo: ${new Date(p.due_date).toLocaleDateString('pt-BR')}`} 
                        status="warning" 
                    />
                  )) : (
                    <div className="h-full flex flex-col items-center justify-center p-10 border border-dashed border-slate-200 rounded-xl text-slate-400 gap-2">
                        <ClipboardCheck size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">Nenhum plano de ação pendente.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <AlertCircle size={16} className="text-[#f71866]" /> Pendências
              </h2>
              <span className="bg-[#f71866] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full">
                {data?.planos?.length || 0}
              </span>
            </div>
            <div className="p-2 space-y-1">
              <PendenciaItem title="Sincronização Neon" desc="Conectado e sincronizado." type="success" />
              {data?.planos?.length > 0 ? (
                <PendenciaItem title="Plano de Ação Aberto" desc="Existem tarefas aguardando correção." type="error" />
              ) : (
                <PendenciaItem title="Status Operacional" desc="Nenhuma pendência crítica." type="success" />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* COMPONENTES DE APOIO */
function TabButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button 
      onClick={onClick}
      className={`border-b-2 py-4 px-1 font-semibold text-sm flex items-center gap-2 transition-all ${
        active ? 'border-[#f71866] text-[#f71866]' : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon} {label}
      {badge !== undefined && badge > 0 && <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  )
}

function InfoCard({ icon, label, value }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f71866]/5 flex items-center justify-center text-[#f71866]">
          {icon}
        </div>
        <span className="font-semibold text-slate-700 text-sm truncate">{value}</span>
      </div>
    </div>
  )
}

function KPIItem({ title, desc, value, meta, status, hasWarning, onRegister }: any) {
    return (
      <div className={`bg-white p-6 rounded-xl border transition-all flex items-center justify-between border-slate-100 shadow-sm`}>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold text-slate-800 uppercase tracking-tight text-xs flex items-center gap-2">
              {title}
              {hasWarning && <AlertCircle size={14} className="text-red-500" />}
          </h3>
          <p className="text-[11px] text-slate-500 font-medium max-w-sm leading-relaxed">{desc}</p>
        </div>
        <div className="flex items-center gap-10">
          <div className="text-right">
            <div className={`font-semibold tracking-tight ${
              status === 'success' ? 'text-lg text-emerald-500' : 
              'text-lg text-slate-600'
            }`}>
              {value}
            </div>
            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">{meta}</div>
          </div>
          {onRegister && (
            <button 
                onClick={onRegister}
                className="bg-[#f71866] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#d61556] transition-all flex items-center gap-2"
            >
                <PlusCircle size={14} /> Registrar
            </button>
          )}
        </div>
      </div>
    )
}

function PendenciaItem({ title, desc, type }: any) {
    return (
        <div className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group">
            <div className="mt-1">
                <Clock size={14} className={type === 'error' ? 'text-red-500' : 'text-emerald-500'} />
            </div>
            <div>
                <p className="text-[11px] font-semibold text-slate-700 group-hover:text-[#f71866] transition-colors leading-tight mb-1">{title}</p>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}