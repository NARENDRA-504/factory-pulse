/**
 * ZIRO Digital Internship — Seed Data & Dataset Benchmarks
 * Empirical records derived from the 4 approved manufacturing datasets.
 */

import {
  UserProfile,
  Machine,
  Incident,
  MaintenanceWorkOrder,
  Dataset1ToolWearSummary,
  Dataset2RoughnessSummary,
  Dataset3TelemetrySummary,
  Dataset4CycleToFailureSummary,
  PipelineHealthAudit,
} from '../types';

export const SEED_USERS: UserProfile[] = [
  {
    id: 1,
    workId: 'OP-101',
    fullName: 'Marcus Vance',
    role: 'Operator',
    assignedMachine: 'CNC-5AX-001',
    email: 'marcus.vance@ziromfg.internal',
    shift: 'Shift A',
    department: 'Milling & Machining Cell 1',
    status: 'On Duty',
  },
  {
    id: 2,
    workId: 'SUP-201',
    fullName: 'Elena Rostova',
    role: 'Supervisor',
    email: 'elena.rostova@ziromfg.internal',
    shift: 'Shift A',
    department: 'Floor Supervision & Quality',
    status: 'On Duty',
  },
  {
    id: 3,
    workId: 'MGR-301',
    fullName: 'David Sterling',
    role: 'Manager',
    email: 'david.sterling@ziromfg.internal',
    shift: 'Shift A',
    department: 'Operations & Plant Management',
    status: 'Active',
  },
  {
    id: 4,
    workId: 'MNT-401',
    fullName: 'Frank Kowalski',
    role: 'Maintenance',
    email: 'frank.kowalski@ziromfg.internal',
    shift: 'Shift A',
    department: 'Reliability & Mechanical Engineering',
    status: 'On Duty',
  },
  {
    id: 5,
    workId: 'ADM-001',
    fullName: 'Sarah Chen',
    role: 'Admin',
    email: 'sarah.chen@ziromfg.internal',
    shift: 'Shift A',
    department: 'System Security & IT Governance',
    status: 'Active',
  },
];

import { ALL_400_MACHINES } from './machinesData';
import availableRoster from '../../public/available-machine-ids.json';

export const MACHINE_DISPLAY_NAMES: Record<string, string> = {
  'CNC-MILL-01': 'VMC-01 – Haas VF-4SS (Alpha-01)',
  'CNC-MILL-02': 'VMC-02 – Haas VF-2 (Beta-02)',
  'CNC-LATHE-03': 'Turning Center-01 – DMG MORI NLX 2500 (Gamma-03)',
  'CNC-HEAVY-04': 'HMC-01 – Makino a51nx (Heavy Station-04)',
};

// Map all 400 realistic machines by code, machineCode, and machineId
ALL_400_MACHINES.forEach((m) => {
  MACHINE_DISPLAY_NAMES[m.machineCode] = m.displayName;
  MACHINE_DISPLAY_NAMES[m.code] = m.displayName;
  MACHINE_DISPLAY_NAMES[m.machineId] = m.displayName;
});

export const getMachineDisplayName = (code: string, fallbackName?: string): string => {
  return MACHINE_DISPLAY_NAMES[code] || fallbackName || code;
};

export const SEED_MACHINES: Machine[] = ALL_400_MACHINES.filter(machine => availableRoster.machine_ids.includes(machine.machineId));

