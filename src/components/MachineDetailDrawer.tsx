import React from 'react';
import { Machine, Incident, TelemetryReading } from '../types';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  Gauge,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

interface MachineDetailDrawerProps {
  machine: Machine | null;
  onClose: () => void;
  incidents: Incident[];
  latestSnapshot?: TelemetryReading;
  onNavigateToTelemetry: (machineCode: string) => void;
  onNavigateToCreateIncident: (machineCode: string) => void;
}

export const MachineDetailDrawer: React.FC<MachineDetailDrawerProps> = ({
  machine,
  onClose,
  incidents = [],
  latestSnapshot,
  onNavigateToTelemetry,
  onNavigateToCreateIncident,
}) => {
  if (!machine) return null;

  const machineIncidents = (incidents || []).filter(
    (i) => i.machineCode === machine.code && i.status !== 'Closed'
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-400/20 backdrop-blur-sm flex justify-end animate-fade-in">
      {/* Drawer Container */}
      <div
        className="w-full max-w-lg bg-white border-l border-slate-200 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold">
                  {machine.code}
                </span>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${
                    machine.status === 'Nominal'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : machine.status === 'Warning'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                  }`}
                >
                  {machine.status}
                </span>
              </div>
              <h3 className="mt-2 font-display font-bold text-lg text-slate-900">
                {machine.name}
              </h3>
              <p className="text-xs text-slate-600">{machine.model}</p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Machine Specification Details */}
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Line Assignment</span>
                <span className="text-slate-800 font-bold block mt-0.5 truncate">{machine.lineId}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Active Workpiece</span>
                <span className="text-purple-800 font-bold block mt-0.5 truncate">{machine.activeWorkpiece}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Total Cut Hours</span>
                <span className="text-slate-800 font-bold block mt-0.5">{machine.cutHours} hrs</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Tool Insert Cuts</span>
                <span className="text-cyan-700 font-bold block mt-0.5">{machine.currentToolCuts} cuts</span>
              </div>
            </div>

            {/* Live Telemetry Snapshot if available */}
            {latestSnapshot && (
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-700" />
                    Latest Live Snapshot
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {latestSnapshot.dataProvenance}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[9px] text-slate-500 block">Spindle</span>
                    <span className="text-slate-900 font-bold">{latestSnapshot.spindleRpm} RPM</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[9px] text-cyan-700 block font-semibold">Motor Power</span>
                    <span className="text-cyan-800 font-bold">{latestSnapshot.motorPowerKw.toFixed(1)} kW</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[9px] text-amber-700 block font-semibold">Motor Load</span>
                    <span className="text-amber-800 font-bold">{latestSnapshot.motorLoadPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active Incidents List for this Machine */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Active Incident Tickets ({machineIncidents.length})
                </span>
              </div>

              {machineIncidents.length === 0 ? (
                <div className="p-3 text-center text-xs font-mono text-emerald-700 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  No open incidents on this unit
                </div>
              ) : (
                <div className="space-y-2">
                  {machineIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-700 font-bold">{inc.incidentCode}</span>
                        <span className="text-amber-700 text-[10px]">{inc.severity} Severity</span>
                      </div>
                      <p className="text-slate-700 font-sans text-xs mt-1 line-clamp-2">
                        {inc.symptomDescription}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                        <span>Status: {inc.status}</span>
                        <span>{inc.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Action Buttons */}
        <div className="pt-4 border-t border-slate-200 space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onNavigateToTelemetry(machine.code);
            }}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-900 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm font-mono"
          >
            <Activity className="w-4 h-4" />
            Open Dedicated Telemetry Stream
          </button>
          <button
            onClick={() => {
              onClose();
              onNavigateToCreateIncident(machine.code);
            }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-200 font-mono"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            Report Issue for {machine.code}
          </button>
        </div>
      </div>
    </div>
  );
};
