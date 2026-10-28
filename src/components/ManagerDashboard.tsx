import React, { useState } from 'react';
import { UserProfile, Machine, Incident, MaintenanceWorkOrder } from '../types';
import {
  TrendingUp,
  BarChart3,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  FileText,
  HelpCircle,
  Flame,
  Wrench,
  Check,
  AlertTriangle,
  Award,
} from 'lucide-react';

interface ManagerDashboardProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory' | 'maintenance') => void;
  onSelectMachine?: (code: string) => void;
  onRefreshData?: () => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
  onSelectMachine,
  onRefreshData,
}) => {
  const [selectedPlantTab, setSelectedPlantTab] = useState<'ALL' | 'Plant A' | 'Plant B' | 'Plant C' | 'Plant D'>('ALL');
  const [authorizedDecisions, setAuthorizedDecisions] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ziro_mgr_authorizations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Fleet performance calculations dynamically based on available roster
  const totalMachines = machines.length || 40;
  const operationalMachines = machines.filter((m) => m.status === 'Nominal').length;
  const warningMachines = machines.filter((m) => m.status === 'Warning').length;
  const criticalMachines = machines.filter((m) => m.status === 'Critical').length;
  const fleetAvailabilityPct = ((operationalMachines / totalMachines) * 100).toFixed(1);

  // Plant comparison figures with live machine counts
  const plantPerformance = [
    {
      plant: 'Plant A',
      fullName: 'Plant A: Precision Machining',
      name: 'Precision Machining',
      line: 'Lines 1–4 · 5-Axis Milling',
      oeePct: 96.2,
      availPct: 97.0,
      partsProduced: 1540,
      targetParts: 1500,
      machinesInPlant: machines.filter((m) => m.plant?.includes('Plant A')).length || 10,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && (i.machineCode.includes('VMC') || i.machineCode.includes('5AX'))).length,
      status: 'Exceeding Target',
    },
    {
      plant: 'Plant B',
      fullName: 'Plant B: Powertrain Components',
      name: 'Powertrain Components',
      line: 'Lines 5–8 · Turning & Mill-Turn',
      oeePct: 91.4,
      availPct: 93.0,
      partsProduced: 1380,
      targetParts: 1500,
      machinesInPlant: machines.filter((m) => m.plant?.includes('Plant B')).length || 10,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && (i.machineCode.includes('TRN') || i.machineCode.includes('MLT'))).length,
      status: 'On Pace',
    },
    {
      plant: 'Plant C',
      fullName: 'Plant C: Heavy Machining',
      name: 'Heavy Machining',
      line: 'Lines 9–12 · Horizontal & Boring',
      oeePct: 88.6,
      availPct: 89.0,
      partsProduced: 1190,
      targetParts: 1500,
      machinesInPlant: machines.filter((m) => m.plant?.includes('Plant C')).length || 10,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && (i.machineCode.includes('HMC') || i.machineCode.includes('DRL'))).length,
      status: 'Needs Attention',
    },
    {
      plant: 'Plant D',
      fullName: 'Plant D: Finishing and Grinding',
      name: 'Finishing & Grinding',
      line: 'Lines 13–16 · Precision Grinding',
      oeePct: 94.8,
      availPct: 95.0,
      partsProduced: 1310,
      targetParts: 1500,
      machinesInPlant: machines.filter((m) => m.plant?.includes('Plant D')).length || 10,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && i.machineCode.includes('GRD')).length,
      status: 'On Pace',
    },
  ];

  // 7-Day Trend data
  const weeklyTrends = [
    { day: 'Mon', incidents: 8, downtimeHours: 3.2, outputRatio: 96 },
    { day: 'Tue', incidents: 6, downtimeHours: 2.1, outputRatio: 98 },
    { day: 'Wed', incidents: 11, downtimeHours: 4.8, outputRatio: 92 },
    { day: 'Thu', incidents: 5, downtimeHours: 1.8, outputRatio: 99 },
    { day: 'Fri', incidents: 9, downtimeHours: 3.6, outputRatio: 94 },
    { day: 'Sat', incidents: 4, downtimeHours: 1.2, outputRatio: 101 },
    { day: 'Sun (Today)', incidents: 7, downtimeHours: 2.5, outputRatio: 95 },
  ];

  const handleAuthorize = (decisionId: string) => {
    setAuthorizedDecisions((prev) => {
      const updated = { ...prev, [decisionId]: true };
      try {
        localStorage.setItem('ziro_mgr_authorizations', JSON.stringify(updated));
      } catch {
        /* storage fallback */
      }
      return updated;
    });
  };

  const pendingApprovalsCount = 3 - Object.keys(authorizedDecisions).length;

  return (
    <div className="space-y-6 text-slate-100">
      {/* 1. Header with Role & Executive Context */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 tracking-wide uppercase mb-1.5 font-mono">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span>Plant Operations Oversight · Multi-Facility Executive</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
              Plant Performance &amp; Operational Trends
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Track overall equipment effectiveness (OEE), 7-day downtime patterns, cross-plant capacity, and executive maintenance sign-offs across <span className="font-semibold text-purple-300">{machines.length} active machines</span> (400 catalog units).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('analytics')}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono flex items-center gap-2 transition-all shadow-md shadow-purple-950/40"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Fleet Analytics &amp; Reports</span>
            </button>
            <button
              onClick={() => onNavigate('incidents')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono flex items-center gap-2 transition-colors border border-slate-700"
            >
              <AlertCircle className="w-4 h-4 text-purple-400" />
              <span>Incident Logs ({incidents.filter(i => i.status !== 'Closed').length})</span>
            </button>
            <button
              onClick={() => onNavigate('maintenance')}
              className="px-4 py-2.5 rounded-xl bg-[#070d18] hover:bg-slate-900 text-slate-300 text-xs font-semibold font-mono flex items-center gap-2 transition-colors border border-slate-800"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Work Orders ({workOrders.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Executive Performance Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Overall Fleet Availability */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block font-mono">
            Fleet Availability
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums font-mono">
              {fleetAvailabilityPct}%
            </span>
            <span className="text-xs text-purple-300 font-mono">Target: 95.0%</span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5 font-mono">
            {operationalMachines} of {totalMachines} active CNCs running nominal
          </p>
        </div>

        {/* KPI 2: Total Shift Output */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block font-mono">
            Shift Output Target
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-300 tabular-nums font-mono">
              5,420
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 6,000 Parts</span>
          </div>
          <p className="text-xs text-emerald-400 mt-2.5 font-mono font-medium">
            90.3% achieved (On pace for 100%)
          </p>
        </div>

        {/* KPI 3: Mean Time to Resolution (MTTR) */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block font-mono">
            Mean Resolution Time (MTTR)
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-300 tabular-nums font-mono">
              34 min
            </span>
            <span className="text-xs text-slate-400 font-mono">SLA: &lt; 45 min</span>
          </div>
          <p className="text-xs text-teal-400 mt-2.5 font-mono font-medium">
            11 min faster than shift target
          </p>
        </div>

        {/* KPI 4: Total Electrical Power Load */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block font-mono">
            Substation Power Draw
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-sky-300 tabular-nums font-mono">
              2,410 kW
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 3,400 kW Max</span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5 font-mono">
            70.9% load factor across 4 plants
          </p>
        </div>
      </div>

      {/* 3. Visualizations: Plant Performance Comparison & 7-Day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visualization 1: Plant vs Plant OEE Comparison Bar Chart */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  <span>Plant OEE &amp; Production Output Comparison</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Overall Equipment Effectiveness (OEE) benchmarked against the 90% SLA minimum standard.
                </p>
              </div>
              <span className="text-[11px] font-semibold font-mono text-purple-300 bg-purple-950/70 px-2.5 py-0.5 rounded-md border border-purple-800">
                90% SLA Target
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {plantPerformance.map((p) => (
                <div key={p.plant} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">{p.plant}:</span>
                      <span className="text-slate-400 font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-slate-100 font-bold">{p.oeePct}% OEE</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          p.oeePct >= 95
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : p.oeePct >= 90
                            ? 'bg-teal-950/80 text-teal-300 border border-teal-800'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-3 w-full bg-slate-900 rounded-md overflow-hidden border border-slate-800">
                    {/* 90% Benchmark Line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                      style={{ left: '90%' }}
                      title="90% Minimum SLA Benchmark"
                    />
                    <div
                      style={{ width: `${p.oeePct}%` }}
                      className={`h-full rounded-md transition-all ${
                        p.oeePct >= 95 ? 'bg-purple-500' : p.oeePct >= 90 ? 'bg-teal-500' : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Parts: {p.partsProduced} / {p.targetParts}</span>
                    <span>Availability: {p.availPct}%</span>
                    <span className={p.activeIncidents > 0 ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                      {p.activeIncidents} Active Issues
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-[#070d18] border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
            <span className="font-bold text-purple-300">Executive Insight:</span> Plant C (Heavy Machining) is at 88.6% OEE, falling slightly below our 90% target due to recurring spindle chatter in Bay 2, while Plant A leads at 96.2%.
          </div>
        </div>

        {/* Visualization 2: 7-Day Incidents & Downtime Trend Line Chart */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>7-Day Incident Frequency &amp; Lost Downtime Trend</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daily ticket volume (bars) compared to total lost production hours (trend line) across all 4 plants.
                </p>
              </div>
              <span className="text-[11px] font-semibold font-mono text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800">
                Weekly Cycle
              </span>
            </div>

            {/* SVG Trend Visualization */}
            <div className="mt-4">
              <div className="h-44 w-full relative">
                <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible">
                  {/* Horizontal gridlines */}
                  <line x1="25" y1="20" x2="385" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                  <line x1="25" y1="50" x2="385" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
                  <line x1="25" y1="80" x2="385" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
                  <line x1="25" y1="100" x2="385" y2="100" stroke="#334155" strokeWidth="1.5" />

                  {/* Y-axis labels */}
                  <text x="20" y="24" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">5h</text>
                  <text x="20" y="54" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">3h</text>
                  <text x="20" y="84" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">1h</text>

                  {/* Incident Count Bars (Purple) */}
                  {weeklyTrends.map((t, idx) => {
                    const x = 35 + idx * 56;
                    const barHeight = t.incidents * 6;
                    return (
                      <g key={t.day}>
                        <rect
                          x={x - 9}
                          y={100 - barHeight}
                          width="18"
                          height={barHeight}
                          fill="#a855f7"
                          opacity="0.6"
                          rx="3"
                        />
                        <text
                          x={x}
                          y={94 - barHeight}
                          fill="#d8b4fe"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {t.incidents}
                        </text>
                        <text
                          x={x}
                          y="114"
                          fill="#94a3b8"
                          fontSize="8"
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          {t.day.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}

                  {/* Downtime Hours Area / Line (Cyan/Sky) */}
                  <path
                    d="M 35 58 L 91 78 L 147 24 L 203 84 L 259 48 L 315 96 L 371 70"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                  />

                  {/* Points on Line */}
                  {[
                    { x: 35, y: 58, val: '3.2h' },
                    { x: 91, y: 78, val: '2.1h' },
                    { x: 147, y: 24, val: '4.8h' },
                    { x: 203, y: 84, val: '1.8h' },
                    { x: 259, y: 48, val: '3.6h' },
                    { x: 315, y: 96, val: '1.2h' },
                    { x: 371, y: 70, val: '2.5h' },
                  ].map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#38bdf8" stroke="#0c1424" strokeWidth="1.5" />
                  ))}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-6 mt-3 text-xs font-medium font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3 rounded bg-purple-500/70" />
                  <span>Purple Bars: Incident Ticket Count</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-sky-400" />
                  <span>Blue Line: Lost Production (Hours)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 bg-[#070d18] border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
            <span className="font-bold text-sky-300">Executive Insight:</span> Wednesday peaked at 4.8 hours lost due to a Z-axis ball screw seizure in Plant B; preventative lubrication cycles reduced weekend downtime to only 1.2 hours.
          </div>
        </div>
      </div>

      {/* 3.5 Plant Power Draw & Thermal Stability Efficiency Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visualization 3: Plant Electrical Power Draw (kW) */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Zap className="w-4 h-4 text-sky-400" />
                  <span>Plant Electrical Power Draw vs. 850 kW Substation Limit</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time factory floor electrical consumption (kW) across the four plants.
                </p>
              </div>
              <span className="text-[11px] font-semibold font-mono text-sky-300 bg-sky-950/70 px-2.5 py-0.5 rounded-md border border-sky-800">
                2,410 kW Total
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { plant: 'Plant A (Precision)', kw: 580, limit: 850, pct: 68.2, status: 'nominal' },
                { plant: 'Plant B (Powertrain)', kw: 640, limit: 850, pct: 75.3, status: 'nominal' },
                { plant: 'Plant C (Heavy Machining)', kw: 760, limit: 850, pct: 89.4, status: 'elevated' },
                { plant: 'Plant D (Grinding)', kw: 430, limit: 850, pct: 50.6, status: 'nominal' },
              ].map((p) => (
                <div key={p.plant} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-200">{p.plant}</span>
                    <span className="text-slate-100 font-bold">
                      {p.kw} kW <span className="text-slate-400 font-normal">({p.pct}% of limit)</span>
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                      style={{ left: '85%' }}
                      title="85% Demand Peak Limit"
                    />
                    <div
                      style={{ width: `${p.pct}%` }}
                      className={`h-full rounded-full transition-all ${
                        p.pct > 85 ? 'bg-amber-400' : 'bg-sky-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Substation Sub-feed capacity: 850 kW</span>
                    <span className={p.pct > 85 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                      {p.pct > 85 ? 'Peak Demand Warning (>85%)' : 'Nominal Power Factor'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-[#070d18] border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
            <span className="font-bold text-sky-300">Executive Insight:</span> Plant C is drawing 760 kW (89.4% of substation limit) during heavy roughing shifts; staggering spindle ramp-up times can avoid peak tariff penalties.
          </div>
        </div>

        {/* Visualization 4: Fleet Thermal Stability Compliance Index */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Flame className="w-4 h-4 text-purple-400" />
                  <span>Fleet Thermal Stability Compliance Index (% &lt; 35°C)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Percentage of plant machines maintaining coolant and spindle temperatures within safe 35°C limits.
                </p>
              </div>
              <span className="text-[11px] font-semibold font-mono text-purple-300 bg-purple-950/70 px-2.5 py-0.5 rounded-md border border-purple-800">
                Target: &gt; 95%
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { plant: 'Plant A', name: 'Precision Machining', compliancePct: 99.0, hotUnits: 1 },
                { plant: 'Plant B', name: 'Powertrain Components', compliancePct: 96.0, hotUnits: 4 },
                { plant: 'Plant C', name: 'Heavy Machining', compliancePct: 87.0, hotUnits: 13 },
                { plant: 'Plant D', name: 'Finishing & Grinding', compliancePct: 98.0, hotUnits: 2 },
              ].map((p) => (
                <div key={p.plant} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-200">{p.plant}: <span className="font-normal text-slate-400">{p.name}</span></span>
                    <span className="text-slate-100 font-bold">
                      {p.compliancePct}% Compliant
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
                      style={{ left: '95%' }}
                      title="95% Target Standard"
                    />
                    <div
                      style={{ width: `${p.compliancePct}%` }}
                      className={`h-full rounded-full transition-all ${
                        p.compliancePct >= 95 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Target Standard: &gt; 95%</span>
                    <span className={p.hotUnits > 5 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      {p.hotUnits} units elevated above 35°C
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-[#070d18] border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono">
            <span className="font-bold text-purple-300">Executive Insight:</span> Plant C has 13 machines running over 35°C (87% compliance), directly explaining its elevated tool wear rate; approving Chiller Overhaul proposal #2 will restore 95%+ stability.
          </div>
        </div>
      </div>

      {/* 4. Executive Decisions Needing Attention */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Decisions Needing Executive Authorization</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review flagged capital, maintenance overhaul, and vendor actions to maintain plant SLA.
            </p>
          </div>
          <span className="text-xs font-bold font-mono text-amber-300 bg-amber-950/70 px-2.5 py-1 rounded-md border border-amber-800">
            {pendingApprovalsCount} Pending Sign-Off
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Decision 1 */}
          <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                  Tooling Overhaul
                </span>
                <span className="text-xs text-slate-400 font-mono">Plant C · Line 2</span>
              </div>
              <h4 className="font-bold text-sm text-white mt-2">
                Authorize Heavy Mill Spindle Bearing Replacement
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Recurring chatter vibration observed across 3 separate shifts. Scheduled downtime: 3.5h. Estimated cost: $4,200.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Req: Frank Kowalski</span>
              {authorizedDecisions['dec-1'] ? (
                <span className="text-xs font-semibold font-mono text-emerald-300 flex items-center gap-1 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Approved
                </span>
              ) : (
                <button
                  onClick={() => handleAuthorize('dec-1')}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono transition-colors shadow-xs"
                >
                  Authorize Sign-Off
                </button>
              )}
            </div>
          </div>

          {/* Decision 2 */}
          <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                  Consumables Order
                </span>
                <span className="text-xs text-slate-400 font-mono">Plant B · Powertrain</span>
              </div>
              <h4 className="font-bold text-sm text-white mt-2">
                Replenish Synthetic Coolant Batch (40 Drums)
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Coolant concentration levels across 8 turning machines approaching 5% lower threshold. Supplier quote: $6,800.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Req: Elena Rostova</span>
              {authorizedDecisions['dec-2'] ? (
                <span className="text-xs font-semibold font-mono text-emerald-300 flex items-center gap-1 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Approved
                </span>
              ) : (
                <button
                  onClick={() => handleAuthorize('dec-2')}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono transition-colors shadow-xs"
                >
                  Authorize Sign-Off
                </button>
              )}
            </div>
          </div>

          {/* Decision 3 */}
          <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800">
                  Preventative Schedule
                </span>
                <span className="text-xs text-slate-400 font-mono">Plant A · Precision</span>
              </div>
              <h4 className="font-bold text-sm text-white mt-2">
                Shift Calibration Window for 5-Axis Centers
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Surface finish profilometer readings approaching 1.4 µm Ra threshold. Shift calibration window from 02:00 to 05:00 UTC.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Req: Marcus Vance</span>
              {authorizedDecisions['dec-3'] ? (
                <span className="text-xs font-semibold font-mono text-emerald-300 flex items-center gap-1 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Approved
                </span>
              ) : (
                <button
                  onClick={() => handleAuthorize('dec-3')}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono transition-colors shadow-xs"
                >
                  Authorize Sign-Off
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Executive Operational & Data Science Guide */}
      <div className="p-6 bg-[#0c1424] border border-slate-800 rounded-2xl shadow-xl">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3 font-mono">
          <HelpCircle className="w-4 h-4 text-purple-400" />
          <span>Executive Data Science &amp; Operational Matrix Guide</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed font-mono">
          <div className="p-3.5 bg-[#070d18] rounded-xl border border-slate-800">
            <span className="font-bold text-white block mb-1">OEE (Overall Equipment Effectiveness):</span>
            Measures true shop-floor productivity by combining Machine Availability × Operating Speed × Quality Pass Rate. FactoryPulse standard is 90%+.
          </div>
          <div className="p-3.5 bg-[#070d18] rounded-xl border border-slate-800">
            <span className="font-bold text-white block mb-1">MTTR (Mean Time to Resolution):</span>
            Average time elapsed from when an operator logs an incident ticket to maintenance completion sign-off. Lower is better (target &lt; 45 min).
          </div>
          <div className="p-3.5 bg-[#070d18] rounded-xl border border-slate-800">
            <span className="font-bold text-white block mb-1">Flank Wear (Vb) &amp; Surface Finish (Ra):</span>
            Vb measures physical cutting edge wear in millimeters (limit 0.30 mm). Ra measures workpiece roughness. Exceeding Vb limits degrades workpiece finish.
          </div>
        </div>
      </div>
    </div>
  );
};
