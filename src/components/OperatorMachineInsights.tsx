import React from 'react';
import { Activity, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { ChartDataPoint } from './IndustrialTelemetryChart';
import { Incident, TelemetryReading } from '../types';

interface OperatorMachineInsightsProps {
  isStreaming: boolean;
  latestTelemetry: TelemetryReading | null;
  vibData: ChartDataPoint[];
  activeAnomaly: string | null;
  machineIncidents: Incident[];
  onRaiseAlert: () => void;
}

export const OperatorMachineInsights: React.FC<OperatorMachineInsightsProps> = ({
  isStreaming,
  latestTelemetry,
  vibData,
  activeAnomaly,
  machineIncidents,
  onRaiseAlert,
}) => {
  // 1. Current Condition: Stable, Changing, Elevated, or Unavailable
  let conditionStatus: 'Stable' | 'Changing' | 'Elevated' | 'Unavailable' = 'Stable';
  let conditionColor = 'text-teal-400 bg-teal-950/40 border-teal-500/50';
  let conditionDesc = 'Vibration within nominal ISO tolerance';

  if (!isStreaming || !latestTelemetry) {
    conditionStatus = 'Unavailable';
    conditionColor = 'text-slate-400 bg-slate-900 border-slate-800';
    conditionDesc = 'Telemetry stream paused';
  } else if ((latestTelemetry.vibRms ?? 0) > 4.2) {
    conditionStatus = 'Elevated';
    conditionColor = 'text-rose-400 bg-rose-950/60 border-rose-500/60';
    conditionDesc = `Threshold breach: ${(latestTelemetry.vibRms ?? 0).toFixed(2)} m/s² > 4.20 limit`;
  } else {
    // Check variance in last 5 points
    const recent = vibData.slice(-5);
    if (recent.length >= 3) {
      const vals = recent.map((r) => r.y);
      const diff = Math.max(...vals) - Math.min(...vals);
      if (diff > 0.6) {
        conditionStatus = 'Changing';
        conditionColor = 'text-amber-400 bg-amber-950/50 border-amber-500/50';
        conditionDesc = `Variance spike (${diff.toFixed(2)} m/s²) across recent cuts`;
      }
    }
  }

  // 2. Recent Abnormality
  let recentAbnormalityText = 'None in current shift';
  let abnormalityTime = 'Shift Nominal';
  let hasAbnormality = false;

  if (activeAnomaly) {
    hasAbnormality = true;
    recentAbnormalityText = `${activeAnomaly.replace(/_/g, ' ')} detected`;
    abnormalityTime = new Date().toISOString().slice(11, 19) + ' UTC';
  } else if (latestTelemetry?.vibRms && latestTelemetry.vibRms > 4.2) {
    hasAbnormality = true;
    recentAbnormalityText = `Vibration surge ${latestTelemetry.vibRms.toFixed(2)} m/s²`;
    abnormalityTime = new Date().toISOString().slice(11, 19) + ' UTC';
  } else if (machineIncidents.length > 0) {
    hasAbnormality = true;
    const latestInc = machineIncidents[0];
    recentAbnormalityText = `${latestInc.incidentCode}: ${latestInc.componentArea}`;
    abnormalityTime = latestInc.createdAt ? latestInc.createdAt.slice(11, 19) + ' UTC' : 'Recent';
  }

  // 3. Recommended Next Action
  let recommendedActionText = 'Continue standard monitoring';
  let actionPrompt = 'Nominal Cycle';
  let actionUrgent = false;

  if (!isStreaming) {
    recommendedActionText = 'Resume live telemetry stream to verify spindle status';
    actionPrompt = 'Monitoring Paused';
  } else if (conditionStatus === 'Elevated' || activeAnomaly) {
    actionUrgent = true;
    recommendedActionText = 'Halt feed and notify maintenance (SOP-SP-01)';
    actionPrompt = 'SOP-SP-01 Protocol';
  } else if (conditionStatus === 'Changing') {
    recommendedActionText = 'Inspect tool holder & coolant; monitor chatter';
    actionPrompt = 'Observation Advised';
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Item 1: Current Condition */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              1. Current Condition
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  conditionStatus === 'Stable'
                    ? 'bg-teal-400'
                    : conditionStatus === 'Unavailable'
                    ? 'bg-slate-500'
                    : conditionStatus === 'Changing'
                    ? 'bg-amber-400'
                    : 'bg-rose-500 animate-pulse'
                }`}
              />
              {conditionStatus === 'Stable' ? (
                <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
              ) : conditionStatus === 'Unavailable' ? (
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline justify-between">
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${conditionColor}`}
              >
                {conditionStatus}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {conditionStatus === 'Stable'
                  ? 'RMS Nominal'
                  : conditionStatus === 'Unavailable'
                  ? 'Paused'
                  : 'Threshold check'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1.5 line-clamp-1">
              {conditionDesc}
            </p>
          </div>
        </div>

        {/* Item 2: Recent Abnormality */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              2. Recent Abnormality
            </span>
            <span className="text-[10px] font-mono text-slate-500">{abnormalityTime}</span>
          </div>
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  hasAbnormality ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'
                }`}
              />
              <span
                className={`text-xs font-mono font-semibold truncate ${
                  hasAbnormality ? 'text-amber-300' : 'text-slate-200'
                }`}
                title={recentAbnormalityText}
              >
                {recentAbnormalityText}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1.5 line-clamp-1">
              {hasAbnormality ? 'Flagged anomaly or surge' : 'No warnings recorded this shift'}
            </p>
          </div>
        </div>

        {/* Item 3: Recommended Next Action */}
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-medium">
              3. Recommended Action
            </span>
            <span
              className={`text-[10px] font-mono ${
                actionUrgent ? 'text-amber-400 font-semibold' : 'text-slate-500'
              }`}
            >
              {actionPrompt}
            </span>
          </div>
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-mono font-semibold truncate ${
                  actionUrgent ? 'text-amber-300' : 'text-slate-200'
                }`}
                title={recommendedActionText}
              >
                {recommendedActionText}
              </span>
              {actionUrgent && (
                <button
                  onClick={onRaiseAlert}
                  className="shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                >
                  Alert &rarr;
                </button>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1.5 line-clamp-1">
              {actionUrgent
                ? 'Authorized action: notify maintenance'
                : 'Follow standard machining protocol'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
