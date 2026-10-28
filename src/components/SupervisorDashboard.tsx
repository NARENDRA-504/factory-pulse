import React, { useState } from 'react';
import { UserProfile, Machine, Incident, MaintenanceWorkOrder } from '../types';
import { apiClient } from '../services/apiClient';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Wrench,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  BarChart2,
  TrendingUp,
  UserCheck,
  Building2,
  Eye,
  X,
  Flame,
  Zap,
  Gauge,
  Activity,
  FileText,
  Send,
  AlertCircle,
  Radio,
} from 'lucide-react';

interface SupervisorDashboardProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory' | 'maintenance') => void;
  onSelectMachine: (code: string) => void;
  onRefreshData?: () => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
  onSelectMachine,
  onRefreshData,
}) => {
  // Fleet filter state
  const [plantFilter, setPlantFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick Assign Modal state
  const [assigningIncident, setAssigningIncident] = useState<Incident | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('Frank Kowalski');
  const [selectedPriority, setSelectedPriority] = useState<string>('High');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // Shift handover note state
  const [handoverNote, setHandoverNote] = useState<string>('');
  const [handoverSaved, setHandoverSaved] = useState<boolean>(false);
  const [shiftNotes, setShiftNotes] = useState<string[]>([
    'Shift A safety briefing complete at 06:00 UTC. 16 operators on station.',
    'Plant C Chiller 03 filter serviced by Frank Kowalski at 07:15 UTC.',
    'CNC-5AX-001 (MCH-001) scheduled for calibration during 14:00 shift changeover.',
  ]);

  // Compute fleet counts dynamically
  const totalFleet = machines.length || 40;
  const nominalCount = machines.filter((m) => m.status === 'Nominal').length;
  const warningCount = machines.filter((m) => m.status === 'Warning').length;
  const criticalCount = machines.filter((m) => m.status === 'Critical').length;
  const offlineCount = machines.filter((m) => m.status === 'Offline').length;

  // Open & Unassigned Incidents
  const openIncidents = incidents.filter((i) => i.status !== 'Closed');
  const unassignedIncidents = openIncidents.filter((i) => !i.assignedToName && i.status === 'Open');
  const criticalIncidents = openIncidents.filter((i) => i.severity === 'Critical' || i.severity === 'High');

  // Filtered machines list
  const filteredMachines = machines.filter((m) => {
    if (plantFilter !== 'ALL' && m.plant !== plantFilter) return false;
    if (typeFilter !== 'ALL' && m.machineType !== typeFilter) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        (m.machineCode && m.machineCode.toLowerCase().includes(q)) ||
        (m.machineId && m.machineId.toLowerCase().includes(q)) ||
        (m.code && m.code.toLowerCase().includes(q)) ||
        (m.plant && m.plant.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Plant distribution data
  const plantNames = [
    { id: 'Plant A: Precision Machining', shortName: 'Plant A', focus: 'Precision Mill & 5-Axis', line: 'Lines 1–4', expectedKw: 580, tempAvg: 23.8 },
    { id: 'Plant B: Powertrain Components', shortName: 'Plant B', focus: 'Turning & Mill-Turn', line: 'Lines 5–8', expectedKw: 640, tempAvg: 26.2 },
    { id: 'Plant C: Heavy Machining', shortName: 'Plant C', focus: 'Horizontal & Boring', line: 'Lines 9–12', expectedKw: 760, tempAvg: 37.4 },
    { id: 'Plant D: Finishing and Grinding', shortName: 'Plant D', focus: 'Grinding & Drilling', line: 'Lines 13–16', expectedKw: 430, tempAvg: 24.1 },
  ];

  const plantStats = plantNames.map((p) => {
    const plantMachines = machines.filter((m) => m.plant === p.id || m.plant === p.shortName);
    const total = plantMachines.length || 10;
    const nominal = plantMachines.filter((m) => m.status === 'Nominal').length;
    const warning = plantMachines.filter((m) => m.status === 'Warning').length;
    const critical = plantMachines.filter((m) => m.status === 'Critical').length;
    const openIncs = incidents.filter(
      (inc) =>
        inc.status !== 'Closed' &&
        plantMachines.some((m) => m.code === inc.machineCode || m.machineCode === inc.machineCode)
    ).length;
    const availPct = total > 0 ? ((nominal / total) * 100).toFixed(1) : '95.0';
    return {
      ...p,
      total,
      nominal,
      warning,
      critical,
      openIncs,
      availPct,
    };
  });

  // Machine Category Availability Comparison
  const categories = [
    'CNC Vertical Machining Center',
    'CNC Horizontal Machining Center',
    'CNC Turning Center',
    '5-Axis CNC Machining Center',
    'CNC Grinding Machine',
    'CNC Drilling and Tapping Center',
    'CNC Mill-Turn Center',
  ];

  const categoryStats = categories.map((cat) => {
    const catMachines = machines.filter((m) => m.machineType === cat);
    const total = catMachines.length || 1;
    const active = catMachines.filter((m) => m.status === 'Nominal').length;
    const pct = Math.round((active / total) * 100);
    return { name: cat, total, active, pct };
  });

  // Handle Quick Assign
  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningIncident) return;
    setIsAssigning(true);
    try {
      await apiClient.assignIncident(assigningIncident.id, selectedAssignee, currentUser.role);
      setAssignSuccessMsg(`Ticket ${assigningIncident.incidentCode} successfully assigned to ${selectedAssignee}.`);
      setAssigningIncident(null);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setAssignSuccessMsg(null), 5000);
    } catch (err: any) {
      setAssignSuccessMsg(`Assignment failed: ${err.message}`);
      setTimeout(() => setAssignSuccessMsg(null), 6000);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddHandoverNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverNote.trim()) return;
    setShiftNotes((prev) => [
      `${currentUser.fullName || 'Supervisor Elena'}: ${handoverNote.trim()}`,
      ...prev,
    ]);
    setHandoverNote('');
    setHandoverSaved(true);
    setTimeout(() => setHandoverSaved(false), 3000);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* 1. Header with Role Purpose & Shift Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0c1424] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-300 uppercase tracking-wider mb-1.5 font-mono">
            <Users className="w-4 h-4 text-teal-400" />
            <span>Supervisor Command Console · Shift A (06:00 – 14:00 UTC)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
            Shift Operations &amp; Plant Fleet Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Active roster: <span className="font-semibold text-teal-300">{machines.length} operational units</span> across 4 manufacturing plants (400-machine catalog). Coordinate shop floor triage, assign technicians, monitor thermal loads, and maintain line readiness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('incidents')}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-teal-950/40"
          >
            <AlertTriangle className="w-4 h-4 text-slate-950" />
            <span>Triage Incidents ({openIncidents.length})</span>
          </button>
          <button
            onClick={() => onNavigate('maintenance')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Maintenance Queue ({workOrders.filter(w => w.status !== 'Completed').length})</span>
          </button>
          <button
            onClick={() => onNavigate('machines')}
            className="px-4 py-2.5 rounded-xl bg-[#070d18] hover:bg-slate-900 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-800"
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Inspect Machines</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {assignSuccessMsg && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 flex items-center justify-between font-medium shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{assignSuccessMsg}</span>
          </div>
          <button onClick={() => setAssignSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Key Operational Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Fleet Health */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block font-mono">
              Fleet Health ({totalFleet} Units)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
              {nominalCount}
            </span>
            <span className="text-xs text-emerald-400 font-semibold font-mono">
              ({((nominalCount / (totalFleet || 1)) * 100).toFixed(1)}% Nominal)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-2 font-mono">
            <span className="text-amber-400 font-medium">{warningCount} Warning</span>
            <span>·</span>
            <span className="text-rose-400 font-medium">{criticalCount} Critical</span>
            {offlineCount > 0 && <span>· <span className="text-slate-500">{offlineCount} Offline</span></span>}
          </p>
        </div>

        {/* Metric 2: Open Incidents Needing Action */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block font-mono">
              Active Shift Incidents
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/70 border border-amber-800/80 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${openIncidents.length > 0 ? 'text-amber-400' : 'text-white'}`}>
              {openIncidents.length}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({unassignedIncidents.length} Unassigned)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5">
            {criticalIncidents.length > 0 ? (
              <span className="text-rose-400 font-semibold font-mono">
                {criticalIncidents.length} High/Critical priority
              </span>
            ) : (
              <span className="text-emerald-400 font-mono">All tickets in triage</span>
            )}
          </p>
        </div>

        {/* Metric 3: Fleet Coolant Temperature */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block font-mono">
              Fleet Avg Chiller Temp
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-950/70 border border-sky-800/80 flex items-center justify-center text-sky-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums font-mono">
              27.9°C
            </span>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-mono">
              Within Limits
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5 font-mono">
            Safe Limit: &lt; 35.0°C · Plant C elevated (37.4°C)
          </p>
        </div>

        {/* Metric 4: Fleet Motor Load & Active Power */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block font-mono">
              Fleet Cutting Load
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-950/70 border border-purple-800/80 flex items-center justify-center text-purple-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-300 tabular-nums font-mono">
              56.4%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (2,410 kW Draw)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5 font-mono">
            Operating Envelope: &lt; 85% · 16 Operators On Station
          </p>
        </div>
      </div>

      {/* 2.5 Plant-by-Plant Operational Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plantStats.map((p) => {
          const isElevated = p.tempAvg >= 35.0;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4.5 transition-all bg-[#0c1424] ${
                isElevated ? 'border-amber-700/80' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-white">{p.shortName}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  p.critical > 0 ? 'bg-rose-950/80 text-rose-300 border border-rose-800' :
                  isElevated ? 'bg-amber-950/80 text-amber-300 border border-amber-800' :
                  'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                }`}>
                  {p.availPct}% Avail
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">{p.focus}</p>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono text-[11px] bg-[#070d18] rounded-xl p-2 border border-slate-800/80">
                <div>
                  <div className="text-emerald-400 font-bold">{p.nominal}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Nominal</div>
                </div>
                <div>
                  <div className="text-amber-400 font-bold">{p.warning}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Warn</div>
                </div>
                <div>
                  <div className="text-rose-400 font-bold">{p.critical}</div>
                  <div className="text-[9px] text-slate-500 uppercase">Crit</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-sky-400" />
                  <span className={isElevated ? 'text-amber-400 font-bold' : 'text-slate-300'}>{p.tempAvg}°C</span>
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span>{p.expectedKw} kW</span>
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{p.openIncs}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Live Visualizations: Fleet Temperature & Spindle Load Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Coolant Temperature Across 4 Plants */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Flame className="w-4 h-4 text-sky-400" />
                  <span>Plant Coolant Temperature vs. 35°C Threshold</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chiller fluid temperature readings (°C) across the four manufacturing plants.
                </p>
              </div>
              <span className="text-xs font-semibold font-mono text-sky-300 bg-sky-950/70 border border-sky-800 px-2.5 py-0.5 rounded-full">
                Safe Limit: 35.0°C
              </span>
            </div>

            {/* SVG Temperature Comparison Chart */}
            <div className="mt-4">
              <div className="h-44 w-full relative">
                <svg viewBox="0 0 380 120" className="w-full h-full overflow-visible">
                  {/* Critical guideline (45°C) */}
                  <line x1="20" y1="20" x2="360" y2="20" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                  {/* Warning guideline (35°C) */}
                  <line x1="20" y1="50" x2="360" y2="50" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                  {/* Base line (15°C) */}
                  <line x1="20" y1="100" x2="360" y2="100" stroke="#334155" strokeWidth="1.5" />

                  <text x="15" y="23" fill="#f43f5e" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="monospace">45°C Trip</text>
                  <text x="15" y="53" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="monospace">35°C Limit</text>
                  <text x="15" y="103" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">15°C</text>

                  {[
                    { plant: 'Plant A', temp: 23.8, status: 'nominal' },
                    { plant: 'Plant B', temp: 26.2, status: 'nominal' },
                    { plant: 'Plant C', temp: 37.4, status: 'warning' },
                    { plant: 'Plant D', temp: 24.1, status: 'nominal' },
                  ].map((item, idx) => {
                    const x = 55 + idx * 80;
                    const barHeight = Math.min(((item.temp - 15) / 35) * 85, 95);
                    const barColor = item.temp >= 45 ? '#f43f5e' : item.temp >= 35 ? '#f59e0b' : '#0ea5e9';
                    return (
                      <g key={item.plant}>
                        <rect
                          x={x - 18}
                          y={100 - barHeight}
                          width="36"
                          height={barHeight}
                          fill={barColor}
                          opacity="0.85"
                          rx="4"
                        />
                        <text x={x} y={92 - barHeight} fill={barColor} fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                          {item.temp.toFixed(1)}°C
                        </text>
                        <text x={x} y="114" fill="#94a3b8" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {item.plant}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-5 mt-3 text-xs font-medium font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-sky-500" />
                  <span>&lt; 30°C: Nominal Chilling</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                  <span>35°C: Warning Threshold</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                  <span>&gt; 45°C: Critical Overheat</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#070d18] border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
            <span className="font-bold text-teal-300">Operational Notice:</span> Plant C average coolant temp is elevated at 37.4°C exceeding the 35°C threshold due to heavy boring cycles, requiring chiller filter backwash.
          </div>
        </div>

        {/* Chart 2: Fleet Motor Load & Active Power by Plant */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Spindle Motor Load (%) &amp; Active Power Draw (kW)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drive inverter cutting load comparison benchmarked against 85% operating envelope.
                </p>
              </div>
              <span className="text-xs font-semibold font-mono text-purple-300 bg-purple-950/70 border border-purple-800 px-2.5 py-0.5 rounded-full">
                Limit: 85% Load
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { plant: 'Plant A (Precision)', loadPct: 52.4, powerKw: 580, rpmAvg: 4500 },
                { plant: 'Plant B (Powertrain)', loadPct: 58.1, powerKw: 640, rpmAvg: 1800 },
                { plant: 'Plant C (Heavy)', loadPct: 69.5, powerKw: 760, rpmAvg: 3200 },
                { plant: 'Plant D (Grinding)', loadPct: 45.6, powerKw: 430, rpmAvg: 5800 },
              ].map((p) => (
                <div key={p.plant} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-200 font-semibold">{p.plant}</span>
                    <span className="text-slate-100 font-bold">
                      {p.loadPct}% Load · {p.powerKw} kW ({p.rpmAvg} RPM)
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                      style={{ left: '85%' }}
                      title="85% Safe Operating Limit"
                    />
                    <div
                      style={{ width: `${p.loadPct}%` }}
                      className={`h-full rounded-full transition-all ${
                        p.loadPct > 85 ? 'bg-rose-500' : p.loadPct > 75 ? 'bg-amber-500' : 'bg-purple-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Power inrush within safe margins</span>
                    <span>Envelope: &lt; 85%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#070d18] border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
            <span className="font-bold text-teal-300">Operational Notice:</span> All four plants are operating safely below the 85% inverter threshold, with Plant C operating at the highest cut load (69.5%, 760 kW) for heavy casting roughing passes.
          </div>
        </div>
      </div>

      {/* 4. Incidents Needing Immediate Attention (Supervisor Queue) */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 font-display">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Incidents Requiring Supervisor Action &amp; Dispatch</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review open shop-floor issues, assign qualified maintenance personnel, or dispatch urgent work orders.
            </p>
          </div>
          <button
            onClick={() => onNavigate('incidents')}
            className="text-xs text-teal-300 hover:text-teal-200 font-semibold flex items-center gap-1 font-mono"
          >
            <span>Open Incident Management</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {openIncidents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No active incidents requiring triage in this selection.</span>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#070d18] border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono font-semibold">
                <tr>
                  <th className="py-3 px-3.5">Ticket</th>
                  <th className="py-3 px-3.5">Machine</th>
                  <th className="py-3 px-3.5">Severity</th>
                  <th className="py-3 px-3.5">Symptom</th>
                  <th className="py-3 px-3.5">Reporter</th>
                  <th className="py-3 px-3.5">Assignee</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {openIncidents.slice(0, 6).map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3.5 font-bold font-mono text-teal-300">{inc.incidentCode}</td>
                    <td className="py-3 px-3.5 text-white font-mono font-semibold">{inc.machineCode}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          inc.severity === 'Critical'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : inc.severity === 'High'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-300 truncate max-w-xs">
                      {inc.symptomDescription}
                    </td>
                    <td className="py-3 px-3.5 text-slate-400">
                      {inc.reporterName} ({inc.reporterRole})
                    </td>
                    <td className="py-3 px-3.5">
                      {inc.assignedToName ? (
                        <span className="text-teal-300 font-medium font-mono">{inc.assignedToName}</span>
                      ) : (
                        <span className="text-rose-400 font-medium font-mono">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setAssigningIncident(inc)}
                          className="px-2.5 py-1 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-300 text-[11px] font-mono font-semibold transition-colors border border-teal-800"
                        >
                          {inc.assignedToName ? 'Reassign' : 'Assign'}
                        </button>
                        <button
                          onClick={() => {
                            onSelectMachine(inc.machineCode);
                            onNavigate('machines');
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
                          title="Inspect Telemetry"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Interactive Fleet Browser with 4-Tier Filters */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 font-display">
              <Layers className="w-4 h-4 text-teal-400" />
              <span>Fleet Inventory &amp; Live Machine Status ({machines.length} Machines)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Filter by plant, machine category, or current operational status. Showing {filteredMachines.length} matching units.
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by code, model, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#070d18] border border-slate-700 text-xs rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 w-full sm:w-64 shadow-inner"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 font-mono">Filter by Plant</label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none"
            >
              <option value="ALL">All Plants ({machines.length} Machines)</option>
              <option value="Plant A: Precision Machining">Plant A: Precision Machining ({machines.filter(m => m.plant === 'Plant A: Precision Machining' || m.plant === 'Plant A').length})</option>
              <option value="Plant B: Powertrain Components">Plant B: Powertrain Components ({machines.filter(m => m.plant === 'Plant B: Powertrain Components' || m.plant === 'Plant B').length})</option>
              <option value="Plant C: Heavy Machining">Plant C: Heavy Machining ({machines.filter(m => m.plant === 'Plant C: Heavy Machining' || m.plant === 'Plant C').length})</option>
              <option value="Plant D: Finishing and Grinding">Plant D: Finishing and Grinding ({machines.filter(m => m.plant === 'Plant D: Finishing and Grinding' || m.plant === 'Plant D').length})</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 font-mono">Filter by Machine Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none"
            >
              <option value="ALL">All Categories (7 Types)</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 font-mono">Filter by Operational Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-700 text-xs text-slate-200 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Nominal">Nominal / Running</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
        </div>

        {/* Machine Table with Dual Identification */}
        <div className="mt-4 overflow-x-auto max-h-96 border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#070d18] border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono font-semibold">
              <tr>
                <th className="py-3 px-3.5">Machine Identification</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Plant &amp; Line</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Spindle RPM</th>
                <th className="py-3 px-3.5">Vibration</th>
                <th className="py-3 px-3.5">Load</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredMachines.slice(0, 40).map((m) => (
                <tr key={m.machineId || m.code} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3 px-3.5">
                    <div className="font-semibold text-white">{m.displayName || m.name}</div>
                    <div className="text-[11px] font-mono text-teal-300">{m.machineId || m.code} · {m.machineCode || m.code}</div>
                  </td>
                  <td className="py-3 px-3.5 text-slate-300 truncate max-w-[160px]">
                    {m.machineType}
                  </td>
                  <td className="py-3 px-3.5 text-slate-400">
                    <div>{m.plant?.split(':')[0] || 'Plant A'}</div>
                    <div className="text-[10px] font-mono text-slate-500">{m.productionLine || 'Line 1'}</div>
                  </td>
                  <td className="py-3 px-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        m.status === 'Critical'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : m.status === 'Warning'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          m.status === 'Critical' ? 'bg-rose-400 animate-pulse' : m.status === 'Warning' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                      />
                      <span>{m.status || 'Nominal'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-slate-200 tabular-nums font-mono font-medium">
                    {m.spindleRpm || 4500} RPM
                  </td>
                  <td className="py-3 px-3.5 text-slate-200 tabular-nums font-mono font-medium">
                    {(m.vibrationMmS || 1.85).toFixed(2)} mm/s
                  </td>
                  <td className="py-3 px-3.5 text-slate-200 tabular-nums font-mono font-medium">
                    {(m.motorLoadPercent || 58).toFixed(1)}%
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <button
                      onClick={() => {
                        onSelectMachine(m.code);
                        onNavigate('machines');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors border border-slate-700"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Shift Handover & Safety Notes Section */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
              <FileText className="w-4 h-4 text-teal-400" />
              <span>Shift Handover Log &amp; Safety Continuity</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live communications bridge between Shift A (Day) and incoming Shift B (Swing) supervisors.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2.5 py-0.5 rounded">
            Pre-Shift Safety Briefing Verified
          </span>
        </div>

        <form onSubmit={handleAddHandoverNote} className="mt-4 flex gap-2">
          <input
            type="text"
            value={handoverNote}
            onChange={(e) => setHandoverNote(e.target.value)}
            placeholder="Record handover instruction or machine observation for incoming supervisor..."
            className="flex-1 bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post Note</span>
          </button>
        </form>
        {handoverSaved && (
          <p className="mt-2 text-xs text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Note appended to shift journal.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {shiftNotes.map((note, idx) => (
            <div key={idx} className="p-2.5 rounded-lg bg-[#070d18] border border-slate-800/80 text-xs text-slate-300 font-mono flex items-start gap-2">
              <span className="text-teal-400 font-bold shrink-0">#{idx + 1}</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* QUICK ASSIGN MODAL */}
      {/* ------------------------------------------------------------- */}
      {assigningIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0c1424] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2 font-display">
                <Wrench className="w-4 h-4 text-teal-400" />
                <span>Assign Ticket {assigningIncident.incidentCode}</span>
              </h3>
              <button
                onClick={() => setAssigningIncident(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-mono block mb-1">Target Machine:</span>
                <div className="p-2.5 bg-[#070d18] border border-slate-800 rounded-lg text-teal-300 font-mono font-semibold">
                  {assigningIncident.machineCode} · {assigningIncident.componentArea}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-mono block mb-1">Reported Symptom:</span>
                <div className="p-2.5 bg-[#070d18] border border-slate-800 rounded-lg text-slate-300">
                  {assigningIncident.symptomDescription}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-mono mb-1 font-semibold">
                  Select Maintenance Technician:
                </label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full bg-[#070d18] border border-slate-700 text-white rounded-lg p-2.5 font-mono focus:border-teal-500 focus:outline-none"
                >
                  <option value="Frank Kowalski">Frank Kowalski (Lead Vibration Specialist · MNT-401)</option>
                  <option value="Elena Rostova">Elena Rostova (Mechanical Systems Supervisor)</option>
                  <option value="Marcus Vance">Marcus Vance (Electrical / VFD Drives Specialist)</option>
                  <option value="David Miller">David Miller (General CNC Tooling Maintenance)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssigningIncident(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold font-mono disabled:opacity-50"
                >
                  {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
