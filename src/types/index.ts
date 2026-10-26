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
