import React, { useState } from 'react';
import { Incident, MaintenanceWorkOrder } from '../types';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Wrench,
  Zap,
} from 'lucide-react';

export interface IndustrialEventItem {
  id: string;
  timestamp: string;
  machineCode: string;
  eventType: 'ANOMALY' | 'INCIDENT' | 'WORK_ORDER' | 'SYSTEM';
  title: string;
  description: string;
  provenance: 'EMPIRICAL DATASET' | 'SIMULATED' | 'DEMO';
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  rawPayload?: any;
}

interface RecentEventsStreamProps {
  events: IndustrialEventItem[];
  onFileIncidentFromEvent?: (event: IndustrialEventItem) => void;
  onNavigateToIncidents?: () => void;
}

export const RecentEventsStream: React.FC<RecentEventsStreamProps> = ({
  events = [],
  onFileIncidentFromEvent,
  onNavigateToIncidents,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredEvents = (events || []).filter((ev) => {
    if (filterType === 'ALL') return true;
    return ev.eventType === filterType;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-700" />
            <h3 className="font-display font-semibold text-sm text-slate-900">
              Live Factory Operations &amp; Event Stream
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            {['ALL', 'ANOMALY', 'INCIDENT', 'WORK_ORDER'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  filterType === type
                    ? 'bg-slate-100 text-cyan-700 border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type === 'ALL' ? 'All' : type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Events List */}
        <div className="mt-3 space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No recent events matching filter
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const isAnomaly = ev.eventType === 'ANOMALY';
              const isIncident = ev.eventType === 'INCIDENT';

              return (
                <div
                  key={ev.id}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    isAnomaly
                      ? 'bg-amber-50 border-amber-200'
                      : isIncident
                      ? 'bg-rose-50 border-slate-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {ev.machineCode}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          ev.provenance === 'SIMULATED'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-cyan-700 bg-cyan-50 border-cyan-200'
                        }`}
                      >
                        {ev.provenance}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {ev.timestamp}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 mt-1.5 flex items-center gap-1.5">
                    {isAnomaly && <Flame className="w-3.5 h-3.5 text-amber-700" />}
                    {isIncident && <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />}
                    {!isAnomaly && !isIncident && <Wrench className="w-3.5 h-3.5 text-cyan-700" />}
                    <span>{ev.title}</span>
                  </div>

                  <p className="text-[11px] text-slate-600 mt-0.5 font-sans">
                    {ev.description}
                  </p>

                  {/* Contextual Action Button */}
                  {isAnomaly && onFileIncidentFromEvent && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => onFileIncidentFromEvent(ev)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-900 text-[10px] font-mono font-semibold rounded flex items-center gap-1 transition-colors shadow-sm"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        File Incident from Event
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {onNavigateToIncidents && (
        <div className="mt-3 pt-3 border-t border-slate-200 text-right">
          <button
            onClick={onNavigateToIncidents}
            className="text-xs font-mono text-cyan-700 hover:text-cyan-800"
          >
            Open All Incidents Console &rarr;
          </button>
        </div>
      )}
    </div>
  );
};
