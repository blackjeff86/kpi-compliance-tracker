"use server"

import sql from "@/lib/db"
import { controlCodeFromControleSox } from "@/lib/automation-inventory"
import { AUTOMACOES_INVENTARIO, type AutomacaoInventario } from "@/data/automacoes-inventario"

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function parseDateColumn(v: string | null | undefined): string | null {
  const t = safeText(v)
  if (!t || t === "-") return null
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const d = new Date(t + "T12:00:00")
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function ensureAutomationInventorySchema() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS automation_inventory (
        inventory_id text PRIMARY KEY,
        id_control text REFERENCES controls (id_control) ON UPDATE CASCADE ON DELETE SET NULL,
        controle_sox_raw text,
        jira_ticket text,
        jira_nome text,
        nome_automacao text,
        objetivo_automacao text,
        owner_automacao text,
        usuario_automacao text,
        tipo_integracao text,
        aplicacoes_integradas text,
        data_inicial_automacao date,
        frequencia_automacao text,
        canal_slack text,
        objetivo_canal text,
        looker_url text,
        obs text,
        kpi_monitoramento_habilitado boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_inventory_id_control
      ON automation_inventory (id_control)
    `
  } catch (error) {
    console.warn("Não foi possível garantir automation_inventory:", error)
  }
}

async function resolveIdControlForSoxLabel(controleSox: string | null | undefined): Promise<string | null> {
  const code = controlCodeFromControleSox(controleSox)
  if (!code) return null
  try {
    const rows = await sql<{ id_control: string }[]>`
      SELECT id_control FROM controls WHERE id_control = ${code} LIMIT 1
    `
    const hit = rows[0]?.id_control
    return hit ? safeText(hit) : null
  } catch {
    return null
  }
}

function dbRowToAutomacao(row: Record<string, unknown>): AutomacaoInventario {
  const invId = safeText(row.inventory_id)
  return {
    id: invId,
    kpiMonitoramentoHabilitado: Boolean(row.kpi_monitoramento_habilitado),
    "Ticket Jira": row.jira_ticket != null ? String(row.jira_ticket) : null,
    "Nome Jira": row.jira_nome != null ? String(row.jira_nome) : null,
    "Controle SOX": row.controle_sox_raw != null ? String(row.controle_sox_raw) : null,
    "Nome automação": row.nome_automacao != null ? String(row.nome_automacao) : null,
    "Objetivo automação": row.objetivo_automacao != null ? String(row.objetivo_automacao) : null,
    "Owner automação": row.owner_automacao != null ? String(row.owner_automacao) : null,
    "Usuário automação": row.usuario_automacao != null ? String(row.usuario_automacao) : null,
    "Tipo de integração": row.tipo_integracao != null ? String(row.tipo_integracao) : null,
    "Aplicações integradas": row.aplicacoes_integradas != null ? String(row.aplicacoes_integradas) : null,
    "Data inicial da automação":
      row.data_inicial_automacao != null
        ? String(row.data_inicial_automacao).slice(0, 10)
        : null,
    "Frequencia automação": row.frequencia_automacao != null ? String(row.frequencia_automacao) : null,
    "Canal Slack": row.canal_slack != null ? String(row.canal_slack) : null,
    "Objetivo (Canal)": row.objetivo_canal != null ? String(row.objetivo_canal) : null,
    Looker: row.looker_url != null ? String(row.looker_url) : null,
    OBS: row.obs != null ? String(row.obs) : null,
  }
}

async function countInventory(): Promise<number> {
  try {
    const rows = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM automation_inventory`
    return Number(rows[0]?.c || 0)
  } catch {
    return -1
  }
}

