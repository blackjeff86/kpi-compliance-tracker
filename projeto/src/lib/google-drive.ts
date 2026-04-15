import crypto from "crypto"

type DriveTokenCache = {
  accessToken: string
  expiresAtMs: number
} | null

let tokenCache: DriveTokenCache = null

function base64Url(input: Buffer | string) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function normalizePrivateKey(keyRaw: string) {
  return keyRaw.replace(/\\n/g, "\n")
}

function getDriveCredentialsFromEnv() {
  const jsonRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw)
    const clientEmail = String(parsed?.client_email || "").trim()
    const privateKey = normalizePrivateKey(String(parsed?.private_key || ""))
    if (clientEmail && privateKey) return { clientEmail, privateKey }
  }

  const clientEmail = String(process.env.GOOGLE_DRIVE_CLIENT_EMAIL || "").trim()
  const privateKey = normalizePrivateKey(String(process.env.GOOGLE_DRIVE_PRIVATE_KEY || ""))
  if (!clientEmail || !privateKey) {
    throw new Error("Credenciais do Google Drive ausentes. Configure GOOGLE_DRIVE_CLIENT_EMAIL e GOOGLE_DRIVE_PRIVATE_KEY.")
  }
  return { clientEmail, privateKey }
}

async function getAccessToken() {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAtMs - 60_000 > now) return tokenCache.accessToken

  const { clientEmail, privateKey } = getDriveCredentialsFromEnv()

  const header = { alg: "RS256", typ: "JWT" }
  const iat = Math.floor(now / 1000)
  const exp = iat + 3600
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  }

  const encodedHeader = base64Url(JSON.stringify(header))
  const encodedClaimSet = base64Url(JSON.stringify(claimSet))
  const payload = `${encodedHeader}.${encodedClaimSet}`

  const signer = crypto.createSign("RSA-SHA256")
  signer.update(payload)
  signer.end()
  const signature = signer.sign(privateKey)
  const jwt = `${payload}.${base64Url(signature)}`

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  })

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!tokenResp.ok) {
    const detail = await tokenResp.text()
    throw new Error(`Falha ao autenticar no Google Drive: ${detail}`)
  }

  const tokenJson = (await tokenResp.json()) as { access_token: string; expires_in: number }
  const accessToken = String(tokenJson?.access_token || "")
  const expiresIn = Number(tokenJson?.expires_in || 0)
  if (!accessToken) throw new Error("Token de acesso do Google Drive não retornado.")

  tokenCache = {
    accessToken,
    expiresAtMs: now + Math.max(60, expiresIn) * 1000,
  }

  return accessToken
}

function escapeDriveQueryValue(v: string) {
  return String(v || "").replace(/'/g, "\\'")
}

async function driveRequest<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers || {})
  headers.set("Authorization", `Bearer ${token}`)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")

  const resp = await fetch(url, { ...init, headers })
  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`Google Drive API error (${resp.status}): ${detail}`)
  }

  const text = await resp.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export async function findFolderByName(params: { parentId: string; name: string }) {
  const parentId = String(params.parentId || "").trim()
  const name = String(params.name || "").trim()
  if (!parentId || !name) return null

  const q = [
    `name = '${escapeDriveQueryValue(name)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'${escapeDriveQueryValue(parentId)}' in parents`,
    "trashed = false",
  ].join(" and ")

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&pageSize=1&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`

  const json = await driveRequest<{ files?: Array<{ id: string; name: string }> }>(url)
  return json?.files?.[0] || null
}

export async function createFolder(params: { parentId: string; name: string }) {
  const parentId = String(params.parentId || "").trim()
  const name = String(params.name || "").trim()
  if (!parentId || !name) throw new Error("parentId e name são obrigatórios para criar pasta.")

  const url = "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink"
  const json = await driveRequest<{ id: string; name: string; webViewLink?: string }>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  })
  return json
}

export async function getOrCreateFolder(params: { parentId: string; name: string }) {
  const found = await findFolderByName(params)
  if (found?.id) return found
  return createFolder(params)
}

export async function ensureFolderTree(params: { rootFolderId: string; segments: string[] }) {
  let currentId = String(params.rootFolderId || "").trim()
  if (!currentId) throw new Error("rootFolderId é obrigatório.")

  for (const segmentRaw of params.segments) {
    const segment = String(segmentRaw || "").trim()
    if (!segment) continue
    const folder = await getOrCreateFolder({ parentId: currentId, name: segment })
    currentId = folder.id
  }

  return currentId
}

export async function uploadFileToFolder(params: {
  parentId: string
  fileName: string
  mimeType: string
  bytes: Buffer
}) {
  const parentId = String(params.parentId || "").trim()
  const fileName = String(params.fileName || "").trim()
  const mimeType = String(params.mimeType || "application/octet-stream").trim()
  if (!parentId || !fileName) throw new Error("parentId e fileName são obrigatórios para upload.")

  const boundary = `drive_boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const metadata = {
    name: fileName,
    parents: [parentId],
  }

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  )
  const ending = Buffer.from(`\r\n--${boundary}--`)
  const body = Buffer.concat([preamble, params.bytes, ending])

  const url =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink"
  const json = await driveRequest<{ id: string; name: string; webViewLink?: string; webContentLink?: string }>(url, {
    method: "POST",
    headers: {
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  return json
}
