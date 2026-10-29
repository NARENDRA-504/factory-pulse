import React, { useState, useEffect } from 'react';
import { Incident, UserProfile, TelemetryReading, AIDiagnosisResult } from '../types';
import { apiClient } from '../services/apiClient';
import { SEED_MACHINES } from '../data/seedData';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { SimpleBarChart } from '../components/SimpleBarChart';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Wrench,
  X,
  Layers,
} from 'lucide-react';

interface IncidentsViewProps {
  currentUser: UserProfile;
  incidents: Incident[];
  onRefreshIncidents: () => void;
  initialMachineForReport?: string;
  initialSnapshotForReport?: TelemetryReading;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  currentUser,
  incidents,
  onRefreshIncidents,
  initialMachineForReport,
  initialSnapshotForReport,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(incidents[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(!!initialSnapshotForReport);
  const [newMachineCode, setNewMachineCode] = useState(initialMachineForReport || currentUser.assignedMachine || SEED_MACHINES[0].code);
  const [newSeverity, setNewSeverity] = useState<Incident['severity']>('Medium');
  const [newSymptom, setNewSymptom] = useState(
    initialSnapshotForReport?.injectedAnomalyType
      ? `Machine anomaly reported: ${initialSnapshotForReport.injectedAnomalyType}`
      : ''
  );
  const [newComponentArea, setNewComponentArea] = useState('Spindle & Toolholder');
  const [newOperatorNotes, setNewOperatorNotes] = useState('');
  const [formSnapshot, setFormSnapshot] = useState<TelemetryReading>(
    initialSnapshotForReport || apiClient.getLiveTelemetrySnapshot(initialMachineForReport || currentUser.assignedMachine || SEED_MACHINES[0].code)
  );

  // Workflow actions
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigneeName, setAssigneeName] = useState('');
  const [technicians,setTechnicians]=useState<any[]>([]);
  useEffect(()=>{if(currentUser.role==='Supervisor') apiClient.getMaintenanceTechnicians().then(setTechnicians).catch(()=>setTechnicians([]));},[currentUser.role]);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progressNotes, setProgressNotes] = useState('');

