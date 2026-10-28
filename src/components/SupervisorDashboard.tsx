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
} from 'lucide-react';

interface SupervisorDashboardProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
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
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // Compute fleet counts
  const totalFleet = machines.length;
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
    { id: 'Plant A: Precision Machining', shortName: 'Plant A', focus: 'Precision Mill & 5-Axis' },
    { id: 'Plant B: Powertrain Components', shortName: 'Plant B', focus: 'Turning & Mill-Turn' },
    { id: 'Plant C: Heavy Machining', shortName: 'Plant C', focus: 'Horizontal & Boring' },
    { id: 'Plant D: Finishing and Grinding', shortName: 'Plant D', focus: 'Grinding & Drilling' },
  ];

  const plantStats = plantNames.map((p) => {
    const plantMachines = machines.filter((m) => m.plant === p.id || m.plant === p.shortName);
    const total = plantMachines.length || 100;
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

  return (
    <div className="space-y-6">
      {/* 1. Header with Role Purpose */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Supervisor Dashboard · Shift A Operations</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Team &amp; 400-Machine Fleet Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Monitor floor staffing, oversee machine conditions across all 4 plants, triage operational incidents, and assign maintenance work orders to on-duty technicians.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('incidents')}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Triage Incidents ({openIncidents.length})</span>
          </button>
          <button
            onClick={() => onNavigate('machines')}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200"
          >
            <Cpu className="w-3.5 h-3.5 text-slate-600" />
            <span>Inspect All Machines</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {assignSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between font-medium shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{assignSuccessMsg}</span>
          </div>
          <button onClick={() => setAssignSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Key Operational Metrics Strip with Clear Units and Status Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Fleet Status */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Fleet Health (400 Units)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {nominalCount}
            </span>
            <span className="text-xs text-emerald-700 font-semibold">
              ({((nominalCount / (totalFleet || 1)) * 100).toFixed(1)}% Nominal)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
            <span className="text-amber-700 font-medium">{warningCount} Warning</span>
            <span>·</span>
            <span className="text-rose-700 font-medium">{criticalCount} Critical</span>
          </p>
        </div>

        {/* Metric 2: Open Incidents Needing Action */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Active Incidents
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${openIncidents.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {openIncidents.length}
            </span>
            <span className="text-xs text-slate-500">
              ({unassignedIncidents.length} Unassigned)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {criticalIncidents.length > 0 ? (
              <span className="text-rose-700 font-semibold">
                {criticalIncidents.length} High/Critical priority
              </span>
            ) : (
              'All incidents under control'
            )}
          </p>
        </div>

        {/* Metric 3: Fleet Coolant Temperature */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Fleet Avg Coolant Temp
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              27.9°C
            </span>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Optimal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Safe Limit: &lt; 35.0°C · 3 units elevated in Bay C
          </p>
        </div>

        {/* Metric 4: Fleet Motor Load & Active Power */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Fleet Motor Cut Load
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-700 tabular-nums">
              56.4%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              (2,410 kW Draw)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Drive Limit: &lt; 85% · 16 staff on shift coverage
          </p>
        </div>
      </div>

      {/* 2.5 Live Visualizations: Fleet Temperature & Spindle Load Distribution Across Plants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Coolant Temperature Across 4 Plants */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-sky-600" />
                  <span>Plant Coolant Temperature vs. 35°C Threshold</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chiller fluid temperature readings (°C) across the four manufacturing plants.
                </p>
              </div>
              <span className="text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
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
                  <line x1="20" y1="100" x2="360" y2="100" stroke="#cbd5e1" strokeWidth="1.5" />

                  <text x="15" y="23" fill="#e11d48" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">45°C Trip</text>
                  <text x="15" y="53" fill="#d97706" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">35°C Limit</text>
                  <text x="15" y="103" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="sans-serif">15°C</text>

                  {[
                    { plant: 'Plant A', temp: 23.8, status: 'nominal' },
                    { plant: 'Plant B', temp: 26.2, status: 'nominal' },
                    { plant: 'Plant C', temp: 37.4, status: 'warning' },
                    { plant: 'Plant D', temp: 24.1, status: 'nominal' },
                  ].map((item, idx) => {
                    const x = 55 + idx * 80;
                    const barHeight = Math.min(((item.temp - 15) / 35) * 85, 95);
                    const barColor = item.temp >= 45 ? '#e11d48' : item.temp >= 35 ? '#f59e0b' : '#0284c7';
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
                        <text x={x} y={92 - barHeight} fill={barColor} fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                          {item.temp.toFixed(1)}°C
                        </text>
                        <text x={x} y="114" fill="#475569" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {item.plant}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-5 mt-3 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-sky-600" />
                  <span>&lt; 30°C: Nominal Chilling</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                  <span>35°C: Warning Threshold</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-600" />
                  <span>&gt; 45°C: Critical Overheat</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">What this shows:</span> Plant C average coolant temp is elevated at 37.4°C exceeding the 35°C threshold due to heavy boring cycles, requiring chiller filter backwash.
          </div>
        </div>

        {/* Chart 2: Fleet Motor Load & Active Power by Plant */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Spindle Motor Load (%) &amp; Active Power Draw (kW)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drive inverter cutting load comparison benchmarked against 85% operating envelope.
                </p>
              </div>
              <span className="text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-800 font-semibold">{p.plant}</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {p.loadPct}% Load · {p.powerKw} kW ({p.rpmAvg} RPM)
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                      style={{ left: '85%' }}
                      title="85% Safe Operating Limit"
                    />
                    <div
                      style={{ width: `${p.loadPct}%` }}
                      className={`h-full rounded-full transition-all ${
                        p.loadPct > 85 ? 'bg-rose-500' : p.loadPct > 75 ? 'bg-amber-500' : 'bg-purple-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Power inrush within safe margins</span>
                    <span>Envelope: &lt; 85%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">What this shows:</span> All four plants are operating safely below the 85% inverter threshold, with Plant C operating at the highest cut load (69.5%, 760 kW) for heavy casting roughing passes.
          </div>
        </div>
      </div>

      {/* 3. Visualizations: Plant Performance & Category Comparison */}
      {/* 3. Visualizations: Plant Performance & Category Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visualization 1: Plant Health & Status Breakdown (Stacked Bar) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  <span>Plant Fleet Operational Readiness</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Machine status across the available roster.
                </p>
              </div>
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                400 Units Total
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {plantStats.map((plant) => (
                <div key={plant.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-800 font-semibold">
                      {plant.shortName}: <span className="text-slate-500 font-normal">{plant.focus}</span>
                    </span>
                    <span className="text-teal-700 font-bold">{plant.availPct}% Operational</span>
                  </div>

                  {/* Stacked Progress Bar */}
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                    <div
                      style={{ width: `${(plant.nominal / plant.total) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all"
                      title={`Nominal: ${plant.nominal} machines`}
                    />
                    <div
                      style={{ width: `${(plant.warning / plant.total) * 100}%` }}
                      className="bg-amber-500 h-full transition-all"
                      title={`Warning: ${plant.warning} machines`}
                    />
                    <div
                      style={{ width: `${(plant.critical / plant.total) * 100}%` }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Critical: ${plant.critical} machines`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Nominal: {plant.nominal}</span>
                    <span>Warning: {plant.warning}</span>
                    <span>Critical: {plant.critical}</span>
                    <span className={plant.openIncs > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                      {plant.openIncs} Open Tickets
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plain-Language Explanation */}
          <div className="mt-5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">What this shows:</span> Green segments indicate machines operating within normal thermal and vibration parameters. Yellow and red mark machines undergoing maintenance or telemetry threshold inspection.
          </div>
        </div>

        {/* Visualization 2: CNC Category Availability Bar Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-cyan-600" />
                  <span>Machine Category Availability vs. 95% Target</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operational readiness by machine class compared to factory SLA.
                </p>
              </div>
              <span className="text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full">
                Target: 95%
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {categoryStats.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-800 font-medium truncate max-w-[240px]">
                      {cat.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {cat.active}/{cat.total} ({cat.pct}%)
                    </span>
                  </div>
                  <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    {/* Benchmark 95% line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                      style={{ left: '95%' }}
                      title="95% Target SLA"
                    />
                    <div
                      style={{ width: `${cat.pct}%` }}
                      className={`h-full rounded-full transition-all ${
                        cat.pct >= 95 ? 'bg-emerald-500' : cat.pct >= 88 ? 'bg-teal-600' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plain-Language Explanation */}
          <div className="mt-5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">What this shows:</span> The vertical black mark represents the 95% fleet availability standard. Categories meeting or exceeding this threshold are colored green; others require tooling indexing.
          </div>
        </div>
      </div>

      {/* 4. Incidents Needing Immediate Attention (Supervisor Queue) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Incidents Requiring Supervisor Action</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review open shop-floor issues and assign qualified maintenance personnel to investigate.
            </p>
          </div>
          <button
            onClick={() => onNavigate('incidents')}
            className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
          >
            <span>Open Incident Management</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {openIncidents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No active incidents in this selection.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold">
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
              <tbody className="divide-y divide-slate-100">
                {openIncidents.slice(0, 5).map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-slate-900">{inc.incidentCode}</td>
                    <td className="py-3 px-3.5 text-slate-800 font-semibold">{inc.machineCode}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          inc.severity === 'Critical'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : inc.severity === 'High'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 truncate max-w-xs">
                      {inc.symptomDescription}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600">
                      {inc.reporterName} ({inc.reporterRole})
                    </td>
                    <td className="py-3 px-3.5">
                      {inc.assignedToName ? (
                        <span className="text-teal-700 font-medium">{inc.assignedToName}</span>
                      ) : (
                        <span className="text-rose-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => setAssigningIncident(inc)}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition-colors border border-teal-200"
                      >
                        {inc.assignedToName ? 'Reassign' : 'Assign Tech'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. 400-Machine Interactive Fleet Browser with 4-Tier Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Fleet Inventory &amp; Live Machine Status ({machines.length} Machines)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter by plant, machine category, or current operational status. Showing {filteredMachines.length} matching units.
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by code, model, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 text-xs rounded-xl pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 w-full sm:w-64 shadow-xs"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Plant</label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 text-xs text-slate-900 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none shadow-xs"
            >
              <option value="ALL">All Plants ({machines.length} Machines)</option>
              <option value="Plant A: Precision Machining">Plant A: Precision Machining ({machines.filter(machine => machine.plant === 'Plant A: Precision Machining').length})</option>
              <option value="Plant B: Powertrain Components">Plant B: Powertrain Components ({machines.filter(machine => machine.plant === 'Plant B: Powertrain Components').length})</option>
              <option value="Plant C: Heavy Machining">Plant C: Heavy Machining ({machines.filter(machine => machine.plant === 'Plant C: Heavy Machining').length})</option>
              <option value="Plant D: Finishing and Grinding">Plant D: Finishing and Grinding ({machines.filter(machine => machine.plant === 'Plant D: Finishing and Grinding').length})</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Machine Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 text-xs text-slate-900 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none shadow-xs"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Operational Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 text-xs text-slate-900 rounded-xl p-2.5 focus:border-teal-500 focus:outline-none shadow-xs"
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
        <div className="mt-4 overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold">
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
            <tbody className="divide-y divide-slate-100">
              {filteredMachines.slice(0, 40).map((m) => (
                <tr key={m.machineId || m.code} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3.5">
                    <div className="font-semibold text-slate-900">{m.displayName || m.name}</div>
                    <div className="text-[11px] text-teal-700">{m.machineId || m.code} · {m.machineCode || m.code}</div>
                  </td>
                  <td className="py-3 px-3.5 text-slate-700 truncate max-w-[160px]">
                    {m.machineType}
                  </td>
                  <td className="py-3 px-3.5 text-slate-600">
                    <div>{m.plant?.split(':')[0] || 'Plant A'}</div>
                    <div className="text-[11px] text-slate-400">{m.productionLine || 'Line 1'}</div>
                  </td>
                  <td className="py-3 px-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        m.status === 'Critical'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : m.status === 'Warning'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          m.status === 'Critical' ? 'bg-rose-500 animate-pulse' : m.status === 'Warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span>{m.status || 'Nominal'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-slate-800 tabular-nums font-medium">
                    {m.spindleRpm || 4500} RPM
                  </td>
                  <td className="py-3 px-3.5 text-slate-800 tabular-nums font-medium">
                    {(m.vibrationMmS || 1.85).toFixed(2)} mm/s
                  </td>
                  <td className="py-3 px-3.5 text-slate-800 tabular-nums font-medium">
                    {(m.motorLoadPercent || 58).toFixed(1)}%
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <button
                      onClick={() => {
                        onSelectMachine(m.code);
                        onNavigate('machines');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMachines.length > 40 && (
          <div className="mt-2 text-right text-[11px] font-mono text-slate-500">
            Showing first 40 of {filteredMachines.length} units. Use filters to narrow results.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* QUICK ASSIGN MODAL */}
      {/* ------------------------------------------------------------- */}
      {assigningIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0c1424] border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
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
                <div className="p-2 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono">
                  {assigningIncident.machineCode} · {assigningIncident.componentArea}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-mono block mb-1">Reported Symptom:</span>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded text-slate-300 font-sans">
                  {assigningIncident.symptomDescription}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1 font-semibold">
                  Select Maintenance Technician:
                </label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 font-mono focus:border-teal-500 focus:outline-none"
                >
                  <option value="Frank Kowalski">Frank Kowalski (Lead Vibration Specialist)</option>
                  <option value="Elena Rostova">Elena Rostova (Mechanical Systems)</option>
                  <option value="Marcus Vance">Marcus Vance (Electrical / VFD Drives)</option>
                  <option value="David Miller">David Miller (General CNC Maintenance)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssigningIncident(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-sans font-medium disabled:opacity-50"
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
