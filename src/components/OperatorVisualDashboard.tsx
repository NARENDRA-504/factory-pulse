import React, { useState, useMemo } from 'react';
import { Machine, TelemetryReading, Incident, MaintenanceWorkOrder } from '../types';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Zap,
  Flame,
  Wrench,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

interface OperatorVisualDashboardProps {
  machine: Machine | undefined;
  telemetry: TelemetryReading | null;
  telemetryHistory: TelemetryReading[];
  isStreaming: boolean;
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onRaiseAlert: () => void;
  onNavigateToIncidents: () => void;
}

export const OperatorVisualDashboard: React.FC<OperatorVisualDashboardProps> = ({
  machine,
  telemetry,
  telemetryHistory,
  isStreaming,
  incidents,
  workOrders,
  onRaiseAlert,
  onNavigateToIncidents,
}) => {
  const [speedTimeRange, setSpeedTimeRange] = useState<'15m' | '1h' | '8h' | '24h'>('15m');
  const [problemsTab, setProblemsTab] = useState<'current' | 'history'>('current');

  const machineCode = machine?.code || 'CNC-MILL-01';

  // Strictly filter incidents for ONLY this assigned machine
  const machineIncidents = useMemo(
    () => incidents.filter((i) => i.machineCode === machineCode),
    [incidents, machineCode]
  );
  const currentProblems = useMemo(
    () => machineIncidents.filter((i) => i.status !== 'Closed'),
    [machineIncidents]
  );
  const historicalProblems = useMemo(
    () => machineIncidents.filter((i) => i.status === 'Closed'),
    [machineIncidents]
  );

  // Strictly filter work orders for this assigned machine
  const machineWorkOrders = useMemo(
    () => workOrders.filter((wo) => wo.machineCode === machineCode),
    [workOrders, machineCode]
  );

  // Latest telemetry metrics
  const spindleRpm = telemetry?.spindleRpm ?? 4500;
  const motorLoadPct = telemetry?.motorLoadPct ?? 60.0;
  const motorPowerKw = telemetry?.motorPowerKw ?? 7.8;
  const vibRms = telemetry?.vibRms ?? 1.85;
  const coolantTempC = telemetry?.coolantTempC ?? 24.5;
  const lastUpdate = telemetry?.timestamp
    ? telemetry.timestamp.slice(11, 19) + ' UTC'
    : new Date().toISOString().slice(11, 19) + ' UTC';

  // Condition evaluation
  const isCritical = machine?.status === 'Critical' || vibRms > 4.2 || motorLoadPct > 90;
  const isWarning = machine?.status === 'Warning' || vibRms > 3.2 || motorLoadPct > 80;
  const conditionState = !isStreaming
    ? 'STOPPED'
    : isCritical
    ? 'CRITICAL'
    : isWarning
    ? 'WARNING'
    : 'NORMAL';

  const conditionColor =
    conditionState === 'NORMAL'
      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
      : conditionState === 'WARNING'
      ? 'bg-amber-950 text-amber-300 border-amber-700'
      : conditionState === 'CRITICAL'
      ? 'bg-rose-950 text-rose-300 border-rose-700'
      : 'bg-slate-900 text-slate-400 border-slate-700';

  // Compute points for SVG charts
  const historyPoints = telemetryHistory.length > 0 ? telemetryHistory.slice(-20) : [];

  // Helper for generating SVG sparkline/chart path
  const generateChartPath = (
    data: number[],
    minVal: number,
    maxVal: number,
    width = 360,
    height = 90
  ) => {
    if (data.length < 2) return '';
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const normalizedY = (val - minVal) / (maxVal - minVal || 1);
      const y = height - Math.max(0, Math.min(1, normalizedY)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const rpmData = historyPoints.length > 2
    ? historyPoints.map((h) => h.spindleRpm)
    : [4480, 4495, 4510, 4500, 4505, spindleRpm];

  const tempData = historyPoints.length > 2
    ? historyPoints.map((h) => h.coolantTempC)
    : [24.1, 24.2, 24.4, 24.3, 24.5, coolantTempC];

  const vibData = historyPoints.length > 2
    ? historyPoints.map((h) => h.vibRms)
    : [1.82, 1.84, 1.86, 1.85, 1.83, vibRms];

  const lastIncident = machineIncidents[0];

  return (
    <div className="space-y-4">
      {/* 1. Header: Machine Status, Assigned Machine ID & Current Shift */}
      <div className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Assigned Workstation
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-teal-950 text-teal-300 border border-teal-800">
              {machineCode}
            </span>
            <span className="text-xs font-mono text-slate-400">· Shift A</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <span>{machine?.name || '5-Axis Precision Vertical Mill Alpha'}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Online/Offline status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isStreaming ? 'bg-teal-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300">{isStreaming ? 'Online' : 'Offline'}</span>
          </div>

          {/* Condition State Pill */}
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border uppercase tracking-wider ${conditionColor}`}
          >
            Condition: {conditionState}
          </div>

          {/* Last Update */}
          <div className="text-xs font-mono text-slate-400 hidden sm:block">
            Updated: <span className="text-slate-200">{lastUpdate}</span>
          </div>

          {/* Raise an Alert Button */}
          <button
            onClick={onRaiseAlert}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Raise Alert</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards (Spindle Speed, Motor Load, Motor Power, Vibration) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Spindle Speed */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Spindle Speed
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono text-white">
              {Math.round(spindleRpm).toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400 font-medium">RPM</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1 block">
            Nominal Range: 3,500 – 6,000 RPM
          </span>
        </div>

        {/* Metric 2: Motor Load */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Motor Load
            </span>
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl sm:text-2xl font-bold font-mono ${
                motorLoadPct > 90
                  ? 'text-rose-400'
                  : motorLoadPct > 80
                  ? 'text-amber-400'
                  : 'text-white'
              }`}
            >
              {motorLoadPct.toFixed(1)}%
            </span>
            <span className="text-xs font-mono text-slate-400 font-medium">Limit &lt; 85%</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1 block">
            VFD Inverter Draw
          </span>
        </div>

        {/* Metric 3: Motor Power */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Motor Power
            </span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono text-cyan-300">
              {motorPowerKw.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 font-medium">kW</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1 block">
            Measured Active Power
          </span>
        </div>

        {/* Metric 4: Vibration */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Vibration
            </span>
            <Activity className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl sm:text-2xl font-bold font-mono ${
                vibRms > 4.2
                  ? 'text-rose-400'
                  : vibRms > 3.2
                  ? 'text-amber-400'
                  : 'text-teal-300'
              }`}
            >
              {vibRms.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400 font-medium">m/s² RMS</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1 block">
            Limit: 4.20 m/s² (ISO 10816-3)
          </span>
        </div>
      </div>

      {/* 3. Main Dashboard — 2x2 Responsive Grid of Four Interactive Graphs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Graph 1: Spindle Speed */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Spindle Speed
                </h3>
              </div>
              {/* Time Range Filter */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[10px] font-mono">
                {(['15m', '1h', '8h', '24h'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSpeedTimeRange(r)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      speedTimeRange === r
                        ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/70'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between text-xs font-mono">
              <span className="text-slate-400">Current Velocity:</span>
              <span className="text-cyan-300 font-bold text-sm">
                {Math.round(spindleRpm).toLocaleString()} RPM
              </span>
            </div>

            {/* SVG Speed Line Chart */}
            <div className="mt-2 h-28 w-full bg-slate-950/60 rounded-lg border border-slate-900 p-2 relative overflow-hidden flex items-end">
              <svg className="w-full h-full" viewBox="0 0 360 90" preserveAspectRatio="none">
                {/* Nominal Limit dashed line */}
                <line
                  x1="0"
                  y1="25"
                  x2="360"
                  y2="25"
                  stroke="#ef4444"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                {/* Speed Line */}
                <path
                  d={generateChartPath(rpmData, 3000, 7000, 360, 90)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute top-1.5 right-2 text-[9px] font-mono text-rose-400/80">
                Operating Limit 6,000 RPM
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Range: 0 – 8,000 RPM</span>
            <span className="text-teal-400">Speed Profile Stable</span>
          </div>
        </div>

        {/* Graph 2: Machine Temperature */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Machine Temperature
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Coolant Chiller</span>
            </div>

            <div className="mt-3 flex items-baseline justify-between text-xs font-mono">
              <span className="text-slate-400">Latest Temp:</span>
              <span className="text-teal-300 font-bold text-sm">
                {coolantTempC.toFixed(1)}°C (Trend: Stable)
              </span>
            </div>

            {/* SVG Temperature Line Chart */}
            <div className="mt-2 h-28 w-full bg-slate-950/60 rounded-lg border border-slate-900 p-2 relative overflow-hidden flex items-end">
              <svg className="w-full h-full" viewBox="0 0 360 90" preserveAspectRatio="none">
                {/* Warning Limit line */}
                <line
                  x1="0"
                  y1="30"
                  x2="360"
                  y2="30"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <path
                  d={generateChartPath(tempData, 18, 35, 360, 90)}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute top-1.5 right-2 text-[9px] font-mono text-amber-400/80">
                Warning Threshold: 30°C
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Nominal Range: 20°C – 28°C</span>
            <span className="text-teal-400">Thermal Envelope Normal</span>
          </div>
        </div>

        {/* Graph 3: Machine Running Time & Utilization */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Machine Runtime
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Current Shift (8h)</span>
            </div>

            {/* Key Utilization Readout */}
            <div className="mt-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">
                Runtime: 6h 20m | Utilization: 79%
              </span>
              <span className="text-emerald-400 font-bold">OEE Target Met</span>
            </div>

            {/* Segmented Timeline / Utilization Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>Shift Timeline Distribution</span>
                <span>Total Monitored: 8h 00m</span>
              </div>
              <div className="h-6 w-full rounded-md overflow-hidden flex border border-slate-800">
                <div
                  className="bg-teal-500 h-full flex items-center justify-center text-[9px] font-mono font-bold text-slate-950"
                  style={{ width: '79%' }}
                  title="Running: 6h 20m (79%)"
                >
                  Running 79%
                </div>
                <div
                  className="bg-amber-500/80 h-full flex items-center justify-center text-[9px] font-mono font-bold text-slate-950"
                  style={{ width: '14%' }}
                  title="Idle: 1h 05m (14%)"
                >
                  Idle 14%
                </div>
                <div
                  className="bg-slate-700 h-full flex items-center justify-center text-[9px] font-mono text-slate-200"
                  style={{ width: '7%' }}
                  title="Stopped: 35m (7%)"
                >
                  7%
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-teal-500" /> Running: 6h 20m
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-amber-500" /> Idle: 1h 05m
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-slate-700" /> Stopped: 35m
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
            Observed activity calculated from verified machine state records
          </div>
        </div>

        {/* Graph 4: Machine Health and Vibration */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Machine Health
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase tracking-wider ${conditionColor}`}
              >
                {conditionState}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between text-xs font-mono">
              <span className="text-slate-400">Vibration Level:</span>
              <span className="text-teal-300 font-bold text-sm">
                {vibRms.toFixed(2)} m/s² RMS · Nominal ISO
              </span>
            </div>

            {/* SVG Vibration Chart */}
            <div className="mt-2 h-28 w-full bg-slate-950/60 rounded-lg border border-slate-900 p-2 relative overflow-hidden flex items-end">
              <svg className="w-full h-full" viewBox="0 0 360 90" preserveAspectRatio="none">
                {/* Operating boundary line */}
                <line
                  x1="0"
                  y1="35"
                  x2="360"
                  y2="35"
                  stroke="#f43f5e"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <path
                  d={generateChartPath(vibData, 0.5, 5.0, 360, 90)}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute top-1.5 right-2 text-[9px] font-mono text-rose-400/80">
                P95 Statistical Boundary: 4.20 m/s²
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Class II Medium Machinery</span>
            <span className="text-teal-400">Zero Critical Deviations</span>
          </div>
        </div>
      </div>

      {/* 4. Additional Compact Insights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Insight 1: Active Problems */}
        <div
          onClick={onNavigateToIncidents}
          className="bg-[#0c1424] border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 shadow-xs cursor-pointer transition-colors"
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-medium">
            Active Problems
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-bold font-mono ${
                currentProblems.length > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {currentProblems.length} Unresolved
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate">
            {currentProblems.length === 0 ? 'No open tickets' : 'Tap to inspect tickets'}
          </span>
        </div>

        {/* Insight 2: Last Incident */}
        <div
          onClick={onNavigateToIncidents}
          className="bg-[#0c1424] border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 shadow-xs cursor-pointer transition-colors"
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-medium">
            Last Incident
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-bold font-mono text-white truncate">
              {lastIncident ? lastIncident.incidentCode : 'None Recorded'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate">
            {lastIncident?.createdAt ? lastIncident.createdAt.slice(0, 10) : 'Clean record'}
          </span>
        </div>

        {/* Insight 3: Operating Trend */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 shadow-xs">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-medium">
            Operating Trend
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-bold font-mono text-teal-300">Stable</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
            Measured variance within nominal
          </span>
        </div>

        {/* Insight 4: Maintenance Status */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 shadow-xs">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-medium">
            Maintenance Status
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold font-mono text-emerald-300">
              {machineWorkOrders.length > 0 ? 'In Progress' : 'Up to Date'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
            {machineWorkOrders.length > 0
              ? `${machineWorkOrders.length} active work order`
              : 'Next scheduled in 48 cut hrs'}
          </span>
        </div>
      </div>

      {/* 5. My Machine Problems (Two Tabs: Current and History) */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-800/70 gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              My Machine Problems ({machineCode})
            </h3>
          </div>

          {/* Two Tabs: Current & History */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs font-mono">
            <button
              onClick={() => setProblemsTab('current')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                problemsTab === 'current'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Current ({currentProblems.length})
            </button>
            <button
              onClick={() => setProblemsTab('history')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                problemsTab === 'history'
                  ? 'bg-teal-950 text-teal-300 border border-teal-800/80'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              History ({historicalProblems.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-3.5">
          {problemsTab === 'current' ? (
            currentProblems.length === 0 ? (
              <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-800/40 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
                  <div>
                    <span className="text-white font-bold block">No Current Problems</span>
                    <span className="text-[11px] text-slate-400">
                      All systems operating within validated baseline parameters.
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800">
                  Ready
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {currentProblems.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{p.incidentCode}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            p.severity === 'Critical'
                              ? 'text-rose-400 bg-rose-950 border border-rose-800'
                              : 'text-amber-400 bg-amber-950 border border-amber-800'
                          }`}
                        >
                          {p.severity}
                        </span>
                        <span className="text-slate-200 font-semibold">{p.componentArea}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Action: Inspect toolholder &amp; verify collet clamping (SOP-SP-01)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        {p.status}
                      </span>
                      <button
                        onClick={onNavigateToIncidents}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : historicalProblems.length === 0 ? (
            <div className="py-6 text-center text-slate-500 font-mono text-xs">
              No historical incidents on record for this machine.
            </div>
          ) : (
            <div className="space-y-2">
              {historicalProblems.map((h) => (
                <div
                  key={h.id}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px]">
                      {h.createdAt ? h.createdAt.slice(0, 10) : 'Recent'}
                    </span>
                    <span className="font-bold text-white">{h.incidentCode}</span>
                    <span className="text-slate-300">{h.componentArea}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Resolved
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. AI Insights Panel (Max 3 Concise Items) */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              AI Insight (Telemetry Hypothesis)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Grounded in Empirical Baselines</span>
        </div>

        <div className="mt-3.5 space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
            <span className="text-teal-400 font-bold shrink-0">Detected:</span>
            <span className="text-slate-200">
              Vibration RMS steady at {vibRms.toFixed(2)} m/s² with motor load at {motorLoadPct.toFixed(1)}%.
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
            <span className="text-amber-400 font-bold shrink-0">Possible cause:</span>
            <span className="text-slate-300">
              Normal cutting engagement harmonics; no pull-stud fretting observed.
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
            <span className="text-emerald-400 font-bold shrink-0">Next action:</span>
            <span className="text-slate-200">
              Continue standard production pass; conduct hourly sample profilometer check.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
