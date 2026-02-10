import type { Metadata } from "next";
import { Inter } from "next/font/google"; 
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Compliance Tracker - VTEX Executive",
  description: "Sistema de Gestão de Conformidade e KPIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Ícones e Fontes Externas */}
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} bg-[#fdfdfd] text-slate-800 antialiased flex min-h-screen`}>
        
        {/* MENU LATERAL FIXO (ASIDE) */}
        <aside className="w-64 bg-white border-r border-slate-100 flex flex-col fixed h-full z-30">
          
          {/* Logo Section - Usando a cor definida no @theme do Tailwind v4 */}
          <div className="p-8 flex items-center gap-3">
            <div className="w-8 h-8 bg-vtex-pink rounded-lg flex items-center justify-center shadow-md shadow-pink-100">
              <span className="material-icons text-white text-lg">verified_user</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 uppercase">Compliance</span>
          </div>

          {/* Navegação Principal */}
          <nav className="flex-1 mt-4 space-y-1">
            <NavItem href="/dashboard" icon="dashboard" label="Dashboard" active />
            <NavItem href="/controles" icon="analytics" label="Controles" />
            <NavItem href="/execucoes" icon="play_circle" label="Execuções" />
            <NavItem href="/planos" icon="assignment" label="Planos de Ação" />
            
            <div className="mx-8 my-6 border-t border-slate-50"></div>
            
            <NavItem href="/admin" icon="settings" label="Admin" />
          </nav>

          {/* Perfil do Usuário (Rodapé da Sidebar) */}
          <div className="p-8 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 shadow-sm">
                JB
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-none">Jefferson Brito</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mt-1 tracking-wider">Lead Auditor</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ÁREA DE CONTEÚDO (MAIN) */}
        <main className="flex-1 ml-64 min-h-screen relative">
          {children}
        </main>

      </body>
    </html>
  );
}

/**
 * Componente NavItem atualizado para Tailwind v4
 */
function NavItem({ 
  href, 
  icon, 
  label, 
  active = false 
}: { 
  href: string; 
  icon: string; 
  label: string; 
  active?: boolean 
}) {
  return (
    <a 
      href={href} 
      className={`flex items-center px-8 py-3.5 transition-all group border-r-4 ${
        active 
          ? "text-vtex-pink bg-[var(--vtex-pink-light)] border-vtex-pink" 
          : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="material-symbols-outlined mr-4 text-[22px] group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-[13px] font-semibold tracking-wide">
        {label}
      </span>
    </a>
  );
}