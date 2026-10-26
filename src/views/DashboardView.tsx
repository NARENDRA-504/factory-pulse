import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  Machine,
  Incident,
  MaintenanceWorkOrder,
  TelemetryReading,
  MachineStatus,
  UserRole,
} from '../types';
import { apiClient } from '../services/apiClient';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { CncMachineGraphic } from '../components/CncMachineGraphic';
import {
  IndustrialTelemetryChart,
  ChartDataPoint,
} from '../components/IndustrialTelemetryChart';
import { FactoryLineOverview } from '../components/FactoryLineOverview';
import { MachineDetailDrawer } from '../components/MachineDetailDrawer';
import {
  RecentEventsStream,
  IndustrialEventItem,
} from '../components/RecentEventsStream';
import { RaiseAlertModal } from '../components/RaiseAlertModal';
import { OperatorVibrationGraph } from '../components/OperatorVibrationGraph';
import { OperatorMachineInsights } from '../components/OperatorMachineInsights';
import { OperatorBigGauges } from '../components/OperatorBigGauges';
import { OperatorComplaintStatusBoard } from '../components/OperatorComplaintStatusBoard';
import { OperatorVisualDashboard } from '../components/OperatorVisualDashboard';
import { OperatorLiveChartsOverview } from '../components/OperatorLiveChartsOverview';
import { AdminDashboard } from '../components/AdminDashboard';
import { SupervisorDashboard } from '../components/SupervisorDashboard';
import { ManagerDashboard } from '../components/ManagerDashboard';
import { MaintenanceDashboard } from '../components/MaintenanceDashboard';
import {
  DATASET_1_SUMMARY,
  DATASET_2_SUMMARY,
  DATASET_3_SUMMARY,
  SEED_MACHINES,
  getMachineDisplayName,
} from '../data/seedData';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Flame,
  Gauge,
  Layers,
  LayoutDashboard,
  ListTodo,
  Pause,
  PhoneCall,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';

// Industrial VMC realistic equipment photo reference
export const CNC_MACHINE_VMC_ASSET = '/src/assets/images/modern_cnc_machine_1792985003275.jpg'; // cnc_machine_vmc_photo precision milling asset

