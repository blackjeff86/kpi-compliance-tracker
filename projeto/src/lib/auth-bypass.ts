const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export const LOCAL_BYPASS_EMAIL =
  String(process.env.LOCALHOST_BYPASS_EMAIL || "").trim().toLowerCase() || "local.dev@kpi.local"

export function isLocalhostBypassAllowed() {
  return process.env.NODE_ENV !== "production"
}

export function isLocalhostHost(host: string | null | undefined) {
  const normalizedHost = String(host || "").trim().toLowerCase()
  if (!normalizedHost) return false

  const withoutPort = normalizedHost.startsWith("[")
    ? `${normalizedHost.split("]")[0] || "[::1]"}]`
    : normalizedHost.split(":")[0]

  return LOCALHOST_HOSTS.has(withoutPort)
}

export function shouldBypassAuthForHost(host: string | null | undefined) {
  return isLocalhostBypassAllowed() && isLocalhostHost(host)
}