export const SEED_INCIDENTS: Incident[] = [
  {
    id: 101,
    incidentCode: 'INC-2026-089',
    machineCode: 'CNC-MILL-02',
    reporterId: 1,
    reporterName: 'Marcus Vance',
    reporterRole: 'Operator',
    severity: 'Medium',
    symptomDescription: 'High-frequency chatter vibration detected during roughing pass on pocket 3B.',
    operatorNotes: 'Audible resonance increased sharply when cutting speed reached 4200 RPM. Swarf chips appear discolored.',
    componentArea: 'Spindle & Toolholder',
    measuredVibRms: 4.82,
    measuredMotorPowerKw: 11.4, // Explicit kW
    measuredMotorLoadPct: 84.5, // Explicit %
    correlatedVbMm: 0.28,       // Flank wear mm from Dataset 1
    correlatedRaUm: 1.45,       // Surface roughness µm from Dataset 2
    dataProvenance: 'EMPIRICAL DATASET',
    assignedToId: 4,
    assignedToName: 'Frank Kowalski',
    status: 'In_Investigation',
    createdAt: '2026-10-09 14:22:10',
    diagnosis: {
      incidentId: 101,
      incidentSummary: 'Elevated radial vibration (4.82 m/s²) and moderate motor power spike (11.4 kW) on Haas VF-4SS during pocket milling.',
      dataProvenance: 'EMPIRICAL DATASET',
      verifiedSensorReadings: [
        { metric: 'Vibration RMS', measuredValue: 4.82, unit: 'm/s²' },
        { metric: 'Motor Power', measuredValue: 11.4, unit: 'kW' },
        { metric: 'Motor Load', measuredValue: 84.5, unit: '%' },
        { metric: 'Tool Flank Wear (Vb)', measuredValue: 0.28, unit: 'mm' },
        { metric: 'Surface Roughness (Ra)', measuredValue: 1.45, unit: 'µm' },
      ],
      unverifiedMetricsExcluded: [
        { metric: 'Raw Accelerometer Channel 14', reason: 'Unit unverified in primary dataset documentation' },
      ],
      diagnosticHypotheses: [
        {
          hypothesis: 'Mechanical toolholder taper fretting or insufficient collet clamping torque',
          rationale: 'Radial harmonic peak is concentrated around tool engagement frequency without total motor power overload.',
          verificationStatus: 'Unverified hypothesis — physical inspection required',
        },
        {
          hypothesis: 'Localized flank wear progression on cutting insert tip corner',
          rationale: 'Correlated Vb of 0.28 mm is nearing the empirical upper quartile of the cutting batch.',
          verificationStatus: 'Unverified hypothesis — physical inspection required',
        },
      ],
      suggestedInvestigationSteps: [
        'Perform spindle sweep test with calibrated dial test indicator (0.001 mm resolution)',
        'Inspect ER-32 collet bore and tool shank for fretting wear or metal chip ingress',
        'Verify tool insert corner radius with optical shop microscope before next cut cycle',
      ],
      safetyDisclaimer: 'AI-generated diagnostic guidance. Suggestions are preliminary hypotheses and do NOT replace official manufacturer standard operating procedures or certified maintenance personnel. Follow all facility Lock-Out/Tag-Out (LOTO) procedures before touching machinery.',
      futureSopCapabilityNote: 'Manufacturer-verified SOP retrieval is reserved for future phases pending integration of validated technical manuals.',
      modelId: 'gemini-3.8-flash (Pending API Model Verification)',
      generatedAt: '2026-10-09 14:25:30',
    },
  },
  {
    id: 102,
    incidentCode: 'INC-2026-092',
    machineCode: 'CNC-HEAVY-04',
    reporterId: 2,
    reporterName: 'Elena Rostova',
    reporterRole: 'Supervisor',
    severity: 'Critical',
    symptomDescription: 'Abrupt spindle motor load surge and thermal boundary alarm on Z-axis wayguides.',
    operatorNotes: 'Machine halted automatically by feed-drive overload interlock. Workpiece was safely cleared.',
    componentArea: 'Z-Axis Ball Screw Drive',
    measuredVibRms: 6.95,
    measuredMotorPowerKw: 22.8,
    measuredMotorLoadPct: 102.3,
    correlatedVbMm: 0.38,
    dataProvenance: 'SIMULATED',
    assignedToId: 4,
    assignedToName: 'Frank Kowalski',
    status: 'Action_Required',
    createdAt: '2026-10-10 09:15:00',
  },
  {
    id: 103,
    incidentCode: 'INC-2026-078',
    machineCode: 'CNC-LATHE-03',
    reporterId: 1,
    reporterName: 'Marcus Vance',
    reporterRole: 'Operator',
    severity: 'Low',
    symptomDescription: 'Periodic squeal during outer diameter rough-turning on workpiece journal.',
    operatorNotes: 'Lubrication sight-glass showed minor foaming.',
    componentArea: 'Headstock Lubrication',
    measuredVibRms: 2.15,
    measuredMotorPowerKw: 6.2,
    measuredMotorLoadPct: 52.0,
    correlatedRaUm: 0.92,
    dataProvenance: 'EMPIRICAL DATASET',
    status: 'Closed',
    createdAt: '2026-10-06 11:04:12',
    closedAt: '2026-10-07 16:30:00',
    closedByName: 'Elena Rostova',
    closedRole: 'Supervisor',
    closureNotes: 'Headstock coolant flush performed. Lube pressure verified nominal at 4.2 bar. Operational sign-off approved.',
  },
];

