"use client"

import { useEffect } from "react"

export default function SessionEmailSync({ email }: { email?: string | null }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    const normalized = String(email || "").trim().toLowerCase()
    if (!normalized) return
    window.localStorage.setItem("kpi_user_email", normalized)
  }, [email])

  return null
}
