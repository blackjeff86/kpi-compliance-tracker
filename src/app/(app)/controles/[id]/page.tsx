"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { 
  ChevronRight, 
  User, 
  Headset, 
  RefreshCw, 
  BarChart3, 
  History, 
  ClipboardCheck, 
  PlusCircle, 
  AlertCircle,
  Clock,
  ShieldCheck,
  Bell,
  X,
  Upload,
  CheckCircle2
} from "lucide-react"

export default function DetalheControlePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  // Função para navegar para a nova tela de execução
  const irParaExecucao = (kpiName: string) => {
    // Navega para a nova página passando o ID do controle
    router.push(`/controles/execucao/${id}`)
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            <Link href="/controles" className="hover:text-[#f71866] transition-colors">Controles</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">{id}</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {id} - User Access Review
            </h1>
            <span className="text-[10px] uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold tracking-wider">
              Ativo
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button className="p-2.5 rounded-full border border-slate-100 text-slate-400 hover:text-[#f71866] hover:bg-[#f71866]/5 transition-all">
                <Bell size={18} />
            </button>
            <div className="h-9 w-9 rounded-full bg-[#f71866] flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-[#f71866]/20">
                JS
            </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard icon={<User size={16} />} label="Owner" value="João Silva" />
            <InfoCard icon={<Headset size={16} />} label="Ponto Focal" value="Maria Oliveira" />
            <InfoCard icon={<RefreshCw size={16} />} label="Frequência" value="Mensal" />
          </section>

          <section className="space-y-6">
            <div className="border-b border-slate-200">
              <nav className="flex space-x-8">
                <button className="border-b-2 border-[#f71866] py-4 px-1 text-[#f71866] font-semibold text-sm flex items-center gap-2">
                  <BarChart3 size={16} /> KPIs
                </button>
                <button className="border-b-2 border-transparent py-4 px-1 text-slate-400 hover:text-slate-600 font-medium text-sm flex items-center gap-2 transition-all">
                  <History size={16} /> Histórico
                </button>
                <button className="border-b-2 border-transparent py-4 px-1 text-slate-400 hover:text-slate-600 font-medium text-sm flex items-center gap-2 transition-all">
                  <ClipboardCheck size={16} /> Planos de Ação
                  <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">2</span>
                </button>
              </nav>
            </div>

            <div className="space-y-4">
              <KPIItem 
                title="Percentual de Acessos Revistos" 
                desc="Garante que 100% dos usuários críticos foram validados."
                value="98.5%"
                meta="Meta: 100%"
                status="success"
                onRegister={() => irParaExecucao("Percentual de Acessos Revistos")}
              />
              <KPIItem 
                title="Usuários Inativos Removidos" 
                desc="Verificação de desligamentos vs exclusão de contas no AD."
                value="PENDING"
                meta="Prazo: 05/11"
                status="danger"
                hasWarning
                onRegister={() => irParaExecucao("Usuários Inativos Removidos")}
              />
              <KPIItem 
                title="SLA de Novos Acessos" 
                desc="Tempo médio para aprovação de novos perfis de acesso."
                value="2.1 dias"
                meta="Meta: < 3d"
                status="warning"
                onRegister={() => irParaExecucao("SLA de Novos Acessos")}
              />
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <AlertCircle size={16} className="text-[#f71866]" /> Pendências
              </h2>
              <span className="bg-[#f71866] text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full">3</span>
            </div>
            <div className="p-2 space-y-1">
              <PendenciaItem title="Evidência de Outubro pendente" desc="Upload de log atrasado." type="error" />
              <PendenciaItem title="Aprovação de gestor faltante" desc="Gestor Financeiro pendente." type="warning" />
            </div>
            <button className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-[#f71866] hover:bg-[#f71866]/5 transition-all border-t border-slate-50">
              Ver Todas
            </button>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShieldCheck size={80} />
            </div>
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                <RefreshCw size={18} className="text-[#f71866]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold tracking-tight">BigQuery Audit Log</h4>
                <p className="text-[10px] text-slate-400 font-medium">Sync: 12 min atrás</p>
              </div>
            </div>
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400 uppercase tracking-widest text-[9px]">Registros</span>
                <span className="font-mono text-[#f71866]">1,240,582</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1">
                <div className="bg-[#f71866] h-1 rounded-full w-[85%]"></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* COMPONENTES DE APOIO */

function InfoCard({ icon, label, value }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f71866]/5 flex items-center justify-center text-[#f71866]">
          {icon}
        </div>
        <span className="font-semibold text-slate-700 text-sm">{value}</span>
      </div>
    </div>
  )
}

function KPIItem({ title, desc, value, meta, status, hasWarning, onRegister }: any) {
  return (
    <div className={`bg-white p-6 rounded-xl border transition-all flex items-center justify-between ${
        hasWarning ? 'border-l-4 border-l-red-500 border-slate-100 shadow-sm' : 'border-slate-100'
    }`}>
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
            status === 'danger' ? 'text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded tracking-widest font-bold' : 
            'text-lg text-slate-600'
          }`}>
            {value}
          </div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">{meta}</div>
        </div>
        <button 
          onClick={onRegister}
          className="bg-[#f71866] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#d61556] transition-all flex items-center gap-2"
        >
          <PlusCircle size={14} /> Registrar
        </button>
      </div>
    </div>
  )
}

function PendenciaItem({ title, desc, type }: any) {
    return (
        <div className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group">
            <div className="mt-1">
                <Clock size={14} className={type === 'error' ? 'text-red-500' : 'text-amber-500'} />
            </div>
            <div>
                <p className="text-[11px] font-semibold text-slate-700 group-hover:text-[#f71866] transition-colors leading-tight mb-1">{title}</p>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}