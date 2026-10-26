import React, { useState, useEffect } from 'react';
import { Machine, TelemetryReading, UserProfile, UserRole } from '../types';
import { apiClient } from '../services/apiClient';
import { SEED_MACHINES } from '../data/seedData';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { MeterCard } from '../components/FactoryPulseDashboard';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Info,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Zap,
  Radio,
  Sliders,
  Search,
  Filter,
} from 'lucide-react';

interface MachineConditionViewProps {
  currentUser: UserProfile;
  machines: Machine[];
  selectedMachineCode: string;
  onSelectMachine: (code: string) => void;
  onCreateIncidentFromSnapshot: (machineCode: string, snapshot: TelemetryReading, suggestedSymptom: string) => void;
}

export const MachineConditionView: React.FC<MachineConditionViewProps> = ({
  currentUser,
  machines,
  selectedMachineCode,
  onSelectMachine,
  onCreateIncidentFromSnapshot,
}) => {
  const currentMachine =
    (machines && machines.length > 0
      ? machines.find((m) => m.code === selectedMachineCode) || machines[0]
      : null) || SEED_MACHINES[0];
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeAnomaly, setActiveAnomaly] = useState<string | null>(null);
  const [injectionSuccessMessage, setInjectionSuccessMessage] = useState<string | null>(null);

  // Multi-tier filtering for 400 CNC machines
  const [plantFilter, setPlantFilter] = useState<string>('ALL');
  const [shopFloorFilter, setShopFloorFilter] = useState<string>('ALL');
  const [machineTypeFilter, setMachineTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const uniquePlants = Array.from(new Set(machines.map((m) => m.plant).filter(Boolean))) as string[];
  const uniqueFloors = Array.from(
    new Set(
      machines
        .filter((m) => plantFilter === 'ALL' || m.plant === plantFilter)
        .map((m) => m.shopFloor)
        .filter(Boolean)
    )
  ) as string[];
  const uniqueTypes = Array.from(new Set(machines.map((m) => m.machineType).filter(Boolean))) as string[];

  const filteredMachines = machines.filter((m) => {
    if (plantFilter !== 'ALL' && m.plant !== plantFilter) return false;
    if (shopFloorFilter !== 'ALL' && m.shopFloor !== shopFloorFilter) return false;
    if (machineTypeFilter !== 'ALL' && m.machineType !== machineTypeFilter) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const match =
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        (m.machineId && m.machineId.toLowerCase().includes(q)) ||
        (m.machineCode && m.machineCode.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.code && m.code.toLowerCase().includes(q)) ||
        (m.model && m.model.toLowerCase().includes(q)) ||
        (m.manufacturer && m.manufacturer.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Initialize and run sliding telemetry stream
  useEffect(() => {
    // Start with one current snapshot. Earlier samples are collected at the real
    // stream interval below, so the chart never fabricates a history on load.
    setTelemetryHistory([apiClient.getLiveTelemetrySnapshot(currentMachine.code, activeAnomaly || undefined)]);
  }, [currentMachine.code, activeAnomaly]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTelemetryHistory((prev) => {
        const nextSnap = apiClient.getLiveTelemetrySnapshot(
          currentMachine.code,
          activeAnomaly || undefined
        );
        const updated = [...prev.slice(-24), nextSnap];
        return updated;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, activeAnomaly, currentMachine.code]);

  const latest = telemetryHistory[telemetryHistory.length - 1] || apiClient.getLiveTelemetrySnapshot(currentMachine.code);

  const canInject = currentUser.role === 'Supervisor' || currentUser.role === 'Maintenance';

  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const handleInjectAnomaly = async (type: string, label: string) => {
    try {
      setActiveAnomaly(type);
      const injectedReading = await apiClient.injectSimulatorTelemetry(currentMachine.code, type, currentUser.role);
      setTelemetryHistory((prev) => [...prev.slice(-24), injectedReading]);
      setInjectionSuccessMessage(`Simulated anomaly "${label}" successfully injected into sim_telemetry_events table.`);
      setTimeout(() => setInjectionSuccessMessage(null), 5000);
    } catch (err: any) {
      setActionErrorMessage(err.message);
      setTimeout(() => setActionErrorMessage(null), 5000);
    }
  };

  const handleResetNominal = () => {
    setActiveAnomaly(null);
    setInjectionSuccessMessage('Sensor stream reset to nominal empirical baseline.');
    setTimeout(() => setInjectionSuccessMessage(null), 3000);
  };

  // Provisional Statistical Baseline threshold (Dataset 3 nominal 95th percentile baseline)
  const PROVISIONAL_VIB_BASELINE = 4.2; // m/s²
  const conditionState = latest.vibRms > PROVISIONAL_VIB_BASELINE || latest.motorLoadPct > 90 || latest.coolantTempC > 45
    ? 'Critical'
    : latest.vibRms > 3.2 || latest.motorLoadPct > 80 || latest.coolantTempC > 35
      ? 'Needs a check'
      : 'Nominal';
  const conditionCopy = conditionState === 'Critical'
    ? 'A reading is above its high alert threshold. Review the meters and follow your site response procedure.'
    : conditionState === 'Needs a check'
      ? 'At least one reading is near or above its watch level. Keep an eye on the live trend.'
      : 'Vibration, coolant temperature, and motor load are within their displayed watch levels.';
  const formatReadingTime = (timestamp?: string) => timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="space-y-5">
      {/* 1. Top Machine Selector, Filters & Status Strip */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-800/60 text-teal-400">
              <Cpu className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-semibold">
                  Equipment Station
                </span>
                <span className="text-slate-600">·</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 border border-slate-700 text-teal-300">
                  {currentMachine.machineId || 'MCH-001'}
                </span>
                <span className="text-xs text-slate-400 font-mono font-semibold">
                  {currentMachine.machineCode || currentMachine.code}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentMachine.plant || currentMachine.lineId}
                </span>
              </div>
              <h1 className="font-display font-bold text-lg sm:text-xl text-white tracking-tight mt-1">
                {currentMachine.displayName || currentMachine.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                <span className="text-slate-300 font-medium">{currentMachine.machineType}</span>
                <span>·</span>
                <span>{currentMachine.shopFloor || 'Precision Floor'}</span>
                <span>·</span>
                <span>{currentMachine.productionLine || currentMachine.lineId}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Streaming Toggle */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors border ${
                isPlaying
                  ? 'bg-teal-950/50 border-teal-700/80 text-teal-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={isPlaying ? 'Pause Sensor Stream' : 'Resume Sensor Stream'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-teal-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isPlaying ? 'Live Streaming' : 'Paused'}</span>
            </button>

            <ProvenanceBadge provenance={latest.dataProvenance} />
          </div>
        </div>

        {/* Filter Bar for 400 Machines (Plant, Shop Floor, Machine Type, Status, Search) */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              <span>Filters:</span>
            </div>

            {/* Plant Filter */}
            <select
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setShopFloorFilter('ALL');
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-hidden focus:border-teal-500"
              title="Filter by Plant"
            >
              <option value="ALL">All Plants (4)</option>
              {uniquePlants.map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>

            {/* Shop Floor Filter */}
            <select
              value={shopFloorFilter}
              onChange={(e) => setShopFloorFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-hidden focus:border-teal-500"
              title="Filter by Shop Floor"
            >
              <option value="ALL">All Shop Floors ({uniqueFloors.length})</option>
              {uniqueFloors.map((floor) => (
                <option key={floor} value={floor}>
                  {floor}
                </option>
              ))}
            </select>

            {/* Machine Type Filter */}
            <select
              value={machineTypeFilter}
              onChange={(e) => setMachineTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-hidden focus:border-teal-500"
              title="Filter by Machine Type"
            >
              <option value="ALL">All Types (7)</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-hidden focus:border-teal-500"
              title="Filter by Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="Nominal">Nominal</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
              <option value="Offline">Offline</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, name, model..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-500 rounded-lg pl-8 pr-2.5 py-1.5 font-mono text-xs focus:outline-hidden focus:border-teal-500 w-44 sm:w-56"
              />
            </div>
          </div>

          {/* Machine Target Selector Dropdown */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              Select CNC Unit:
            </span>
            <select
              value={selectedMachineCode}
              onChange={(e) => onSelectMachine(e.target.value)}
              className="bg-slate-900 border border-teal-700/70 text-xs font-mono text-teal-300 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-teal-400 max-w-xs sm:max-w-md truncate"
            >
              {filteredMachines.map((m) => (
                <option key={m.machineId || m.code} value={m.code || m.machineCode}>
                  {m.displayName || m.name} ({m.machineId || m.code})
                </option>
              ))}
            </select>
            <span className="text-[10px] font-mono text-slate-500">
              ({filteredMachines.length}/{machines.length})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Primary Telemetry Gauges (Strict unit separation: motor_power_kw in kW, motor_load_pct in %) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
        {/* Gauge 1: Spindle Speed */}
        <div className="p-3.5 bg-[#0c1424] border border-slate-800/80 rounded-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Spindle Speed</span>
            <span className="text-[10px] text-slate-500">RPM</span>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-slate-100 font-mono-numbers">
            {latest.spindleRpm.toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">Live spindle reading</div>
        </div>

        {/* Gauge 2: Feed Rate */}
        <div className="p-3.5 bg-[#0c1424] border border-slate-800/80 rounded-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Feed Rate</span>
            <span className="text-[10px] text-slate-500">mm/min</span>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-slate-100 font-mono-numbers">
            {latest.feedRateMmpm}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">Continuous feed axis</div>
        </div>

        {/* Shared instrument meter also used on the Operator dashboard */}
        <MeterCard label="Vibration RMS" value={latest.vibRms} unit="m/s²" warningAt={3.2} limit={PROVISIONAL_VIB_BASELINE} limitLabel="95th pct. baseline" scaleMax={6.3} digits={2} icon={<Activity className="h-4 w-4"/>}/>

        {/* Gauge 4: Motor Power in kW (SEPARATED) */}
        <div className="p-3.5 bg-[#0c1424] border border-slate-800/80 rounded-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Motor Power</span>
            <span className="text-[10px] text-teal-400 font-bold">kW</span>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-teal-300 font-mono-numbers">
            {latest.motorPowerKw.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">VFD active power draw</div>
        </div>

        <MeterCard label="Motor Load" value={latest.motorLoadPct} unit="%" warningAt={80} limit={85} limitLabel="Load limit" scaleMax={100} icon={<Zap className="h-4 w-4"/>}/>

        <MeterCard label="Coolant Temp" value={latest.coolantTempC} unit="°C" warningAt={30} limit={35} limitLabel="Safe limit" scaleMax={52.5} icon={<Flame className="h-4 w-4"/>}/>
      </div>

      <section className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${conditionState === 'Critical' ? 'border-rose-800/70 bg-rose-950/25' : conditionState === 'Needs a check' ? 'border-amber-800/70 bg-amber-950/20' : 'border-teal-900/70 bg-teal-950/20'}`} aria-live="polite">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${conditionState === 'Critical' ? 'bg-rose-950 text-rose-300' : conditionState === 'Needs a check' ? 'bg-amber-950 text-amber-300' : 'bg-teal-950 text-teal-300'}`}><Activity className="h-4 w-4"/></span>
          <div><p className="text-xs font-semibold text-slate-100">Live condition · {conditionState}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-400">{conditionCopy}</p></div>
        </div>
        <span className="shrink-0 text-[10px] font-mono text-slate-500">SIMULATOR READINGS · {telemetryHistory.length} samples collected</span>
      </section>

      {/* 3. Live Time-Series Chart with Provisional Statistical Baseline */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <h2 className="font-display font-bold text-base text-white">
                Sliding Time-Series Vibration RMS &amp; Motor Power Stream
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live simulator samples at 1.5-second intervals. Vibration and power are drawn on their own scales.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-teal-400"></span>
              <span className="text-slate-300">Vibration RMS (m/s²)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-cyan-500"></span>
              <span className="text-slate-300">Power (kW)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed border-amber-500"></span>
              <span className="text-amber-400">Provisional Stat Baseline ({PROVISIONAL_VIB_BASELINE} m/s²)</span>
            </div>
          </div>
        </div>

        {/* Visual Line / Bar Graph Representation */}
        <div className="h-56 bg-slate-950/70 border border-slate-800/80 rounded-lg p-4 relative flex flex-col justify-between overflow-hidden">
          {telemetryHistory.length > 1 ? <>
          {/* Baseline Guideline Overlay */}
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/70 z-10 pointer-events-none"
            style={{ bottom: `${(PROVISIONAL_VIB_BASELINE / 8.0) * 100}%` }}
          >
            <span className="absolute right-2 -top-5 text-[10px] font-mono text-amber-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-900/60">
              Provisional Statistical Baseline: Nominal 95th Percentile ({PROVISIONAL_VIB_BASELINE} m/s²)
            </span>
          </div>

          {/* SVG Multi-Line Chart */}
          <div className="relative w-full h-full flex items-end">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Vibration Polyline */}
              <polyline
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="2.5"
                points={telemetryHistory
                  .map((snap, idx) => {
                    const x = (idx / (telemetryHistory.length - 1 || 1)) * 100;
                    const y = 100 - (snap.vibRms / 8.0) * 100;
                    return `${x},${Math.max(5, Math.min(95, y))}`;
                  })
                  .join(' ')}
              />
              {/* Power Polyline */}
              <polyline
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.8"
                strokeDasharray="2,2"
                points={telemetryHistory
                  .map((snap, idx) => {
                    const x = (idx / (telemetryHistory.length - 1 || 1)) * 100;
                    const y = 100 - (snap.motorPowerKw / 25.0) * 100;
                    return `${x},${Math.max(5, Math.min(95, y))}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>

          {/* Time scale footer uses the actual oldest and latest sample times. */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-850">
            <span>{formatReadingTime(telemetryHistory[0]?.timestamp)}</span>
            <span>Vibration scale: 0–8 m/s²</span>
            <span>Power scale: 0–25 kW</span>
            <span className="text-teal-300 font-semibold">Now · {formatReadingTime(latest.timestamp)}</span>
          </div>
          </> : <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Activity className="h-6 w-6 text-teal-400"/>
            <p className="text-sm font-semibold text-slate-200">Collecting live samples</p>
            <p className="max-w-md text-xs leading-relaxed text-slate-400">The trend will appear after the next simulator sample. Current readings are shown in the meters above.</p>
          </div>}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Note: The 4.2 m/s² line is the dataset’s nominal 95th-percentile baseline, not a universal failure limit.</span>
          </div>
          <span className="text-slate-500">Dataset 3 Baseline Reference</span>
        </div>
      </div>

      {/* 4. Interactive AI Telemetry Injector (Demonstration Tool for V1) */}
      <div className="bg-[#0c1424] border border-amber-900/40 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h2 className="font-display font-bold text-base text-white">
                Interactive AI Telemetry Injector (Demonstration Tool)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate machine anomalies to demonstrate live threshold alerting and incident reporting workflows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800 uppercase">
              Target: sim_telemetry_events Table
            </span>
          </div>
        </div>

        {injectionSuccessMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{injectionSuccessMessage}</span>
          </div>
        )}

        {actionErrorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionErrorMessage}</span>
          </div>
        )}

        {/* Injector Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleInjectAnomaly('HIGH_CHATTER', 'High Spindle Chatter Resonance')}
            disabled={!canInject}
            className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              activeAnomaly === 'HIGH_CHATTER'
                ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-md'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div>
              <div className="text-xs font-semibold text-white">1. High Spindle Chatter</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Injects radial vibration spike (&gt;5.4 m/s²) with tool engagement resonance.
              </div>
            </div>
            <div className="mt-3 text-[10px] font-mono text-amber-400">Triggers Chatter Alert</div>
          </button>

          <button
            onClick={() => handleInjectAnomaly('THERMAL_OVERLOAD', 'Z-Axis Servo Thermal Surge')}
            disabled={!canInject}
            className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              activeAnomaly === 'THERMAL_OVERLOAD'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-md'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div>
              <div className="text-xs font-semibold text-white">2. Z-Axis Thermal Overload</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Surges motor load to 104% and drives coolant temperature to 56°C.
              </div>
            </div>
            <div className="mt-3 text-[10px] font-mono text-rose-400">Triggers Critical Overload</div>
          </button>

          <button
            onClick={() => handleInjectAnomaly('FEED_SPIKE', 'Feed Rate Inrush Surge')}
            disabled={!canInject}
            className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              activeAnomaly === 'FEED_SPIKE'
                ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-md'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div>
              <div className="text-xs font-semibold text-white">3. Feed Rate Inrush Spike</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Forces feed rate surge to 850 mm/min, inducing cutting force deviation.
              </div>
            </div>
            <div className="mt-3 text-[10px] font-mono text-amber-400">Triggers Feed Deviation</div>
          </button>

          <button
            onClick={handleResetNominal}
            className="p-3.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-850 text-slate-200 text-left transition-all flex flex-col justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                Reset Nominal Baseline
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Restores standard nominal cut cycle conditions from Dataset 3 empirical baseline.
              </div>
            </div>
            <div className="mt-3 text-[10px] font-mono text-teal-300">Nominal Operation</div>
          </button>
        </div>

        {/* Action Button: Create Incident from Injected Anomaly */}
        {latest.dataProvenance === 'SIMULATED' && (
          <div className="mt-4 p-4 rounded-lg bg-amber-950/40 border border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Active Anomaly Snapshot Captured
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Vibration: {latest.vibRms} m/s² · Motor Load: {latest.motorLoadPct}% · Power: {latest.motorPowerKw} kW ({latest.injectedAnomalyType || 'Simulated'})
              </p>
            </div>
            <button
              onClick={() =>
                onCreateIncidentFromSnapshot(
                  currentMachine.code,
                  latest,
                  `Automated trigger from simulated telemetry: ${latest.injectedAnomalyType || 'Threshold breach'}`
                )
              }
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shrink-0 shadow-md font-mono"
            >
              <AlertTriangle className="w-4 h-4" />
              File Incident Report from this Snapshot
            </button>
          </div>
        )}

        {!canInject && (
          <div className="mt-3 text-[11px] font-mono text-slate-500">
            * Note: Simulated telemetry injection is restricted to Supervisor or Maintenance roles.
          </div>
        )}
      </div>
    </div>
  );
};
