import React, { useState } from 'react';
import { UserProfile, Machine, TelemetryReading, Incident, IncidentSeverity } from '../types';
import { apiClient } from '../services/apiClient';
import { AlertTriangle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface RaiseAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | undefined;
  latestTelemetry: TelemetryReading;
  currentUser: UserProfile;
  onIncidentCreated: (newIncident: Incident) => void;
}

export type OperatorIssueCategory =
  | 'Abnormal noise or vibration'
  | 'Excessive temperature'
  | 'Unusual motor load or power'
  | 'Machine stopped';

const CATEGORIES: { label: OperatorIssueCategory; description: string; componentArea: string }[] = [
  {
    label: 'Abnormal noise or vibration',
    description: 'High chatter, screeching bearings, or excessive tool vibration',
    componentArea: 'Spindle / Toolholder',
  },
  {
    label: 'Excessive temperature',
    description: 'Spindle housing hot, coolant temp rising, or chiller fault',
    componentArea: 'Coolant System / Spindle Bearings',
  },
  {
    label: 'Unusual motor load or power',
    description: 'Motor load surging > 85%, power draw fluctuation, or feed stall',
    componentArea: 'Spindle Drive Motor / VFD',
  },
  {
    label: 'Machine stopped',
    description: 'Emergency stop activated, axis interlock tripped, or cycle paused',
    componentArea: 'Axis Drive / Safety Interlock',
  },
];

export const RaiseAlertModal: React.FC<RaiseAlertModalProps> = ({
  isOpen,
  onClose,
  machine,
  latestTelemetry,
  currentUser,
  onIncidentCreated,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<OperatorIssueCategory>(
    'Abnormal noise or vibration'
  );
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [isMachineStopped, setIsMachineStopped] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCategoryInfo =
    CATEGORIES.find((c) => c.label === selectedCategory) || CATEGORIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const machineCode = machine?.code || 'CNC-MILL-01';

      const symptomDescription = `[Operator Report] ${selectedCategory}${
        operatorNotes.trim() ? ` — ${operatorNotes.trim()}` : ''
      }${isMachineStopped ? ' (Machine halted by operator)' : ''}`;

      const fullNotes = [
        operatorNotes.trim() ? `Operator observations: ${operatorNotes.trim()}` : '',
        isMachineStopped ? 'Immediate action taken: Machine stopped via feed hold / emergency stop.' : 'Machine operating state: Still running under monitoring.',
        `Reported by ${currentUser.fullName} (${currentUser.workId}) on Shift A.`,
      ]
        .filter(Boolean)
        .join('\n');

      const incident = await apiClient.createIncident({
        machineCode,
        severity: isMachineStopped && severity === 'Low' ? 'High' : severity,
        symptomDescription,
        componentArea: currentCategoryInfo.componentArea,
        operatorNotes: fullNotes,
        snapshot: latestTelemetry,
        user: currentUser,
      });

      onIncidentCreated(incident);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit incident report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-400/20 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-slate-200 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="alert-modal-title" className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                Raise Machine Alert
              </h2>
              <p className="text-xs text-slate-600">
                Immediately notifies Maintenance Department and Shift Supervisor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-slate-700 text-xs font-mono">
              {errorMessage}
            </div>
          )}

          {/* Machine (Read-only for operator) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Assigned Machine
            </label>
            <div className="flex items-center justify-between p-2.5 bg-slate-50/90 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-800">
                  {machine?.code || 'CNC-MILL-01'}
                </span>
                <span className="text-xs text-slate-600">
                  · {machine?.name || 'CNC Milling Center'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 uppercase">
                Read-only
              </span>
            </div>
          </div>

          {/* Issue Category (Required) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Issue Category <span className="text-amber-700">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.label);
                      if (cat.label === 'Machine stopped') {
                        setIsMachineStopped(true);
                        setSeverity('Critical');
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50 border-amber-600/80 text-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-xs font-medium leading-tight">{cat.label}</span>
                    <span className="text-[10px] text-slate-600 mt-1 leading-normal">
                      {cat.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Urgency / Severity Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Low', 'Medium', 'High', 'Critical'] as IncidentSeverity[]).map((sev) => {
                const isSelected = severity === sev;
                const labelMap: Record<IncidentSeverity, string> = {
                  Low: 'Low (Advisory)',
                  Medium: 'Medium (Warning)',
                  High: 'High Risk',
                  Critical: 'Critical (Stop)',
                };
                const colorMap: Record<IncidentSeverity, string> = {
                  Low: isSelected ? 'bg-slate-100 border-slate-600 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600',
                  Medium: isSelected ? 'bg-amber-50 border-amber-500 text-slate-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600',
                  High: isSelected ? 'bg-orange-50 border-orange-500 text-slate-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600',
                  Critical: isSelected ? 'bg-rose-50 border-rose-500 text-slate-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600',
                };
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`py-2 px-2.5 rounded-lg border text-xs text-center transition-colors ${colorMap[sev]}`}
                  >
                    {labelMap[sev]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Operator Observation Notes */}
          <div>
            <label htmlFor="operator-notes" className="block text-xs font-medium text-slate-700 mb-1">
              Observation Details &amp; Notes
            </label>
            <textarea
              id="operator-notes"
              rows={3}
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="Describe sounds, smell, tool chatter, or specific workpiece pass..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Immediate Action Checkbox */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isMachineStopped}
                onChange={(e) => setIsMachineStopped(e.target.checked)}
                className="mt-0.5 rounded border-slate-200 text-amber-500 focus:ring-0 bg-slate-100"
              />
              <div>
                <span className="text-xs font-medium text-slate-800 block">
                  Machine has been stopped / paused
                </span>
                <span className="text-[11px] text-slate-600 block mt-0.5">
                  Feed hold or safety enclosure interlock engaged to prevent workpiece damage.
                </span>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-slate-900 flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Dispatching Alert...</span>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Submit Alert &amp; Notify Maintenance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
