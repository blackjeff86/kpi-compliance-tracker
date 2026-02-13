export type AdminKpiRules = {
    yellow_ratio: number
    zero_meta_yellow_max: number
  }
  
  export type KpiEvaluationMode = "UP" | "DOWN" | "BOOLEAN"
  
  const DEFAULT_RULES: AdminKpiRules = {
    yellow_ratio: 0.9,
    zero_meta_yellow_max: 1,
  }
  
  function safeNumber(v: any): number | null {
    if (v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  
  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
  }
  
  function normalizeRules(input: any): AdminKpiRules {
    const yellow_ratio = safeNumber(input?.yellow_ratio)
    const zero_meta_yellow_max = safeNumber(input?.zero_meta_yellow_max)
  
    return {
      yellow_ratio: clamp(yellow_ratio ?? DEFAULT_RULES.yellow_ratio, 0.01, 0.999),
      zero_meta_yellow_max: clamp(zero_meta_yellow_max ?? DEFAULT_RULES.zero_meta_yellow_max, 0, 999999),
    }
  }
  
  function normalizeMode(v: any): KpiEvaluationMode {
    const s = String(v || "").trim().toUpperCase()
    if (s === "UP" || s === "DOWN" || s === "BOOLEAN") return s
    return "UP"
  }
  
  /** Parse numérico tolerante: "10%", "10,5", 10, etc. */
  function parseNumberLoose(v: any): number | null {
    if (v === null || v === undefined) return null
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const s = v.trim().replace("%", "").replace(",", ".")
      if (!s) return null
      const n = Number(s)
      return Number.isNaN(n) ? null : n
    }
    return null
  }
  
  /** Parse boolean tolerante: true/false, "sim"/"não", "1"/"0", "ok"/"fail" */
  function parseBooleanLoose(v: any): boolean | null {
    if (v === null || v === undefined) return null
    if (typeof v === "boolean") return v
  
    const s = String(v).trim().toLowerCase()
    if (!s) return null
  
    if (["true", "t", "1", "sim", "s", "yes", "y", "ok", "conforme"].includes(s)) return true
    if (["false", "f", "0", "nao", "não", "n", "no", "fail", "não conforme"].includes(s)) return false
  
    return null
  }
  
  /**
   * ✅ Motor universal de classificação (GREEN/YELLOW/RED)
   *
   * BOOLEAN:
   *   GREEN se atual == target
   *   RED se diferente
   *   YELLOW se inválido
   *
   * UP (maior melhor):
   *   GREEN: atual >= meta
   *   YELLOW: atual >= meta*yellow_ratio e < meta
   *   RED: atual < meta*yellow_ratio
   *
   * DOWN (menor melhor):
   *   GREEN: atual <= meta
   *   YELLOW: atual > meta e atual <= meta + buffer
   *   RED: atual > meta + buffer
   *   (buffer = zero_meta_yellow_max)
   */
  export function computeKpiStatusUniversal(params: {
    mode: KpiEvaluationMode
    target: any
    measured: any
    rules?: Partial<AdminKpiRules>
  }): "GREEN" | "YELLOW" | "RED" {
    const r = normalizeRules(params.rules || null)
    const mode = normalizeMode(params.mode)
  
    if (mode === "BOOLEAN") {
      const t = parseBooleanLoose(params.target)
      const m = parseBooleanLoose(params.measured)
      if (t === null || m === null) return "YELLOW"
      return m === t ? "GREEN" : "RED"
    }
  
    const targetN = parseNumberLoose(params.target)
    const measuredN = parseNumberLoose(params.measured)
    if (targetN === null || measuredN === null) return "YELLOW"
  
    if (mode === "UP") {
      const yellowFloor = targetN * r.yellow_ratio
      if (measuredN >= targetN) return "GREEN"
      if (measuredN >= yellowFloor) return "YELLOW"
      return "RED"
    }
  
    // DOWN
    const bufferMax = targetN + r.zero_meta_yellow_max
    if (measuredN <= targetN) return "GREEN"
    if (measuredN <= bufferMax) return "YELLOW"
    return "RED"
  }
  