export async function seedAutomationInventoryIfEmpty(): Promise<{ success: boolean; seeded: number; error?: string }> {
  await ensureAutomationInventorySchema()
  const n = await countInventory()
  if (n < 0) return { success: false, seeded: 0, error: "Não foi possível consultar automation_inventory." }
  if (n > 0) return { success: true, seeded: 0 }
  let seeded = 0
  try {
    for (const row of AUTOMACOES_INVENTARIO) {
      const id_control = await resolveIdControlForSoxLabel(row["Controle SOX"])
      const dataInicial = parseDateColumn(row["Data inicial da automação"] ?? undefined)
      await sql`
        INSERT INTO automation_inventory (
          inventory_id,
          id_control,
          controle_sox_raw,
          jira_ticket,
          jira_nome,
          nome_automacao,
          objetivo_automacao,
          owner_automacao,
          usuario_automacao,
          tipo_integracao,
          aplicacoes_integradas,
          data_inicial_automacao,
          frequencia_automacao,
          canal_slack,
          objetivo_canal,
          looker_url,
          obs,
          kpi_monitoramento_habilitado
        ) VALUES (
          ${row.id},
          ${id_control},
          ${safeText(row["Controle SOX"]) || null},
          ${safeText(row["Ticket Jira"]) || null},
          ${safeText(row["Nome Jira"]) || null},
          ${safeText(row["Nome automação"]) || null},
          ${safeText(row["Objetivo automação"]) || null},
          ${safeText(row["Owner automação"]) || null},
          ${safeText(row["Usuário automação"]) || null},
          ${safeText(row["Tipo de integração"]) || null},
          ${safeText(row["Aplicações integradas"]) || null},
          ${dataInicial},
          ${safeText(row["Frequencia automação"]) || null},
          ${safeText(row["Canal Slack"]) || null},
          ${safeText(row["Objetivo (Canal)"]) || null},
          ${safeText(row.Looker) || null},
          ${safeText(row.OBS) || null},
          ${Boolean(row.kpiMonitoramentoHabilitado)}
        )
        ON CONFLICT (inventory_id) DO UPDATE SET
          id_control = EXCLUDED.id_control,
          controle_sox_raw = EXCLUDED.controle_sox_raw,
          jira_ticket = EXCLUDED.jira_ticket,
          jira_nome = EXCLUDED.jira_nome,
          nome_automacao = EXCLUDED.nome_automacao,
          objetivo_automacao = EXCLUDED.objetivo_automacao,
          owner_automacao = EXCLUDED.owner_automacao,
          usuario_automacao = EXCLUDED.usuario_automacao,
          tipo_integracao = EXCLUDED.tipo_integracao,
          aplicacoes_integradas = EXCLUDED.aplicacoes_integradas,
          data_inicial_automacao = EXCLUDED.data_inicial_automacao,
          frequencia_automacao = EXCLUDED.frequencia_automacao,
          canal_slack = EXCLUDED.canal_slack,
          objetivo_canal = EXCLUDED.objetivo_canal,
          looker_url = EXCLUDED.looker_url,
          obs = EXCLUDED.obs,
          kpi_monitoramento_habilitado = EXCLUDED.kpi_monitoramento_habilitado,
          updated_at = now()
      `
      seeded += 1
    }
    return { success: true, seeded }
  } catch (error: any) {
    console.error("seedAutomationInventoryIfEmpty:", error)
    return { success: false, seeded, error: error?.message || "Erro ao popular inventário." }
  }
}

export async function fetchAutomationInventoryList(): Promise<
  | { success: true; data: AutomacaoInventario[] }
  | { success: false; error: string; data: AutomacaoInventario[] }
> {
  await ensureAutomationInventorySchema()
  const seed = await seedAutomationInventoryIfEmpty()
  if (!seed.success) {
    return { success: false, error: seed.error || "Falha ao preparar inventário.", data: [] }
  }
  try {
    const rows = await sql<Record<string, unknown>[]>`
      SELECT * FROM automation_inventory ORDER BY inventory_id ASC
    `
    return { success: true, data: rows.map(dbRowToAutomacao) }
  } catch (error: any) {
    console.error("fetchAutomationInventoryList:", error)
    return { success: false, error: error?.message || "Erro ao carregar inventário.", data: [] }
  }
}

export async function fetchAutomationInventoryById(
  inventoryId: string
): Promise<{ success: true; data: AutomacaoInventario | null } | { success: false; error: string }> {
  const id = safeText(inventoryId)
  if (!id) return { success: false, error: "ID inválido." }
  await ensureAutomationInventorySchema()
  await seedAutomationInventoryIfEmpty()
  try {
    const rows = await sql<Record<string, unknown>[]>`
      SELECT * FROM automation_inventory WHERE inventory_id = ${id} LIMIT 1
    `
    const row = rows[0]
    return { success: true, data: row ? dbRowToAutomacao(row) : null }
  } catch (error: any) {
    console.error("fetchAutomationInventoryById:", error)
    return { success: false, error: error?.message || "Erro ao carregar automação." }
  }
}

export type ControlCatalogRow = {
  id_control: string
  label: string
  framework: string | null
}

export async function fetchControlsCatalogForAutomacao(): Promise<
  { success: true; data: ControlCatalogRow[] } | { success: false; error: string; data: ControlCatalogRow[] }
> {
  try {
    const rows = await sql<{ id_control: string; name_control: string | null; framework: string | null }[]>`
      SELECT DISTINCT ON (c.id_control)
        c.id_control,
        c.name_control,
        c.framework
      FROM controls c
      ORDER BY c.id_control
    `
    const data: ControlCatalogRow[] = (rows || []).map((r) => {
      const code = safeText(r.id_control)
      const name = safeText(r.name_control)
      const fw = r.framework != null ? safeText(r.framework) : null
      const label = name ? `${code} - ${name}` : code
      return { id_control: code, label, framework: fw && fw.length ? fw : null }
    })
    return { success: true, data }
  } catch (error: any) {
    console.error("fetchControlsCatalogForAutomacao:", error)
    return { success: false, error: error?.message || "Erro ao carregar controles.", data: [] }
  }
}

