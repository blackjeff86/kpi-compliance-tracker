"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [loadingSSO, setLoadingSSO] = useState(false)

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" })
        if (!res.ok) return
        const session = (await res.json()) as { user?: { email?: string } } | null
        if (session?.user?.email) {
          router.replace("/dashboard")
          return
        }
      } catch (error) {
        console.error("Falha ao verificar sessão SSO:", error)
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [router])

  async function handleGoogleSSO() {
    setLoadingSSO(true)
    await signIn(
      "google",
      { callbackUrl: "/dashboard" },
      { prompt: "select_account consent" },
    )
    setLoadingSSO(false)
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

          <div className="space-y-5">
            <button
              type="button"
              onClick={handleGoogleSSO}
              disabled={checkingSession || loadingSSO}
              className="w-full h-12 bg-[#f71963] text-white rounded-md font-bold text-sm hover:bg-[#d61556] shadow-lg shadow-[#f71963]/20 transition-all active:scale-[0.98]"
            >
              {checkingSession || loadingSSO ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar com Google SSO"
              )}
            </button>
            <p className="text-xs text-slate-500">
              Use sua conta corporativa autorizada para acessar o sistema com autenticação SSO.
            </p>
          </div>

          <p className="mt-10 text-center text-[11px] text-slate-400 uppercase tracking-widest font-medium">
            Ambiente de Desenvolvimento
          </p>
        </div>
      </div>
    </div>
  )
}
