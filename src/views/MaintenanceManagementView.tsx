import React, { useState, useEffect } from 'react';
import { MaintenanceWorkOrder, UserProfile, Machine, Incident } from '../types';
import { apiClient } from '../services/apiClient';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Cpu,
  FileText
} from 'lucide-react';

interface MaintenanceManagementViewProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  onNavigateToMachine?: (code: string) => void;
  onNavigateToIncident?: (code: string) => void;
}

export const MaintenanceManagementView: React.FC<MaintenanceManagementViewProps> = ({
  currentUser,
  machines,
  incidents,
  onNavigateToMachine,
  onNavigateToIncident,
}) => {
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // New Work Order Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedMachine, setSelectedMachine] = useState<string>(machines[0]?.code || 'CNC-5AX-001');
  const [selectedPriority, setSelectedPriority] = useState<string>('Medium');
  const [technicianName, setTechnicianName] = useState<string>(currentUser.fullName);
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Status Update Modal
  const [activeOrder, setActiveOrder] = useState<MaintenanceWorkOrder | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'Pending' | 'In_Progress' | 'Completed'>('In_Progress');
  const [updateNotes, setUpdateNotes] = useState<string>('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const orders = await apiClient.getWorkOrders();
      setWorkOrders(orders);
    } catch (e) {
      console.error('Error fetching work orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) return;
    setIsSubmitting(true);
    try {
      await apiClient.createWorkOrder({
        machine_code: selectedMachine,
        technician_name: technicianName,
        priority: selectedPriority,
        action_notes: actionNotes,
      });
      setFeedback('Maintenance work order dispatched successfully.');
      setIsCreateModalOpen(false);
      setActionNotes('');
      await loadOrders();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(`Error creating order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: number, nextStatus: 'Pending' | 'In_Progress' | 'Completed') => {
    try {
      await apiClient.updateWorkOrderStatus(orderId, nextStatus);
      setFeedback(`Work order status updated to ${nextStatus.replace('_', ' ')}.`);
      setActiveOrder(null);
      await loadOrders();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(`Update failed: ${err.message}`);
    }
  };

  // Filtered orders
  const filteredOrders = workOrders.filter((wo) => {
    const matchesSearch =
      wo.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.machineCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wo.technicianName && wo.technicianName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (wo.actionTaken && wo.actionTaken.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || wo.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || wo.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // KPI Metrics
  const totalCount = workOrders.length;
  const pendingCount = workOrders.filter((o) => o.status === 'Pending').length;
  const inProgressCount = workOrders.filter((o) => o.status === 'In_Progress').length;
  const completedCount = workOrders.filter((o) => o.status === 'Completed').length;

  const canCreate = ['Admin', 'Supervisor', 'Maintenance'].includes(currentUser.role);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-amber-700 font-semibold tracking-wider">
              Plant Maintenance Operations
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-600 font-mono">Work Orders, Dispatch &amp; Technician Tracking</span>
          </div>
          <h1 className="font-display font-bold text-xl text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-700" />
            Maintenance Management &amp; Work Orders
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Authoritative MySQL maintenance log linked to incident tickets and machine telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadOrders}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-mono flex items-center gap-1.5 transition-all"
            title="Refresh Orders"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-900 text-xs font-semibold font-mono flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Dispatch Work Order</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-slate-700 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase text-slate-600 font-semibold block">Total Work Orders</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{totalCount}</div>
          <span className="text-[10px] text-slate-600 font-mono mt-0.5 block">Logged in MySQL</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase text-amber-700 font-semibold block">Pending Dispatch</span>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{pendingCount}</div>
          <span className="text-[10px] text-amber-800/80 font-mono mt-0.5 block">Awaiting technician</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase text-slate-700 font-semibold block">In Progress</span>
          <div className="text-2xl font-bold font-mono text-slate-700 mt-1">{inProgressCount}</div>
          <span className="text-[10px] text-slate-700/80 font-mono mt-0.5 block">Active repairs</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-[10px] font-mono uppercase text-emerald-700 font-semibold block">Completed</span>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{completedCount}</div>
          <span className="text-[10px] text-emerald-800/80 font-mono mt-0.5 block">Resolved tickets</span>
        </div>

        <div className="bg-white border border-purple-900/40 rounded-xl p-4 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase text-purple-700 font-semibold block">Avg MTTR</span>
          <div className="text-2xl font-bold font-mono text-purple-800 mt-1">1.45 h</div>
          <span className="text-[10px] text-purple-800/80 font-mono mt-0.5 block">Mean repair time</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search work order code, machine, technician, or repair notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-mono focus:outline-hidden"
            >
              <option value="ALL" className="bg-slate-50">All Statuses</option>
              <option value="Pending" className="bg-slate-50">Pending</option>
              <option value="In_Progress" className="bg-slate-50">In Progress</option>
              <option value="Completed" className="bg-slate-50">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-mono focus:outline-hidden"
            >
              <option value="ALL" className="bg-slate-50">All Priorities</option>
              <option value="Urgent" className="bg-slate-50">Urgent</option>
              <option value="Medium" className="bg-slate-50">Medium</option>
              <option value="Low" className="bg-slate-50">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-600">Loading maintenance work orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-slate-600 space-y-2">
            <Wrench className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No maintenance work orders match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Order Code</th>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action Taken / Notes</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredOrders.map((wo) => {
                  const isUrgent = wo.priority === 'Urgent';
                  const isDone = wo.status === 'Completed';
                  const isInProgress = wo.status === 'In_Progress';

                  return (
                    <tr key={wo.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-amber-700">
                        {wo.orderCode}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => onNavigateToMachine?.(wo.machineCode)}
                          className="font-mono text-teal-700 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          <span>{wo.machineCode}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {wo.technicianName || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isUrgent
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : wo.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {wo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isInProgress
                              ? 'bg-slate-50 text-slate-700 border-slate-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {wo.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-slate-700 font-mono text-[11px]" title={wo.actionTaken || ''}>
                        {wo.actionTaken || <span className="text-slate-500 italic">No notes logged yet</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                        {new Date(wo.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        {wo.status !== 'Completed' && (
                          <button
                            onClick={() => {
                              setActiveOrder(wo);
                              setUpdateStatus(wo.status === 'Pending' ? 'In_Progress' : 'Completed');
                            }}
                            className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-800 border border-amber-600/40 font-mono text-[10px] font-semibold transition-all"
                          >
                            Update
                          </button>
                        )}
                        {wo.incidentCode && (
                          <button
                            onClick={() => onNavigateToIncident?.(wo.incidentCode!)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px]"
                            title="View Incident Ticket"
                          >
                            Ticket
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Dispatch Work Order */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-400/20 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-700" />
                Dispatch Maintenance Work Order
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-600 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-700 mb-1">Target Machine</label>
                <select
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                >
                  {machines.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} — {m.name} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-700 mb-1">Priority</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-700 mb-1">Assigned Technician</label>
                  <input
                    type="text"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                    placeholder="e.g. Frank Kowalski"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-700 mb-1">Dispatch Instructions / Notes</label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Describe maintenance procedure, spindle vibration inspection, coolant flush..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-mono font-semibold text-slate-900"
                >
                  {isSubmitting ? 'Creating...' : 'Dispatch Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Work Order Status */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-400/20 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="font-display font-bold text-base text-slate-900">
                Update Order #{activeOrder.orderCode}
              </h2>
              <button onClick={() => setActiveOrder(null)} className="text-slate-600 hover:text-slate-900">✕</button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-700 font-mono">
                Machine: <span className="text-teal-700 font-bold">{activeOrder.machineCode}</span>
              </p>

              <div>
                <label className="block text-xs font-mono text-slate-700 mb-1">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(activeOrder.id, 'In_Progress')}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono font-semibold hover:bg--100"
                  >
                    Mark In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(activeOrder.id, 'Completed')}
                    className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50 text-slate-700 text-xs font-mono font-semibold hover:bg-emerald-50"
                  >
                    Mark Completed
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
