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
} from 'lucide-react';

interface ManagerDashboardProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
}) => {
  const [selectedPlantTab, setSelectedPlantTab] = useState<'ALL' | 'Plant A' | 'Plant B' | 'Plant C' | 'Plant D'>('ALL');
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [authorizedDecisions, setAuthorizedDecisions] = useState<Record<string, boolean>>({});

  // Fleet performance calculations
  const totalMachines = machines.length || 400;
  const operationalMachines = machines.filter((m) => m.status === 'Nominal').length;
  const fleetAvailabilityPct = ((operationalMachines / totalMachines) * 100).toFixed(1);

  // Plant comparison figures
  const plantPerformance = [
    {
      plant: 'Plant A',
      name: 'Precision Machining',
      oeePct: 96.2,
      availPct: 97.0,
      partsProduced: 1540,
      targetParts: 1500,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && i.machineCode.includes('VMC')).length,
      status: 'Exceeding Target',
    },
    {
      plant: 'Plant B',
      name: 'Powertrain Components',
      oeePct: 91.4,
      availPct: 93.0,
      partsProduced: 1380,
      targetParts: 1500,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && i.machineCode.includes('TRN')).length,
      status: 'On Pace',
    },
    {
      plant: 'Plant C',
      name: 'Heavy Machining',
      oeePct: 88.6,
      availPct: 89.0,
      partsProduced: 1190,
      targetParts: 1500,
      activeIncidents: incidents.filter((i) => i.status !== 'Closed' && i.machineCode.includes('HMC')).length,
      status: 'Needs Attention',
    },
    {
      plant: 'Plant D',
      name: 'Finishing & Grinding',
      oeePct: 94.8,
      availPct: 95.0,
      partsProduced: 1310,
      targetParts: 1500,
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
    setAuthorizedDecisions((prev) => ({ ...prev, [decisionId]: true }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Role & Executive Context */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 tracking-wide uppercase mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>Plant Manager Operations · Multi-Facility Oversight</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Plant Performance &amp; Operational Trends
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Track overall equipment effectiveness (OEE), 7-day downtime patterns, cross-plant capacity, and executive maintenance approvals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('analytics')}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Empirical Analytics Dossier</span>
            </button>
            <button
              onClick={() => onNavigate('incidents')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <AlertCircle className="w-3.5 h-3.5 text-purple-600" />
              <span>Incident Resolution Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Executive Performance Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Overall Fleet Availability */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            Fleet Availability
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {fleetAvailabilityPct}%
            </span>
            <span className="text-xs text-slate-500 font-medium">Target: 95.0%</span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            372 of 400 CNC machines actively cutting
          </p>
        </div>

        {/* KPI 2: Total Shift Output */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            Shift Output Target
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-purple-700 tabular-nums">
              5,420
            </span>
            <span className="text-xs text-slate-500 font-medium">/ 6,000 Parts</span>
          </div>
          <p className="text-xs text-emerald-700 mt-2 font-medium">
            90.3% achieved (On pace to hit 100%)
          </p>
        </div>

        {/* KPI 3: Mean Time to Resolution (MTTR) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            Mean Resolution Time
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-teal-700 tabular-nums">
              34 min
            </span>
            <span className="text-xs text-slate-500 font-medium">SLA: &lt; 45 min</span>
          </div>
          <p className="text-xs text-teal-700 mt-2 font-medium">
            11 min faster than shift target
          </p>
        </div>

        {/* KPI 4: Total Electrical Power Load */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            Active Power Draw
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-sky-700 tabular-nums">
              2,410 kW
            </span>
            <span className="text-xs text-slate-500 font-medium">Across 4 Plants</span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Avg 6.03 kW per operating spindle
          </p>
        </div>
      </div>

      {/* 3. Visualizations: Plant Performance Comparison & 7-Day Trend (Prominently Near the Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visualization 1: Plant vs Plant OEE Comparison Bar Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <span>Plant OEE &amp; Production Output Comparison</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overall Equipment Effectiveness (OEE) benchmarked against the 90% SLA minimum standard.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                90% SLA Target
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {plantPerformance.map((p) => (
                <div key={p.plant} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{p.plant}:</span>
                      <span className="text-slate-600 font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-slate-900 font-bold">{p.oeePct}% OEE</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                          p.oeePct >= 95
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.oeePct >= 90
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-3 w-full bg-slate-100 rounded-md overflow-hidden">
                    {/* 90% Benchmark Line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                      style={{ left: '90%' }}
                      title="90% Minimum SLA Benchmark"
                    />
                    <div
                      style={{ width: `${p.oeePct}%` }}
                      className={`h-full rounded-md transition-all ${
                        p.oeePct >= 95 ? 'bg-purple-600' : p.oeePct >= 90 ? 'bg-teal-600' : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Parts: {p.partsProduced} / {p.targetParts}</span>
                    <span>Availability: {p.availPct}%</span>
                    <span className={p.activeIncidents > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                      {p.activeIncidents} Active Issues
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs text-purple-950 leading-relaxed">
            <span className="font-bold text-purple-900">What to notice:</span> Plant C (Heavy Machining) is at 88.6% OEE, falling slightly below our 90% target due to recurring spindle chatter in Bay 2, while Plant A leads at 96.2%.
          </div>
        </div>

        {/* Visualization 2: 7-Day Incidents & Downtime Trend Line Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <span>7-Day Incident Frequency &amp; Lost Downtime Trend</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily ticket volume (bars) compared to total lost production hours (trend line) across all 4 plants.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Weekly Cycle
              </span>
            </div>

            {/* SVG Trend Visualization */}
            <div className="mt-4">
              <div className="h-44 w-full relative">
                <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible">
                  {/* Horizontal gridlines */}
                  <line x1="25" y1="20" x2="385" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="25" y1="50" x2="385" y2="50" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="25" y1="80" x2="385" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="25" y1="100" x2="385" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />

                  {/* Y-axis labels */}
                  <text x="20" y="24" fill="#94a3b8" fontSize="8" textAnchor="end" fontFamily="sans-serif">5h</text>
                  <text x="20" y="54" fill="#94a3b8" fontSize="8" textAnchor="end" fontFamily="sans-serif">3h</text>
                  <text x="20" y="84" fill="#94a3b8" fontSize="8" textAnchor="end" fontFamily="sans-serif">1h</text>

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
                          fill="#c084fc"
                          opacity="0.5"
                          rx="3"
                        />
                        <text
                          x={x}
                          y={94 - barHeight}
                          fill="#7e22ce"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          {t.incidents}
                        </text>
                        <text
                          x={x}
                          y="114"
                          fill="#64748b"
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
                    stroke="#0284c7"
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
                    <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                  ))}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-6 mt-3 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3 rounded bg-purple-400/60" />
                  <span>Purple Bars: Incident Ticket Count</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-sky-600" />
                  <span>Blue Line: Lost Production (Hours)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-950 leading-relaxed">
            <span className="font-bold text-sky-900">What to notice:</span> Wednesday peaked at 4.8 hours lost due to a Z-axis ball screw seizure in Plant B; preventative lubrication cycles reduced weekend downtime to only 1.2 hours.
          </div>
        </div>
      </div>

      {/* 3.5 Plant Power Draw & Thermal Stability Efficiency Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visualization 3: Plant Electrical Power Draw (kW) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span>Plant Electrical Power Draw vs. 850 kW Substation Limit</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time factory floor electrical consumption (kW) across the four plants.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{p.plant}</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {p.kw} kW <span className="text-slate-500 font-normal">({p.pct}% of limit)</span>
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                      style={{ left: '85%' }}
                      title="85% Demand Peak Limit"
                    />
                    <div
                      style={{ width: `${p.pct}%` }}
                      className={`h-full rounded-full transition-all ${
                        p.pct > 85 ? 'bg-amber-500' : 'bg-sky-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Substation Sub-feed capacity: 850 kW</span>
                    <span className={p.pct > 85 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                      {p.pct > 85 ? 'Peak Demand Warning (>85%)' : 'Nominal Power Factor'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-950 leading-relaxed">
            <span className="font-bold text-sky-900">What to notice:</span> Plant C is drawing 760 kW (89.4% of substation limit) during heavy roughing shifts; staggering spindle ramp-up times can avoid peak tariff penalties.
          </div>
        </div>

        {/* Visualization 4: Fleet Thermal Stability Compliance Index */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-600" />
                  <span>Fleet Thermal Stability Compliance Index (% &lt; 35°C)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Percentage of plant machines maintaining coolant and spindle temperatures within safe 35°C limits.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{p.plant}: <span className="font-normal text-slate-600">{p.name}</span></span>
                    <span className="font-mono text-slate-900 font-bold">
                      {p.compliancePct}% Compliant
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
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
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Target Standard: &gt; 95%</span>
                    <span className={p.hotUnits > 5 ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                      {p.hotUnits} units elevated above 35°C
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs text-purple-950 leading-relaxed">
            <span className="font-bold text-purple-900">What to notice:</span> Plant C has 13 machines running over 35°C (87% compliance), directly explaining its elevated tool wear rate; approving Chiller Overhaul proposal #2 will restore 95%+ stability.
          </div>
        </div>
      </div>

      {/* 4. Executive Decisions Needing Attention */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Decisions Needing Executive Authorization</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review flagged capital, maintenance overhaul, and vendor actions to maintain plant SLA.
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            {3 - Object.keys(authorizedDecisions).length} Pending Sign-Off
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Decision 1 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                  Tooling Overhaul
                </span>
                <span className="text-xs text-slate-500 font-medium">Plant C · Line 2</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mt-2">
                Authorize Heavy Mill Spindle Bearing Replacement
              </h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Recurring chatter vibration observed across 3 separate shifts. Scheduled downtime: 3.5h. Estimated cost: $4,200.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Req: Frank Kowalski</span>
              {authorizedDecisions['dec-1'] ? (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                </span>
              ) : (
                <button
                  onClick={() => handleAuthorize('dec-1')}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  Authorize
                </button>
              )}
            </div>
          </div>

          {/* Decision 2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  Consumables Order
                </span>
                <span className="text-xs text-slate-500 font-medium">Plant B · Powertrain</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mt-2">
                Replenish Synthetic Coolant Batch (40 Drums)
              </h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Coolant concentration levels across 8 turning machines approaching 5% lower threshold. Supplier quote: $6,800.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Req: Elena Rostova</span>
              {authorizedDecisions['dec-2'] ? (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                </span>
              ) : (
                <button
                  onClick={() => handleAuthorize('dec-2')}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  Authorize
                </button>
              )}
            </div>
          </div>

          {/* Decision 3 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                  Preventative Schedule
                </span>
                <span className="text-xs text-slate-500 font-medium">Plant A · Precision</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mt-2">
                Shift Calibration Window for 5-Axis Centers
              </h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Surface finish profilometer readings approaching 1.4 µm Ra threshold. Shift calibration window from 02:00 to 05:00 UTC.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Req: Marcus Vance</span>
              {authorizedDecisions['dec-3'] ? (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                </span>
              ) : (
                <button
                  onClick={() => handleAuthorize('dec-3')}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  Authorize
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Plain-Language Data Science Metric Glossary for Executives */}
      <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-purple-600" />
          <span>Executive Data Science &amp; Operational Guide</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-900 block mb-1">OEE (Overall Equipment Effectiveness):</span>
            Measures true productivity by combining Machine Availability × Operating Speed × Quality Pass Rate. FactoryPulse target is 90%+.
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-900 block mb-1">MTTR (Mean Time to Resolution):</span>
            Average time elapsed from when an operator logs an incident ticket to maintenance completion sign-off. Lower is better (target &lt; 45 min).
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-900 block mb-1">Flank Wear (Vb) &amp; Surface Finish (Ra):</span>
            Vb measures physical cutting edge wear in millimeters (limit 0.30 mm). Ra measures workpiece roughness. Exceeding Vb limits degrades workpiece finish.
          </div>
        </div>
      </div>
    </div>
  );
};
