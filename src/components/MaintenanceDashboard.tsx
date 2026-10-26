import React, { useState } from 'react';
import { UserProfile, Machine, Incident, MaintenanceWorkOrder } from '../types';
import { apiClient } from '../services/apiClient';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  Search,
  Sparkles,
  ClipboardList,
  CheckSquare,
  Square,
  Activity,
  Gauge,
  HelpCircle,
  X,
  Flame,
  Zap,
} from 'lucide-react';

interface MaintenanceDashboardProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
  onSelectMachine: (code: string) => void;
  onRefreshData?: () => void;
}

export const MaintenanceDashboard: React.FC<MaintenanceDashboardProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
  onSelectMachine,
  onRefreshData,
}) => {
  // Inspection checklist state
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    step1: true,
    step2: false,
    step3: false,
    step4: false,
  });

  // Action progress modal state
  const [activeTicketModal, setActiveTicketModal] = useState<Incident | null>(null);
  const [progressNote, setProgressNote] = useState<string>('');
  const [isUpdatingProgress, setIsUpdatingProgress] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filtered maintenance issues
  const myAssignedIncidents = incidents.filter(
    (i) => i.status !== 'Closed' && (i.assignedToName === currentUser.fullName || !i.assignedToName)
  );
  const criticalHighRiskMachines = machines.filter(
    (m) => (m.vibrationMmS && m.vibrationMmS > 3.0) || m.status === 'Warning' || m.status === 'Critical'
  );

  const toggleCheck = (stepId: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleUpdateWorkOrderStatus = async (orderId: number, newStatus: 'Pending' | 'In_Progress' | 'Completed') => {
    try {
      await apiClient.updateWorkOrderStatus(orderId, newStatus);
      if (onRefreshData) onRefreshData();
      setFeedbackMessage(`Work order #${orderId} marked as ${newStatus.replace('_', ' ')}.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(`Error updating work order: ${err.message}`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicketModal || !progressNote.trim()) return;
    setIsUpdatingProgress(true);
    try {
      await apiClient.updateIncidentProgress(activeTicketModal.id, progressNote, currentUser.role);
      setFeedbackMessage(`Progress updated on ${activeTicketModal.incidentCode}. Status set to Action Required.`);
      setActiveTicketModal(null);
      setProgressNote('');
      if (onRefreshData) onRefreshData();
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setFeedbackMessage(`Update failed: ${err.message}`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Maintenance Context */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 tracking-wide uppercase mb-1">
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>Maintenance Engineering · Equipment Integrity &amp; Servicing</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Assigned Issues &amp; Equipment Condition History
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Diagnose spindle sensor alerts, verify ISO vibration severity standards, log physical inspection protocols, and execute shift work orders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('incidents')}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Root-Cause Assistant</span>
            </button>
            <button
              onClick={() => onNavigate('machines')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-600" />
              <span>Telemetry Spectrograms</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Key Maintenance Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Assigned Issues */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            Assigned to You
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${myAssignedIncidents.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {myAssignedIncidents.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">Active Tickets</span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            {myAssignedIncidents.filter((i) => i.severity === 'High' || i.severity === 'Critical').length} urgent priority tickets
          </p>
        </div>

        {/* Metric 2: Machines Exceeding Thresholds */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            High-Risk Machines
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-rose-600 tabular-nums">
              {criticalHighRiskMachines.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">&gt; 3.0 mm/s Vib</span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Spindle or way-lube degradation
          </p>
        </div>

        {/* Metric 3: Active Work Orders */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            Shift Work Orders
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-sky-700 tabular-nums">
              {workOrders.filter((w) => w.status !== 'Completed').length}
            </span>
            <span className="text-xs text-slate-500 font-medium">Pending Tasks</span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            {workOrders.filter((w) => w.status === 'Completed').length} completed this shift
          </p>
        </div>

        {/* Metric 4: Preventative Compliance */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
            PM Compliance
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-600 tabular-nums">
              96.4%
            </span>
            <span className="text-xs text-slate-500 font-medium">On-Time</span>
          </div>
          <p className="text-xs text-emerald-700 mt-2 font-medium">
            Zero overdue safety inspections
          </p>
        </div>
      </div>

      {/* 3. Visualizations: Machine Condition History & Vibration vs Limits (Near Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visualization 1: Spindle Vibration vs Bearing Warning Limits */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span>Spindle Vibration Condition vs. ISO 10816 Thresholds</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vibration velocity in mm/s RMS for monitored CNC units benchmarked against industrial standards.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                ISO 10816 Limits
              </span>
            </div>

            {/* SVG Multi-Machine Vibration Bar */}
            <div className="mt-4">
              <div className="h-44 w-full relative">
                <svg viewBox="0 0 380 120" className="w-full h-full overflow-visible">
                  {/* Threshold Lines */}
                  <line x1="20" y1="30" x2="360" y2="30" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                  <line x1="20" y1="65" x2="360" y2="65" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                  <line x1="20" y1="100" x2="360" y2="100" stroke="#cbd5e1" strokeWidth="1.5" />

                  {/* Y-axis labels */}
                  <text x="15" y="33" fill="#e11d48" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">4.0 Critical</text>
                  <text x="15" y="68" fill="#d97706" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">2.5 Warning</text>
                  <text x="15" y="103" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="sans-serif">0.0 mm/s</text>

                  {/* Machine Sample Points */}
                  {[
                    { code: 'MILL-01', vib: 1.85, status: 'nominal' },
                    { code: 'MILL-02', vib: 4.50, status: 'critical' },
                    { code: 'TRN-04', vib: 2.90, status: 'warning' },
                    { code: '5AX-02', vib: 1.20, status: 'nominal' },
                    { code: 'GRD-01', vib: 3.40, status: 'warning' },
                    { code: 'HMC-03', vib: 2.10, status: 'nominal' },
                  ].map((item, idx) => {
                    const x = 45 + idx * 54;
                    const barHeight = Math.min((item.vib / 5.0) * 85, 95);
                    const barColor = item.vib >= 4.0 ? '#e11d48' : item.vib >= 2.5 ? '#f59e0b' : '#059669';
                    return (
                      <g key={item.code}>
                        <rect
                          x={x - 12}
                          y={100 - barHeight}
                          width="24"
                          height={barHeight}
                          fill={barColor}
                          opacity="0.85"
                          rx="4"
                        />
                        <text x={x} y={92 - barHeight} fill={barColor} fontSize="9" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                          {item.vib.toFixed(1)}
                        </text>
                        <text x={x} y="114" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {item.code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-5 mt-3 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
                  <span>&lt; 2.5 mm/s: Nominal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                  <span>2.5 - 4.0: Warning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-600" />
                  <span>&gt; 4.0: Urgent Shutdown</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 leading-relaxed">
            <span className="font-bold text-amber-900">What to notice:</span> MILL-02 has spiked to 4.5 mm/s, breaching the ISO critical threshold; collet taper runout must be checked before resuming cuts.
          </div>
        </div>

        {/* Visualization 2: Tool Flank Wear (Vb) Progression Indicator */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-sky-600" />
                  <span>Tool Flank Wear (Vb) Progression Bar</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Physical cutting edge wear measurement in millimeters from active spindle tools.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                Limit: 0.30 mm
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { tool: 'Spindle Tool #04 (End Mill 16mm)', machine: 'CNC-MILL-01', vbMm: 0.18, cycles: 280 },
                { tool: 'Spindle Tool #08 (Roughing Mill 25mm)', machine: 'CNC-MILL-02', vbMm: 0.28, cycles: 490 },
                { tool: 'Turret Tool #02 (Carbide Insert CNMG)', machine: 'CNC-TRN-01', vbMm: 0.14, cycles: 180 },
                { tool: 'Spindle Tool #12 (Ball Nose 10mm)', machine: '5AX-PLT-A-01', vbMm: 0.22, cycles: 340 },
              ].map((t) => {
                const pct = Math.min((t.vbMm / 0.30) * 100, 100);
                const isNearEnd = t.vbMm >= 0.25;
                return (
                  <div key={t.tool} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{t.tool}</span>
                      <span className="text-xs tabular-nums text-slate-600">
                        Vb: <span className={isNearEnd ? 'text-rose-600 font-bold' : 'text-slate-900 font-bold'}>{t.vbMm.toFixed(2)} mm</span> (Target &lt; 0.30 mm)
                      </span>
                    </div>
                    <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          isNearEnd ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Machine: {t.machine}</span>
                      <span>{t.cycles} Machining Cycles Completed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-950 leading-relaxed">
            <span className="font-bold text-sky-900">What to notice:</span> Tool #08 is at 0.28 mm (93% of wear limit); schedule tool insert indexing before the next heavy roughing cycle to prevent part chatter.
          </div>
        </div>
      </div>

      {/* 3.5 Spindle Bearing Thermal History & Motor Load / Electrical Power Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visualization 3: Bearing Temperature History vs 60°C Trip Limit */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-600" />
                  <span>Spindle Bearing Thermal History vs. 60.0°C Trip Limit</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thermocouple readings (°C) across the last 6 inspection cycles for critical machines.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Trip: 60.0°C
              </span>
            </div>

            {/* SVG Line Chart */}
            <div className="mt-4">
              <div className="h-44 w-full relative">
                <svg viewBox="0 0 380 120" className="w-full h-full overflow-visible">
                  {/* Trip limit line (60°C) */}
                  <line x1="25" y1="20" x2="365" y2="20" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
                  {/* Warning line (45°C) */}
                  <line x1="25" y1="52" x2="365" y2="52" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                  {/* Nominal line (25°C) */}
                  <line x1="25" y1="95" x2="365" y2="95" stroke="#cbd5e1" strokeWidth="1.5" />

                  <text x="20" y="23" fill="#e11d48" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">60°C Trip</text>
                  <text x="20" y="55" fill="#d97706" fontSize="8" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">45°C Warning</text>
                  <text x="20" y="98" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="sans-serif">25°C Baseline</text>

                  {/* Temperature trend lines for monitored machines */}
                  {/* MILL-02 (Spiking) */}
                  <path
                    d="M 45 92 L 105 84 L 165 72 L 225 58 L 285 46 L 345 38"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* MILL-01 (Nominal) */}
                  <path
                    d="M 45 94 L 105 92 L 165 91 L 225 93 L 285 90 L 345 91"
                    fill="none"
                    stroke="#0d9488"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Points on MILL-02 */}
                  {[
                    { x: 45, y: 92, val: '26°C' },
                    { x: 105, y: 84, val: '31°C' },
                    { x: 165, y: 72, val: '37°C' },
                    { x: 225, y: 58, val: '43°C' },
                    { x: 285, y: 46, val: '49°C' },
                    { x: 345, y: 38, val: '53°C' },
                  ].map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="3.5" fill="#e11d48" stroke="#ffffff" strokeWidth="1.5" />
                      <text x={p.x} y={p.y - 7} fill="#e11d48" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        {p.val}
                      </text>
                      <text x={p.x} y="112" fill="#64748b" fontSize="7.5" textAnchor="middle" fontFamily="sans-serif">
                        Cycle {i + 1}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="flex items-center justify-center gap-6 mt-3 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-1 rounded bg-teal-600" />
                  <span>MILL-01: Steady 26.5°C</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-1 rounded bg-rose-600" />
                  <span>MILL-02: Escalating (53.0°C)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs text-rose-950 leading-relaxed">
            <span className="font-bold text-rose-900">What to notice:</span> CNC-MILL-02 front bearing has climbed from 26°C to 53°C across 6 cycles, approaching the 60°C trip threshold. Bearing grease repack or spindle rebuild required.
          </div>
        </div>

        {/* Visualization 4: Motor Cut Load & Electrical Power Profile */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Motor Cut Load (%) &amp; Electrical Power Draw (kW)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inverter drive power profile across roughing and finishing passes benchmarked against 85% limit.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                Safe Envelope: &lt; 85%
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { cut: 'Roughing Pass 1 (Steel 4140, 4mm DoC)', loadPct: 78.5, powerKw: 18.2, status: 'nominal' },
                { cut: 'Roughing Pass 2 (Feed Surge Anomaly)', loadPct: 92.4, powerKw: 22.8, status: 'overload' },
                { cut: 'Semi-Finishing Pass (2mm DoC)', loadPct: 54.0, powerKw: 11.5, status: 'nominal' },
                { cut: 'High-Speed Finishing Pass (0.5mm DoC)', loadPct: 38.2, powerKw: 7.4, status: 'nominal' },
              ].map((c) => (
                <div key={c.cut} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{c.cut}</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {c.loadPct}% ({c.powerKw} kW)
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                      style={{ left: '85%' }}
                      title="85% Inverter Safe Limit"
                    />
                    <div
                      style={{ width: `${Math.min(c.loadPct, 100)}%` }}
                      className={`h-full rounded-full transition-all ${
                        c.loadPct > 85 ? 'bg-rose-500' : c.loadPct > 70 ? 'bg-amber-500' : 'bg-purple-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>VFD Current Inrush</span>
                    <span className={c.loadPct > 85 ? 'text-rose-700 font-bold' : 'text-slate-600'}>
                      {c.loadPct > 85 ? 'Inrush Spike Exceeded 85%' : 'Nominal Power Factor'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs text-purple-950 leading-relaxed">
            <span className="font-bold text-purple-900">What to notice:</span> Roughing Pass 2 triggered a 92.4% load inrush (22.8 kW) due to chip jamming. Feed override reduction prevented servo driver trip.
          </div>
        </div>
      </div>

      {/* 4. Assigned Issues & Inspection Checklist (Split Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Assigned Tickets Queue */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-600" />
                <span>Assigned Incident Tickets</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect sensor snapshots, add maintenance progress notes, and close verified repairs.
              </p>
            </div>
            <button
              onClick={() => onNavigate('incidents')}
              className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
            >
              <span>Full Incident Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {myAssignedIncidents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No pending incident tickets assigned. You are caught up on all repairs!
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {myAssignedIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{inc.incidentCode}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs font-semibold text-slate-700">{inc.machineCode}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-500 font-medium">{inc.componentArea}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                        inc.severity === 'Critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : inc.severity === 'High'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {inc.severity} Priority
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 mt-2 font-normal leading-relaxed">{inc.symptomDescription}</p>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div>
                      <span>Vibration: </span>
                      <span className="text-slate-900 font-bold">{inc.measuredVibRms} m/s²</span>
                      <span className="mx-2">·</span>
                      <span>Motor Load: </span>
                      <span className="text-slate-900 font-bold">{inc.measuredMotorLoadPct}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTicketModal(inc)}
                        className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors"
                      >
                        Update Progress
                      </button>
                      <button
                        onClick={() => {
                          onSelectMachine(inc.machineCode);
                          onNavigate('incidents');
                        }}
                        className="px-3 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 transition-colors"
                      >
                        Run AI Diagnosis &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Standard Investigation Steps Checklist */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>Physical Investigation Protocol</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard technical verification steps prior to closing spindle tickets.
              </p>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <label
                onClick={() => toggleCheck('step1')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checkedSteps.step1
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedSteps.step1}
                  onChange={() => {}}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold block text-slate-900">1. Spindle Runout Check</span>
                  <span className="text-[11px] text-slate-500">Sweep tool shank with 0.001mm dial indicator (&lt;0.003mm allowable).</span>
                </div>
              </label>

              <label
                onClick={() => toggleCheck('step2')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checkedSteps.step2
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedSteps.step2}
                  onChange={() => {}}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold block text-slate-900">2. Collet Taper Inspection</span>
                  <span className="text-[11px] text-slate-500">Clean 7:24 taper bore; inspect for fretting or metal chip bite.</span>
                </div>
              </label>

              <label
                onClick={() => toggleCheck('step3')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checkedSteps.step3
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedSteps.step3}
                  onChange={() => {}}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold block text-slate-900">3. Way-Lube Pressure Check</span>
                  <span className="text-[11px] text-slate-500">Verify hydraulic pump discharge pressure is above 14 bar.</span>
                </div>
              </label>

              <label
                onClick={() => toggleCheck('step4')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checkedSteps.step4
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedSteps.step4}
                  onChange={() => {}}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold block text-slate-900">4. Workpiece Surface Profilometry</span>
                  <span className="text-[11px] text-slate-500">Sample surface roughness with contact stylus (Ra &lt; 1.6 µm).</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Lock-Out/Tag-Out (LOTO) protocols must be enforced before opening spindle safety doors.
          </div>
        </div>
      </div>

      {/* 5. Scheduled Maintenance Work Orders */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-600" />
              <span>Shift Maintenance Work Orders</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Preventative maintenance, tooling replacement, and mechanical servicing schedules.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {workOrders.length} Work Orders Assigned
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold bg-slate-50/80">
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Machine</th>
                <th className="py-2.5 px-3">Title / Task</th>
                <th className="py-2.5 px-3">Assignee</th>
                <th className="py-2.5 px-3">Scheduled Time</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 text-sky-700 font-bold">{wo.orderCode || `WO-${String(wo.id).padStart(4, '0')}`}</td>
                  <td className="py-3 px-3 text-slate-900 font-semibold">{wo.machineCode}</td>
                  <td className="py-3 px-3 text-slate-700">{wo.actionTaken || 'Tooling Calibration & Spindle Inspection'}</td>
                  <td className="py-3 px-3 text-slate-600">{wo.technicianName}</td>
                  <td className="py-3 px-3 text-slate-500">{wo.createdAt ? new Date(wo.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Shift A'}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        wo.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : wo.status === 'In_Progress'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {wo.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {wo.status !== 'Completed' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {wo.status === 'Pending' && (
                          <button
                            onClick={() => handleUpdateWorkOrderStatus(wo.id, 'In_Progress')}
                            className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors"
                          >
                            Start
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateWorkOrderStatus(wo.id, 'Completed')}
                          className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors"
                        >
                          Complete
                        </button>
                      </div>
                    ) : (
                      <span className="text-emerald-700 text-xs font-semibold flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* UPDATE PROGRESS MODAL */}
      {/* ------------------------------------------------------------- */}
      {activeTicketModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>Log Maintenance Progress — {activeTicketModal.incidentCode}</span>
              </h3>
              <button
                onClick={() => setActiveTicketModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProgress} className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium block mb-1">Target Unit:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold">
                  {activeTicketModal.machineCode} ({activeTicketModal.componentArea})
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Technical Action Notes:
                </label>
                <textarea
                  required
                  rows={4}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Describe physical inspection findings, dial indicator measurements, or collet torque adjustments..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-3 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTicketModal(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProgress}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {isUpdatingProgress ? 'Saving...' : 'Save Action Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