export const SEED_WORK_ORDERS: MaintenanceWorkOrder[] = [
  {
    id: 1,
    orderCode: 'WO-2026-041',
    incidentCode: 'INC-2026-089',
    machineCode: 'CNC-MILL-02',
    technicianName: 'Frank Kowalski',
    priority: 'Medium',
    actionTaken: 'Dial indicator sweep confirmed 0.004 mm runout. Cleaned toolholder taper and replaced collet assembly.',
    status: 'In_Progress',
    createdAt: '2026-10-09 15:00:00',
  },
  {
    id: 2,
    orderCode: 'WO-2026-042',
    incidentCode: 'INC-2026-092',
    machineCode: 'CNC-HEAVY-04',
    technicianName: 'Frank Kowalski',
    priority: 'Urgent',
    actionTaken: 'Awaiting thermal cool-down. Inspecting ball screw pre-load nut and servo feedback encoder.',
    status: 'Pending',
    createdAt: '2026-10-10 09:30:00',
  },
  {
    id: 3,
    orderCode: 'WO-2026-037',
    incidentCode: 'INC-2026-078',
    machineCode: 'CNC-LATHE-03',
    technicianName: 'Frank Kowalski',
    priority: 'Low',
    actionTaken: 'Drained reservoir, replaced filter cartridge, refilled ISO VG 68 slide-way oil.',
    status: 'Completed',
    createdAt: '2026-10-06 13:00:00',
    completedAt: '2026-10-07 15:45:00',
  },
];

export const DATASET_1_SUMMARY: Dataset1ToolWearSummary = {
  datasetName: 'CNC Machine Tool Wear Dataset',
  rowCount: 2054,
  columnCount: 154,
  targetMetric: 'Vb (Flank Wear Width)',
  targetUnit: 'mm',
  meanVbMm: 0.194,
  medianVbMm: 0.178,
  iqrVbMm: 0.115,
  p90VbMm: 0.312,
  missingSensorColumns: ['sensor_channel_14 (missing in 12 rows)', 'sensor_channel_15 (missing in 12 rows)'],
  sampleCutPoints: [
    { cutNumber: 1, vbMm: 0.035, condition: 'Fresh Sharp Insert' },
    { cutNumber: 25, vbMm: 0.082, condition: 'Initial Break-In Wear' },
    { cutNumber: 50, vbMm: 0.141, condition: 'Steady State Linear Wear' },
    { cutNumber: 75, vbMm: 0.198, condition: 'Steady State Linear Wear' },
    { cutNumber: 100, vbMm: 0.245, condition: 'Elevated Flank Abrasion' },
    { cutNumber: 125, vbMm: 0.289, condition: 'Upper Quartile Boundary' },
    { cutNumber: 150, vbMm: 0.342, condition: 'Accelerated Degradation Region' },
  ],
};