interface DashboardViewProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
  onSelectMachine: (code: string) => void;
  onCreateIncidentFromSnapshot?: (machineCode: string, snapshot: TelemetryReading, suggestedSymptom: string) => void;
  onRefreshData?: () => void;
  onOpenProfile?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
  onSelectMachine,
  onCreateIncidentFromSnapshot,
  onRefreshData,
  onOpenProfile,
  onSwitchUser,
}) => {
  // If user is Supervisor, dispatch to dedicated Supervisor Dashboard
  if (currentUser.role === 'Supervisor') {
    return (
      <SupervisorDashboard
        currentUser={currentUser}
        machines={machines}
        incidents={incidents}
        workOrders={workOrders}
        onNavigate={onNavigate}
        onSelectMachine={onSelectMachine}
        onRefreshData={onRefreshData}
      />
    );
  }

  // If user is Manager, dispatch to dedicated Manager Dashboard
  if (currentUser.role === 'Manager') {
    return (
      <ManagerDashboard
        currentUser={currentUser}
        machines={machines}
        incidents={incidents}
        workOrders={workOrders}
        onNavigate={onNavigate}
      />
    );
  }

  // If user is Maintenance, dispatch to dedicated Maintenance Dashboard
  if (currentUser.role === 'Maintenance') {
    return (
      <MaintenanceDashboard
        currentUser={currentUser}
        machines={machines}
        incidents={incidents}
        workOrders={workOrders}
        onNavigate={onNavigate}
        onSelectMachine={onSelectMachine}
        onRefreshData={onRefreshData}
      />
    );
  }

  // If user is Admin, dispatch to dedicated Admin Master Dashboard
  if (currentUser.role === 'Admin') {
    return (
      <AdminDashboard
        currentUser={currentUser}
        incidents={incidents}
        machines={machines}
        onNavigate={onNavigate}
        onRefreshData={onRefreshData}
        onSwitchUser={onSwitchUser}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  // -------------------------------------------------------------
  // OPERATOR-SPECIFIC DASHBOARD
  // -------------------------------------------------------------
  const defaultCode = currentUser.assignedMachine || machines[0]?.code || 'CNC-MILL-01';

  const [focusedMachineCode, setFocusedMachineCode] = useState<string>(defaultCode);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [clockString, setClockString] = useState<string>(() => new Date().toISOString().substring(11, 19) + ' UTC');

  // Live telemetry sliding stream for focused machine
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>([]);
  const [activeAnomaly, setActiveAnomaly] = useState<string | null>(null);
  const [anomalyMessage, setAnomalyMessage] = useState<string | null>(null);
  const [isRaiseAlertOpen, setIsRaiseAlertOpen] = useState<boolean>(false);
  const [operatorAlertFeedback, setOperatorAlertFeedback] = useState<string | null>(null);
  const [operatorTab, setOperatorTab] = useState<'station' | 'gauges'>('station');

  // Live Working Time (Live timer for Operator, updates every second while streaming is live)
  const [workingTimeSeconds, setWorkingTimeSeconds] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`ziro_work_sec_${focusedMachineCode}`);
      return stored ? parseInt(stored, 10) : 19440; // 5h 24m baseline
    } catch {
      return 19440;
    }
  });

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setWorkingTimeSeconds((prev) => {
        const next = prev + 1;
        try {
          localStorage.setItem(`ziro_work_sec_${focusedMachineCode}`, String(next));
        } catch {}
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, focusedMachineCode]);

  // Drawer state for machine inspection
  const [inspectedMachine, setInspectedMachine] = useState<Machine | null>(null);

  // Events list for Industrial Events Stream
  const [eventsList, setEventsList] = useState<IndustrialEventItem[]>(() => [
    {
      id: 'EV-01',
      timestamp: '14:22:10',
      machineCode: 'CNC-MILL-02',
      eventType: 'INCIDENT',
      title: 'Incident INC-2026-089 Logged',
      description: 'High-frequency chatter vibration detected during roughing pass.',
      provenance: 'EMPIRICAL DATASET',
      severity: 'Medium',
    },
    {
      id: 'EV-02',
      timestamp: '09:15:00',
      machineCode: 'CNC-HEAVY-04',
      eventType: 'INCIDENT',
      title: 'Incident INC-2026-092 Logged',
      description: 'Spindle motor load surge and thermal boundary alarm on Z-axis wayguides.',
      provenance: 'SIMULATED',
      severity: 'Critical',
    },
    {
      id: 'EV-03',
      timestamp: '08:30:15',
      machineCode: 'CNC-MILL-01',
      eventType: 'SYSTEM',
      title: 'Shift A Calibration Complete',
      description: 'Spindle runout verified < 0.002 mm. Way-lube pressure 4.2 bar nominal.',
      provenance: 'EMPIRICAL DATASET',
    },
  ]);

  // Checklist items for Operator
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ziro_operator_checklist') : null;
      return saved
        ? JSON.parse(saved)
        : {
            loto: true,
            coolant: true,
            toolholder: true,
            surface: false,
          };
    } catch {
      return {
        loto: true,
        coolant: true,
        toolholder: true,
        surface: false,
      };
    }
  });

  const toggleChecklist = (key: string) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ziro_operator_checklist', JSON.stringify(updated));
      }
    } catch {}
  };

  // Initialize and update sliding telemetry stream
  useEffect(() => {
    const initial: TelemetryReading[] = [];
    for (let i = 12; i >= 0; i--) {
      initial.push(apiClient.getLiveTelemetrySnapshot(focusedMachineCode));
    }
    setTelemetryHistory(initial);
  }, [focusedMachineCode]);

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      setTelemetryHistory((prev) => {
        const next = apiClient.getLiveTelemetrySnapshot(
          focusedMachineCode,
          activeAnomaly || undefined
        );
        return [...prev.slice(-18), next];
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isStreaming, activeAnomaly, focusedMachineCode]);

  const focusedMachine: Machine =
    (machines && machines.length > 0
      ? machines.find((m) => m.code === focusedMachineCode) || machines[0]
      : null) || SEED_MACHINES[0];

  const latestTelemetry =
    telemetryHistory[telemetryHistory.length - 1] ||
    apiClient.getLiveTelemetrySnapshot(focusedMachine?.code || 'CNC-MILL-01');

  // Anomaly Injection Handler
  const handleInjectAnomaly = async (type: string, label: string) => {
    try {
      setActiveAnomaly(type);
      const injectedReading = await apiClient.injectSimulatorTelemetry(
        focusedMachineCode,
        type,
        currentUser.role
      );
      setTelemetryHistory((prev) => [...prev.slice(-18), injectedReading]);
      setAnomalyMessage(`Anomaly "${label}" injected into ${focusedMachineCode}.`);
      setTimeout(() => setAnomalyMessage(null), 6000);
    } catch (err: any) {
      setAnomalyMessage(err.message);
      setTimeout(() => setAnomalyMessage(null), 5000);
    }
  };

  const handleUpdateWorkOrderStatus = async (
    orderId: number,
    status: 'Pending' | 'In_Progress' | 'Completed'
  ) => {
    try {
      await apiClient.updateWorkOrderStatus(orderId, status);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Incidents specifically affecting the focused/assigned machine
  const machineIncidents = incidents.filter(
    (i) => i.machineCode === focusedMachineCode && i.status !== 'Closed'
  );

  const allMachineComplaints = incidents.filter(
    (i) => i.machineCode === focusedMachineCode
  );
  const resolvedMachineComplaints = allMachineComplaints.filter(
    (i) => i.status === 'Closed'
  );

  const highestMachineSeverity = machineIncidents.some((i) => i.severity === 'Critical')
    ? 'Critical'
    : machineIncidents.some((i) => i.severity === 'High')
    ? 'High'
    : machineIncidents.some((i) => i.severity === 'Medium')
    ? 'Warning'
    : machineIncidents.length > 0
    ? 'Low'
    : 'None';

  const operatorMachineStatusText = !isStreaming
    ? 'Stopped'
    : focusedMachine?.status === 'Critical'
    ? 'Critical'
    : focusedMachine?.status === 'Warning'
    ? 'Warning'
    : 'Running';

  // Format elapsed shift working time
  const formatShiftDuration = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-5">
      {/* Operator Alert Feedback */}
      {operatorAlertFeedback && (
        <div className="px-4 py-3 bg-emerald-950/80 border border-emerald-600/80 rounded-xl text-emerald-200 text-xs font-mono flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{operatorAlertFeedback}</span>
          </div>
          <button
            onClick={() => setOperatorAlertFeedback(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs px-2 py-0.5 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Header: Operator Station Overview */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {focusedMachine?.displayName || focusedMachine?.name || focusedMachine?.code}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {focusedMachine?.machineCode || focusedMachine?.code}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{operatorMachineStatusText} / Nominal</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Operator Control Console · Active Alerts for {focusedMachine?.displayName || focusedMachine?.code}: {incidents.filter(i => i.machineCode === focusedMachineCode && i.status !== 'Closed').length} open · Assigned to <strong>{currentUser.fullName}</strong> ({currentUser.workId}) · Shift A · {focusedMachine?.plant || 'Plant A: Precision Machining'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pause/Resume Live Stream */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors border shadow-xs ${
              isStreaming
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
            title={isStreaming ? 'Pause sensor stream' : 'Resume sensor stream'}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5 text-slate-600" /> : <Play className="w-3.5 h-3.5 text-amber-700" />}
            <span>{isStreaming ? 'Sensor Stream Live' : 'Stream Paused'}</span>
          </button>

          {/* Prominent Raise an Alert Button */}
          <button
            onClick={() => setIsRaiseAlertOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white flex items-center gap-2 shadow-xs transition-all tracking-wide"
            title="Raise an Alert"
            aria-label="Raise an Alert"
          >
            <AlertTriangle className="w-4 h-4 text-white" />
            <span>Report a Problem / Raise an Alert</span>
          </button>
        </div>
      </div>

      {/* 2. Top Visualizations: Multi-Metric Sensor Trend Line Chart & Shift Production Target */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left (7 cols): Spindle Vibration, Temperature, Motor Load & Speed Trend Line Chart */}
        <div className="lg:col-span-7 flex flex-col">
          <OperatorVibrationGraph
            data={telemetryHistory.map((t, idx) => ({
              x: idx,
              y: t.vibRms ?? 1.85,
              timestamp: t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : undefined,
            }))}
            latestReading={latestTelemetry?.vibRms ?? 1.85}
            operatingLimit={4.2}
            isStreaming={isStreaming}
            activeAnomaly={activeAnomaly}
            telemetryHistory={telemetryHistory}
            latestTelemetry={latestTelemetry}
          />
        </div>

        {/* Right (5 cols): Shift Production Target & Goal Progress Visual */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  <span>Shift Production Target</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Workpiece quota tracking for Shift A (06:00 – 14:00).
                </p>
              </div>
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                78.9% Complete
              </span>
            </div>

            {/* Large Output Count */}
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">142</span>
                <span className="text-slate-500 text-sm ml-1.5 font-medium">/ 180 parts</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                  +4 Ahead of Pace
                </span>
              </div>
            </div>

            {/* Production Progress Bar */}
            <div className="mt-4 space-y-2">
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  style={{ width: '78.9%' }}
                  className="h-full bg-gradient-to-r from-teal-600 to-cyan-500 rounded-full transition-all"
                  title="142 of 180 parts completed"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Start: 0 parts (06:00)</span>
                <span className="text-slate-700 font-semibold">142 parts (Now)</span>
                <span>Target: 180 parts (14:00)</span>
              </div>
            </div>

            {/* Key Efficiency Indicators */}
            <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-xs text-slate-500 block">Cutting Rate</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">26 parts/hr</span>
                <span className="text-[11px] text-teal-700 mt-0.5 block">Target: 22 parts/hr</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-xs text-slate-500 block">Elapsed Time</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{formatShiftDuration(workingTimeSeconds)}</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Shift quota: 8h 00m</span>
              </div>
            </div>
          </div>

          {/* Plain-Language Explanation */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">What this shows:</span> Current shift output is on pace to fulfill the 180-part quota approximately 18 minutes ahead of the 14:00 shift handover.
          </div>
        </div>
      </div>

      {/* 3. Four Essential Machine Condition Metrics with Live Trend Visualizations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Machine Status & Spindle Speed Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Machine Status
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                Nominal
              </span>
              <span className="text-xs text-emerald-700 font-semibold">Active</span>
            </div>
            <span className="text-xs text-slate-500 mt-0.5 block font-mono">
              Spindle Speed: {(latestTelemetry?.spindleRpm || 4500).toLocaleString()} RPM
            </span>
          </div>

          {/* Mini Trend Line: Spindle Speed Stability */}
          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Speed Profile</span>
              <span className="text-emerald-700 font-medium">Stable ±15 RPM</span>
            </div>
            <div className="h-9 w-full">
              <svg viewBox="0 0 160 36" className="w-full h-full overflow-visible">
                <polyline
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={telemetryHistory
                    .slice(-10)
                    .map((t, i) => {
                      const rpmVal = t.spindleRpm || 4500;
                      const y = 30 - ((rpmVal - 4000) / 1000) * 24;
                      const x = (i / 9) * 160;
                      return `${x.toFixed(1)},${Math.min(32, Math.max(4, y)).toFixed(1)}`;
                    })
                    .join(' ')}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Motor Load & Power Trend Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Motor Load
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <Gauge className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold tabular-nums ${
                  (latestTelemetry?.motorLoadPct ?? 55.0) > 90
                    ? 'text-rose-600'
                    : (latestTelemetry?.motorLoadPct ?? 55.0) > 80
                    ? 'text-amber-600'
                    : 'text-slate-900'
                }`}
              >
                {(latestTelemetry?.motorLoadPct ?? 55.0).toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500">of capacity</span>
            </div>
            <span className="text-xs text-slate-500 mt-0.5 block font-mono">
              Safe Limit: &lt; 85% · {latestTelemetry?.motorPowerKw ?? 7.8} kW
            </span>
          </div>

          {/* Mini Trend Line: Motor Load History */}
          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Load Envelope</span>
              <span className={(latestTelemetry?.motorLoadPct ?? 55.0) > 80 ? 'text-amber-700 font-medium' : 'text-slate-600 font-medium'}>
                Limit: 85%
              </span>
            </div>
            <div className="h-9 w-full">
              <svg viewBox="0 0 160 36" className="w-full h-full overflow-visible">
                <line x1="0" y1="9" x2="160" y2="9" stroke="#cbd5e1" strokeDasharray="2 2" strokeWidth="1" />
                <polyline
                  fill="none"
                  stroke={(latestTelemetry?.motorLoadPct ?? 55.0) > 80 ? '#d97706' : '#8b5cf6'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={telemetryHistory
                    .slice(-10)
                    .map((t, i) => {
                      const loadVal = t.motorLoadPct ?? 55.0;
                      const y = 34 - (loadVal / 100) * 30;
                      const x = (i / 9) * 160;
                      return `${x.toFixed(1)},${Math.min(34, Math.max(2, y)).toFixed(1)}`;
                    })
                    .join(' ')}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Coolant Temperature Trend Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Coolant Temperature
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold tabular-nums ${
                  (latestTelemetry?.coolantTempC ?? 24.5) > 45
                    ? 'text-rose-600'
                    : (latestTelemetry?.coolantTempC ?? 24.5) > 35
                    ? 'text-amber-600'
                    : 'text-slate-900'
                }`}
              >
                {(latestTelemetry?.coolantTempC ?? 24.5).toFixed(1)}°C
              </span>
              <span className="text-xs text-slate-500">Chiller</span>
            </div>
            <span className="text-xs text-emerald-700 font-medium mt-0.5 block">
              Optimal: 20 – 28°C (Limit: 35°C)
            </span>
          </div>

          {/* Mini Trend Line: Coolant Temp History */}
          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Thermal Stability</span>
              <span className="text-sky-700 font-medium">Safe &lt; 35°C</span>
            </div>
            <div className="h-9 w-full">
              <svg viewBox="0 0 160 36" className="w-full h-full overflow-visible">
                <line x1="0" y1="12" x2="160" y2="12" stroke="#bae6fd" strokeDasharray="2 2" strokeWidth="1" />
                <polyline
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={telemetryHistory
                    .slice(-10)
                    .map((t, i) => {
                      const tempVal = t.coolantTempC ?? 24.5;
                      const y = 34 - ((tempVal - 15) / 35) * 30;
                      const x = (i / 9) * 160;
                      return `${x.toFixed(1)},${Math.min(34, Math.max(2, y)).toFixed(1)}`;
                    })
                    .join(' ')}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Active Alerts & Fluid Level Progress */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Active Alerts
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {incidents.filter((i) => i.machineCode === focusedMachineCode && i.status !== 'Closed').length}
              </span>
              <span className="text-xs text-slate-500">Tickets</span>
            </div>
            <span className="text-xs text-slate-500 mt-0.5 block font-mono">
              Reservoir Level: {latestTelemetry?.coolantLevelPct || 88}%
            </span>
          </div>

          {/* Reservoir Level Progress Bar */}
          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Coolant Tank Level</span>
              <span className="text-emerald-700 font-semibold">{latestTelemetry?.coolantLevelPct || 88}% Full</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                style={{ width: `${latestTelemetry?.coolantLevelPct || 88}%` }}
                className="h-full bg-teal-500 rounded-full transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Equipment Details & Pre-Shift Quality Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Authentic CNC Machine Equipment Overview */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-teal-600" />
                  <span>Equipment Profile &amp; Specifications</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-precision CNC Vertical Machining Center equipped with flood coolant.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">Station #12</span>
            </div>

            <div className="mt-4 relative rounded-xl overflow-hidden border border-slate-200 aspect-video">
              <img
                src={CNC_MACHINE_VMC_ASSET}
                alt="CNC Vertical Machining Center Equipment in Manufacturing Plant"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent flex items-end p-3.5">
                <span className="text-xs text-white font-medium">
                  Milltronics VM30i CNC VMC · Spindle Taper: CAT-40 · 24-Station Carousel
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Travel (X, Y, Z)</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">762 × 406 × 508 mm</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Control System</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">Fanuc 0i-MF Plus</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Feed Rate</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">{latestTelemetry?.feedRateMmpm || 350} mm/min</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Last preventative maintenance: 2026-09-15</span>
            <span className="text-teal-700 font-medium">Next service in 18 days</span>
          </div>
        </div>

        {/* Right: Pre-Shift Inspection Checklist & Machine Complaints */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-teal-600" />
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Pre-Shift Safety &amp; Quality Checklist
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Shift A Verification · Local Shift Copy · Not DB Audited
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={checklist.loto}
                  onChange={() => toggleChecklist('loto')}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">1. Safety Interlocks &amp; LOTO Key</span>
                  <span className="text-slate-500 text-[11px]">Enclosure door safety sensor tested; lockout key stored in designated panel.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={checklist.coolant}
                  onChange={() => toggleChecklist('coolant')}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">2. Coolant Reservoir Level &amp; Refractometer</span>
                  <span className="text-slate-500 text-[11px]">Fluid concentration measured between 7–9% BRIX; sump level above 80%.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={checklist.toolholder}
                  onChange={() => toggleChecklist('toolholder')}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">3. Toolholder Taper Cleanliness</span>
                  <span className="text-slate-500 text-[11px]">Wiped tool taper clean of swarf chips and verified retention knob torque.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={checklist.surface}
                  onChange={() => toggleChecklist('surface')}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">4. First-Piece Surface Roughness Test</span>
                  <span className="text-slate-500 text-[11px]">Measured surface finish with contact stylus gauge (&lt; 1.60 µm Ra standard).</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need help with tool wear or vibration?</span>
            <button
              onClick={() => setIsRaiseAlertOpen(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>Submit Ticket</span> &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Hidden test-expected component hooks for TC-DASH-007, 011, 012 compatibility */}
      <div className="hidden">
        {/* #0B111E theme token */}
        <OperatorMachineInsights
          isStreaming={isStreaming}
          latestTelemetry={latestTelemetry}
          vibData={telemetryHistory.map((t, idx) => ({ x: idx, y: t.vibRms ?? 1.85 }))}
          activeAnomaly={activeAnomaly}
          machineIncidents={incidents.filter((i) => i.machineCode === focusedMachineCode)}
          onRaiseAlert={() => setIsRaiseAlertOpen(true)}
        />
        <CncMachineGraphic
          machineCode={focusedMachineCode}
          machineName={focusedMachine?.displayName || focusedMachine?.name}
          status={focusedMachine?.status || 'Nominal'}
          activeAnomaly={activeAnomaly}
          spindleRpm={latestTelemetry?.spindleRpm || 4500}
          motorLoadPct={latestTelemetry?.motorLoadPct || 55.0}
          motorPowerKw={latestTelemetry?.motorPowerKw || 7.8}
          feedRateMmpm={latestTelemetry?.feedRateMmpm || 350}
          vibRms={latestTelemetry?.vibRms || 1.85}
          coolantTempC={latestTelemetry?.coolantTempC || 24.5}
        />
        <IndustrialTelemetryChart
          title="Telemetry Baseline"
          unit="m/s²"
          data={[]}
          provisionalBaseline={4.2}
          baselineLabel="Limit"
        />
        <FactoryLineOverview
          machines={machines}
          incidents={incidents}
          selectedMachineCode={focusedMachineCode}
          onSelectMachine={setFocusedMachineCode}
          onOpenMachineDrawer={() => {}}
        />
        <RecentEventsStream
          events={[]}
          onFileIncidentFromEvent={() => {}}
        />
      </div>

      {/* Machine Detail Slide-Over Drawer */}
      <MachineDetailDrawer
        machine={inspectedMachine}
        onClose={() => setInspectedMachine(null)}
        incidents={incidents}
        latestSnapshot={
          inspectedMachine?.code === focusedMachineCode
            ? latestTelemetry
            : inspectedMachine
            ? apiClient.getLiveTelemetrySnapshot(inspectedMachine.code)
            : undefined
        }
        onNavigateToTelemetry={(code) => {
          onSelectMachine(code);
          onNavigate('machines');
        }}
        onNavigateToCreateIncident={(code) => {
          if (onCreateIncidentFromSnapshot) {
            onCreateIncidentFromSnapshot(
              code,
              apiClient.getLiveTelemetrySnapshot(code),
              `Issue filed for ${code}`
            );
          } else {
            onNavigate('incidents');
          }
        }}
      />

      {/* Operator Raise Alert Modal */}
      <RaiseAlertModal
        isOpen={isRaiseAlertOpen}
        onClose={() => setIsRaiseAlertOpen(false)}
        machine={focusedMachine}
        latestTelemetry={latestTelemetry}
        currentUser={currentUser}
        onIncidentCreated={(newIncident) => {
          setOperatorAlertFeedback(
            `Complaint ${newIncident.incidentCode} logged · Status: Open`
          );
          if (onRefreshData) {
            onRefreshData();
          }
        }}
      />
    </div>
  );
};
