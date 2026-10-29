import React, { useState } from 'react';
import { Machine, Incident, MachineStatus } from '../types';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Layers,
  Search,
  Zap,
  Filter,
} from 'lucide-react';

interface FactoryLineOverviewProps {
  machines: Machine[];
  incidents: Incident[];
  selectedMachineCode: string;
  onSelectMachine: (code: string) => void;
  onOpenMachineDrawer: (machine: Machine) => void;
  activeAnomalyMachineCode?: string | null;
  activeAnomalyType?: string | null;
}

export const FactoryLineOverview: React.FC<FactoryLineOverviewProps> = ({
  machines = [],
  incidents = [],
  selectedMachineCode = 'CNC-MILL-01',
  onSelectMachine,
  onOpenMachineDrawer,
  activeAnomalyMachineCode,
  activeAnomalyType,
}) => {
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedPlant, setSelectedPlant] = useState<string>('ALL');
  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [onlyWithIncidents, setOnlyWithIncidents] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number>(32);

  const safeMachines = machines || [];
  const safeIncidents = incidents || [];

  // Extract unique taxonomies and lines
  const lines = Array.from(new Set(safeMachines.map((m) => m.lineId).filter(Boolean))) as string[];
  const uniquePlants = Array.from(new Set(safeMachines.map((m) => m.plant).filter(Boolean))) as string[];
  const uniqueFloors = Array.from(
    new Set(
      safeMachines
        .filter((m) => selectedPlant === 'ALL' || m.plant === selectedPlant)
        .map((m) => m.shopFloor)
        .filter(Boolean)
    )
  ) as string[];
  const uniqueTypes = Array.from(new Set(safeMachines.map((m) => m.machineType).filter(Boolean))) as string[];

  // Filter machines
  const filteredMachines = safeMachines.filter((machine) => {
    if (selectedLine !== 'ALL' && machine.lineId !== selectedLine && machine.productionLine !== selectedLine) return false;
    if (selectedPlant !== 'ALL' && machine.plant !== selectedPlant) return false;
    if (selectedFloor !== 'ALL' && machine.shopFloor !== selectedFloor) return false;
    if (selectedType !== 'ALL' && machine.machineType !== selectedType) return false;
    if (selectedStatus !== 'ALL' && machine.status !== selectedStatus) return false;

    const machineIncidents = safeIncidents.filter(
      (i) => i.machineCode === machine.code && i.status !== 'Closed'
    );
    if (onlyWithIncidents && machineIncidents.length === 0) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        machine.code.toLowerCase().includes(q) ||
        (machine.machineCode && machine.machineCode.toLowerCase().includes(q)) ||
        (machine.machineId && machine.machineId.toLowerCase().includes(q)) ||
        (machine.name && machine.name.toLowerCase().includes(q)) ||
        (machine.displayName && machine.displayName.toLowerCase().includes(q)) ||
        (machine.model && machine.model.toLowerCase().includes(q)) ||
        (machine.manufacturer && machine.manufacturer.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Calculate fleet summaries
  const totalCount = safeMachines.length;
  const nominalCount = safeMachines.filter((m) => m.status === 'Nominal').length;
  const warningCount = safeMachines.filter((m) => m.status === 'Warning').length;
  const criticalCount = safeMachines.filter((m) => m.status === 'Critical').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
      {/* Top Header & Fleet Status Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-700" />
            <h2 className="font-display font-bold text-base text-slate-900">
              Interactive Factory Floor &amp; Production Lines
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time machine cell topology across shop floor production lines
          </p>
        </div>

        {/* Fleet KPI Quick Strip */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-600 uppercase text-[10px]">Fleet:</span>
            <span className="text-slate-900 font-bold">{totalCount} Units</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-slate-200 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{nominalCount} Nominal</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-slate-200 text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>{warningCount} Warning</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-slate-200 text-rose-800">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>{criticalCount} Critical</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar for 400 Machines */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-slate-600 font-mono text-xs">
              <Filter className="w-3.5 h-3.5 text-cyan-700" />
              <span>Filters:</span>
            </div>

            {/* Plant Filter */}
            <select
              value={selectedPlant}
              onChange={(e) => {
                setSelectedPlant(e.target.value);
                setSelectedFloor('ALL');
                setDisplayLimit(32);
              }}
              className="bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
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
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setDisplayLimit(32);
              }}
              className="bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
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
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setDisplayLimit(32);
              }}
              className="bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
              title="Filter by Machine Type"
            >
              <option value="ALL">All Types (7)</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setDisplayLimit(32);
              }}
              className="bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
            >
              <option value="ALL">All States</option>
              <option value="Nominal">Nominal</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
              <option value="Offline">Offline</option>
            </select>

            {/* Incidents Toggle */}
            <button
              onClick={() => {
                setOnlyWithIncidents(!onlyWithIncidents);
                setDisplayLimit(32);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border ${
                onlyWithIncidents
                  ? 'bg-amber-50 border-amber-600 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Active Tickets Only</span>
            </button>
          </div>

          {/* Search box & Count */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600">
              {filteredMachines.length} matches
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setDisplayLimit(32);
                }}
                placeholder="Search ID, name, model..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 w-40 sm:w-52"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Machine Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredMachines.slice(0, displayLimit).map((machine) => {
          const isSelected = machine.code === selectedMachineCode;
          const machineIncidents = incidents.filter(
            (i) => (i.machineCode === machine.code || i.machineCode === machine.machineCode) && i.status !== 'Closed'
          );
          const hasAnomaly =
            activeAnomalyMachineCode === machine.code && activeAnomalyType;

          // Status colors
          const statusBorder =
            hasAnomaly || machine.status === 'Critical'
              ? 'border-rose-600/80'
              : machine.status === 'Warning'
              ? 'border-amber-600/80'
              : 'border-slate-200 hover:border-slate-200';

          const statusBadge =
            machine.status === 'Nominal'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : machine.status === 'Warning'
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-rose-700 bg-rose-50 border-rose-200';

          return (
            <div
              key={machine.machineId || machine.code}
              className={`relative rounded-xl p-4 bg-slate-50 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${statusBorder} ${
                isSelected ? 'ring-2 ring-cyan-500 bg-slate-50 shadow-lg' : ''
              } ${hasAnomaly ? 'animate-pulse' : ''}`}
              onClick={() => {
                onSelectMachine(machine.code || machine.machineCode);
                onOpenMachineDrawer(machine);
              }}
            >
              {/* Machine Top Banner */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        machine.status === 'Nominal'
                          ? 'bg-emerald-400'
                          : machine.status === 'Warning'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                    />
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-teal-800 shrink-0">
                      {machine.machineId || 'MCH-001'}
                    </span>
                    <span className="font-mono text-xs font-bold text-cyan-700 tracking-wide truncate">
                      {machine.machineCode || machine.code}
                    </span>
                  </div>

                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${statusBadge}`}>
                    {hasAnomaly ? 'ANOMALY INJECTED' : machine.status}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 truncate" title={machine.displayName || machine.name}>
                  {machine.displayName || machine.name}
                </h4>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5 truncate">
                  {machine.plant || 'Precision Machining'} · {machine.shopFloor || machine.lineId}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                  {machine.manufacturer} {machine.model}
                </div>

                {/* Active Workpiece */}
                <div className="mt-2.5 p-2 rounded bg-slate-100/70 border border-slate-200">
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">Active Workpiece</span>
                  <span className="text-[11px] font-medium text-slate-800 truncate block">
                    {machine.activeWorkpiece || 'Standard Production Run'}
                  </span>
                </div>
              </div>

              {/* Compact Metrics Strip */}
              <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-500 block">Spindle</span>
                    <span className="text-slate-800 font-bold">{machine.spindleRpm?.toLocaleString() || 4500} RPM</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Motor Load</span>
                    <span className="text-cyan-700 font-bold">{machine.motorLoadPercent?.toFixed(1) || '42.0'}%</span>
                  </div>
                </div>

                {/* Incident and Anomaly badges */}
                <div className="flex items-center justify-between pt-1">
                  {machineIncidents.length > 0 ? (
                    <span className="text-[10px] font-mono text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                      {machineIncidents.length} Open Ticket{machineIncidents.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      Zero Incidents
                    </span>
                  )}

                  <span className="text-[10px] font-mono text-cyan-700 hover:text-cyan-800">
                    Inspect &rarr;
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination / Load More Controls */}
      {filteredMachines.length > displayLimit && (
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => setDisplayLimit((prev) => Math.min(prev + 32, filteredMachines.length))}
            className="px-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-200 text-xs font-mono font-medium text-cyan-800 rounded-lg transition-colors"
          >
            Load More (+32 Machines) · {filteredMachines.length - displayLimit} Remaining
          </button>
          <button
            onClick={() => setDisplayLimit(filteredMachines.length)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-200 text-xs font-mono text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
          >
            Show All ({filteredMachines.length})
          </button>
        </div>
      )}
    </div>
  );
};
