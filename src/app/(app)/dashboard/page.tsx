import sql from "@/lib/db";

export default async function DashboardPage() {
  // 1. BUSCA DE DADOS REAIS DO NEON (SQL PURO)
  let totalControls = 0;
  let activeControls = 0;
  let recentControls: any[] = [];

  try {
    // Busca contagens em paralelo para performance
    const [stats] = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE is_active = true)::int as active
      FROM controls
    `;
    
    totalControls = stats.total;
    activeControls = stats.active;

    // Busca os últimos 5 controles
    recentControls = await sql`
      SELECT id, control_code, name, risk_level, owner_email 
      FROM controls 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
  } catch (error) {
    console.error("Erro ao buscar dados do Neon:", error);
    // Mantém os valores zerados caso a tabela ainda não exista
  }

  return (
    <div className="p-10 max-w-7xl mx-auto w-full space-y-10">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <h2 className="text-3xl font-light text-slate-900">Performance Corporativa</h2>
          <p className="text-slate-400 mt-2 text-sm max-w-md">
            Visão executiva de governança baseada nos controles de segurança e KPIs.
          </p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 bg-[#fcfcfd] p-2 rounded border border-slate-100">
            <div className="px-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 text-center">Status DB</label>
              <span className="text-[11px] font-bold text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> CONECTADO (SQL)
              </span>
            </div>
          </div>
          <button className="bg-[#f71963] text-white px-6 py-2 rounded-md font-medium hover:bg-[#d61556] transition-colors text-sm">
            Gerar PDF
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard label="Score Geral" value="94.2" trend="+1.2%" trendColor="text-green-500" />
        <StatCard label="Aderência KPIs" value="88.5%" trend="-0.5%" trendColor="text-red-500" />
        <StatCard label="Controles Ativos" value={activeControls.toString()} subValue={`/ ${totalControls}`} />
        <StatCard label="Risco Residual" value="Baixo" trend="Stable" trendColor="text-yellow-500" />
      </div>

      {/* SEÇÃO DE TABELA */}
      <div className="pt-8 border-t border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Monitoramento de Controles</h3>
            <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Dados reais via Postgres.js</p>
          </div>
          <a href="/controles" className="text-[11px] font-bold text-[#f71963] uppercase tracking-widest hover:underline">
            Ver todos os controles
          </a>
        </div>

        <div className="overflow-x-auto bg-white rounded-xl border border-slate-100 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50">
                <th className="py-4 px-6">ID / Ref</th>
                <th className="py-4 px-6">Nome do Controle</th>
                <th className="py-4 px-6">Criticidade</th>
                <th className="py-4 px-6 text-right">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentControls.length > 0 ? (
                recentControls.map((control) => (
                  <tr key={control.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-5 px-6 text-xs font-mono text-slate-400">
                      {control.control_code}
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-sm font-medium text-slate-700 group-hover:text-[#f71963] transition-colors">
                        {control.name}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm border uppercase ${
                        control.risk_level === 'High' || control.risk_level === 'HIGH'
                        ? 'bg-red-50 text-red-500 border-red-100' 
                        : 'bg-blue-50 text-blue-500 border-blue-100'
                      }`}>
                        {control.risk_level}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <span className="text-xs text-slate-500">{control.owner_email}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 text-sm">
                    Nenhum dado encontrado ou tabela inexistente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, subValue, trendColor }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900 tracking-tighter">
          {value}
        </span>
        {trend && <span className={`text-xs font-bold ${trendColor}`}>{trend}</span>}
        {subValue && <span className="text-xs font-bold text-slate-300">{subValue}</span>}
      </div>
    </div>
  );
}