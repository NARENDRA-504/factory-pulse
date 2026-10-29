import React from 'react';
import { Machine, TelemetryReading, UserProfile } from '../types';
import { SimulatorFleetTelemetryDashboard } from '../components/SimulatorFleetTelemetryDashboard';

interface MachineConditionViewProps {
  currentUser: UserProfile;
  machines: Machine[];
  selectedMachineCode: string;
  onSelectMachine: (code: string) => void;
  onCreateIncidentFromSnapshot: (machineCode: string, snapshot: TelemetryReading, suggestedSymptom: string) => void;
}

export const MachineConditionView: React.FC<MachineConditionViewProps> = ({ currentUser, machines }) => (
  <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-6 text-slate-900">
    <header className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">Machine condition · MySQL records</p>
      <h1 className="mt-1 text-xl font-semibold sm:text-2xl">AI Simulator machine telemetry</h1>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
        Current readings and trends below are fetched from telemetry saved by FactoryPulse in MySQL. Current values refresh four times per second and history every second. No browser-generated readings are used.
      </p>
    </header>
    <SimulatorFleetTelemetryDashboard user={currentUser} machines={machines} />
  </div>
);
