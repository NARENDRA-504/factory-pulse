import React, { useState } from 'react';
import { Machine, TelemetryReading, Incident } from '../types';
import { getMachineDisplayName } from '../data/seedData';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Gauge,
  Layers,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface OperatorLiveChartsOverviewProps {
  machine: Machine;
  telemetryHistory: TelemetryReading[];
  latestTelemetry: TelemetryReading;
  isStreaming: boolean;
  workingTimeSeconds: number;
  activeAnomaly: string | null;
  onRaiseAlert: () => void;
  incidents: Incident[];
}

export const OperatorLiveChartsOverview: React.FC<OperatorLiveChartsOverviewProps> = ({
  machine,
  telemetryHistory,
  latestTelemetry,
  isStreaming,
  workingTimeSeconds,
  activeAnomaly,
  onRaiseAlert,
  incidents,
}) => {
  const [selectedRange, setSelectedRange] = useState<'15m' | '1h' | '8h' | '24h'>('15m');

  const displayName = getMachineDisplayName(machine.code, machine.name);

  // Extract metrics from latest simulator / telemetry
  const rpm = latestTelemetry.spindleRpm ?? (machine.code.includes('LATHE') ? 1800 : 4500);
  const coolantTemp = latestTelemetry.coolantTempC ?? 24.5;
  const motorLoad = latestTelemetry.motorLoadPct ?? 58.0;
  const coolantLevel = latestTelemetry.coolantLevelPct ?? 94;
  const jobsProduced = latestTelemetry.jobsProduced ?? Math.min(180, Math.floor(130 + (workingTimeSeconds % 3600) / 120));
  const shiftTarget = 180;
  const targetPct = Math.min(100, Math.round((jobsProduced / shiftTarget) * 100));

  // Determine overall status colors and plain language labels
  const isLoadCritical = motorLoad > 90;
  const isLoadWarning = motorLoad > 78;
  const isTempCritical = coolantTemp > 45;
  const isTempWarning = coolantTemp > 35;
  const isRpmAbnormal = Math.abs(rpm - (machine.code.includes('LATHE') ? 1800 : 4500)) > 600;

  const isCritical =
    machine.status === 'Critical' ||
    isLoadCritical ||
    isTempCritical ||
    activeAnomaly === 'HIGH_CHATTER' ||
    activeAnomaly === 'THERMAL_OVERLOAD';

  const isWarning =
    machine.status === 'Warning' ||
    isLoadWarning ||
    isTempWarning ||
    isRpmAbnormal ||
    activeAnomaly === 'FEED_SPIKE';

  const overallStatusLabel = !isStreaming
    ? 'Paused'
    : isCritical
    ? 'Critical Alert'
    : isWarning
    ? 'Needs Attention'
    : 'Normal';

  const overallStatusBadgeClass = !isStreaming
    ? 'bg-slate-800 text-slate-300 border-slate-700'
    : isCritical
    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
    : isWarning
    ? 'bg-amber-950/80 text-amber-300 border-amber-800'
    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800';

  // Format live timer
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Filter unresolved machine complaints/incidents for this machine
  const activeMachineIncident = incidents.find(
    (i) => i.machineCode === machine.code && i.status !== 'Closed'
  );

  // SVG Chart Dimensions
  const chartW = 460;
  const chartH = 150;
  const padL = 45;
  const padR = 20;
  const padT = 15;
  const padB = 25;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  // Chart 1: Spindle Speed (RPM)
  const rpmData = telemetryHistory.map((d) => d.spindleRpm || 4500);
  const minRpm = Math.min(...rpmData, machine.code.includes('LATHE') ? 1200 : 3800);
  const maxRpm = Math.max(...rpmData, machine.code.includes('LATHE') ? 2200 : 5200);
  const rpmRange = Math.max(maxRpm - minRpm, 100);

  const rpmPoints = rpmData
    .map((val, idx) => {
      const x = padL + (idx / Math.max(rpmData.length - 1, 1)) * innerW;
      const y = padT + innerH - ((val - minRpm) / rpmRange) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Chart 2: Coolant Temperature (°C)
  const tempData = telemetryHistory.map((d) => d.coolantTempC || 24.5);
  const minTemp = 15;
  const maxTemp = 60;
  const tempRange = maxTemp - minTemp;

  const tempPoints = tempData
    .map((val, idx) => {
      const x = padL + (idx / Math.max(tempData.length - 1, 1)) * innerW;
      const y = padT + innerH - ((val - minTemp) / tempRange) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Chart 3: Motor Load (%)
  const loadData = telemetryHistory.map((d) => d.motorLoadPct || 55);
  const minLoad = 0;
  const maxLoad = 110;
  const loadRange = 110;

  const loadPoints = loadData
    .map((val, idx) => {
      const x = padL + (idx / Math.max(loadData.length - 1, 1)) * innerW;
      const y = padT + innerH - ((val - minLoad) / loadRange) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Chart 4: Jobs Produced during shift (Cumulative output count by hour)
  // Shift 8 hours: simulates progressive parts accumulation
  const shiftHours = ['Hr 1', 'Hr 2', 'Hr 3', 'Hr 4', 'Hr 5', 'Hr 6', 'Hr 7', 'Hr 8'];
  const hourlyJobTarget = [22, 45, 68, 90, 112, 135, 158, 180];
  const currentHourIdx = Math.min(Math.floor(workingTimeSeconds / 3600), 7);
  const hourlyActual: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (i < currentHourIdx) {
      hourlyActual.push(Math.round((i + 1) * (jobsProduced / (currentHourIdx + 0.8))));
    } else if (i === currentHourIdx) {
      hourlyActual.push(jobsProduced);
    } else {
      hourlyActual.push(0);
    }
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP METRIC CARDS ROW WITH LIVE TIMER */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Spindle Speed */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              Spindle Speed
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                isRpmAbnormal
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}
            >
              {isRpmAbnormal ? 'Attention' : 'Normal'}
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                {rpm.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold">RPM</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Target: {machine.code.includes('LATHE') ? '1,800' : '4,500'} RPM
            </p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isRpmAbnormal ? 'bg-amber-400' : 'bg-teal-400'
              }`}
              style={{
                width: `${Math.min(100, Math.max(10, (rpm / (machine.code.includes('LATHE') ? 2400 : 6000)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Card 2: Coolant Temperature */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              Coolant Temp
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                isTempCritical
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : isTempWarning
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}
            >
              {isTempCritical ? 'Critical' : isTempWarning ? 'High' : 'Normal'}
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  isTempCritical
                    ? 'text-rose-400'
                    : isTempWarning
                    ? 'text-amber-400'
                    : 'text-white'
                }`}
              >
                {coolantTemp.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold">°C</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Safe Operating: &lt; 35.0 °C
            </p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isTempCritical ? 'bg-rose-500' : isTempWarning ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(10, (coolantTemp / 60) * 100))}%` }}
            />
          </div>
        </div>

        {/* Card 3: Motor Load */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              Motor Load
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                isLoadCritical
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : isLoadWarning
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}
            >
              {isLoadCritical ? 'Overload' : isLoadWarning ? 'Attention' : 'Normal'}
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  isLoadCritical
                    ? 'text-rose-400'
                    : isLoadWarning
                    ? 'text-amber-400'
                    : 'text-white'
                }`}
              >
                {motorLoad.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold">%</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Limit: 85% · Power: {latestTelemetry.motorPowerKw ?? 11.2} kW
            </p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isLoadCritical ? 'bg-rose-500' : isLoadWarning ? 'bg-amber-400' : 'bg-teal-400'
              }`}
              style={{ width: `${Math.min(100, motorLoad)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Jobs Produced */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              Jobs Produced
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border bg-teal-950/80 text-teal-300 border-teal-800">
              Shift A
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                {jobsProduced}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold">/ {shiftTarget} pcs</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-0.5">
              <span>Progress: {targetPct}%</span>
              <span className="text-teal-400">Tank: {coolantLevel}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-teal-400 transition-all duration-500"
              style={{ width: `${targetPct}%` }}
            />
          </div>
        </div>

        {/* Card 5: Working Time (LIVE TIMER NOT GRAPH) */}
        <div className="col-span-2 lg:col-span-1 bg-[#0c1424] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              Working Time
            </span>
            <div className="flex items-center gap-1.5">
              {isStreaming ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                  <Pause className="w-2.5 h-2.5 text-amber-400" />
                  <span>Paused</span>
                </span>
              )}
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                {formatTimer(workingTimeSeconds)}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center justify-between">
              <span>{isStreaming ? 'Updating live every second' : 'Telemetry Paused'}</span>
              <span className="text-slate-400">Shift Run</span>
            </p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isStreaming ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
              style={{ width: `${Math.min(100, (workingTimeSeconds / 28800) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SIMPLE ALERT PANEL WITH QUICK RAISE ALERT ACTION */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`p-3.5 sm:p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isCritical
            ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
            : isWarning
            ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
            : 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isCritical
                ? 'bg-rose-900/50 text-rose-300'
                : isWarning
                ? 'bg-amber-900/50 text-amber-300'
                : 'bg-emerald-900/50 text-emerald-300'
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                {isCritical
                  ? 'CRITICAL CONDITION'
                  : isWarning
                  ? 'ATTENTION NOTICE'
                  : 'NORMAL CONDITION'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                · {displayName} ({machine.code})
              </span>
            </div>
            <p className="text-xs font-sans text-slate-200 mt-0.5">
              {activeAnomaly === 'HIGH_CHATTER'
                ? 'Elevated chatter resonance on spindle toolholder. Limit: Spindle vibration exceeds 4.5 m/s².'
                : activeAnomaly === 'THERMAL_OVERLOAD'
                ? 'Motor thermal overload on servo wayguides. Coolant temperature spiking over 50°C.'
                : activeAnomaly === 'FEED_SPIKE'
                ? 'Feed rate inrush spike detected. Check workpiece clamping and chip evacuation.'
                : activeMachineIncident
                ? `${activeMachineIncident.symptomDescription}`
                : 'All sensor readings are within verified operating limits. Spindle, thermal, and motor load nominal.'}
            </p>
          </div>
        </div>

        {/* Action Button: Raise an Alert */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRaiseAlert}
            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <AlertTriangle className="w-4 h-4 text-white" />
            <span>Raise an Alert</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DASHBOARD: FOUR LIVE SIMPLE CHARTS (2 x 2 GRID) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GRAPH 1: Spindle Speed */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white font-mono tracking-tight">
                Spindle Speed Over Time
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">
                {rpm.toLocaleString()} RPM
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isRpmAbnormal ? 'bg-amber-400' : 'bg-teal-400 animate-pulse'
                }`}
              />
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="my-2">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-44 sm:h-48 overflow-visible">
              {/* Grid Lines */}
              <line x1={padL} y1={padT} x2={chartW - padR} y2={padT} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={padL} y1={padT + innerH / 2} x2={chartW - padR} y2={padT + innerH / 2} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#334155" />

              {/* Y Axis Labels */}
              <text x={padL - 6} y={padT + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                {Math.round(maxRpm)}
              </text>
              <text x={padL - 6} y={padT + innerH / 2 + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                {Math.round((maxRpm + minRpm) / 2)}
              </text>
              <text x={padL - 6} y={padT + innerH} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                {Math.round(minRpm)}
              </text>

              {/* Threshold Guideline (Upper operating envelope) */}
              <line
                x1={padL}
                y1={padT + innerH * 0.15}
                x2={chartW - padR}
                y2={padT + innerH * 0.15}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <text x={chartW - padR} y={padT + innerH * 0.15 - 4} textAnchor="end" fill="#f59e0b" fontSize="9" fontFamily="monospace">
                Operating Limit
              </text>

              {/* Telemetry Line */}
              <polyline
                fill="none"
                stroke={isRpmAbnormal ? '#f59e0b' : '#2dd4bf'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rpmPoints}
              />

              {/* Latest Point Indicator */}
              {rpmData.length > 0 && (
                <circle
                  cx={padL + innerW}
                  cy={padT + innerH - ((rpmData[rpmData.length - 1] - minRpm) / rpmRange) * innerH}
                  r="4.5"
                  fill={isRpmAbnormal ? '#f59e0b' : '#2dd4bf'}
                  stroke="#0c1424"
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
            <span>Historical window: Last 20 live ticks</span>
            <span className="text-slate-300">
              Condition: <strong className="text-teal-300">RPM Stable</strong>
            </span>
          </div>
        </div>

        {/* GRAPH 2: Coolant Temperature */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white font-mono tracking-tight">
                Coolant Temperature Over Time
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono font-bold ${
                  isTempCritical ? 'text-rose-400' : isTempWarning ? 'text-amber-400' : 'text-white'
                }`}
              >
                {coolantTemp.toFixed(1)} °C
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isTempCritical
                    ? 'bg-rose-500 animate-pulse'
                    : isTempWarning
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="my-2">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-44 sm:h-48 overflow-visible">
              {/* Grid Lines */}
              <line x1={padL} y1={padT} x2={chartW - padR} y2={padT} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={padL} y1={padT + innerH / 2} x2={chartW - padR} y2={padT + innerH / 2} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#334155" />

              {/* Y Axis Labels */}
              <text x={padL - 6} y={padT + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                60°C
              </text>
              <text x={padL - 6} y={padT + innerH / 2 + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                37°C
              </text>
              <text x={padL - 6} y={padT + innerH} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                15°C
              </text>

              {/* Safe Threshold Guide */}
              <line
                x1={padL}
                y1={padT + innerH - ((35 - minTemp) / tempRange) * innerH}
                x2={chartW - padR}
                y2={padT + innerH - ((35 - minTemp) / tempRange) * innerH}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              <text
                x={chartW - padR}
                y={padT + innerH - ((35 - minTemp) / tempRange) * innerH - 3}
                textAnchor="end"
                fill="#10b981"
                fontSize="9"
                fontFamily="monospace"
              >
                Safe Limit (35°C)
              </text>

              {/* Temperature Line */}
              <polyline
                fill="none"
                stroke={isTempCritical ? '#f43f5e' : isTempWarning ? '#f59e0b' : '#10b981'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={tempPoints}
              />

              {/* Latest Point */}
              {tempData.length > 0 && (
                <circle
                  cx={padL + innerW}
                  cy={padT + innerH - ((tempData[tempData.length - 1] - minTemp) / tempRange) * innerH}
                  r="4.5"
                  fill={isTempCritical ? '#f43f5e' : isTempWarning ? '#f59e0b' : '#10b981'}
                  stroke="#0c1424"
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
            <span>Optimal range: 20°C - 30°C</span>
            <span className={isTempWarning ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
              {isTempCritical ? 'Critical Thermal Spike' : isTempWarning ? 'Elevated Heat' : 'Thermal Nominal'}
            </span>
          </div>
        </div>

        {/* GRAPH 3: Motor Load */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-mono tracking-tight">
                Motor Load (%)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono font-bold ${
                  isLoadCritical ? 'text-rose-400' : isLoadWarning ? 'text-amber-400' : 'text-white'
                }`}
              >
                {motorLoad.toFixed(1)} %
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isLoadCritical
                    ? 'bg-rose-500 animate-pulse'
                    : isLoadWarning
                    ? 'bg-amber-400'
                    : 'bg-teal-400'
                }`}
              />
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="my-2">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-44 sm:h-48 overflow-visible">
              {/* Grid Lines */}
              <line x1={padL} y1={padT} x2={chartW - padR} y2={padT} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={padL} y1={padT + innerH / 2} x2={chartW - padR} y2={padT + innerH / 2} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#334155" />

              {/* Y Axis Labels */}
              <text x={padL - 6} y={padT + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                100%
              </text>
              <text x={padL - 6} y={padT + innerH / 2 + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                50%
              </text>
              <text x={padL - 6} y={padT + innerH} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                0%
              </text>

              {/* Warning Threshold Line (85%) */}
              <line
                x1={padL}
                y1={padT + innerH - (85 / loadRange) * innerH}
                x2={chartW - padR}
                y2={padT + innerH - (85 / loadRange) * innerH}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <text
                x={chartW - padR}
                y={padT + innerH - (85 / loadRange) * innerH - 3}
                textAnchor="end"
                fill="#f59e0b"
                fontSize="9"
                fontFamily="monospace"
              >
                Warning Threshold (85%)
              </text>

              {/* Load Line */}
              <polyline
                fill="none"
                stroke={isLoadCritical ? '#f43f5e' : isLoadWarning ? '#f59e0b' : '#38bdf8'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={loadPoints}
              />

              {/* Latest Point */}
              {loadData.length > 0 && (
                <circle
                  cx={padL + innerW}
                  cy={padT + innerH - (loadData[loadData.length - 1] / loadRange) * innerH}
                  r="4.5"
                  fill={isLoadCritical ? '#f43f5e' : isLoadWarning ? '#f59e0b' : '#38bdf8'}
                  stroke="#0c1424"
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
            <span>Operating Envelope: 45% - 75%</span>
            <span className={isLoadWarning ? 'text-amber-400 font-semibold' : 'text-cyan-300'}>
              {isLoadCritical ? 'Overload Interlock' : isLoadWarning ? 'High Cut Load' : 'Load Balanced'}
            </span>
          </div>
        </div>

        {/* GRAPH 4: Jobs Produced During Shift */}
        <div className="bg-[#0c1424] border border-slate-800/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white font-mono tracking-tight">
                Jobs Produced During Shift
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-teal-300">
                {jobsProduced} / {shiftTarget} pcs
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-950 text-teal-300 border border-teal-800">
                {targetPct}% Target
              </span>
            </div>
          </div>

          {/* Hourly Progression Bars */}
          <div className="my-2">
            <div className="h-44 sm:h-48 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
              {shiftHours.map((hr, idx) => {
                const actual = hourlyActual[idx];
                const target = hourlyJobTarget[idx];
                const maxBar = 180;
                const actualH = Math.min(100, (actual / maxBar) * 100);
                const targetH = Math.min(100, (target / maxBar) * 100);
                const isCurrent = idx === currentHourIdx;

                return (
                  <div key={hr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    {/* Value Pill on Top */}
                    {actual > 0 && (
                      <span className="text-[10px] font-mono font-bold text-slate-300">
                        {actual}
                      </span>
                    )}

                    {/* Bar Container */}
                    <div className="w-full relative flex items-end justify-center h-32 bg-slate-900/60 rounded-lg overflow-hidden border border-slate-800/80">
                      {/* Target marker line */}
                      <div
                        className="absolute w-full border-t border-slate-700/80 border-dashed"
                        style={{ bottom: `${targetH}%` }}
                      />

                      {/* Actual Filled Bar */}
                      <div
                        className={`w-full transition-all duration-500 rounded-t ${
                          actual >= target
                            ? 'bg-teal-500'
                            : actual > 0
                            ? 'bg-teal-600/80'
                            : 'bg-slate-800'
                        } ${isCurrent ? 'ring-2 ring-teal-400 shadow-md shadow-teal-500/20' : ''}`}
                        style={{ height: `${actualH}%` }}
                      />
                    </div>

                    {/* X-axis hour label */}
                    <span
                      className={`text-[10px] font-mono ${
                        isCurrent ? 'text-teal-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {hr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
            <span>Shift Target: 180 pcs total (22.5 pcs/hr)</span>
            <span className="text-teal-300 font-semibold">
              Production Pace: {targetPct >= 70 ? 'On Target' : 'Pace Tracking'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
