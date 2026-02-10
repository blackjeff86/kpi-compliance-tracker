"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { 
  Shield, 
  Target, 
  Calendar, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
  UploadCloud,
  Cpu
} from "lucide-react"

export default function RegistrarExecucaoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  
  const id = params.id as string || "ITGC-01"
  const periodoSelecionado = searchParams.get("periodo") || "Fevereiro / 2026"
  
  const [resultado, setResultado] = useState(85)
  const [envolveAutomacao, setEnvolveAutomacao] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  
  const threshold = 95
  const isBelowThreshold = resultado < threshold

  return (
    <div className="min-h-screen bg-[#f8f5f6] text-slate-800 font-sans animate-in fade-in duration-500">
      
      {/* HEADER PADRONIZADO - SEM ÍCONES DE PERFIL/NOTIFICAÇÃO */}
      <header className="px-8 py-6 flex justify-between items-center bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="flex flex-col">
          <nav className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            <Link href="/controles" className="hover:text-[#f71866] transition-colors">Controles</Link>
            <span>/</span>
            <Link href={`/controles/${id}`} className="hover:text-[#f71866] transition-colors">{id}</Link>
            <span>/</span>
            <span className="text-slate-600">Execução</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Registrar Execução de KPI
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-8 space-y-6">
        
        {/* INFO CARDS SUPERIORES */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#f71866]/20">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-3">Controle Relacionado</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f71866]/5 flex items-center justify-center text-[#f71866]">
                <Shield size={18} />
              </div>
              <span className="font-semibold text-slate-700 text-sm tracking-tight">{id} - Access Review</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#f71866]/20">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-3">KPI em Avaliação</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Target size={18} />
              </div>
              <span className="font-semibold text-slate-700 text-sm tracking-tight">Percentual de Acessos</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-[#f71866]/20">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block mb-3">Período de Referência</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <Calendar size={18} />
              </div>
              <span className="font-semibold text-slate-700 text-sm tracking-tight capitalize">{periodoSelecionado}</span>
            </div>
          </div>
        </section>

        {/* FORMULÁRIO PRINCIPAL */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#f71866]" />
              <h2 className="font-bold text-slate-800 text-[11px] uppercase tracking-widest">Detalhes da Evidência</h2>
            </div>
            {isBelowThreshold && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-tighter border border-red-100">
                <AlertCircle size={10} /> Meta não atingida
              </div>
            )}
          </div>

          <form className="p-8 space-y-8" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              
              {/* Resultado Obtido */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest block border-l-2 border-[#f71866] pl-3">
                  Resultado da Verificação (%)
                </label>
                <div className="relative group">
                  <input 
                    type="number" 
                    value={resultado}
                    onChange={(e) => setResultado(Number(e.target.value))}
                    className={`w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-xl font-bold outline-none transition-all focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866] ${isBelowThreshold ? 'text-red-500' : 'text-emerald-500'}`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">%</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium italic">
                  <Info size={12} /> Threshold esperado: {threshold}%
                </div>
              </div>

              {/* Upload de Arquivo */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest block border-l-2 border-[#f71866] pl-3">
                  Upload da Evidência
                </label>
                <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all cursor-pointer min-h-[95px] relative group hover:border-[#f71866]/30">
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => setArquivo(e.target.files ? e.target.files[0] : null)}
                  />
                  <UploadCloud size={24} className="text-slate-300 group-hover:text-[#f71866] transition-colors" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight text-center">
                    {arquivo ? arquivo.name : "Arraste o documento ou clique para selecionar"}
                  </p>
                </div>
              </div>

              {/* Notas do Ponto Focal */}
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-bold text-[#f71866] uppercase tracking-widest block border-l-2 border-[#f71866] pl-3">
                  Notas e comentários do ponto focal
                </label>
                <textarea 
                  rows={4}
                  placeholder="Descreva o processo de coleta e as validações realizadas para este período..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#f71866]/10 focus:border-[#f71866] resize-none"
                />
              </div>
            </div>

            {/* PLANO DE AÇÃO MANDATÁRIO */}
            {isBelowThreshold && (
              <div className="mt-4 pt-8 border-t border-slate-100 space-y-6 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500 rounded-lg shadow-lg shadow-red-500/10 text-white">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight">Plano de Ação Mandatário</h3>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Alerta de Não Conformidade • Preenchimento Obrigatório</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medidas de Mitigação</label>
                    <textarea 
                      required
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 transition-all"
                      placeholder="Quais ações serão tomadas para regularizar o KPI?"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo de Resolução</label>
                    <input 
                      required
                      type="date"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável pela Ação</label>
                    <select required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 transition-all appearance-none cursor-pointer">
                      <option value="">Selecione o Owner...</option>
                      <option value="1">João Silva (GRC)</option>
                      <option value="2">Maria Oliveira (IT)</option>
                    </select>
                  </div>

                  {/* LÓGICA DE AUTOMAÇÃO - INTEGRADA AO GRID */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 w-fit pr-6">
                      <div className="flex items-center h-5">
                        <input
                          id="automacao"
                          type="checkbox"
                          checked={envolveAutomacao}
                          onChange={(e) => setEnvolveAutomacao(e.target.checked)}
                          className="w-4 h-4 text-[#f71866] border-slate-300 rounded focus:ring-[#f71866] cursor-pointer"
                        />
                      </div>
                      <label htmlFor="automacao" className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                        <Cpu size={14} className={envolveAutomacao ? "text-[#f71866]" : "text-slate-400"} />
                        O plano de ação envolve uma automação futura?
                      </label>
                    </div>

                    {envolveAutomacao && (
                      <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Sistemas participantes da automação</label>
                        <input 
                          type="text"
                          required
                          placeholder="Ex: ServiceNow, SAP, Microsoft Power Automate..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#f71866] transition-all shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* ACTIONS FOOTER */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <Link 
            href={`/controles/${id}`} 
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-700 transition-all group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
            Descartar Alterações
          </Link>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
             <button className="w-full md:w-auto bg-[#f71866] hover:bg-[#d61556] text-white px-10 py-4 rounded-xl text-xs font-bold shadow-xl shadow-[#f71866]/20 transition-all flex items-center justify-center gap-3 group active:scale-95 tracking-widest">
                <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                FINALIZAR REGISTRO
              </button>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-8 pb-12 text-center md:text-left">
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Sync Status: <span className="text-emerald-500">Connected to BigQuery Audit Log</span> • 2026 GRC Platform
        </p>
      </footer>
    </div>
  )
}