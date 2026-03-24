import fs from "node:fs"
import path from "node:path"
import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { isLocalhostBypassAllowed } from "@/lib/auth-bypass"

type GoogleClientSecretFileShape = {
  installed?: { client_id?: string; client_secret?: string }
  web?: { client_id?: string; client_secret?: string }
}

function resolveGoogleCredentials() {
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret }
  }

  const fromEnvFile = process.env.GOOGLE_CLIENT_SECRET_FILE?.trim()
  const cwd = process.cwd()
  const candidates = [
    fromEnvFile ? path.resolve(cwd, fromEnvFile) : "",
    ...fs
      .readdirSync(cwd)
      .filter((name) => /^client_secret_.*\.json$/i.test(name))
      .map((name) => path.join(cwd, name)),
  ].filter(Boolean)

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue
    const raw = fs.readFileSync(filePath, "utf8")
    const parsed = JSON.parse(raw) as GoogleClientSecretFileShape
    const node = parsed.web || parsed.installed
    const clientId = node?.client_id?.trim()
    const clientSecret = node?.client_secret?.trim()
    if (clientId && clientSecret) {
      return { clientId, clientSecret }
    }
  }

  if (isLocalhostBypassAllowed()) return null

  throw new Error(
    "Google SSO não configurado. Defina GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ou adicione um arquivo client_secret_*.json na raiz do projeto.",
  )
}

const googleCredentials = resolveGoogleCredentials()
const providers = googleCredentials
  ? [
      GoogleProvider({
        clientId: googleCredentials.clientId,
        clientSecret: googleCredentials.clientSecret,
      }),
    ]
  : []

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-change-this-secret",
  providers,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
}
