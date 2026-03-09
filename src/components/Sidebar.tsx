"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  ShieldCheck, 
  BarChart3, // Ícone alterado para representar KPIs
  ClipboardList, 
  Settings,
  LogOut,
  ClipboardCheck
} from "lucide-react"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShieldCheck, label: "Controles", href: "/controles" },
  { icon: BarChart3, label: "KPIs", href: "/kpis" }, // Texto e rota alterados
  { icon: ClipboardCheck, label: "Revisão", href: "/revisao" },
  { icon: ClipboardList, label: "Planos de Ação", href: "/planos" },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
      {/* LOGO AREA */}
      <div className="p-8 flex items-center gap-3">
        <div className="h-12 w-12 bg-[#f71963] rounded-lg flex items-center justify-center shadow-lg shadow-[#f71963]/20">
          <Image src="/logo-v2.png" alt="Logo" width={46} height={46} className="object-contain" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">KPIs Management</h1>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                isActive 
                ? "bg-[#f71963]/5 text-[#f71963]" 
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-[#f71963]" : "group-hover:text-slate-600"}`} />
              <span className="text-sm font-semibold">{item.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 bg-[#f71963] rounded-full" />}
            </Link>
          )
        })}
      </nav>

      {/* FOOTER AREA (Admin & Logout) */}
      <div className="p-4 border-t border-slate-50 space-y-2">
        <Link 
          href="/admin"
          className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span className="text-sm font-medium">Admin</span>
        </Link>
        
        <Link 
          href="/login"
          className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sair</span>
        </Link>
      </div>
    </aside>
  )
}
