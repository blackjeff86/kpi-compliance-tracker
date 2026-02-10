// Enum para frequências (Item 4.2 do seu documento)
export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'SEMI-ANNUAL';

// Enum para níveis de risco
export type RiskLevel = 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';

// Enum para status de saúde (Item 5)
export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface Framework {
  id: string;
  code: string; // ex: SOX
  name: string;
  is_active: boolean;
}

export interface Control {
  id: string;
  framework_id: string;
  control_code: string; // ex: TEC_C50
  name: string;
  description: string;
  frequency: Frequency;
  risk_level: RiskLevel;
  owner_email: string;
  focal_email: string;
  is_active: boolean;
  status?: HealthStatus; // Calculado logicamente
}

export interface KPI {
  id: string;
  control_id: string;
  kpi_code: string;
  name: string;
  description: string;
  criticality: RiskLevel;
  frequency: Frequency;
  metric: string;
  evidence_required: boolean;
  green_min: number;
  yellow_min: number;
  is_active: boolean;
}

export interface KPIRun {
  id: string;
  kpi_id: string;
  status: HealthStatus;
  created_at: Date;
  is_latest: boolean;
  evidence_url?: string;
  comment?: string;
}