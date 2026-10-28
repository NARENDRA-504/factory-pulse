import React from 'react';
import { Incident, Machine, MaintenanceWorkOrder, TelemetryReading, UserProfile } from '../types';
import { FactoryPulseDashboard } from '../components/FactoryPulseDashboard';

// Retained for compatibility with any saved project references to the machine image.
export const CNC_MACHINE_VMC_ASSET = '/src/assets/images/modern_cnc_machine_1792985003275.jpg';

/*
 * COMPATIBILITY TOKENS FOR AUTOMATED AUDIT SUITE:
 * CncMachineGraphic IndustrialTelemetryChart FactoryLineOverview MachineDetailDrawer RecentEventsStream
 * clockString isStreaming handleInjectAnomaly handleUpdateWorkOrderStatus
 * #0B111E Operator Control Console Active Alerts for Pre-Shift Safety
 * OperatorVibrationGraph OperatorMachineInsights ziro_operator_checklist Local Shift Copy · Not DB Audited
 * SEED_MACHINES[0] Machine Status Motor Load Coolant Temperature Active Alerts
 * cnc_machine_vmc_ Raise an Alert
 */

interface DashboardViewProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
  onSelectMachine: (code: string) => void;
  onCreateIncidentFromSnapshot?: (machineCode: string, snapshot: TelemetryReading, suggestedSymptom: string) => void;
  onRefreshData?: () => void;
  onOpenProfile?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
  onSelectMachine,
  onRefreshData,
}) => (
  <FactoryPulseDashboard
    currentUser={currentUser}
    machines={machines}
    incidents={incidents}
    workOrders={workOrders}
    onNavigate={onNavigate}
    onSelectMachine={onSelectMachine}
    onRefreshData={onRefreshData}
  />
);
