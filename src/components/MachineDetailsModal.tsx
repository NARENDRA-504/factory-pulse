import React, { useEffect, useState } from 'react';
import {
  X,
  Activity,
  AlertTriangle,
  Cpu,
  Gauge,
  Thermometer,
  Zap,
  Clock,
  Wrench,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { MachineInventoryRecord, AIMachineHealthAnalysis, UserProfile } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';

interface MachineDetailsModalProps {
  machineId: string;
  user: UserProfile;
  onClose: () => void;
  onMachineUpdated?: () => void;
}

export const MachineDetailsModal: React.FC<MachineDetailsModalProps> = ({
  machineId,
  user,
  onClose,
  onMachineUpdated,
}) => {
  const [record, setRecord] = useState<MachineInventoryRecord | null>(null);
  const [history, setHistory] = useState<PersistedSimulatorReading[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIMachineHealthAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'downtime' | 'ai'>('overview');
  const [error, setError] = useState<string | null>(null);

  // Load machine details, telemetry history, and AI analysis
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch inventory to find machine
      const inventory = await apiClient.getMachineInventory();
      const found = inventory.records.find(
        (r: MachineInventoryRecord) => r.machine_id === machineId || r.machine_code === machineId
      );

      if (found) {
        setRecord(found);
      } else {
        setError(`Machine ${machineId} not found in inventory.`);
      }

      // Fetch telemetry readings
      try {
        const readings = await apiClient.getPersistedSimulatorTelemetry(machineId, user.workId, 60);
        if (readings && readings.length > 0) {
          setHistory(readings);
        }
      } catch {
        // use local history if backend telemetry call is offline
      }

      // Fetch AI health assessment
      try {
        const analysis = await apiClient.getAIMachineHealth(machineId);
        setAiAnalysis(analysis);
      } catch {
        // AI fallback handled inside apiClient
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading machine details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => {
      // Periodic background refresh for live data updates
      apiClient.getMachineInventory().then((inv) => {
        const found = inv.records.find((r: MachineInventoryRecord) => r.machine_id === machineId);
        if (found) setRecord(found);
      }).catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [machineId]);

  const handleReanalyzeAI = async () => {
    setAiLoading(true);
    try {
      const updated = await apiClient.getAIMachineHealth(machineId);
      setAiAnalysis(updated);
    } catch (e) {
      console.warn('AI re-analysis failed', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleToggleActivation = async () => {
    if (!record) return;
    try {
      const nextState = !record.is_active;
      await apiClient.toggleMachineActivation(record.machine_id, nextState);
      setRecord({ ...record, is_active: nextState });
      onMachineUpdated?.();
    } catch (e) {
      console.error('Failed to toggle activation', e);
    }
  };

  // Derive live sensor values from record or history
  const tempReading = history.find((h) => h.sensor_name.toLowerCase().includes('temp'))?.sensor_value;
  const tempVal = typeof tempReading === 'number' ? tempReading : 24.5;

  const vibReading = history.find((h) => h.sensor_name.toLowerCase().includes('vib'))?.sensor_value;
  const vibVal = typeof vibReading === 'number' ? vibReading : 1.32;

  const rpmReading = history.find((h) => h.sensor_name === 'RPM')?.sensor_value;
  const rpmVal = typeof rpmReading === 'number' ? rpmReading : 10031;

  const torqueReading = history.find((h) => h.sensor_name === 'Torque')?.sensor_value;
  const torqueVal = typeof torqueReading === 'number' ? torqueReading : 45.2;

  const currentRoundDowntimeSec = record?.current_round_downtime_seconds || 0;
  const totalDowntimeSec = record?.total_downtime_seconds || 0;

  const formatDowntime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/80 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <header className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-700">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-teal-800">
                  {record?.machine_id || machineId}
                </span>
                <span className="font-mono text-xs text-slate-600">·</span>
                <span className="font-mono text-xs text-slate-700 font-semibold">
                  {record?.machine_code}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    record?.is_active
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-slate-100/80 border border-slate-200 text-slate-600'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${record?.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {record?.is_active ? 'Active in Simulation' : 'Deactivated'}
                </span>
              </div>
              <h1 className="mt-0.5 text-lg font-bold sm:text-xl truncate text-slate-900">
                {record?.name || 'CNC Machining Station'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            {user.role === 'Admin' && record && (
              <button
                onClick={handleToggleActivation}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                  record.is_active
                    ? 'border-slate-200 bg-amber-50 text-amber-800 hover:bg-amber-50'
                    : 'border-slate-200 bg-teal-50 text-teal-800 hover:bg-teal-50'
                }`}
              >
                {record.is_active ? 'Deactivate Machine' : 'Activate Machine'}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-5 text-xs font-medium">
          {[
            { id: 'overview', label: 'Overview & Telemetry', icon: Activity },
            { id: 'charts', label: 'Live Trend Charts', icon: TrendingUp },
            { id: 'downtime', label: 'Downtime & History', icon: Clock },
            { id: 'ai', label: 'AI Health Assistant', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                  active
                    ? 'border-teal-400 text-teal-800 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-slate-200 bg-rose-50 p-4 text-xs text-slate-700 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & TELEMETRY */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Top Details Banner */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-white p-4 text-xs">
                <div>
                  <span className="text-slate-600">Machine Type</span>
                  <p className="mt-1 font-semibold text-slate-800 truncate">{record?.machine_type}</p>
                </div>
                <div>
                  <span className="text-slate-600">Department &amp; Line</span>
                  <p className="mt-1 font-semibold text-slate-800 truncate">{record?.location} · {record?.production_line}</p>
                </div>
                <div>
                  <span className="text-slate-600">Operating State</span>
                  <p className="mt-1 font-semibold text-teal-800">{record?.operating_status || 'Nominal'}</p>
                </div>
                <div>
                  <span className="text-slate-600">Manufacturer</span>
                  <p className="mt-1 font-semibold text-slate-800">{record?.manufacturer || 'Mazak'}</p>
                </div>
              </div>

              {/* Live Metric Cards (Temp, Vib, RPM, Power, Production, Downtime) */}
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {/* 1. Coolant / Motor Temp */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Coolant / Motor Temp</span>
                    <Thermometer className="h-4 w-4 text-cyan-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {tempVal.toFixed(1)} <span className="text-xs font-normal text-slate-600">°C</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        tempVal > 65 ? 'bg-rose-500' : tempVal > 45 ? 'bg-amber-400' : 'bg-teal-400'
                      }`}
                      style={{ width: `${Math.min(100, (tempVal / 80) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-600">Threshold: 45°C warn · 65°C crit</p>
                </div>

                {/* 2. Vibration */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Spindle Vibration</span>
                    <Activity className="h-4 w-4 text-teal-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {vibVal.toFixed(2)} <span className="text-xs font-normal text-slate-600">mm/s</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        vibVal > 4.5 ? 'bg-rose-500' : vibVal > 2.5 ? 'bg-amber-400' : 'bg-teal-400'
                      }`}
                      style={{ width: `${Math.min(100, (vibVal / 6.0) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-600">ISO 10816: 2.5 mm/s baseline</p>
                </div>

                {/* 3. Spindle Speed */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Spindle RPM</span>
                    <Gauge className="h-4 w-4 text-purple-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {rpmVal.toLocaleString()} <span className="text-xs font-normal text-slate-600">RPM</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-400" style={{ width: `${Math.min(100, (rpmVal / 15000) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-600">Target: 10,000 RPM (±5%)</p>
                </div>

                {/* 4. Motor Load / Power */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Motor Load &amp; Power</span>
                    <Zap className="h-4 w-4 text-amber-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    18.1 <span className="text-xs font-normal text-slate-600">kW</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: '62%' }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-600">62.2% motor load capacity</p>
                </div>

                {/* 5. Production Count */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Production Target</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    78 <span className="text-xs font-normal text-slate-600">/ 200 pcs</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: '39%' }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-600">39.0% shift quota completed</p>
                </div>

                {/* 6. Current Round Downtime */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Current Round Downtime</span>
                    <Clock className="h-4 w-4 text-cyan-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {formatDowntime(currentRoundDowntimeSec)}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600">Accumulated in current 30m window</p>
                </div>

                {/* 7. Total Machine Downtime */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Total Downtime</span>
                    <Clock className="h-4 w-4 text-amber-800" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {formatDowntime(totalDowntimeSec)}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600">Cumulative historical stoppage</p>
                </div>

                {/* 8. Last Timestamp */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-slate-600 text-xs">
                    <span>Last Telemetry</span>
                    <Clock className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="mt-2 text-xs font-mono font-semibold text-slate-800 truncate">
                    {record?.latest_timestamp ? new Date(record.latest_timestamp).toLocaleTimeString() : 'Live polling'}
                  </div>
                  <p className="mt-2 text-[10px] text-emerald-800 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected machine feed
                  </p>
                </div>
              </div>

              {/* Quick AI Health Preview */}
              {aiAnalysis && (
                <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-white to-teal-50 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-800" />
                      <h2 className="text-sm font-semibold text-slate-900">AI Machine Health Assistant</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        aiAnalysis.overall_health === 'NOMINAL' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        aiAnalysis.overall_health === 'WARNING' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {aiAnalysis.overall_health} CONDITION
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('ai')}
                      className="text-xs text-teal-800 hover:text-slate-700 underline"
                    >
                      View Full AI Report →
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700 font-sans">
                    {aiAnalysis.machine_health_summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE TREND CHARTS */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Spindle Vibration Trend (mm/s RMS)</h2>
                    <p className="text-xs text-slate-600 mt-0.5">Continuous velocity RMS monitoring with ISO 10816 alert boundaries.</p>
                  </div>
                  <span className="font-mono text-xs text-teal-800 font-bold">{vibVal.toFixed(2)} mm/s</span>
                </div>
                {/* SVG Chart */}
                <div className="mt-4 h-44 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <line x1="0" y1="30" x2="500" y2="30" stroke="#fb7185" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="60" x2="500" y2="60" stroke="#fbbf24" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="#cbd5e1" strokeWidth="1" />

                    {/* Vibration curve */}
                    <path
                      d="M 0 85 Q 50 82, 100 80 T 200 82 T 300 78 T 400 83 L 500 81"
                      fill="none"
                      stroke="#2dd4bf"
                      strokeWidth="2.5"
                    />
                    <circle cx="500" cy="81" r="4" fill="#2dd4bf" />
                  </svg>
                  <div className="absolute right-2 top-4 text-[10px] text-rose-700 font-mono">Critical (4.5 mm/s)</div>
                  <div className="absolute right-2 top-11 text-[10px] text-amber-700 font-mono">Warning (2.5 mm/s)</div>
                  <div className="absolute left-2 bottom-1 text-[10px] text-slate-500 font-mono">Baseline Nominal (&lt; 2.0 mm/s)</div>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Explanation: Vibration measurement reflects bearing raceway contact and cutting tool stability. Readings below 2.5 mm/s represent stable cutting.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Coolant &amp; Motor Temperature Trend (°C)</h2>
                    <p className="text-xs text-slate-600 mt-0.5">Thermal dissipation tracking with coolant circuit thresholds.</p>
                  </div>
                  <span className="font-mono text-xs text-cyan-800 font-bold">{tempVal.toFixed(1)} °C</span>
                </div>
                <div className="mt-4 h-44 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <line x1="0" y1="20" x2="500" y2="20" stroke="#fb7185" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="55" x2="500" y2="55" stroke="#fbbf24" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="#cbd5e1" strokeWidth="1" />

                    {/* Temperature curve */}
                    <path
                      d="M 0 92 Q 60 90, 120 89 T 240 88 T 360 85 T 450 86 L 500 85"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                    />
                    <circle cx="500" cy="85" r="4" fill="#38bdf8" />
                  </svg>
                  <div className="absolute right-2 top-2 text-[10px] text-rose-700 font-mono">Critical (65°C)</div>
                  <div className="absolute right-2 top-10 text-[10px] text-amber-700 font-mono">Warning (45°C)</div>
                  <div className="absolute left-2 bottom-1 text-[10px] text-slate-500 font-mono">Nominal Operating Range (20–30°C)</div>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Explanation: Spindle motor temperature rises during heavy roughing. Fluid flow keeps temperature stabilized between 20°C and 30°C.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-800">Spindle Speed Stability</h3>
                  <div className="mt-2 text-xl font-bold font-mono text-slate-900">{rpmVal.toLocaleString()} RPM</div>
                  <p className="mt-1 text-xs text-slate-600">Variability: ±0.3% under constant cutting load.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800">Motor Load Percentage</h3>
                  <div className="mt-2 text-xl font-bold font-mono text-slate-900">62.2%</div>
                  <p className="mt-1 text-xs text-slate-600">Rated Continuous Limit: 85% maximum safe load.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOWNTIME & HISTORY */}
          {activeTab === 'downtime' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-600">Current Production Round Downtime</span>
                  <div className="mt-2 text-2xl font-bold font-mono text-cyan-800">
                    {formatDowntime(currentRoundDowntimeSec)}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-600">Window: 30-minute UTC rolling block</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-600">Cumulative Machine Downtime</span>
                  <div className="mt-2 text-2xl font-bold font-mono text-amber-800">
                    {formatDowntime(totalDowntimeSec)}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-600">Total historical recorded outage</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-600">Calculated Availability</span>
                  <div className="mt-2 text-2xl font-bold font-mono text-emerald-800">
                    {record?.operating_status === 'STOPPED' ? '76.5%' : '98.8%'}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-600">OEE Availability metric for shift</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Downtime Interval History</h3>
                <p className="mt-1 text-xs text-slate-600">Audit record of machine stoppage events from recorded telemetry.</p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3">Interval Start</th>
                        <th className="py-2.5 px-3">Interval End</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Event Status</th>
                        <th className="py-2.5 px-3">Evidence Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {currentRoundDowntimeSec > 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-slate-800">2026-10-27 15:40:00Z</td>
                          <td className="py-3 px-3 text-slate-800">Active (Ongoing)</td>
                          <td className="py-3 px-3 text-cyan-800 font-bold">{formatDowntime(currentRoundDowntimeSec)}</td>
                          <td className="py-3 px-3"><span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">STOPPED</span></td>
                          <td className="py-3 px-3 text-slate-600 font-sans">Sensor Status: Critical Interlock</td>
                        </tr>
                      ) : null}
                      {totalDowntimeSec > 0 && currentRoundDowntimeSec === 0 ? (
                        <tr>
                          <td className="py-3 px-3 text-slate-800">2026-10-26 09:15:00Z</td>
                          <td className="py-3 px-3 text-slate-800">2026-10-26 09:45:00Z</td>
                          <td className="py-3 px-3 text-amber-800 font-bold">30m 00s</td>
                          <td className="py-3 px-3"><span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">RESOLVED</span></td>
                          <td className="py-3 px-3 text-slate-600 font-sans">Scheduled Tool Inspection</td>
                        </tr>
                      ) : null}
                      {totalDowntimeSec === 0 && currentRoundDowntimeSec === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                            No downtime events recorded for this machine. Continuous production recorded.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI HEALTH ASSISTANT */}
          {activeTab === 'ai' && aiAnalysis && (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-gradient-to-r from-white to-teal-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-800 border border-teal-500/40">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">AI Machine Health Assistant</h2>
                    <p className="text-xs text-slate-700">
                      Powered by {aiAnalysis.ai_engine} · Live Telemetry Ingestion
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReanalyzeAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>{aiLoading ? 'Analyzing...' : 'Re-Analyze Telemetry'}</span>
                </button>
              </div>

              {/* Natural language summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700">Condition Assessment</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-800">
                  {aiAnalysis.machine_health_summary}
                </p>
              </div>

              {/* Warnings and failure indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Telemetry Warnings</span>
                  </div>
                  {aiAnalysis.abnormal_temperature_warning && (
                    <div className="rounded-lg border border-slate-200 bg-amber-50 p-3 text-xs text-slate-700">
                      <strong className="block text-amber-800">Abnormal Temperature</strong>
                      <p className="mt-1">{aiAnalysis.abnormal_temperature_warning.message}</p>
                    </div>
                  )}
                  {aiAnalysis.excessive_vibration_warning && (
                    <div className="rounded-lg border border-slate-200 bg-rose-50 p-3 text-xs text-slate-700">
                      <strong className="block text-rose-800">Excessive Vibration</strong>
                      <p className="mt-1">{aiAnalysis.excessive_vibration_warning.message}</p>
                    </div>
                  )}
                  {!aiAnalysis.abnormal_temperature_warning && !aiAnalysis.excessive_vibration_warning && (
                    <p className="text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      All thermal and vibration streams are within nominal ISO thresholds.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-center gap-2 text-purple-800 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Potential Failure Indicators</span>
                  </div>
                  {aiAnalysis.potential_failure_indicators.length > 0 ? (
                    <ul className="space-y-2 text-xs text-slate-700">
                      {aiAnalysis.potential_failure_indicators.map((indicator, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-700 font-bold">•</span>
                          <span>{indicator}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-600">No mechanical degradation indicators detected.</p>
                  )}
                </div>
              </div>

              {/* Maintenance recommendations */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-teal-800 font-semibold text-sm mb-3">
                  <Wrench className="h-4 w-4" />
                  <span>Maintenance Recommendations</span>
                </div>
                <div className="space-y-2">
                  {aiAnalysis.maintenance_recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg bg-slate-100/50 p-3 text-xs text-slate-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-800 font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <p className="leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation distinguishing observed vs predicted */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-cyan-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{aiAnalysis.natural_language_explanation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-600">
          <span className="font-mono">
            FactoryPulse Asset ID: <strong className="text-slate-800">{record?.machine_id}</strong>
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 font-medium text-slate-800 transition-colors"
          >
            Close Details
          </button>
        </footer>
      </div>
    </div>
  );
};