export const DATASET_2_SUMMARY: Dataset2RoughnessSummary = {
  datasetName: 'CNC Turning Roughness Dataset',
  rowCount: 612,
  mergedExperiments: ['Exp1 (306 cuts)', 'Exp2 (306 cuts)'],
  targetMetric: 'Ra (Surface Roughness Arithmetic Mean)',
  targetUnit: 'µm',
  prepCsvStatus: 'Prep.csv strictly separate (not Experiment 3)',
  exp1MeanRaUm: 1.18,
  exp2MeanRaUm: 1.42,
  overallMedianRaUm: 1.25,
  samples: [
    { sourceExperiment: 'Exp1', cutSpeedMpm: 120, feedRateMmpm: 0.10, depthOfCutMm: 0.5, raUm: 0.72 },
    { sourceExperiment: 'Exp1', cutSpeedMpm: 150, feedRateMmpm: 0.15, depthOfCutMm: 1.0, raUm: 1.08 },
    { sourceExperiment: 'Exp1', cutSpeedMpm: 180, feedRateMmpm: 0.20, depthOfCutMm: 1.5, raUm: 1.54 },
    { sourceExperiment: 'Exp2', cutSpeedMpm: 120, feedRateMmpm: 0.10, depthOfCutMm: 0.5, raUm: 0.88 },
    { sourceExperiment: 'Exp2', cutSpeedMpm: 150, feedRateMmpm: 0.18, depthOfCutMm: 1.0, raUm: 1.46 },
    { sourceExperiment: 'Exp2', cutSpeedMpm: 180, feedRateMmpm: 0.25, depthOfCutMm: 1.5, raUm: 1.92 },
  ],
};

export const DATASET_3_SUMMARY: Dataset3TelemetrySummary = {
  datasetName: 'CNC Mill Tool Telemetry Dataset',
  rowCount: 25286,
  columnCount: 49,
  experimentCount: 18,
  experimentSummaries: [
    { experimentName: 'Experiment_01_Unworn', sampleCount: 1420, avgSpindleRpm: 4500, avgVibRms: 1.82, p95VibRmsBaseline: 2.35, avgMotorCurrentAmp: 4.8, nominalVsWornRatio: '100% Nominal' },
    { experimentName: 'Experiment_02_Unworn', sampleCount: 1390, avgSpindleRpm: 4500, avgVibRms: 1.91, p95VibRmsBaseline: 2.41, avgMotorCurrentAmp: 5.1, nominalVsWornRatio: '100% Nominal' },
    { experimentName: 'Experiment_06_Transition', sampleCount: 1450, avgSpindleRpm: 4500, avgVibRms: 2.74, p95VibRmsBaseline: 3.52, avgMotorCurrentAmp: 6.2, nominalVsWornRatio: '70% Nom / 30% Worn' },
    { experimentName: 'Experiment_12_Worn', sampleCount: 1380, avgSpindleRpm: 4480, avgVibRms: 4.65, p95VibRmsBaseline: 5.88, avgMotorCurrentAmp: 8.9, nominalVsWornRatio: '100% Worn Cutting' },
    { experimentName: 'Experiment_18_Degraded', sampleCount: 1445, avgSpindleRpm: 4420, avgVibRms: 5.82, p95VibRmsBaseline: 7.15, avgMotorCurrentAmp: 10.4, nominalVsWornRatio: 'High Chatter Anomaly' },
  ],
  disclaimer: 'Provisional statistical baseline only — no trained ML anomaly model claimed or implied.',
};

export const DATASET_4_SUMMARY: Dataset4CycleToFailureSummary = {
  datasetName: 'FeatureAndMetadata_Milling Dataset',
  rowCount: 968,
  columnCount: 131,
  targetMetric: 'CycleToFailure (Tool Cut Life to Failure)',
  meanCycles: 312,
  medianCycles: 295,
  p25Cycles: 210,
  p75Cycles: 390,
  samples: [
    { cycleId: 10, cycleToFailure: 382 },
    { cycleId: 25, cycleToFailure: 345 },
    { cycleId: 50, cycleToFailure: 290 },
    { cycleId: 75, cycleToFailure: 240 },
    { cycleId: 100, cycleToFailure: 185 },
    { cycleId: 150, cycleToFailure: 88 },
    { cycleId: 200, cycleToFailure: 24 },
  ],
};

export const PIPELINE_AUDIT: PipelineHealthAudit = {
  rawToolWearCount: 2054,
  rawRoughnessCount: 612,
  rawTelemetryCount: 25286,
  rawMillingCyclesCount: 968,
  simTelemetryEventsCount: 142,
  validationCheckPassed: true,
  totalEmpiricalRows: 28920,
  formula: '2,054 (D1) + 612 (D2) + 25,286 (D3) + 968 (D4) = 28,920 raw empirical rows',
  lastSyncTimestamp: '2026-10-10 18:00:00 UTC',
  mysqlHost: 'localhost:3306',
  databaseName: 'ziro_manufacturing',
};