export type CreateAutomationInventoryInput = {
  inventoryId?: string | null
  ticketJira?: string | null
  nomeJira?: string | null
  controleSox?: string | null
  nomeAutomacao?: string | null
  objetivoAutomacao?: string | null
  ownerAutomacao?: string | null
  usuarioAutomacao?: string | null
  tipoIntegracao?: string | null
  aplicacoesIntegradas?: string | null
  dataInicial?: string | null
  frequencia?: string | null
  canalSlack?: string | null
  objetivoCanal?: string | null
  lookerUrl?: string | null
  obs?: string | null
  kpiMonitoramentoHabilitado: boolean
}

async function generateNextInventoryId(): Promise<string> {
  const rows = await sql<{ inventory_id: string }[]>`
    SELECT inventory_id FROM automation_inventory WHERE inventory_id ~ '^inv-[0-9]+$'
  `
  let max = 0
  for (const r of rows) {
    const m = /^inv-(\d+)$/i.exec(safeText(r.inventory_id))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `inv-${String(max + 1).padStart(3, "0")}`
}

export async function createAutomationInventory(
  input: CreateAutomationInventoryInput
): Promise<{ success: true; data: AutomacaoInventario } | { success: false; error: string }> {
  await ensureAutomationInventorySchema()

  const controle = safeText(input.controleSox)
  const nomeJira = safeText(input.nomeJira)
  const nomeAuto = safeText(input.nomeAutomacao)
  if (!controle) {
    return { success: false, error: "Controle SOX é obrigatório (use o código e nome, ex.: TEC_C92 - …)." }
  }
  if (!nomeJira && !nomeAuto) {
    return { success: false, error: "Informe ao menos Nome Jira ou Nome da automação." }
  }

  let inventory_id = safeText(input.inventoryId)
  if (inventory_id) {
    if (!/^inv-[a-zA-Z0-9._-]+$/i.test(inventory_id)) {
      return { success: false, error: "ID do inventário inválido. Use o formato inv-001 ou deixe em branco para gerar automaticamente." }
    }
    try {
      const dup = await sql`SELECT 1 FROM automation_inventory WHERE inventory_id = ${inventory_id} LIMIT 1`
      if (dup.length) return { success: false, error: "Este ID de inventário já existe." }
    } catch (error: any) {
      return { success: false, error: error?.message || "Erro ao validar ID." }
    }
  } else {
    inventory_id = await generateNextInventoryId()
  }

  const id_control = await resolveIdControlForSoxLabel(controle)
  const dataInicial = parseDateColumn(input.dataInicial ?? undefined)

  try {
    await sql`
      INSERT INTO automation_inventory (
        inventory_id,
        id_control,
        controle_sox_raw,
        jira_ticket,
        jira_nome,
        nome_automacao,
        objetivo_automacao,
        owner_automacao,
        usuario_automacao,
        tipo_integracao,
        aplicacoes_integradas,
        data_inicial_automacao,
        frequencia_automacao,
        canal_slack,
        objetivo_canal,
        looker_url,
        obs,
        kpi_monitoramento_habilitado
      ) VALUES (
        ${inventory_id},
        ${id_control},
        ${controle},
        ${safeText(input.ticketJira) || null},
        ${nomeJira || null},
        ${nomeAuto || null},
        ${safeText(input.objetivoAutomacao) || null},
        ${safeText(input.ownerAutomacao) || null},
        ${safeText(input.usuarioAutomacao) || null},
        ${safeText(input.tipoIntegracao) || null},
        ${safeText(input.aplicacoesIntegradas) || null},
        ${dataInicial},
        ${safeText(input.frequencia) || null},
        ${safeText(input.canalSlack) || null},
        ${safeText(input.objetivoCanal) || null},
        ${safeText(input.lookerUrl) || null},
        ${safeText(input.obs) || null},
        ${Boolean(input.kpiMonitoramentoHabilitado)}
      )
    `
  } catch (error: any) {
    console.error("createAutomationInventory:", error)
    return { success: false, error: error?.message || "Erro ao salvar no banco." }
  }

  try {
    const rows = await sql<Record<string, unknown>[]>`
      SELECT * FROM automation_inventory WHERE inventory_id = ${inventory_id} LIMIT 1
    `
    const row = rows[0]
    if (!row) return { success: false, error: "Registro criado mas não foi possível reler os dados." }
    return { success: true, data: dbRowToAutomacao(row) }
  } catch (error: any) {
    return { success: false, error: error?.message || "Erro ao confirmar cadastro." }
  }
}
