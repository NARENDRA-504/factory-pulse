/**
 * ZIRO Digital Internship — AI Manufacturing Platform Type Definitions
 */

export type UserRole = 'Operator' | 'Supervisor' | 'Manager' | 'Maintenance' | 'Admin';

export type DataProvenance = 'EMPIRICAL DATASET' | 'SIMULATED' | 'DEMO';

export type MachineStatus = 'Nominal' | 'Warning' | 'Critical' | 'Offline';

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentStatus = 'Open' | 'In_Investigation' | 'Action_Required' | 'Closed';

export interface UserProfile {
  id: number;
  workId: string;
  fullName: string;
  role: UserRole;
  assignedMachine?: string;
  assignedPlant?: string;
  email: string;
  shift?: 'Shift A' | 'Shift B' | 'Night Shift';
  department?: string;
  /** UTC timestamp returned by the authenticated session endpoint. */
  sessionStartedAt?: string;
  status?: 'Active' | 'On Duty' | 'Standby' | 'Offline';
  phone?: string;
}

export type MachineCategory =
  | 'CNC Vertical Machining Center'
  | 'CNC Horizontal Machining Center'
  | 'CNC Turning Center'
  | '5-Axis CNC Machining Center'
  | 'CNC Grinding Machine'
  | 'CNC Drilling and Tapping Center'
  | 'CNC Mill-Turn Center';

export interface Machine {
  // Required core fields for 400-machine factory
  machineId: string;
  machineCode: string;
  displayName: string;
  machineType: MachineCategory;
  manufacturer: string;
  model: string;
  plant: string;
  shopFloor: string;
  productionLine: string;
  status: MachineStatus;
  assignedOperator: string;
  shift: 'Shift A' | 'Shift B' | 'Night Shift';
  telemetryKey: string;

  // Machine telemetry condition fields
  spindleRpm: number;
  coolantTemperatureC: number;
  motorLoadPercent: number;
  vibrationMmS: number;
  powerKw: number;
  workingTimeMinutes: number;
  jobsProducedThisShift: number;
  shiftJobsTarget: number;
  coolantLevelPercent: number;
  activeAlertCount: number;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;

  // Backward compatibility fields
  code: string;
  name: string;
  lineId: string;
  lastInspectionDate: string;
  cutHours: number;
  currentToolCuts: number;
  operatorWorkId?: string;
  activeWorkpiece: string;
}

export interface TelemetryReading {
  timestamp: string;
  spindleRpm: number;
  feedRateMmpm: number;
  vibX: number;
  vibY: number;
  vibZ: number;
  vibRms: number;
  motorPowerKw: number;      // Explicit kW field
  motorLoadPct: number;      // Explicit % field
  coolantTempC: number;
  dataProvenance: DataProvenance;
  injectedAnomalyType?: string;
  // Live Simulator Supported Fields
  jobsProduced?: number;
  coolantLevelPct?: number;
  workingTimeSeconds?: number;
  machineStatus?: MachineStatus;
  activeAlert?: string | null;
}

export interface VerifiedSensorReading {
  metric: string;
  measuredValue: number;
  unit: string;
  statusNote?: string;
}

export interface DiagnosticHypothesis {
  hypothesis: string;
  rationale: string;
  verificationStatus: string;
}

export interface AIDiagnosisResult {
  incidentId: number;
  incidentSummary: string;
  dataProvenance: DataProvenance;
  verifiedSensorReadings: VerifiedSensorReading[];
  unverifiedMetricsExcluded: Array<{ metric: string; reason: string }>;
  diagnosticHypotheses: DiagnosticHypothesis[];
  suggestedInvestigationSteps: string[];
  safetyDisclaimer: string;
  futureSopCapabilityNote: string;
  modelId: string;
  generatedAt: string;
}

export type IncidentLifecycleStage =
  | 'Detected'
  | 'Created'
  | 'Notified'
  | 'Acknowledged'
  | 'Under_Investigation'
  | 'Action_Taken'
  | 'Verified'
  | 'Resolved';

