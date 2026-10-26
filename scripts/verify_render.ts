import React from 'react';
import { renderToString } from 'react-dom/server';
import { SEED_MACHINES, SEED_USERS, SEED_INCIDENTS, SEED_WORK_ORDERS } from '../src/data/seedData';
import { CncMachineGraphic } from '../src/components/CncMachineGraphic';
import { IndustrialTelemetryChart } from '../src/components/IndustrialTelemetryChart';
import { FactoryLineOverview } from '../src/components/FactoryLineOverview';
import { MachineDetailDrawer } from '../src/components/MachineDetailDrawer';
import { RecentEventsStream } from '../src/components/RecentEventsStream';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import App from '../src/App';
import { MachineConditionView } from '../src/views/MachineConditionView';
import { IncidentsView } from '../src/views/IncidentsView';
import { AnalyticsView } from '../src/views/AnalyticsView';
import { LoginView } from '../src/views/LoginView';
import { DashboardView } from '../src/views/DashboardView';

const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => {}
};
(global as any).window = {
  localStorage: (global as any).localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { reload: () => {} }
};

async function runVerification() {
  console.log('--- 1. Testing CncMachineGraphic ---');
  let html = renderToString(React.createElement(CncMachineGraphic, {
    machineCode: 'CNC-MILL-01',
    machineName: 'Haas VF-2SS 5-Axis VMC',
    status: 'Nominal',
    activeAnomaly: null,
    spindleRpm: 4500,
    motorLoadPct: 62.4,
    motorPowerKw: 11.2,
    feedRateMmpm: 1450,
    vibRms: 0.042,
    coolantTempC: 22.8,
    reducedMotion: false,
  }));
  console.log('✓ CncMachineGraphic full props:', html.length, 'chars');

  html = renderToString(React.createElement(CncMachineGraphic as any, {}));
  console.log('✓ CncMachineGraphic default props:', html.length, 'chars');

  console.log('--- 2. Testing IndustrialTelemetryChart ---');
  html = renderToString(React.createElement(IndustrialTelemetryChart, {
    title: 'Tool Wear Progression (Dataset 1: Vb)',
    unit: 'mm',
    data: [{ x: 1, y: 0.1 }, { x: 2, y: 0.15 }],
  }));
  console.log('✓ IndustrialTelemetryChart with parenthesized title:', html.length, 'chars');

  html = renderToString(React.createElement(IndustrialTelemetryChart as any, {
    data: [{ x: 1, y: 0.1 }],
  }));
  console.log('✓ IndustrialTelemetryChart with omitted title:', html.length, 'chars');

  console.log('--- 3. Testing FactoryLineOverview ---');
  html = renderToString(React.createElement(FactoryLineOverview, {
    machines: SEED_MACHINES,
    incidents: SEED_INCIDENTS,
    selectedMachineCode: 'CNC-MILL-01',
    onSelectMachine: () => {},
    onOpenMachineDrawer: () => {},
  }));
  console.log('✓ FactoryLineOverview with data:', html.length, 'chars');

  html = renderToString(React.createElement(FactoryLineOverview as any, {}));
  console.log('✓ FactoryLineOverview with empty props:', html.length, 'chars');

  console.log('--- 4. Testing MachineDetailDrawer ---');
  html = renderToString(React.createElement(MachineDetailDrawer, {
    machine: SEED_MACHINES[0],
    onClose: () => {},
    incidents: SEED_INCIDENTS,
    onNavigateToTelemetry: () => {},
    onNavigateToCreateIncident: () => {},
  }));
  console.log('✓ MachineDetailDrawer open:', html.length, 'chars');

  html = renderToString(React.createElement(MachineDetailDrawer, {
    machine: null,
    onClose: () => {},
    incidents: [],
    onNavigateToTelemetry: () => {},
    onNavigateToCreateIncident: () => {},
  }));
  console.log('✓ MachineDetailDrawer null machine:', html.length, 'chars');

  console.log('--- 5. Testing RecentEventsStream ---');
  html = renderToString(React.createElement(RecentEventsStream, {
    events: [],
  }));
  console.log('✓ RecentEventsStream empty:', html.length, 'chars');

  console.log('--- 6. Testing ErrorBoundary ---');
  html = renderToString(React.createElement(ErrorBoundary, null, React.createElement('div', null, 'Child renders')));
  console.log('✓ ErrorBoundary render:', html.length, 'chars');

  console.log('--- 7. Testing LoginView ---');
  html = renderToString(React.createElement(LoginView, { onLoginSuccess: () => {} }));
  console.log('✓ LoginView render:', html.length, 'chars');

  console.log('--- 8. Testing IncidentsView ---');
  html = renderToString(React.createElement(IncidentsView, {
    currentUser: SEED_USERS[0],
    incidents: SEED_INCIDENTS,
    onRefreshIncidents: () => {}
  }));
  console.log('✓ IncidentsView render:', html.length, 'chars');

  console.log('--- 9. Testing AnalyticsView ---');
  html = renderToString(React.createElement(AnalyticsView));
  console.log('✓ AnalyticsView render:', html.length, 'chars');

  console.log('--- 10. Testing MachineConditionView ---');
  html = renderToString(React.createElement(MachineConditionView, {
    currentUser: SEED_USERS[0],
    machines: SEED_MACHINES,
    selectedMachineCode: 'CNC-MILL-01',
    onSelectMachine: () => {},
    onCreateIncidentFromSnapshot: () => {}
  }));
  console.log('✓ MachineConditionView with SEED_MACHINES:', html.length, 'chars');

  html = renderToString(React.createElement(MachineConditionView, {
    currentUser: SEED_USERS[0],
    machines: [],
    selectedMachineCode: 'CNC-MILL-01',
    onSelectMachine: () => {},
    onCreateIncidentFromSnapshot: () => {}
  }));
  console.log('✓ MachineConditionView with empty machines array:', html.length, 'chars');

  console.log('--- 11. Testing DashboardView for All 5 Roles ---');
  for (const user of SEED_USERS) {
    html = renderToString(React.createElement(DashboardView, {
      currentUser: user,
      machines: SEED_MACHINES,
      incidents: SEED_INCIDENTS,
      workOrders: SEED_WORK_ORDERS,
      onNavigate: () => {},
      onSelectMachine: () => {},
      onCreateIncidentFromSnapshot: () => {},
      onRefreshData: () => {}
    }));
    console.log(`✓ DashboardView role ${user.role} (${user.fullName}): ${html.length} chars`);
  }

  console.log('--- 12. Testing Root App Mounting (Unauthenticated & Authenticated) ---');
  delete store['ziro_current_user'];
  html = renderToString(React.createElement(App));
  console.log('✓ App login state (unauthenticated):', html.length, 'chars');

  for (const user of SEED_USERS) {
    store['ziro_current_user'] = JSON.stringify(user);
    html = renderToString(React.createElement(App));
    console.log(`✓ Full App mounted for role ${user.role}: ${html.length} chars`);
  }

  console.log('\n========================================');
  console.log('>>> ALL VERIFICATION CHECKS PASSED 100% <<<');
  console.log('========================================');
}

runVerification().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
