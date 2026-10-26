import React from 'react';
import { MachineStatus } from '../types';

interface CncMachineGraphicProps {
  machineCode: string;
  machineName: string;
  status: MachineStatus;
  activeAnomaly?: string | null;
  spindleRpm: number;
  motorLoadPct: number;
  motorPowerKw: number;
  feedRateMmpm: number;
  vibRms: number;
  coolantTempC: number;
  reducedMotion?: boolean;
  onSelectHotspot?: (part: string) => void;
}

export const CncMachineGraphic: React.FC<CncMachineGraphicProps> = ({
  machineCode = 'CNC-MILL-01',
  machineName = 'Haas VF-2SS 5-Axis VMC',
  status = 'Nominal',
  activeAnomaly = null,
  spindleRpm = 4500,
  motorLoadPct = 62.4,
  motorPowerKw = 11.2,
  feedRateMmpm = 1200,
  vibRms = 1.85,
  coolantTempC = 24.5,
  reducedMotion = false,
  onSelectHotspot,
}) => {
  const isOperating = status !== 'Offline';
  const isCritical = status === 'Critical' || (activeAnomaly && activeAnomaly.includes('THERMAL'));
  const isWarning = status === 'Warning' || (activeAnomaly && (activeAnomaly.includes('CHATTER') || activeAnomaly.includes('FEED')));

  // Status color codes
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : isOperating ? '#10b981' : '#64748b';
  const statusGlow = isCritical ? 'rgba(239, 68, 68, 0.4)' : isWarning ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)';

  return (
    <div className="relative w-full rounded-xl bg-[#090e17] border border-slate-800/90 p-3 sm:p-3.5 overflow-hidden shadow-sm">
      {/* Background Subtle Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header Info Strip */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: statusColor,
              }}
            />
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-slate-100">
              {machineCode}
            </span>
          </div>
          <span className="text-slate-600 font-mono text-xs">/</span>
          <span className="text-xs text-slate-400 font-medium truncate max-w-[180px] sm:max-w-xs">
            {machineName}
          </span>
        </div>

        {/* Live Status Chip */}
        <div className="flex items-center gap-2">
          {activeAnomaly && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-500 text-amber-300 animate-pulse">
              ANOMALY: {activeAnomaly}
            </span>
          )}
          <span
            className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
            style={{
              color: statusColor,
              borderColor: `${statusColor}55`,
              backgroundColor: `${statusColor}18`,
            }}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Centerpiece Vector Schematic */}
      <div className="relative z-10 w-full flex items-center justify-center">
        <svg
          viewBox="0 0 760 380"
          className="w-full h-auto max-h-[210px] select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="gantryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
            <linearGradient id="spindleBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            <linearGradient id="toolSteelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="viseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="workpieceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#7e22ce" />
              <stop offset="100%" stopColor="#581c87" />
            </linearGradient>
            <linearGradient id="thermalHaze" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </linearGradient>

            {/* Glass door reflection */}
            <linearGradient id="glassReflection" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.03" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* 1. Main Machine Enclosure Base Frame */}
          <rect
            x="40"
            y="30"
            width="680"
            height="320"
            rx="16"
            fill="url(#gantryGrad)"
            stroke="#334155"
            strokeWidth="2"
          />

          {/* Top Status Light Bar */}
          <rect
            x="60"
            y="42"
            width="640"
            height="8"
            rx="4"
            fill={statusColor}
            opacity="0.85"
            style={{
              filter: `drop-shadow(0 0 8px ${statusColor})`,
            }}
          />

          {/* Enclosure Header Label & Serial */}
          <text x="70" y="74" fill="#94a3b8" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="600">
            DMG MORI 5-AXIS VERTICAL MACHINING CELL · DUAL-ENCLOSED CABIN
          </text>
          <text x="690" y="74" textAnchor="end" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace">
            ISO 230-2 COMPLIANT · {isOperating ? 'STREAMING' : 'IDLE'}
          </text>

          {/* 2. Internal Machine Machining Chamber */}
          <rect
            x="70"
            y="88"
            width="620"
            height="244"
            rx="10"
            fill="#060911"
            stroke="#1e293b"
            strokeWidth="1.5"
          />

          {/* Chamber Depth Shadow */}
          <rect x="72" y="90" width="616" height="20" fill="#000000" opacity="0.4" />

          {/* Rear Ball Screw & Guide Columns (Dual Z-Axis Wayguides) */}
          <rect x="230" y="98" width="16" height="210" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <line x1="238" y1="102" x2="238" y2="304" stroke="#475569" strokeWidth="2" strokeDasharray="6 3" />
          <rect x="514" y="98" width="16" height="210" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <line x1="522" y1="102" x2="522" y2="304" stroke="#475569" strokeWidth="2" strokeDasharray="6 3" />

          {/* Horizontal X/Y Bridge Axis */}
          <rect x="180" y="112" width="400" height="28" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="190" y1="126" x2="570" y2="126" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />

          {/* 3. Spindle Carriage & Motor Head */}
          <g
            className="cursor-pointer"
            onClick={() => onSelectHotspot && onSelectHotspot('Spindle Motor')}
          >
            {/* Thermal Haze when overloaded */}
            {activeAnomaly === 'THERMAL_OVERLOAD' && !reducedMotion && (
              <circle cx="380" cy="180" r="70" fill="url(#thermalHaze)">
                <animate attributeName="r" values="60;85;60" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Spindle Carriage Unit */}
            <rect
              x="330"
              y="118"
              width="100"
              height="64"
              rx="6"
              fill="url(#spindleBodyGrad)"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            {/* Motor Cooling Fins */}
            <line x1="344" y1="126" x2="344" y2="174" stroke="#0284c7" strokeWidth="2" />
            <line x1="356" y1="126" x2="356" y2="174" stroke="#0284c7" strokeWidth="2" />
            <line x1="368" y1="126" x2="368" y2="174" stroke="#0284c7" strokeWidth="2" />
            <line x1="380" y1="126" x2="380" y2="174" stroke="#0284c7" strokeWidth="2" />
            <line x1="392" y1="126" x2="392" y2="174" stroke="#0284c7" strokeWidth="2" />
            <line x1="404" y1="126" x2="404" y2="174" stroke="#0284c7" strokeWidth="2" />
            <line x1="416" y1="126" x2="416" y2="174" stroke="#0284c7" strokeWidth="2" />

            {/* Spindle Bearing Core */}
            <rect x="355" y="182" width="50" height="24" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <text x="380" y="198" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="bold">
              {spindleRpm} RPM
            </text>

            {/* Toolholder Taper (HSK-63A) */}
            <polygon points="364,206 396,206 390,224 370,224" fill="url(#toolSteelGrad)" stroke="#475569" strokeWidth="1" />

            {/* Clamping Collet Nut */}
            <rect x="370" y="224" width="20" height="10" rx="1.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />

            {/* Carbide Milling Cutter Shank & Flutes */}
            <rect x="377" y="234" width="6" height="34" fill="url(#toolSteelGrad)" stroke="#334155" strokeWidth="0.8" />
            {/* Flute spiral cuts */}
            <line x1="377" y1="242" x2="383" y2="246" stroke="#475569" strokeWidth="1.2" />
            <line x1="377" y1="250" x2="383" y2="254" stroke="#475569" strokeWidth="1.2" />
            <line x1="377" y1="258" x2="383" y2="262" stroke="#475569" strokeWidth="1.2" />

            {/* Rotating Cutter Tip Vibration & Spark Effects */}
            {isOperating && !reducedMotion && (
              <g>
                <circle cx="380" cy="268" r="4" fill="#38bdf8" opacity="0.6">
                  <animate attributeName="r" values="3;7;3" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="0.8s" repeatCount="indefinite" />
                </circle>
                {/* Chatter Vibration Waves when Anomaly Active */}
                {activeAnomaly === 'HIGH_CHATTER' && (
                  <>
                    <circle cx="380" cy="268" r="16" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3">
                      <animate attributeName="r" values="10;28;10" dur="0.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0;1" dur="0.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="380" cy="268" r="26" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2">
                      <animate attributeName="r" values="15;38;15" dur="0.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0;0.8" dur="0.6s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </g>
            )}
          </g>

          {/* Coolant Nozzle Dual Jets */}
          <g opacity={isOperating ? 1 : 0.4}>
            {/* Left Coolant Articulated Arm */}
            <path d="M 330 188 Q 345 204 358 226" fill="none" stroke="#64748b" strokeWidth="3" />
            <polygon points="356,224 362,228 358,232" fill="#0284c7" />
            {isOperating && !reducedMotion && (
              <line x1="360" y1="230" x2="376" y2="266" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.75">
                <animate attributeName="stroke-dashoffset" values="0;12" dur="0.5s" repeatCount="indefinite" />
              </line>
            )}

            {/* Right Coolant Articulated Arm */}
            <path d="M 430 188 Q 415 204 402 226" fill="none" stroke="#64748b" strokeWidth="3" />
            <polygon points="404,224 398,228 402,232" fill="#0284c7" />
            {isOperating && !reducedMotion && (
              <line x1="400" y1="230" x2="384" y2="266" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.75">
                <animate attributeName="stroke-dashoffset" values="0;12" dur="0.5s" repeatCount="indefinite" />
              </line>
            )}
          </g>

          {/* 4. Machine Work Table, Rotary Platter & Workpiece Vise */}
          {/* Machine Cast Iron Table Base */}
          <rect x="190" y="292" width="380" height="28" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          {/* T-Slots */}
          <line x1="205" y1="300" x2="555" y2="300" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="205" y1="308" x2="555" y2="308" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="205" y1="316" x2="555" y2="316" stroke="#0f172a" strokeWidth="2.5" />

          {/* Rotary 5-Axis Table (A/C Trunnion Cradle) */}
          <ellipse cx="380" cy="292" rx="95" ry="14" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <ellipse cx="380" cy="292" rx="75" ry="9" fill="#0f172a" stroke="#0284c7" strokeWidth="1" strokeDasharray="5 3" />

          {/* Precision Clamping Vise */}
          <rect x="330" y="274" width="100" height="18" rx="3" fill="url(#viseGrad)" stroke="#64748b" strokeWidth="1" />
          <rect x="324" y="270" width="12" height="22" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
          <rect x="424" y="270" width="12" height="22" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />

          {/* Active Workpiece (Aerospace Impeller Blisk) */}
          <rect
            x="346"
            y="266"
            width="68"
            height="10"
            rx="2"
            fill="url(#workpieceGrad)"
            stroke="#c084fc"
            strokeWidth="1.2"
          />

          {/* Feed Velocity Motion Arrows during Feed Spike */}
          {activeAnomaly === 'FEED_SPIKE' && !reducedMotion && (
            <g>
              <line x1="280" y1="282" x2="315" y2="282" stroke="#eab308" strokeWidth="2.5" markerEnd="url(#arrow)" />
              <polygon points="315,278 325,282 315,286" fill="#eab308">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" repeatCount="indefinite" />
              </polygon>
              <line x1="480" y1="282" x2="445" y2="282" stroke="#eab308" strokeWidth="2.5" />
              <polygon points="445,278 435,282 445,286" fill="#eab308">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" repeatCount="indefinite" />
              </polygon>
            </g>
          )}

          {/* 5. Tool Contact Point Spark Coordinates */}
          <circle cx="380" cy="266" r="2.5" fill="#f8fafc" />

          {/* 6. Enclosure Safety Window Panels with Industrial Glare */}
          <rect x="74" y="92" width="298" height="236" fill="url(#glassReflection)" pointerEvents="none" />
          <rect x="388" y="92" width="298" height="236" fill="url(#glassReflection)" pointerEvents="none" />
          <line x1="372" y1="88" x2="372" y2="332" stroke="#334155" strokeWidth="4" />

          {/* Coordinate Readout HUD Overlay on Lower Right */}
          <g>
            <rect x="520" y="248" width="160" height="74" rx="6" fill="#090e17" fillOpacity="0.88" stroke="#334155" strokeWidth="1" />
            <text x="530" y="266" fill="#38bdf8" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">
              AXIS TELEMETRY HUD
            </text>
            <text x="530" y="282" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, monospace">
              X: +142.50 mm · Y: -84.20
            </text>
            <text x="530" y="296" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, monospace">
              Z: -022.15 mm · FEED: {feedRateMmpm ?? 1200}
            </text>
            <text x="530" y="310" fill={(vibRms ?? 1.85) > 4.2 ? '#f59e0b' : '#10b981'} fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="bold">
              VIB RMS: {(vibRms ?? 1.85).toFixed(2)} m/s²
            </text>
          </g>

          {/* Coolant & Power Gauge Overlay on Lower Left */}
          <g>
            <rect x="80" y="248" width="150" height="74" rx="6" fill="#090e17" fillOpacity="0.88" stroke="#334155" strokeWidth="1" />
            <text x="90" y="266" fill="#38bdf8" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="bold">
              VFD DRIVE TELEMETRY
            </text>
            <text x="90" y="282" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace">
              POWER: {(motorPowerKw ?? 11.2).toFixed(1)} kW
            </text>
            <text x="90" y="296" fill={(motorLoadPct ?? 62.4) > 90 ? '#ef4444' : '#f59e0b'} fontSize="9" fontFamily="ui-monospace, monospace">
              LOAD: {(motorLoadPct ?? 62.4).toFixed(1)}%
            </text>
            <text x="90" y="310" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, monospace">
              COOLANT: {(coolantTempC ?? 24.5).toFixed(1)}°C
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