export type NotificationDeliveryStatus =
  | 'In_App_Delivered'
  | 'Acknowledged'
  | 'External_Unconfigured'
  | 'Failed';

export interface DepartmentNotification {
  id: string;
  incidentId: number;
  incidentCode: string;
  machineCode: string;
  targetRoles: UserRole[];
  severity: IncidentSeverity;
  title: string;
  message: string;
  abnormalParameters: Array<{
    parameter: string;
    observedValue: number | string;
    unit: string;
    baselineValue: number | string;
    deviation: string;
  }>;
  recommendedNextSteps: string[];
  deliveredAt: string;
  deliveryStatus: NotificationDeliveryStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  externalDeliveryNote: string;
}

export interface SOPDocument {
  id: string;
  sopCode: string;
  title: string;
  category: 'Spindle' | 'Axis_Drive' | 'Lubrication' | 'Surface_Quality' | 'General';
  machineTypes: string[];
  targetComponents: string[];
  safetyWarnings: string[];
  lotoRequired: boolean;
  inspectionSteps: string[];
  correctiveActions: string[];
  revision: string;
  authorizingBody: string;
}

export interface AnomalyEvidenceItem {
  parameter: string;
  observedValue: number;
  unit: string;
  baselineP95: number;
  deviationMultiplier: number;
  isRateOfChangeTrigger: boolean;
  rateOfChangeValue?: string;
}

export interface AnomalyDetectionResult {
  machineCode: string;
  timestamp: string;
  anomalyScore: number; // 0.0 to 1.0 from Multivariate Isolation Forest
  state: 'Normal' | 'Warning' | 'Critical';
  severity: IncidentSeverity;
  detectionMethod: string;
  isPatternChange: boolean;
  rateOfChangeSummary: string;
  abnormalMetrics: AnomalyEvidenceItem[];
  suggestedAction: string;
  provisionalThresholdDisclaimer: string;
  rawReading: TelemetryReading;
}

export interface ManagerMTTAMetrics {
  mttaMinutes: number;
  mttrMinutes: number;
  unplannedDowntimeHours: number;
  activeIncidentsCount: number;
  recurringMachineIssuesCount: number;
  totalAlertsDispatched: number;
  averageAcknowledgementRatePct: number;
}

export interface Incident {
  sensorSnapshot?: Array<{reading_id:string;sensor_name:string;sensor_value:number|string|null;sensor_unit:string;timestamp:string}>;
  id: number;
  incidentCode: string;
  machineCode: string;
  reporterId: number;
  reporterName: string;
  reporterRole: UserRole;
  severity: IncidentSeverity;
  symptomDescription: string;
  operatorNotes?: string;
  componentArea: string;
  measuredVibRms: number;
  measuredMotorPowerKw: number; // Stored separately in kW
  measuredMotorLoadPct: number; // Stored separately in %
  correlatedVbMm?: number;      // Flank wear in mm (Dataset 1)
  correlatedRaUm?: number;      // Surface roughness in µm (Dataset 2)
  dataProvenance: DataProvenance;
  assignedToId?: number;
  assignedToName?: string;
  status: IncidentStatus;
  lifecycleStage?: IncidentLifecycleStage;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedByName?: string;
  notificationStatus?: NotificationDeliveryStatus;
  duplicateCount?: number;
  lastTelemetryEventAt?: string;
  anomalyScore?: number;
  detectionMethod?: string;
  sopReferenceCode?: string;
  resolutionVerifiedAt?: string;
  resolutionVerifiedByName?: string;
  closedAt?: string;
  closedByName?: string;
  closedRole?: UserRole;
  closureNotes?: string;
  notes?: string;
  diagnosis?: AIDiagnosisResult;
}

export interface MaintenanceWorkOrder {
  id: number;
  orderCode: string;
  incidentCode: string;
  machineCode: string;
  technicianName: string;
  priority: 'Low' | 'Medium' | 'Urgent';
  actionTaken?: string;
  status: 'Pending' | 'In_Progress' | 'Completed';
  createdAt: string;
  completedAt?: string;
}

