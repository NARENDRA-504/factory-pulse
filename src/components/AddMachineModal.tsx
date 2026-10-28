import React, { useState } from 'react';
import { X, PlusCircle, Cpu, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';
import { NewMachineInput, UserProfile } from '../types';
import { apiClient } from '../services/apiClient';

interface AddMachineModalProps {
  user: UserProfile;
  nextSuggestedId: string;
  onClose: () => void;
  onMachineCreated: (createdMachine: any) => void;
}

const MACHINE_TYPES = [
  '5-Axis CNC Machining Center',
  'CNC Vertical Machining Center',
  'CNC Horizontal Machining Center',
  'CNC Turning Center',
  'CNC Grinding Machine',
  'CNC Drilling and Tapping Center',
  'CNC Mill-Turn Center',
];

const DEPARTMENTS = [
  'Floor A1: Aerospace Micro-Milling',
  'Floor A2: Medical Implant Fabrication',
  'Floor A3: High-Speed Precision Drilling',
  'Floor B1: Transmission Gear & Shaft Line',
  'Floor B2: Engine Block Machining',
  'Floor B3: Drivetrain Mill-Turn Cells',
  'Floor C1: Turbine & Casing Machining',
  'Floor C2: Heavy Structural Frames',
  'Floor D1: Cylindrical & Surface Grinding',
  'Floor D2: Precision Bore & Internal Grinding',
];

export const AddMachineModal: React.FC<AddMachineModalProps> = ({
  user,
  nextSuggestedId,
  onClose,
  onMachineCreated,
}) => {
  const [formData, setFormData] = useState<NewMachineInput>({
    name: '',
    machine_type: '5-Axis CNC Machining Center',
    department: 'Floor A1: Aerospace Micro-Milling',
    location: 'Bay 4, Station 12',
    status: 'Nominal',
    installation_date: new Date().toISOString().split('T')[0],
    manufacturer: 'Mazak',
    description: '',
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Machine Name is required.');
      return;
    }
    if (!formData.location.trim()) {
      setError('Factory Section / Location is required.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (formData.installation_date > today) {
      setError('Installation Date cannot be in the future.');
      return;
    }

    setSaving(true);
    try {
      const result = await apiClient.createMachine(formData);
      setSuccessResult(result);
      onMachineCreated(result.machine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create machine.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#070d18] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800/80 bg-[#0c1424] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-teal-400">
                Administration Console
              </span>
              <h1 className="text-lg font-bold text-slate-100">Add New Machine</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {successResult ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Machine Registered Successfully</h2>
                <p className="mt-1 text-xs text-slate-300">
                  {successResult.message || `Machine ${successResult.machine_id} is now registered in SQL and the AI Simulator.`}
                </p>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-[#0c1424] p-4 text-left text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Machine ID:</span>
                  <span className="text-cyan-300 font-bold">{successResult.machine_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Machine Code:</span>
                  <span className="text-slate-200">{successResult.machine_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Simulation Status:</span>
                  <span className="text-emerald-300 font-bold">Synchronized (Live Active)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Database Storage:</span>
                  <span className="text-teal-300">MySQL Table 'machines'</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Machine Count:</span>
                  <span className="text-teal-300 font-bold">Updated (e.g. 50 → 51)</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-teal-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-colors"
                >
                  Done &amp; View in Management Table
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {error && (
                <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-3.5 text-xs text-rose-200 flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* ID auto-generation note */}
              <div className="flex items-center justify-between rounded-xl border border-teal-800/50 bg-[#0c1a2e] p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-teal-300" />
                  <span className="text-slate-300">
                    Automatically Generated Canonical ID: <strong className="font-mono text-teal-300">{nextSuggestedId}</strong>
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Unique · Non-colliding</span>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Machine Name */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Machine Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5-Axis Precision Machining Center 51"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Manufacturer */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Manufacturer (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Mazak, DMG MORI, Haas, Makino"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>

                {/* Machine Type */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Machine Type *</label>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.machine_type}
                    onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                  >
                    {MACHINE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Department *</label>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Factory Section / Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bay 4, Station 12, South Corridor"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                {/* Installation Date */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Installation Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.installation_date}
                    onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                  />
                </div>

                {/* Machine Status */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Initial Operating Status</label>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="Nominal">Nominal (Running)</option>
                    <option value="Idle">Idle (Waiting)</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Down">Down (Stoppage)</option>
                    <option value="Warning">Warning</option>
                  </select>
                </div>

                {/* Simulation toggle */}
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span className="font-semibold text-teal-300">
                      Activate immediately in AI Simulator roster
                    </span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description &amp; Workpiece Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dedicated high-torque machining station for aerospace titanium brackets."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 text-xs focus:border-teal-500 focus:outline-hidden resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Integration note */}
              <p className="text-[11px] text-slate-400 leading-relaxed rounded-lg bg-[#0c1424] p-3 border border-slate-800">
                Notice: Machine identity is persisted in SQL. The AI Simulator is automatically updated to produce live telemetry for this machine without restarting the application.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-500 hover:bg-teal-400 px-5 py-2 text-xs font-semibold text-slate-950 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating Machine...' : 'Add Machine'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
