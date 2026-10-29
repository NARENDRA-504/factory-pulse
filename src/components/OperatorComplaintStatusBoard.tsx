import React, { useState } from 'react';
import { Incident } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Search,
  Filter,
  PlusCircle,
} from 'lucide-react';

interface OperatorComplaintStatusBoardProps {
  machineCode: string;
  incidents: Incident[];
  onRaiseAlert: () => void;
  onViewIncidentDetails?: (incident: Incident) => void;
}

export const OperatorComplaintStatusBoard: React.FC<OperatorComplaintStatusBoardProps> = ({
  machineCode,
  incidents,
  onRaiseAlert,
  onViewIncidentDetails,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');

  // Filter complaints for this specific machine
  const machineComplaints = incidents.filter((i) => i.machineCode === machineCode);
  const openComplaints = machineComplaints.filter((i) => i.status !== 'Closed');
  const resolvedComplaints = machineComplaints.filter((i) => i.status === 'Closed');

  const filteredList =
    filterStatus === 'open'
      ? openComplaints
      : filterStatus === 'resolved'
      ? resolvedComplaints
      : machineComplaints;

  const hasPastComplaints = machineComplaints.length > 0;

  return (
    <div className="space-y-4">
      {/* 1. Quick Question & Answer Banner (Are there complaints in the past? What is the status?) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-600">
                Machine Complaints History
              </span>
              <span className="text-xs font-mono font-bold text-teal-800 px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                {machineCode}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
              <span>Past Machine Complaints &amp; Status</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRaiseAlert}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-900 font-bold font-mono text-xs flex items-center gap-2 shadow-md transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report New Machine Issue</span>
            </button>
          </div>
        </div>

        {/* Big visual answer */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          {!hasPastComplaints ? (
            <div className="flex items-center gap-3.5 p-4 rounded-xl bg-emerald-50 border border-slate-200 text-slate-700">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-base font-bold font-mono block text-slate-900">
                  NO PAST COMPLAINTS RECORDED
                </span>
                <span className="text-xs font-mono text-emerald-800/90">
                  This machine has zero complaints in system history. All components nominal.
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Complaints in past */}
              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-slate-600 block uppercase">
                    Past Complaints
                  </span>
                  <span className="text-2xl font-bold font-mono text-slate-900 mt-0.5 block">
                    {machineComplaints.length}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                  <Wrench className="w-5 h-5 text-teal-700" />
                </div>
              </div>

              {/* Resolved / Fixed Status */}
              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-emerald-700 block uppercase font-medium">
                    Resolved / Closed
                  </span>
                  <span className="text-2xl font-bold font-mono text-emerald-800 mt-0.5 block">
                    {resolvedComplaints.length}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
              </div>

              {/* Open / Under Investigation Status */}
              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-amber-700 block uppercase font-medium">
                    Still In Progress
                  </span>
                  <span className="text-2xl font-bold font-mono text-amber-800 mt-0.5 block">
                    {openComplaints.length}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock className="w-5 h-5 text-amber-700" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Simplified Complaints Cards (No long text, simple status cards) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200/70 gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wider">
              Complaints Status List
            </h3>
            <span className="text-xs font-mono text-slate-600">
              ({filteredList.length} items)
            </span>
          </div>

          {/* Simple Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200 p-1 rounded-xl text-xs font-mono">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filterStatus === 'all'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              All ({machineComplaints.length})
            </button>
            <button
              onClick={() => setFilterStatus('open')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filterStatus === 'open'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              In Progress ({openComplaints.length})
            </button>
            <button
              onClick={() => setFilterStatus('resolved')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filterStatus === 'resolved'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Resolved ({resolvedComplaints.length})
            </button>
          </div>
        </div>

        {/* Complaint Cards Grid */}
        <div className="mt-4">
          {filteredList.length === 0 ? (
            <div className="py-8 text-center text-slate-600 font-mono text-xs">
              No complaints match the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredList.map((inc) => {
                const isResolved = inc.status === 'Closed';
                const isInvestigating = inc.status === 'In_Investigation';
                const isActionRequired = inc.status === 'Action_Required';

                const statusLabel = isResolved
                  ? 'RESOLVED'
                  : isInvestigating
                  ? 'UNDER INVESTIGATION'
                  : isActionRequired
                  ? 'ACTION REQUIRED'
                  : 'OPEN';

                const statusBadgeClass = isResolved
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isInvestigating
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : isActionRequired
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200';

                return (
                  <div
                    key={inc.id}
                    onClick={() => onViewIncidentDetails?.(inc)}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-200 transition-all cursor-pointer flex flex-col justify-between gap-2.5"
                  >
                    {/* Top Row: Ticket Code & Big Status Pill */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-900 tracking-wide">
                        {inc.incidentCode}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${statusBadgeClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Middle Row: Component Area & Severity */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        {inc.componentArea}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          inc.severity === 'Critical'
                            ? 'text-rose-700 bg-rose-50'
                            : inc.severity === 'High'
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-slate-600 bg-slate-100'
                        }`}
                      >
                        {inc.severity} Priority
                      </span>
                    </div>

                    {/* Bottom Row: Simple Assignee & Date (Concise, no paragraphs) */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-2 border-t border-slate-200/60">
                      <span>
                        {inc.assignedToName ? `Handled by: ${inc.assignedToName}` : 'Queue: Unassigned'}
                      </span>
                      <span className="text-slate-500">
                        {inc.createdAt ? inc.createdAt.slice(0, 10) : 'Recent'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
