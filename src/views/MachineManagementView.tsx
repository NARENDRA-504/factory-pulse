import React, { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  Radio,
  Power,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { Machine, MachineInventoryRecord, UserProfile } from '../types';
import { MachineDetailsModal } from '../components/MachineDetailsModal';
import { AddMachineModal } from '../components/AddMachineModal';

interface MachineManagementViewProps {
  user: UserProfile;
  machines: Machine[];
}

export function MachineManagementView({ user, machines }: MachineManagementViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(0);

  // Modals
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Data fetching
  const refreshInventory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getMachineInventory();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load machine inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshInventory();
    // 5-second polling for real-time live updates
    const timer = window.setInterval(refreshInventory, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Listen to simulator broadcast events
  useEffect(() => {
    const handleMachineCreated = () => {
      refreshInventory();
    };
    window.addEventListener('factorypulse:machine_created', handleMachineCreated);
    window.addEventListener('factorypulse:simulator', handleMachineCreated);
    return () => {
      window.removeEventListener('factorypulse:machine_created', handleMachineCreated);
      window.removeEventListener('factorypulse:simulator', handleMachineCreated);
    };
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, activeFilter, plantFilter, typeFilter]);

  // Filtered rows
  const records: MachineInventoryRecord[] = data?.records || [];

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Search term
      const matchSearch =
        search === '' ||
        rec.machine_id.toLowerCase().includes(search.toLowerCase()) ||
        rec.machine_code.toLowerCase().includes(search.toLowerCase()) ||
        rec.name.toLowerCase().includes(search.toLowerCase()) ||
        rec.location.toLowerCase().includes(search.toLowerCase());

      // Active filter
      const matchActive =
        activeFilter === 'ALL' ||
        (activeFilter === 'ACTIVE' && rec.is_active) ||
        (activeFilter === 'INACTIVE' && !rec.is_active);

      // Status filter
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'RUNNING' && rec.operating_status === 'Nominal' && rec.is_active) ||
        (statusFilter === 'IDLE' && (rec.operating_status === 'IDLE' || rec.operating_status === 'Idle' || rec.connection_status === 'WAITING')) ||
        (statusFilter === 'DOWN' && (rec.operating_status === 'STOPPED' || rec.operating_status === 'Critical')) ||
        (statusFilter === 'MAINTENANCE' && (rec.operating_status === 'MAINTENANCE' || rec.operating_status === 'Maintenance'));

      // Plant filter
      const matchPlant = plantFilter === 'ALL' || rec.plant === plantFilter;

      // Type filter
      const matchType = typeFilter === 'ALL' || rec.machine_type === typeFilter;

      return matchSearch && matchActive && matchStatus && matchPlant && matchType;
    });
  }, [records, search, activeFilter, statusFilter, plantFilter, typeFilter]);

  const uniquePlants = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.plant).filter(Boolean))).sort();
  }, [records]);

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.machine_type).filter(Boolean))).sort();
  }, [records]);

  // Compute next suggested Machine ID
  const nextSuggestedId = useMemo(() => {
    const existingIds = new Set<string>(records.map((r) => r.machine_id));
    let num = 51;
    while (existingIds.has(`MCH-${String(num).padStart(3, '0')}`)) {
      num++;
    }
    return `MCH-${String(num).padStart(3, '0')}`;
  }, [records]);

  // Downtime display helper
  const formatDowntime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleToggleActivation = async (machineId: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.toggleMachineActivation(machineId, !currentState);
      refreshInventory();
    } catch (err) {
      console.error('Failed to toggle activation', err);
    }
  };

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pageRecords = filteredRecords.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-teal-700 font-semibold">
            Administration Console
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Machine Management</h1>
          <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
            Manage the synchronized machine catalog, active AI Simulator telemetry population, downtime tracking, and live SQL machine registrations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshInventory}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            title="Refresh machine inventory"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {user.role === 'Admin' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors shadow-md shadow-teal-950/40"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add New Machine</span>
            </button>
          )}
        </div>
      </header>

      {/* Summary KPI Cards (Requirement 4) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* 1. Total Registered */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-slate-600 text-xs">
            <span>Total Registered</span>
            <Cpu className="h-4 w-4 text-cyan-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {data?.total_registered ?? records.length}
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Canonical machine master</p>
        </div>

        {/* 2. Active Machines (50 default, increments to 51) */}
        <div className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-teal-800 text-xs">
            <span className="font-semibold">Active Machines</span>
            <Radio className="h-4 w-4 text-teal-700 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-teal-800">
            {data?.active_machines ?? 50}
          </div>
          <p className="mt-1 text-[10px] text-teal-700/80">Default 50 · Dynamic simulation</p>
        </div>

        {/* 3. Running Machines */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-slate-600 text-xs">
            <span>Running</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700">
            {data?.running_machines ?? 38}
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Nominal operating state</p>
        </div>

        {/* 4. Idle Machines */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-slate-600 text-xs">
            <span>Idle / Standby</span>
            <Clock className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-700">
            {data?.idle_machines ?? 7}
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Waiting for workpiece</p>
        </div>

        {/* 5. Down Machines */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-slate-600 text-xs">
            <span>Down Machines</span>
            <AlertTriangle className="h-4 w-4 text-rose-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-700">
            {data?.down_machines ?? 3}
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Stopped / Safety interlock</p>
        </div>

        {/* 6. Under Maintenance */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-slate-600 text-xs">
            <span>Maintenance</span>
            <Wrench className="h-4 w-4 text-amber-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-800">
            {data?.maintenance_machines ?? 2}
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Tool inspection / repair</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <input
              type="text"
              placeholder="Search by Machine ID (MCH-001), Code, Name, or Floor Location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
            />
          </div>

          {/* Active Status Filter Buttons */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs">
            <button
              onClick={() => setActiveFilter('ACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeFilter === 'ACTIVE'
                  ? 'bg-teal-500/20 text-teal-800 border border-teal-500/40'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Active Only ({data?.active_machines ?? 50})
            </button>
            <button
              onClick={() => setActiveFilter('INACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeFilter === 'INACTIVE'
                  ? 'bg-teal-500/20 text-teal-800 border border-teal-500/40'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Inactive
            </button>
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-teal-500/20 text-teal-800 border border-teal-500/40'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              All Records
            </button>
          </div>

          {/* Operational Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden"
          >
            <option value="ALL">All Operating States</option>
            <option value="RUNNING">Running / Nominal</option>
            <option value="IDLE">Idle / Standby</option>
            <option value="DOWN">Down / Stopped</option>
            <option value="MAINTENANCE">Under Maintenance</option>
          </select>

          {/* Machine Type Select */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden"
          >
            <option value="ALL">All Machine Types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Plant Select */}
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden"
          >
            <option value="ALL">All Plants</option>
            {uniquePlants.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Machine Table (Requirement 4) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[980px]">
            <thead className="bg-white text-slate-600 uppercase tracking-wider font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Machine ID &amp; Code</th>
                <th className="py-3.5 px-4">Machine Name</th>
                <th className="py-3.5 px-4">Department &amp; Section</th>
                <th className="py-3.5 px-4">Machine Type</th>
                <th className="py-3.5 px-4">Current Status</th>
                <th className="py-3.5 px-4">Current Round Downtime</th>
                <th className="py-3.5 px-4">Total Downtime</th>
                <th className="py-3.5 px-4">Last Telemetry</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {pageRecords.map((row) => {
                const isDown = row.operating_status === 'STOPPED' || row.operating_status === 'Critical';
                const isMaint = row.operating_status === 'MAINTENANCE' || row.operating_status === 'Maintenance';
                const isIdle = row.operating_status === 'IDLE' || row.operating_status === 'Idle';
                const isNominal = row.operating_status === 'Nominal' || row.operating_status === 'NORMAL';

                return (
                  <tr
                    key={row.machine_id}
                    onClick={() => setSelectedMachineId(row.machine_id)}
                    className="hover:bg-slate-100/40 transition-colors cursor-pointer group"
                  >
                    {/* Machine ID & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            row.is_active
                              ? isDown
                                ? 'bg-rose-500 animate-ping'
                                : 'bg-teal-400'
                              : 'bg-slate-600'
                          }`}
                        />
                        <div>
                          <strong className="block font-mono text-cyan-800 font-semibold group-hover:text-slate-700">
                            {row.machine_id}
                          </strong>
                          <span className="block font-mono text-[11px] text-slate-600">
                            {row.machine_code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Machine Name */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 max-w-[220px] block truncate">
                        {row.name}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {row.manufacturer ? `${row.manufacturer} · ` : ''}{row.model}
                      </span>
                    </td>

                    {/* Department & Location */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="block truncate max-w-[200px]">{row.location}</span>
                      <span className="text-[10px] text-slate-600">{row.production_line}</span>
                    </td>

                    {/* Machine Type */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="truncate max-w-[160px] block">{row.machine_type}</span>
                    </td>

                    {/* Current Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isDown
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : isMaint
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isIdle
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : isNominal
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isDown ? 'bg-rose-400' : isMaint ? 'bg-amber-400' : isIdle ? 'bg-slate-400' : 'bg-emerald-400'
                          }`}
                        />
                        {row.operating_status}
                      </span>
                    </td>

                    {/* Current Round Downtime */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className={row.current_round_downtime_seconds > 0 ? 'text-cyan-800 font-bold' : 'text-slate-600'}>
                        {formatDowntime(row.current_round_downtime_seconds)}
                      </span>
                    </td>

                    {/* Total Downtime */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className={row.total_downtime_seconds > 0 ? 'text-amber-800 font-medium' : 'text-slate-600'}>
                        {formatDowntime(row.total_downtime_seconds)}
                      </span>
                    </td>

                    {/* Last Telemetry */}
                    <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                      {row.latest_timestamp ? new Date(row.latest_timestamp).toLocaleTimeString() : 'Live'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedMachineId(row.machine_id)}
                          className="rounded border border-slate-200 bg-slate-100/80 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                        >
                          View Details
                        </button>
                        {user.role === 'Admin' && (
                          <button
                            onClick={(e) => handleToggleActivation(row.machine_id, row.is_active, e)}
                            className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
                              row.is_active
                                ? 'border-slate-200 text-slate-600 hover:text-amber-800 hover:border-slate-200'
                                : 'border-slate-200 text-teal-800 hover:bg-teal-50'
                            }`}
                            title={row.is_active ? 'Deactivate from telemetry simulation' : 'Activate in telemetry simulation'}
                          >
                            {row.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!pageRecords.length && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-600 text-xs">
                    No machines match your active filters and search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 gap-3">
          <span>
            Showing {filteredRecords.length ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, filteredRecords.length)} of {filteredRecords.length} machines (
            {data?.active_machines ?? 50} active)
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-mono text-slate-700">
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={(page + 1) * pageSize >= filteredRecords.length}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Machine Details Modal (Requirement 5) */}
      {selectedMachineId && (
        <MachineDetailsModal
          machineId={selectedMachineId}
          user={user}
          onClose={() => setSelectedMachineId(null)}
          onMachineUpdated={refreshInventory}
        />
      )}

      {/* Add New Machine Modal (Requirement 3) */}
      {isAddModalOpen && (
        <AddMachineModal
          user={user}
          nextSuggestedId={nextSuggestedId}
          onClose={() => setIsAddModalOpen(false)}
          onMachineCreated={() => {
            refreshInventory();
          }}
        />
      )}
    </div>
  );
}
