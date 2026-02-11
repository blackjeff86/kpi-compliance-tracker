"use server"
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function fetchControles() {
  try {
    const data = await sql`
      SELECT 
        id_control, 
        name_control, 
        framework, 
        frequency,
        status,
        risk_title,
        reference_month
      FROM controls 
      ORDER BY id_control ASC
    `;
    return { success: true, data };
  } catch (error) {
    console.error("Erro fetchControles:", error);
    return { success: false, error: "Erro ao carregar lista de controles." };
  }
}

export async function fetchControleByCode(code: string) {
  try {
    const [controle] = await sql`
      SELECT * FROM controls WHERE id_control = ${code} LIMIT 1
    `;
    
    if (!controle) return { success: false, error: "Controle não encontrado" };

    let historico: any[] = [];
    let planos: any[] = [];
    
    try {
      historico = await sql`SELECT * FROM control_history WHERE id_control = ${code} ORDER BY executed_at DESC`;
      planos = await sql`SELECT * FROM action_plans WHERE id_control = ${code}`;
    } catch (e) {
      console.warn("Tabelas auxiliares vazias.");
    }
    
    return { 
      success: true, 
      data: { ...controle, historico, planos } 
    };
  } catch (error) {
    console.error("Erro fetchControleByCode:", error);
    return { success: false, error: "Erro ao buscar detalhes." };
  }
}