export interface Dataset1ToolWearSummary {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  targetMetric: string;
  targetUnit: string;
  meanVbMm: number;
  medianVbMm: number;
  iqrVbMm: number;
  p90VbMm: number;
  missingSensorColumns: string[];
  sampleCutPoints: Array<{ cutNumber: number; vbMm: number; condition: string }>;
}

export interface Dataset2RoughnessSummary {
  datasetName: string;
  rowCount: number;
  mergedExperiments: string[];
  targetMetric: string;
  targetUnit: string;
  prepCsvStatus: string;
  exp1MeanRaUm: number;
  exp2MeanRaUm: number;
  overallMedianRaUm: number;
  samples: Array<{
    sourceExperiment: string;
    cutSpeedMpm: number;
    feedRateMmpm: number;
    depthOfCutMm: number;
    raUm: number;
  }>;
}

export interface Dataset3TelemetrySummary {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  experimentCount: number;
  experimentSummaries: Array<{
    experimentName: string;
    sampleCount: number;
    avgSpindleRpm: number;
    avgVibRms: number;
    p95VibRmsBaseline: number;
    avgMotorCurrentAmp: number;
    nominalVsWornRatio: string;
  }>;
  disclaimer?: string;
}

export interface Dataset4CycleToFailureSummary {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  targetMetric: string;
  meanCycles: number;
  medianCycles: number;
  p25Cycles: number;
  p75Cycles: number;
  samples: Array<{ cycleId: number; cycleToFailure: number }>;
}

export interface PipelineHealthAudit {
  rawToolWearCount: number;
  rawRoughnessCount: number;
  rawTelemetryCount: number;
  rawMillingCyclesCount: number;
  simTelemetryEventsCount: number;
  validationCheckPassed: boolean;
  totalEmpiricalRows?: number;
  formula?: string;
  lastSyncTimestamp: string;
  mysqlHost: string;
  databaseName: string;
}

export interface MachineInventoryRecord {
  machine_id: string;
  machine_code: string;
  name: string;
  model: string;
  machine_type: string;
  production_line: string;
  plant: string;
  location: string;
  manufacturer?: string;
  registry_source: 'MYSQL' | 'REFERENCE_CATALOG';
  registered_in_sql: boolean;
  description?: string;
  last_inspection_date?: string;
  installation_date?: string;
  is_active: boolean;
  operating_status: string;
  connection_status: 'RECEIVING' | 'STALE' | 'WAITING' | 'CONFIGURATION_REQUIRED';
  current_round_downtime_seconds: number;
  total_downtime_seconds: number;
  latest_timestamp?: string | null;
  sensors?: any[];
}

export interface NewMachineInput {
  name: string;
  machine_type: string;
  department: string;
  location: string;
  status: 'Nominal' | 'Warning' | 'Critical' | 'Offline' | 'Down' | 'Idle' | 'Maintenance';
  installation_date: string;
  manufacturer?: string;
  description?: string;
  is_active: boolean;
}

export interface AIMachineHealthAnalysis {
  machine_id: string;
  machine_code: string;
  overall_health: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  machine_health_summary: string;
  abnormal_temperature_warning: {
    severity: string;
    observed_value: string;
    threshold: string;
    message: string;
  } | null;
  excessive_vibration_warning: {
    severity: string;
    observed_value: string;
    threshold: string;
    message: string;
  } | null;
  potential_failure_indicators: string[];
  downtime_explanation: string;
  maintenance_recommendations: string[];
  natural_language_explanation: string;
  evidence_used: {
    temperature?: number | null;
    vibration?: number | null;
    rpm?: number | null;
    fault_mode?: string | null;
    current_round_downtime_seconds: number;
    total_downtime_seconds: number;
  };
  ai_engine: string;
  generated_at: string;
}

export interface MachineDowntimeSummary {
  machine_id: string;
  current_downtime_seconds: number;
  total_seconds: number;
  intervals: Array<{
    start: string;
    end: string;
    seconds: number;
    ongoing: boolean;
  }>;
  rounds: Array<{
    round_id: string;
    start: string;
    end: string;
    downtime_seconds: number;
  }>;
  round_definition: string;
  basis: string;
}