  // AI Assistant states
  const [isAILoading, setIsAILoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Filtered incidents
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.incidentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.machineCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.symptomDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // KPI Counts
  const totalCount = incidents.length;
  const openCount = incidents.filter((i) => i.status === 'Open').length;
  const inInvestCount = incidents.filter((i) => i.status === 'In_Investigation').length;
  const actionReqCount = incidents.filter((i) => i.status === 'Action_Required').length;
  const closedCount = incidents.filter((i) => i.status === 'Closed').length;

  // Action feedback & error states
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const handleCaptureFreshSnapshot = () => {
    const fresh = apiClient.getLiveTelemetrySnapshot(newMachineCode);
    setFormSnapshot(fresh);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiClient.createIncident({
        machineCode: newMachineCode,
        severity: newSeverity,
        symptomDescription: newSymptom,
        componentArea: newComponentArea,
        operatorNotes: newOperatorNotes,
        snapshot: formSnapshot,
        user: currentUser,
      });
      setIsNewModalOpen(false);
      onRefreshIncidents();
      setSelectedIncident(created);
    } catch (err: any) {
      setActionErrorMessage(err.message);
      setTimeout(() => setActionErrorMessage(null), 6000);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    try {
      const updated = await apiClient.assignIncident(selectedIncident.id, assigneeName, currentUser.role);
      setIsAssignModalOpen(false);
      onRefreshIncidents();
      setSelectedIncident(updated);
    } catch (err: any) {
      setActionErrorMessage(err.message);
      setTimeout(() => setActionErrorMessage(null), 6000);
    }
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    try {
      const updated = await apiClient.updateIncidentProgress(selectedIncident.id, progressNotes, currentUser.role);
      setIsProgressModalOpen(false);
      setProgressNotes('');
      onRefreshIncidents();
      setSelectedIncident(updated);
    } catch (err: any) {
      setActionErrorMessage(err.message);
      setTimeout(() => setActionErrorMessage(null), 6000);
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    try {
      const updated = await apiClient.closeIncident(selectedIncident.id, closureNotes, currentUser);
      setIsCloseModalOpen(false);
      setClosureNotes('');
      onRefreshIncidents();
      setSelectedIncident(updated);
    } catch (err: any) {
      setActionErrorMessage(err.message);
      setTimeout(() => setActionErrorMessage(null), 6000);
    }
  };

  const handleRunAIAssistant = async () => {
    if (!selectedIncident) return;
    setIsAILoading(true);
    try {
      const diagnosis = await apiClient.diagnoseIncidentWithAI(selectedIncident.id);
      setSelectedIncident({ ...selectedIncident, diagnosis });
      onRefreshIncidents();
    } catch (err: any) {
      setActionErrorMessage(`AI Assistant Error: ${err.message}`);
      setTimeout(() => setActionErrorMessage(null), 6000);
    } finally {
      setIsAILoading(false);
    }
  };

  const toggleStep = (stepKey: string) => {
    setCompletedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  // Permission checkers strictly aligned with approved RBAC policy
  const canCreate = currentUser.role === 'Operator' || currentUser.role === 'Supervisor' || currentUser.role === 'Maintenance';
  const canAssign = currentUser.role === 'Supervisor';
  const canUpdateProgress = currentUser.role === 'Maintenance';
  const canClose = currentUser.role === 'Supervisor' || currentUser.role === 'Maintenance';

  return (
    <div className="space-y-5">
      {/* 1. KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-600 font-medium">Total Tickets</span>
            <div className="text-xl font-bold font-mono text-slate-900 font-mono-numbers mt-1">
              {totalCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <Layers className="w-4 h-4 text-teal-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-600 font-medium">Open</span>
            <div className="text-xl font-bold font-mono text-amber-700 font-mono-numbers mt-1">
              {openCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <AlertCircle className="w-4 h-4 text-amber-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-600 font-medium">Investigation</span>
            <div className="text-xl font-bold font-mono text-teal-800 font-mono-numbers mt-1">
              {inInvestCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <Clock className="w-4 h-4 text-teal-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-600 font-medium">Action Required</span>
            <div className="text-xl font-bold font-mono text-rose-700 font-mono-numbers mt-1">
              {actionReqCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <Wrench className="w-4 h-4 text-rose-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-600 font-medium">Closed</span>
            <div className="text-xl font-bold font-mono text-emerald-700 font-mono-numbers mt-1">
              {closedCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Incident charts">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Tickets by workflow status</h2>
          <p className="mb-3 mt-1 text-xs text-slate-600">Counts from the incident records currently in this app.</p>
          <SimpleBarChart data={[
            { label: 'Open', value: openCount, color: '#f59e0b' },
            { label: 'In investigation', value: inInvestCount, color: '#2dd4bf' },
            { label: 'Action required', value: actionReqCount, color: '#fb7185' },
            { label: 'Closed', value: closedCount, color: '#34d399' },
          ]} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Severity breakdown</h2>
          <p className="mb-3 mt-1 text-xs text-slate-600">Current ticket counts by reported severity.</p>
          <SimpleBarChart data={(['Critical', 'High', 'Medium', 'Low'] as const).map((severity) => ({
            label: severity,
            value: incidents.filter((incident) => incident.severity === severity).length,
            color: severity === 'Critical' || severity === 'High' ? '#fb7185' : severity === 'Medium' ? '#fbbf24' : '#38bdf8',
          }))} />
        </div>
      </section>

      {/* 2. Search & Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-teal-700 font-semibold tracking-wider">
              Tickets Filter
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-600 font-mono">
              Showing {filteredIncidents.length} of {incidents.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket code, machine..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 rounded-lg focus:outline-none focus:border-teal-500 w-48 sm:w-56"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In_Investigation">In Investigation</option>
              <option value="Action_Required">Action Required</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Severities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>

            {canCreate && (
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm font-mono"
              >
                <Plus className="w-4 h-4" />
                Report Incident
              </button>
            )}
          </div>
        </div>
      </div>

      {actionErrorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-slate-700 text-xs rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            <span className="font-medium">{actionErrorMessage}</span>
          </div>
          <button
            onClick={() => setActionErrorMessage(null)}
            className="text-rose-700 hover:text-slate-700 text-xs px-2 py-0.5 rounded font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main Grid: Incident Table (5 Cols) + Detail Workspace (7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Incidents Table (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/40">
            <span className="text-xs font-mono uppercase text-slate-600 font-semibold">
              Incident Tickets ({filteredIncidents.length})
            </span>
            <span className="text-[10px] font-mono text-slate-500">Sorted by newest</span>
          </div>

          <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[700px]">
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No incidents match the active filter criteria.
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-3.5 transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-teal-50 border-l-2 border-teal-400'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-900">{inc.incidentCode}</span>
                      <span
                        className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                          inc.severity === 'Critical'
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : inc.severity === 'High'
                            ? 'text-orange-700 bg-orange-50 border-orange-200'
                            : inc.severity === 'Medium'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-slate-600 bg-slate-50 border-slate-200'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-700 line-clamp-1">
                      {inc.symptomDescription}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span>{inc.machineCode}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          inc.status === 'Closed'
                            ? 'text-emerald-700 bg-emerald-50 border border-slate-200'
                            : inc.status === 'Action_Required'
                            ? 'text-amber-700 bg-amber-50 border border-slate-200'
                            : 'text-teal-800 bg-teal-50 border border-slate-200'
                        }`}
                      >
                        {inc.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <ProvenanceBadge provenance={inc.dataProvenance} />
                      <span className="text-[10px] text-slate-500 font-mono">{inc.createdAt.substring(0, 10)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Incident Detail Workspace (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
          {selectedIncident ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-teal-800">
                      {selectedIncident.incidentCode}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-xs text-slate-900">{selectedIncident.machineCode}</span>
                    <span className="text-slate-600">·</span>
                    <ProvenanceBadge provenance={selectedIncident.dataProvenance} />
                  </div>
                  <h2 className="mt-1 font-display font-bold text-lg text-slate-900">
                    {selectedIncident.symptomDescription}
                  </h2>
                </div>

                {/* Workflow Buttons Enforced by Role */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Supervisor Assign Action */}
                  {canAssign && selectedIncident.status === 'Open' && (
                    <button
                      onClick={() => setIsAssignModalOpen(true)}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors font-mono"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Assign Technician
                    </button>
                  )}

                  {/* Maintenance Progress Update */}
                  {canUpdateProgress && selectedIncident.status !== 'Closed' && (
                    <button
                      onClick={() => setIsProgressModalOpen(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors font-mono"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Update Progress
                    </button>
                  )}

                  {/* Operational / Maintenance Close Action */}
                  {canClose && selectedIncident.status !== 'Closed' && (
                    <button
                      onClick={() => setIsCloseModalOpen(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors font-mono"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Close Ticket (Sign-off)
                    </button>
                  )}

                  {selectedIncident.status === 'Closed' && (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Closed by {selectedIncident.closedRole || 'Maintenance'} ({selectedIncident.closedByName})
                    </span>
                  )}
                </div>
              </div>

              {/* Status & Metadata Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Reported By</span>
                  <span className="text-slate-700 font-semibold">{selectedIncident.reporterName}</span>
                  <span className="text-[10px] text-slate-500 block">({selectedIncident.reporterRole})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Assigned Engineer</span>
                  <span className="text-teal-800 font-semibold">{selectedIncident.assignedToName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Severity Priority</span>
                  <span className="text-amber-700 font-semibold">{selectedIncident.severity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Ticket State</span>
                  <span className="text-slate-900 font-semibold">{selectedIncident.status.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Verified Machine Sensor Snapshot (Measured Values) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase text-slate-600 font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    Verified Machine Sensor Snapshot (Measured Values)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700">Telemetry Locked at Failure</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Vibration RMS</div>
                    <div className="text-base font-mono font-bold text-slate-900 font-mono-numbers">
                      {(selectedIncident.measuredVibRms == null ? 'Not measured' : selectedIncident.measuredVibRms.toFixed(2))}{' '}
                      <span className="text-xs font-normal text-slate-600">m/s²</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Motor Power (kW)</div>
                    <div className="text-base font-mono font-bold text-teal-800 font-mono-numbers">
                      {(selectedIncident.measuredMotorPowerKw == null ? 'Not measured' : selectedIncident.measuredMotorPowerKw.toFixed(1))}{' '}
                      <span className="text-xs font-normal text-slate-600">kW</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Motor Load (%)</div>
                    <div className="text-base font-mono font-bold text-amber-700 font-mono-numbers">
                      {(selectedIncident.measuredMotorLoadPct == null ? 'Not measured' : selectedIncident.measuredMotorLoadPct.toFixed(1))}{' '}
                      <span className="text-xs font-normal text-slate-600">%</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Correlated Vb Wear</div>
                    <div className="text-base font-mono font-bold text-slate-900 font-mono-numbers">
                      {selectedIncident.correlatedVbMm !== undefined ? `${selectedIncident.correlatedVbMm} mm` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-[10px] font-mono text-slate-500">
                  * Note: Motor Power in kW and Motor Load in % are stored as separate database fields. Auxiliary channels with unconfirmed units are labeled Unit unverified.
                </div>
              </div>

              {/* Operator Notes / Maintenance Timeline */}
              {selectedIncident.operatorNotes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span className="font-mono text-[10px] text-slate-600 uppercase font-semibold block mb-1">
                    Operator Field Observations
                  </span>
                  <p className="text-slate-700">{selectedIncident.operatorNotes}</p>
                </div>
              )}

              {selectedIncident.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span className="font-mono text-[10px] text-amber-700 uppercase font-semibold block mb-1">
                    Maintenance Progress Log
                  </span>
                  <p className="text-slate-700 whitespace-pre-line">{selectedIncident.notes}</p>
                </div>
              )}

              {selectedIncident.closureNotes && (
                <div className="p-3 bg-emerald-50 border border-slate-200 rounded-lg text-xs">
                  <span className="font-mono text-[10px] text-emerald-700 uppercase font-semibold block mb-1">
                    Formal Sign-off &amp; Closure Record
                  </span>
                  <p className="text-slate-700">{selectedIncident.closureNotes}</p>
                  <div className="mt-1 text-[10px] text-emerald-700 font-mono">
                    Signed by {selectedIncident.closedByName} ({selectedIncident.closedRole}) on {selectedIncident.closedAt}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {selectedIncident.sensorSnapshot && <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-sm">Saved sensor evidence at report time</h3><p className="mt-1 text-xs text-slate-600">Original readings attached by FactoryPulse from MySQL.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{selectedIncident.sensorSnapshot.map(reading=><div key={reading.reading_id} className="rounded-lg bg-slate-100 p-3"><p className="text-xs text-slate-600">{reading.sensor_name}</p><p className="mt-1 text-sm text-slate-700">{reading.sensor_value??'Unavailable'} {reading.sensor_unit}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(reading.timestamp).toLocaleString()}</p></div>)}</div></section>}
              {/* AI Incident Investigation Assistant Panel */}
              {/* ------------------------------------------------------------- */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-teal-700" />
                    <div>
                      <h3 className="font-display font-bold text-sm text-slate-900">
                        AI Incident Investigation Assistant
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Use Factory Intelligence on the live dashboard for authorized SQL evidence. Optional Google analysis requires backend configuration.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-slate-700">Provider not configured</span>
                </div>

                {selectedIncident.diagnosis ? (
                  <div className="space-y-4 bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 sm:p-5">
                    {/* Model & Provenance Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-600 pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-teal-700 font-semibold">{selectedIncident.diagnosis.modelId}</span>
                        <span className="text-slate-600">·</span>
                        <span>Generated: {selectedIncident.diagnosis.generatedAt}</span>
                      </div>
                      <ProvenanceBadge provenance={selectedIncident.diagnosis.dataProvenance} />
                    </div>

                    {/* Prominent Mandatory Safety Disclaimer */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold block uppercase text-[10px] tracking-wide text-amber-800">
                          Mandatory Safety Disclaimer
                        </span>
                        {selectedIncident.diagnosis.safetyDisclaimer}
                      </div>
                    </div>

                    {/* Diagnostic Hypotheses (Clearly Labeled as Unverified) */}
                    <div>
                      <span className="text-xs font-mono uppercase text-amber-700 font-bold block mb-2">
                        Diagnostic Hypotheses (Unverified Guidance — Requires Physical Inspection)
                      </span>
                      <div className="space-y-2.5">
                        {selectedIncident.diagnosis.diagnosticHypotheses.map((hyp, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-100/80 border border-slate-200 rounded-lg text-xs"
                          >
                            <div className="font-semibold text-slate-900 flex items-center justify-between gap-2">
                              <span>Hypothesis {idx + 1}: {hyp.hypothesis}</span>
                              <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                Unverified
                              </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-[11px] leading-relaxed">{hyp.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Suggested Physical Investigation Steps */}
                    <div>
                      <span className="text-xs font-mono uppercase text-teal-700 font-bold block mb-2">
                        Recommended Physical Investigation Steps
                      </span>
                      <div className="space-y-2">
                        {selectedIncident.diagnosis.suggestedInvestigationSteps.map((step, idx) => {
                          const isDone = !!completedSteps[`step_${idx}`];
                          return (
                            <label
                              key={idx}
                              onClick={() => toggleStep(`step_${idx}`)}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isDone
                                  ? 'bg-emerald-50 border-emerald-200 text-slate-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:border-slate-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => {}}
                                className="mt-0.5 rounded border-slate-200 text-teal-500 focus:ring-0"
                              />
                              <span className={isDone ? 'line-through text-slate-500' : ''}>{step}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Excluded Unverified Metrics Note */}
                    <div className="pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-500">
                      Excluded Channels: {selectedIncident.diagnosis.unverifiedMetricsExcluded.map((m) => m.metric).join(', ')} ({selectedIncident.diagnosis.unverifiedMetricsExcluded[0]?.reason})
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50/40 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No generated diagnosis is available. Recorded sensor evidence remains accessible on the live dashboard.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500 font-mono">
              Select an incident from the list to view its complete diagnostic dossier.
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CREATE NEW INCIDENT REPORT */}
      {/* ------------------------------------------------------------- */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-400/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-display font-bold text-base text-slate-900">
                Submit New Incident Report
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-600 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-mono mb-1">Target Machine</label>
                  <select
                    value={newMachineCode}
                    onChange={(e) => {
                      setNewMachineCode(e.target.value);
                      setFormSnapshot(apiClient.getLiveTelemetrySnapshot(e.target.value));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2 font-mono"
                  >
                    {SEED_MACHINES.map((m) => (
                      <option key={m.machineId || m.machineCode} value={m.machineCode}>
                        {m.displayName} ({m.machineId || m.machineCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-mono mb-1">Severity Priority</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2 font-mono"
                  >
                    <option value="Low">Low (Informational observation)</option>
                    <option value="Medium">Medium (Machining quality affected)</option>
                    <option value="High">High (Immediate tool/workpiece risk)</option>
                    <option value="Critical">Critical (Immediate safety/machine halt)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-mono mb-1">Component / Subsystem Area</label>
                <input
                  type="text"
                  required
                  value={newComponentArea}
                  onChange={(e) => setNewComponentArea(e.target.value)}
                  placeholder="e.g. Spindle & Toolholder, Wayguide Lube, Coolant Chiller"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-mono mb-1">Observed Symptom Description</label>
                <textarea
                  required
                  rows={2}
                  value={newSymptom}
                  onChange={(e) => setNewSymptom(e.target.value)}
                  placeholder="Describe abnormal vibration, sound, odor, or surface finish defect..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2"
                ></textarea>
              </div>

              <div>
                <label className="block text-slate-600 font-mono mb-1">Operator Notes</label>
                <textarea
                  rows={2}
                  value={newOperatorNotes}
                  onChange={(e) => setNewOperatorNotes(e.target.value)}
                  placeholder="Additional context on tooling insert condition, cut cycle count, etc."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2"
                ></textarea>
              </div>

              {/* Attached Sensor Snapshot Section */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-slate-600 uppercase font-semibold">
                    Attached Sensor Telemetry Snapshot
                  </span>
                </div>
                <p className="text-xs text-slate-600">FactoryPulse attaches the latest saved MySQL sensor readings when you submit. Original sensor units and timestamps are preserved. Unmeasured vibration acceleration, motor power and motor load remain unavailable.</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-900 font-semibold rounded font-mono"
                >
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ASSIGN TECHNICIAN (SUPERVISOR ONLY) */}
      {/* ------------------------------------------------------------- */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-400/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="font-display font-bold text-sm text-slate-900 mb-3">
              Assign Incident to Maintenance Engineer
            </h3>
            <form onSubmit={handleAssignSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-mono mb-1">Technician Name</label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2 font-mono"
                >
                  <option value="">Choose an active technician</option>{technicians.map(person=><option key={person.id} value={person.full_name}>{person.full_name} ({person.work_id})</option>)}
                  </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-900 font-semibold rounded font-mono"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: UPDATE PROGRESS (MAINTENANCE ONLY) */}
      {/* ------------------------------------------------------------- */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-400/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="font-display font-bold text-sm text-slate-900 mb-2">
              Log Maintenance Investigation Progress
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Record physical inspection findings (e.g., dial indicator runout, collet cleaning, insert replacement).
            </p>
            <form onSubmit={handleProgressSubmit} className="space-y-3 text-xs">
              <div>
                <textarea
                  required
                  rows={3}
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  placeholder="e.g. Performed spindle sweep test; confirmed 0.003mm radial play. Cleaned 7:24 taper."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-900 font-semibold rounded font-mono"
                >
                  Save Progress Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: CLOSE TICKET (SUPERVISOR OR MAINTENANCE SIGN-OFF) */}
      {/* ------------------------------------------------------------- */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-400/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="font-display font-bold text-sm text-slate-900 mb-1">
              Operational Sign-Off &amp; Ticket Closure
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Certified by {currentUser.role} ({currentUser.fullName}). Confirm physical machine readiness before clearing.
            </p>
            <form onSubmit={handleCloseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-mono mb-1">Closure Verification Notes</label>
                <textarea
                  required
                  rows={3}
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="e.g. Test cut cycle verified nominal. Vibration measured at 1.8 m/s². Machine returned to active production."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-2"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold rounded font-mono"
                >
                  Approve Sign-off &amp; Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
