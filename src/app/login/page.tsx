"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function persistUserSessionEmail(rawEmail?: string) {
    if (typeof window === "undefined") return
    const normalized = String(rawEmail || "").trim().toLowerCase()
    const finalEmail = normalized || "guest@kpi.local"
    window.localStorage.setItem("kpi_user_email", finalEmail)
  }

  // Esta função agora apenas ignora os dados e pula para o dashboard
  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    // Log apenas para você ver no console do navegador que o clique funcionou
    console.log("Tentativa de login ignorada. Redirecionando...")
    persistUserSessionEmail(email)
    
    // Redireciona para o grupo (app) na rota /dashboard
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen font-sans bg-white">
      {/* Painel Esquerdo - Branding VTEX Style */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#f71963] p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20">
            <Image src="/logo-v2.png" alt="Logo" width={58} height={58} className="object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">KPIs Management</h1>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight text-white text-balance">
            Segurança e Governança em um só lugar.
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed font-light">
            Centralize a gestão de controles de auditoria e garanta conformidade com frameworks globais como SOX, SOC e ISO 27001.
          </p>
        </div>

        <p className="text-[10px] uppercase tracking-widest text-white/50 font-medium">
          Internal Systems - Governança & Risco
        </p>
      </div>

      {/* Painel Direito - Formulário */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f71963]">
              <Image src="/logo-v2.png" alt="Logo" width={58} height={58} className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">KPIs Management</h1>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900">Entrar na plataforma</h2>
          </div>

          {/* Formulário que também redireciona sem validar */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type="email"
                  placeholder="seu@vtex.com.br"
                  className="flex h-12 w-full rounded-md border border-slate-200 bg-white pl-10 text-sm outline-none focus:border-[#f71963] focus:ring-1 focus:ring-[#f71963] transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Qualquer senha funciona"
                  className="flex h-12 w-full rounded-md border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none focus:border-[#f71963] focus:ring-1 focus:ring-[#f71963] transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#f71963] text-white rounded-md font-bold text-sm hover:bg-[#d61556] shadow-lg shadow-[#f71963]/20 transition-all active:scale-[0.98]"
            >
              Acessar Plataforma
            </button>
          </form>

          <p className="mt-10 text-center text-[11px] text-slate-400 uppercase tracking-widest font-medium">
            Ambiente de Desenvolvimento
          </p>
        </div>
      </div>
    </div>
  )
}
