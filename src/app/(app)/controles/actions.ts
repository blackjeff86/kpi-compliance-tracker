"use server"
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Busca todos os controles. 
 * Mantido original para não quebrar a página de listagem/cards gerais.
 */
export async function fetchControles() {
  try {
    const data = await sql`
      SELECT * FROM controls 
      ORDER BY id_control ASC
    `;
    return { success: true, data };
  } catch (error) {
    console.error("Erro fetchControles:", error);
    return { success: false, error: "Erro ao carregar lista de controles." };
  }
}

/**
 * Busca os detalhes de um controle específico.
 * AJUSTADO: Garante que 'all_kpis' sempre seja um array para o frontend mapear os cards.
 */
export async function fetchControleByCode(code: string) {
  try {
    // Busca todas as linhas (cada linha é um KPI diferente do mesmo controle)
    const rows = await sql`
      SELECT * FROM controls WHERE id_control = ${code}
    `;
    
    if (!rows || rows.length === 0) return { success: false, error: "Controle não encontrado" };

    // Pegamos a primeira linha para os dados fixos (Header, Owner, etc)
    const baseControl = rows[0];

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
      data: { 
        ...baseControl,     // Espalha os dados da primeira linha (nome, owner, etc)
        all_kpis: rows,      // IMPORTANTE: Aqui vai a lista completa de KPIs para o .map()
        historico, 
        planos 
      } 
    };
  } catch (error) {
    console.error("Erro fetchControleByCode:", error);
    return { success: false, error: "Erro ao buscar detalhes do controle." };
  }
}

/**
 * Lógica de UPSERT (Insere ou Atualiza).
 * Mantido exatamente como você enviou para garantir a compatibilidade.
 */
export async function importarControles(controles: any[]) {
  try {
    for (const ctrl of controles) {
      await sql`
        INSERT INTO controls (
          id_control, name_control, description_control, goal_control,        
          framework, owner_name, owner_email, owner_area, 
          focal_point_name, focal_point_email, focal_point_area, 
          frequency, risk_id, risk_name, risk_title, risk_description, 
          kpi_id, kpi_name, kpi_description, kpi_type, kpi_target, 
          status, reference_month
        ) VALUES (
          ${ctrl.id_control}, ${ctrl.name_control}, ${ctrl.description_control || null}, 
          ${ctrl.goal_control || null}, ${ctrl.framework}, ${ctrl.owner_name}, 
          ${ctrl.owner_email}, ${ctrl.owner_area}, ${ctrl.focal_point_name}, 
          ${ctrl.focal_point_email}, ${ctrl.focal_point_area}, ${ctrl.frequency}, 
          ${ctrl.risk_id}, ${ctrl.risk_name}, ${ctrl.risk_title}, 
          ${ctrl.risk_description}, ${ctrl.kpi_id}, ${ctrl.kpi_name}, 
          ${ctrl.kpi_description}, ${ctrl.kpi_type}, ${ctrl.kpi_target}, 
          ${ctrl.status}, ${ctrl.reference_month || null}
        )
        ON CONFLICT (id_control, kpi_id) DO UPDATE SET
          name_control = EXCLUDED.name_control,
          description_control = EXCLUDED.description_control,
          goal_control = EXCLUDED.goal_control,               
          framework = EXCLUDED.framework,
          owner_name = EXCLUDED.owner_name,
          owner_email = EXCLUDED.owner_email,
          owner_area = EXCLUDED.owner_area,
          focal_point_name = EXCLUDED.focal_point_name,
          focal_point_email = EXCLUDED.focal_point_email,
          focal_point_area = EXCLUDED.focal_point_area,
          frequency = EXCLUDED.frequency,
          risk_id = EXCLUDED.risk_id,
          risk_name = EXCLUDED.risk_name,
          risk_title = EXCLUDED.risk_title,
          risk_description = EXCLUDED.risk_description,
          kpi_id = EXCLUDED.kpi_id,
          kpi_name = EXCLUDED.kpi_name,
          kpi_description = EXCLUDED.kpi_description,
          kpi_type = EXCLUDED.kpi_type,
          kpi_target = EXCLUDED.kpi_target,
          status = EXCLUDED.status,
          reference_month = EXCLUDED.reference_month
      `;
    }
    return { success: true };
  } catch (error) {
    console.error("Erro ao importar controles:", error);
    return { success: false, error: "Falha ao registrar dados." };
  }
}