"use server"

import sql from "@/lib/db"
import { INCIDENTES, type Incidente } from "@/data/incidentes"
import { seedAutomationInventoryIfEmpty } from "../automacoes/actions"

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function referenceMonthFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "1970-01"
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

async function ensureAutomationIncidentsSchema() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS automation_incidents (
        incident_id text PRIMARY KEY,
        automation_inventory_id text
          REFERENCES automation_inventory (inventory_id)
          ON UPDATE CASCADE ON DELETE SET NULL,
        id_control text REFERENCES controls (id_control) ON UPDATE CASCADE ON DELETE SET NULL,
        framework text,
        reference_month text NOT NULL,
        titulo text NOT NULL,
        severidade text NOT NULL
          CHECK (severidade IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        status text NOT NULL
          CHECK (status IN ('EM_ANALISE', 'ABERTO', 'CONCLUIDO', 'AGUARDANDO_EVIDENCIA')),
        nome_automacao text,
        trigger_name text,
        detected_at timestamptz NOT NULL,
        affected_object text,
        initiator_user text,
        technical_summary text,
        evidencias_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        historico_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT automation_incidents_reference_month_fmt
          CHECK (reference_month ~ '^\\d{4}-(0[1-9]|1[0-2])$')
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_incidents_reference_month
      ON automation_incidents (reference_month)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_incidents_id_control
      ON automation_incidents (id_control)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_incidents_framework
      ON automation_incidents (framework)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_incidents_automation
      ON automation_incidents (automation_inventory_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_automation_incidents_detected_at
      ON automation_incidents (detected_at DESC)
    `
  } catch (error) {
    console.warn("Não foi possível garantir automation_incidents:", error)
  }
}

async function getFrameworkForControl(id_control: string | null): Promise<string | null> {
  const id = safeText(id_control)
  if (!id) return null
  try {
    const rows = await sql<{ framework: string | null }[]>`
      SELECT framework FROM controls WHERE id_control = ${id} LIMIT 1
    `
    const fw = rows[0]?.framework
    return fw != null && safeText(fw) ? safeText(fw) : null
  } catch {
    return null
  }
}

async function countIncidents(): Promise<number> {
  try {
    const rows = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM automation_incidents`
    return Number(rows[0]?.c || 0)
  } catch {
    return -1
  }
}

async function resolveIdControlForInventoryId(inventoryId: string | null): Promise<string | null> {
  const id = safeText(inventoryId)
  if (!id) return null
  try {
    const rows = await sql<{ id_control: string | null }[]>`
      SELECT id_control FROM automation_inventory WHERE inventory_id = ${id} LIMIT 1
    `
    const ic = rows[0]?.id_control
    return ic != null && safeText(ic) ? safeText(ic) : null
  } catch {
    return null
  }
}

export async function seedAutomationIncidentsIfEmpty(): Promise<{ success: boolean; seeded: number; error?: string }> {
  const invSeed = await seedAutomationInventoryIfEmpty()
  if (!invSeed.success) return { success: false, seeded: 0, error: invSeed.error }

  await ensureAutomationIncidentsSchema()
  const n = await countIncidents()
  if (n < 0) return { success: false, seeded: 0, error: "Não foi possível consultar automation_incidents." }
  if (n > 0) return { success: true, seeded: 0 }

  let seeded = 0
  try {
    for (const inc of INCIDENTES) {
      const reference_month = referenceMonthFromIso(inc.detectedAt)
      const automation_inventory_id = safeText(inc.automacaoInventarioId) || null
      const id_control = await resolveIdControlForInventoryId(automation_inventory_id)
      const framework = await getFrameworkForControl(id_control)

      await sql`
        INSERT INTO automation_incidents (
          incident_id,
          automation_inventory_id,
          id_control,
          framework,
          reference_month,
          titulo,
          severidade,
          status,
          nome_automacao,
          trigger_name,
          detected_at,
          affected_object,
          initiator_user,
          technical_summary,
          evidencias_json,
          historico_json
        ) VALUES (
          ${inc.id},
          ${automation_inventory_id},
          ${id_control},
          ${framework},
          ${reference_month},
          ${inc.titulo},
          ${inc.severidade},
          ${inc.status},
          ${inc.nomeAutomacao},
          ${inc.triggerName},
          ${inc.detectedAt}::timestamptz,
          ${inc.affectedObject},
          ${inc.initiatorUser},
          ${inc.technicalSummary},
          ${JSON.stringify(inc.evidencias)}::jsonb,
          ${JSON.stringify(inc.historico)}::jsonb
        )
        ON CONFLICT (incident_id) DO UPDATE SET
          automation_inventory_id = EXCLUDED.automation_inventory_id,
          id_control = EXCLUDED.id_control,
          framework = EXCLUDED.framework,
          reference_month = EXCLUDED.reference_month,
          titulo = EXCLUDED.titulo,
          severidade = EXCLUDED.severidade,
          status = EXCLUDED.status,
          nome_automacao = EXCLUDED.nome_automacao,
          trigger_name = EXCLUDED.trigger_name,
          detected_at = EXCLUDED.detected_at,
          affected_object = EXCLUDED.affected_object,
          initiator_user = EXCLUDED.initiator_user,
          technical_summary = EXCLUDED.technical_summary,
          evidencias_json = EXCLUDED.evidencias_json,
          historico_json = EXCLUDED.historico_json,
          updated_at = now()
      `
      seeded += 1
    }
    return { success: true, seeded }
  } catch (error: any) {
    console.error("seedAutomationIncidentsIfEmpty:", error)
    return { success: false, seeded, error: error?.message || "Erro ao popular incidentes." }
  }
}

type IncidentRow = {
  incident_id: string
  automation_inventory_id: string | null
  id_control: string | null
  framework: string | null
  reference_month: string
  titulo: string
  severidade: string
  status: string
  nome_automacao: string | null
  trigger_name: string | null
  detected_at: string
  affected_object: string | null
  initiator_user: string | null
  technical_summary: string | null
  evidencias_json: unknown
  historico_json: unknown
  controle_sox_raw: string | null
  jira_nome: string | null
  name_control: string | null
}

function mapRowToIncidente(r: IncidentRow): Incidente {
  let evidencias: Incidente["evidencias"] = []
  let historico: Incidente["historico"] = []
  try {
    const ev = r.evidencias_json
    if (Array.isArray(ev)) evidencias = ev as Incidente["evidencias"]
    else if (typeof ev === "string") evidencias = JSON.parse(ev)
  } catch {
    evidencias = []
  }
  try {
    const hi = r.historico_json
    if (Array.isArray(hi)) historico = hi as Incidente["historico"]
    else if (typeof hi === "string") historico = JSON.parse(hi)
  } catch {
    historico = []
  }

  const controleSoxDisplay =
    safeText(r.controle_sox_raw) || safeText(r.name_control) || safeText(r.id_control) || null
  const nomeJiraDisplay = safeText(r.jira_nome) || null

  return {
    id: r.incident_id,
    titulo: r.titulo,
    severidade: r.severidade as Incidente["severidade"],
    status: r.status as Incidente["status"],
    automacaoInventarioId: r.automation_inventory_id,
    nomeAutomacao: safeText(r.nome_automacao) || "—",
    triggerName: safeText(r.trigger_name) || "—",
    detectedAt: new Date(r.detected_at).toISOString(),
    affectedObject: safeText(r.affected_object) || "—",
    initiatorUser: safeText(r.initiator_user) || "—",
    technicalSummary: safeText(r.technical_summary) || "—",
    evidencias,
    historico,
    referenceMonth: r.reference_month,
    idControl: r.id_control,
    framework: r.framework,
    controleSoxDisplay,
    nomeJiraDisplay,
  }
}

export async function fetchIncidentesList(): Promise<
  { success: true; data: Incidente[] } | { success: false; error: string; data: Incidente[] }
> {
  await ensureAutomationIncidentsSchema()
  const seed = await seedAutomationIncidentsIfEmpty()
  if (!seed.success) {
    return { success: false, error: seed.error || "Falha ao preparar incidentes.", data: [] }
  }
  try {
    const rows = await sql<IncidentRow[]>`
      SELECT
        i.incident_id,
        i.automation_inventory_id,
        i.id_control,
        i.framework,
        i.reference_month,
        i.titulo,
        i.severidade,
        i.status,
        i.nome_automacao,
        i.trigger_name,
        i.detected_at::text,
        i.affected_object,
        i.initiator_user,
        i.technical_summary,
        i.evidencias_json,
        i.historico_json,
        inv.controle_sox_raw,
        inv.jira_nome,
        c.name_control
      FROM automation_incidents i
      LEFT JOIN automation_inventory inv ON inv.inventory_id = i.automation_inventory_id
      LEFT JOIN controls c ON c.id_control = i.id_control
      ORDER BY i.detected_at DESC
    `
    return { success: true, data: rows.map(mapRowToIncidente) }
  } catch (error: any) {
    console.error("fetchIncidentesList:", error)
    return { success: false, error: error?.message || "Erro ao carregar incidentes.", data: [] }
  }
}

export async function fetchIncidenteById(
  incidentId: string
): Promise<{ success: true; data: Incidente | null } | { success: false; error: string }> {
  const id = safeText(incidentId)
  if (!id) return { success: false, error: "ID inválido." }
  await ensureAutomationIncidentsSchema()
  await seedAutomationIncidentsIfEmpty()
  try {
    const rows = await sql<IncidentRow[]>`
      SELECT
        i.incident_id,
        i.automation_inventory_id,
        i.id_control,
        i.framework,
        i.reference_month,
        i.titulo,
        i.severidade,
        i.status,
        i.nome_automacao,
        i.trigger_name,
        i.detected_at::text,
        i.affected_object,
        i.initiator_user,
        i.technical_summary,
        i.evidencias_json,
        i.historico_json,
        inv.controle_sox_raw,
        inv.jira_nome,
        c.name_control
      FROM automation_incidents i
      LEFT JOIN automation_inventory inv ON inv.inventory_id = i.automation_inventory_id
      LEFT JOIN controls c ON c.id_control = i.id_control
      WHERE i.incident_id = ${id}
      LIMIT 1
    `
    const row = rows[0]
    return { success: true, data: row ? mapRowToIncidente(row) : null }
  } catch (error: any) {
    console.error("fetchIncidenteById:", error)
    return { success: false, error: error?.message || "Erro ao carregar incidente." }
  }
}
