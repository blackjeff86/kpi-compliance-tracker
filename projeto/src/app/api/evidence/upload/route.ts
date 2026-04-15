import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { ensureFolderTree, uploadFileToFolder } from "@/lib/google-drive"

export const runtime = "nodejs"

type UploadConfig = {
  enabled: boolean
  provider: "GOOGLE_DRIVE"
  drive_root_folder_id: string
}

function safeText(v: unknown) {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function sanitizeSegment(v: string) {
  return safeText(v).replace(/[\\/:*?"<>|]/g, "_").slice(0, 120)
}

async function getUploadConfig(): Promise<UploadConfig> {
  const rows = await sql`
    SELECT value_json
    FROM admin_settings
    WHERE key = 'evidence_upload_config'
    LIMIT 1
  `
  const raw = (rows?.[0]?.value_json || {}) as any

  return {
    enabled: raw?.enabled === true || String(raw?.enabled || "").toLowerCase() === "true",
    provider: "GOOGLE_DRIVE",
    drive_root_folder_id: safeText(raw?.drive_root_folder_id),
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")
    const period = safeText(formData.get("period"))
    const idControl = safeText(formData.get("id_control"))
    const kpiId = safeText(formData.get("kpi_id"))

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Arquivo é obrigatório." }, { status: 400 })
    }
    if (!period || !idControl || !kpiId) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios ausentes (period, id_control, kpi_id)." },
        { status: 400 }
      )
    }

    const cfg = await getUploadConfig()
    if (!cfg.enabled) {
      return NextResponse.json({ success: false, error: "Upload de evidências está desabilitado no Admin." }, { status: 400 })
    }
    if (!cfg.drive_root_folder_id) {
      return NextResponse.json({ success: false, error: "Pasta raiz do Google Drive não configurada no Admin." }, { status: 400 })
    }

    const periodSegment = sanitizeSegment(period)
    const controlSegment = sanitizeSegment(idControl)
    const kpiSegment = sanitizeSegment(kpiId)

    const targetFolderId = await ensureFolderTree({
      rootFolderId: cfg.drive_root_folder_id,
      segments: [periodSegment, controlSegment, kpiSegment],
    })

    const bytes = Buffer.from(await file.arrayBuffer())
    const cleanName = sanitizeSegment(file.name || "evidencia")
    const finalFileName = `${new Date().toISOString().replace(/[:.]/g, "-")}__${cleanName}`

    const uploaded = await uploadFileToFolder({
      parentId: targetFolderId,
      fileName: finalFileName,
      mimeType: safeText(file.type) || "application/octet-stream",
      bytes,
    })

    return NextResponse.json({
      success: true,
      data: {
        file_id: uploaded.id,
        file_name: uploaded.name,
        web_view_link: uploaded.webViewLink || null,
        web_content_link: uploaded.webContentLink || null,
        folder_path: `${periodSegment}/${controlSegment}/${kpiSegment}`,
      },
    })
  } catch (error: any) {
    console.error("Erro no upload de evidência:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Falha ao fazer upload da evidência no Google Drive." },
      { status: 500 }
    )
  }
}
