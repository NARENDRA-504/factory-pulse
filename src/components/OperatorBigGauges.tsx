import React from 'react';
import { TelemetryReading, Machine } from '../types';
import { getMachineDisplayName } from '../data/seedData';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface OperatorBigGaugesProps {
  machine: Machine | undefined;
  telemetry: TelemetryReading | null;
  isStreaming: boolean;
  activeAnomaly: string | null;
  onRaiseAlert: () => void;
}

export const OperatorBigGauges: React.FC<OperatorBigGaugesProps> = ({
  machine,
  telemetry,
  isStreaming,
  activeAnomaly,
  onRaiseAlert,
}) => {
  const vib = telemetry?.vibRms ?? 1.85;
  const motorLoad = telemetry?.motorLoadPct ?? 60.0;
  const coolantTemp = telemetry?.coolantTempC ?? 24.5;
  const spindleRpm = telemetry?.spindleRpm ?? 4500;

  // Status computation for simple visual light
  const isCritical = machine?.status === 'Critical' || vib > 4.2 || motorLoad > 90;
  const isWarning = machine?.status === 'Warning' || vib > 3.2 || motorLoad > 80;
  const statusLabel = !isStreaming
    ? 'PAUSED'
    : isCritical
    ? 'CRITICAL ALERT'
    : isWarning
    ? 'WARNING'
    : 'NORMAL RUN';

  // Helper for circular dial calculation
  const renderGaugeArc = (
    value: number,
    min: number,
    max: number,
    unit: string,
    label: string,
    warnThresh: number,
    critThresh: number,
    colorScheme: 'teal' | 'amber' | 'cyan'
  ) => {
    const clamped = Math.min(Math.max(value, min), max);
    const pct = (clamped - min) / (max - min);
    // 240 degree arc from 150deg to 390deg (or -210 to 30)
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.72; // ~260 degrees
    const strokeDashoffset = arcLength * (1 - pct);

    const isHigh = value >= critThresh;
    const isMid = value >= warnThresh;

    const strokeColor = isHigh
      ? '#f43f5e'
      : isMid
      ? '#f59e0b'
      : colorScheme === 'teal'
      ? '#2dd4bf'
      : colorScheme === 'cyan'
      ? '#38bdf8'
      : '#10b981';

    return (
      <div className="bg-[#0c1424] border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-between shadow-md relative overflow-hidden">
        {/* Top Label */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800/70">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
            {label}
          </span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
              isHigh
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : isMid
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-teal-950/80 text-teal-300 border border-teal-800/60'
            }`}
          >
            {isHigh ? 'Danger' : isMid ? 'Caution' : 'Safe'}
          </span>
        </div>

        {/* SVG Dial */}
        <div className="relative w-40 h-36 flex items-center justify-center my-1">
          <svg className="w-40 h-40 -rotate-90 transform" viewBox="0 0 150 150">
            {/* Background Arc */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth="12"
              strokeDasharray={arcLength}
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            {/* Value Arc */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth="12"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* Central Big Number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span
              className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight"
              style={{ color: strokeColor }}
            >
              {typeof value === 'number'
                ? value % 1 === 0
                  ? value
                  : value.toFixed(1)
                : value}
            </span>
            <span className="text-xs font-mono text-slate-400 font-semibold">{unit}</span>
          </div>
        </div>

        {/* Bottom range indicator */}
        <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
          <span>Min: {min}</span>
          <span className="text-slate-300 font-medium">Limit: &lt; {warnThresh}</span>
          <span>Max: {max}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Visual Shop-Floor Light Tower Banner */}
      <div className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Machine Status Lights (Traffic Light for Operators) */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl shadow-inner">
            {/* Red Light */}
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isCritical
                  ? 'bg-rose-500 border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse'
                  : 'bg-rose-950/40 border-rose-900/40 opacity-30'
              }`}
              title="Stop / Danger"
            />
            {/* Yellow Light */}
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                !isCritical && isWarning
                  ? 'bg-amber-500 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.8)]'
                  : 'bg-amber-950/40 border-amber-900/40 opacity-30'
              }`}
              title="Caution / Warning"
            />
            {/* Green Light */}
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isStreaming && !isCritical && !isWarning
                  ? 'bg-teal-400 border-teal-200 shadow-[0_0_15px_rgba(45,212,191,0.8)] animate-pulse'
                  : 'bg-teal-950/40 border-teal-900/40 opacity-30'
              }`}
              title="Normal Running"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-xl font-bold font-mono tracking-wide text-white">
                {getMachineDisplayName(machine?.code || 'CNC-MILL-01', machine?.name)} ({machine?.code || 'CNC-MILL-01'})
              </span>
            </div>
            <p className="text-xs sm:text-sm font-mono text-slate-300 flex items-center gap-2 mt-0.5">
              <span>Operating State:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-xs ${
                  isCritical
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : isWarning
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-teal-950 text-teal-300 border border-teal-800'
                }`}
              >
                {statusLabel}
              </span>
            </p>
          </div>
        </div>

        {/* Quick Emergency / Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={onRaiseAlert}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold font-mono text-sm flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-white" />
            <span>REPORT ABNORMAL NOISE / ISSUE</span>
          </button>
        </div>
      </div>

      {/* Grid of 4 Big Visual Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gauge 1: Vibration */}
        {renderGaugeArc(
          vib,
          0,
          8,
          'm/s²',
          'Spindle Vibration',
          3.2,
          4.2,
          'teal'
        )}

        {/* Gauge 2: Motor Load */}
        {renderGaugeArc(
          motorLoad,
          0,
          100,
          '% Load',
          'Motor Load',
          80,
          90,
          'amber'
        )}

        {/* Gauge 3: Spindle Speed */}
        {renderGaugeArc(
          spindleRpm,
          0,
          8000,
          'RPM',
          'Spindle Speed',
          6500,
          7500,
          'cyan'
        )}

        {/* Gauge 4: Coolant Temperature */}
        {renderGaugeArc(
          coolantTemp,
          10,
          50,
          '°C',
          'Coolant Temp',
          28,
          32,
          'teal'
        )}
      </div>

      {/* Operator Immediate Action Guidance Card */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-950/70 border border-teal-800/60 text-teal-300">
            <CheckCircle2 className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white font-mono">
              Shop Floor Operator Rules
            </h4>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              Keep eye on green zone. If vibration needle turns amber (&gt;3.2 m/s²) or red, halt feed and report issue immediately.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-slate-400">Emergency Protocol:</span>
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-teal-300 font-mono text-xs font-bold">
            SOP-SP-01
          </span>
        </div>
      </div>
    </div>
  );
};
