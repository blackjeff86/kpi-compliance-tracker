// src/app/(app)/layout.tsx
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar Fixa */}
      <Sidebar />
      
      {/* Ajustes: 
          1. 'px-12' para um respiro elegante mas não exagerado.
          2. 'py-12' para o título não colar no navegador.
          3. Removemos o 'max-w-7xl' para a página ocupar a tela toda se necessário.
      */}
      <main className="flex-1 overflow-y-auto bg-white px-12 py-12">
        <div className="w-full"> 
          {children}
        </div>
      </main>
    </div>
  );
}