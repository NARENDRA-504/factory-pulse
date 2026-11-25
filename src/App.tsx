import { useOperationalInbox, OperationalAlertCenter } from './components/ReliabilityPanels';
import { AlertSoundControl } from './components/AlertSoundControl';
import { SuperAdminUserSwitcher } from './components/SuperAdminUserSwitcher';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { UserProfile, Machine, Incident, MaintenanceWorkOrder, TelemetryReading } from './types';
import { apiClient } from './services/apiClient';
import { SEED_MACHINES, SEED_INCIDENTS, SEED_WORK_ORDERS } from './data/seedData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { RaiseAlertModal } from './components/RaiseAlertModal';
import { UserProfileModal } from './components/UserProfileModal';
import { ShieldAlert } from 'lucide-react';
import { DraggableAssistant } from './components/DraggableAssistant';
import { SopGuidancePanel } from './components/SopGuidancePanel';
import { LoginView } from './views/LoginView';
import { AppScreen, canOpenScreen } from './roleNavigation';


// Load operational pages only when opened; server authorization remains unchanged.
const ReadinessReview = lazy(() => import('./components/ReadinessReview').then(module => ({ default: module.ReadinessReview })));
const CompletionEvidence = lazy(() => import('./components/CompletionEvidence').then(module => ({ default: module.CompletionEvidence })));
const OperationalReadiness = lazy(() => import('./components/OperationalReadiness').then(module => ({ default: module.OperationalReadiness })));
const MachineChangeView = lazy(() => import('./views/MachineChangeView').then(module => ({ default: module.MachineChangeView })));
const FactoryChat = lazy(() => import('./components/FactoryChat').then(module => ({ default: module.FactoryChat })));
const DashboardView = lazy(() => import('./views/DashboardView').then(module => ({ default: module.DashboardView })));
const MachineConditionView = lazy(() => import('./views/MachineConditionView').then(module => ({ default: module.MachineConditionView })));
const IncidentsView = lazy(() => import('./views/IncidentsView').then(module => ({ default: module.IncidentsView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then(module => ({ default: module.AnalyticsView })));
const UsersView = lazy(() => import('./views/UsersView').then(module => ({ default: module.UsersView })));
const ActivityLogView = lazy(() => import('./views/ActivityLogView').then(module => ({ default: module.ActivityLogView })));
const MachineManagementView = lazy(() => import('./views/MachineManagementView').then(module => ({ default: module.MachineManagementView })));
const MaintenanceManagementView = lazy(() => import('./views/MaintenanceManagementView').then(module => ({ default: module.MaintenanceManagementView })));
const RoleOperationsView = lazy(() => import('./views/RoleOperationsView').then(module => ({ default: module.RoleOperationsView })));

function PageLoading() {
  return <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading workspace…</div>;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('CNC-MILL-01');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isGlobalAlertOpen, setIsGlobalAlertOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);
  const alertInbox=useOperationalInbox(currentUser);
  const [dataError,setDataError]=useState('');
  const ownerKey=currentUser?[currentUser.id,currentUser.role,currentUser.assignedMachine,currentUser.department].join('|'):'';
  const ownerRef=useRef(ownerKey);ownerRef.current=ownerKey;
  const refreshingOwner=useRef<string|null>(null);

  // Handoff state for filing incident from telemetry anomaly snapshot
  const [handoffMachine, setHandoffMachine] = useState<string | undefined>(undefined);
  const [handoffSnapshot, setHandoffSnapshot] = useState<TelemetryReading | undefined>(undefined);

  // Load initial data
  const refreshData = async () => {
    if (!currentUser || refreshingOwner.current===ownerKey) return;
    const requestedOwner=ownerKey;refreshingOwner.current=requestedOwner;
    try {
    const [machList, incList, woList] = await Promise.all([
      apiClient.getMachines(),
      apiClient.getIncidents(),
      currentUser.role === 'Operator' ? Promise.resolve([]) : apiClient.getWorkOrders(),
    ]);
    if(ownerRef.current!==requestedOwner)return;
    setMachines(machList||[]);
    if (incList) setIncidents(incList);
    if (woList) setWorkOrders(woList);
    setDataError('');
    } catch(error) {
      if(ownerRef.current===requestedOwner)setDataError('Operations data could not refresh. Previously loaded records may be out of date. Check machine availability and retry.');
      throw error;
    } finally {if(refreshingOwner.current===requestedOwner)refreshingOwner.current=null;}
  };

  useEffect(() => {
    let active = true;
    apiClient.getCurrentUser().then((user) => {
      if (active) setCurrentUser(user);
    }).catch(() => {
      if (active) setCurrentUser(null);
    }).finally(() => {
      if (active) setSessionRestoring(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(()=>{setMachines([]);setIncidents([]);setWorkOrders([]);setDataError('');},[ownerKey]);

  useEffect(() => {
    refreshData().catch(console.error);
    const timer=window.setInterval(()=>refreshData().catch(console.error),10000);
    const changed = () => { refreshData().catch(console.error); };
    window.addEventListener('factorypulse:incidents-changed', changed);
    return ()=>{ window.clearInterval(timer); window.removeEventListener('factorypulse:incidents-changed', changed); };
  }, [currentUser]);

  // Account assignments can change while an employee is signed in.
  useEffect(() => {
    if (!currentUser) return;
    let active=true;
    const timer = window.setInterval(async () => {
      try {
        const next = await apiClient.getCurrentUser();
        if(active)setCurrentUser(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      } catch { /* Keep the current page visible during a temporary API outage. */ }
    }, 10000);
    return () => {active=false;window.clearInterval(timer);};
  }, [currentUser?.workId]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Sign-out could not be confirmed by the server.', error);
    } finally {
      setCurrentUser(null);
      setChatOpen(false);
      setCurrentScreen('dashboard');
    }
  };

  const handleCreateIncidentFromSnapshot = (
    machineCode: string,
    snapshot: TelemetryReading,
    _suggestedSymptom: string
  ) => {
    setHandoffMachine(machineCode);
    setHandoffSnapshot(snapshot);
    setCurrentScreen('incidents');
  };

  // If unauthenticated, show Screen 1: Login
  if (sessionRestoring) {
    return <div className="min-h-screen bg-slate-50 text-slate-700 flex items-center justify-center text-sm">Checking your FactoryPulse session…</div>;
  }
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const activeIncidentsCount = incidents.filter((i) => i.status !== 'Closed').length;
  const currentFocusedMachine = machines.find((m) => m.code === selectedMachineCode) || machines[0] || SEED_MACHINES[0];

  return (
    <div className="fp-shell min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* 1. Left Navigation Sidebar (Deep Navy Industrial Look) */}
      <Sidebar
        currentUser={currentUser}
        currentScreen={currentScreen}
        onNavigate={(screen) => {
          setHandoffSnapshot(undefined);
          setHandoffMachine(undefined);
          if (canOpenScreen(currentUser.role, screen)) setCurrentScreen(screen);
        }}
        onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        activeIncidentsCount={activeIncidentsCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Canvas (Light FactoryPulse dashboard theme) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Context Bar with Breadcrumb, Title, and Action Controls */}
        <SuperAdminUserSwitcher user={currentUser} />
        <TopBar
          currentUser={currentUser}
          currentScreen={currentScreen}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onRefreshData={refreshData}
          onRaiseAlert={() => setIsGlobalAlertOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          unreadNotificationsCount={alertInbox.data?.alerts.filter((a:any)=>!a.acknowledged_at).length||0}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        />

        <AlertSoundControl key={alertInbox.owner} owner={alertInbox.owner} alerts={alertInbox.data?.alerts??null}/>
        {/* Viewport Content */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-5">
          {dataError&&<div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{dataError}</p><button className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium" onClick={()=>void refreshData().catch(console.error)}>Retry operations refresh</button></div>}
          <SopGuidancePanel screen={currentScreen} user={currentUser} machineId={(currentUser.role === 'Operator' ? machines.find(machine => machine.machineCode === currentUser.assignedMachine || machine.code === currentUser.assignedMachine) : machines.find(machine => machine.machineCode === selectedMachineCode || machine.code === selectedMachineCode))?.machineId}/>
          <ErrorBoundary key={currentScreen} fallbackTitle="Unable to display this page">
          <Suspense fallback={<PageLoading />}>
            {(['production', 'coverage', 'downtime', 'quality', 'reports'] as const).map(page => currentScreen === page && (canOpenScreen(currentUser.role, page) ? <RoleOperationsView key={page} screen={page} user={currentUser} machines={machines} incidents={incidents} workOrders={workOrders} onNavigate={setCurrentScreen} /> : <p key={page} role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">This page is unavailable for your role.</p>))}
            {currentScreen === 'dashboard' && (
              <DashboardView
                currentUser={currentUser}
                machines={machines}
                incidents={incidents}
                workOrders={workOrders}
                onNavigate={(screen) => setCurrentScreen(screen)}
                onSelectMachine={(code) => setSelectedMachineCode(code)}
                onCreateIncidentFromSnapshot={handleCreateIncidentFromSnapshot}
                onRefreshData={refreshData}
                onOpenProfile={() => setIsProfileModalOpen(true)}
              />
            )}

            {currentScreen === 'machines' && (
              <MachineConditionView
                currentUser={currentUser}
                machines={machines}
                selectedMachineCode={selectedMachineCode}
                onSelectMachine={(code) => setSelectedMachineCode(code)}
                onCreateIncidentFromSnapshot={handleCreateIncidentFromSnapshot}
              />
            )}

            {currentScreen === 'incidents' && (
              <IncidentsView
                currentUser={currentUser}
                incidents={incidents}
                onRefreshIncidents={refreshData}
                initialMachineForReport={handoffMachine}
                initialSnapshotForReport={handoffSnapshot}
              />
            )}

            {currentScreen === 'analytics' && (
              currentUser.role === 'Operator' ? (
                <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
                  <ShieldAlert className="w-12 h-12 text-rose-700 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900 font-display">Access Restricted</h2>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Operators are restricted to shop-floor telemetry and incident reporting. Full empirical data analytics and research datasets require Supervisor, Manager, or Maintenance authorization.
                  </p>
                  <button
                    onClick={() => setCurrentScreen('dashboard')}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-slate-900 text-xs font-semibold font-mono"
                  >
                    Return to My Machine Console
                  </button>
                </div>
              ) : (
                <AnalyticsView />
              )
            )}

            {currentScreen === 'users' && (
              !['Admin', 'Super Admin'].includes(currentUser.role) ? (
                <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
                  <ShieldAlert className="w-12 h-12 text-rose-700 mx-auto" />
                  <h2 className="text-lg font-bold text-slate-900 font-display">Administrative Authority Required</h2>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Personnel administration and Role-Based Access Control (RBAC) governance is restricted exclusively to System Administrators.
                  </p>
                  <button
                    onClick={() => setCurrentScreen('dashboard')}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-slate-900 text-xs font-semibold font-mono"
                  >
                    Return to Dashboard
                  </button>
                </div>
              ) : (
                <UsersView
                  currentUser={currentUser}
                  machines={machines}
                  incidents={incidents}
                />
              )
            )}
            {currentScreen === 'readiness-review' && <React.Fragment key={ownerKey}><ReadinessReview user={currentUser}/><CompletionEvidence/></React.Fragment>}
            {currentScreen === 'readiness' && <OperationalReadiness key={ownerKey} user={currentUser} onNavigate={setCurrentScreen}/>}
            {currentScreen === 'machine-changes' && <MachineChangeView user={currentUser} />}
            {currentScreen === 'inventory' && (['Admin', 'Super Admin'].includes(currentUser.role)
              ? <MachineManagementView user={currentUser} machines={machines}/>
              : <p className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-800">Machine management requires Admin access.</p>)}
            {currentScreen === 'maintenance' && (
              <MaintenanceManagementView
                currentUser={currentUser}
                machines={machines}
                incidents={incidents}
                onNavigateToMachine={(code) => {
                  setSelectedMachineCode(code);
                  setCurrentScreen('machines');
                }}
                onNavigateToIncident={(_code) => {
                  setCurrentScreen('incidents');
                }}
              />
            )}
            {currentScreen === 'activity' && (
              !['Admin', 'Super Admin'].includes(currentUser.role) ? (
                <div className="m-12 rounded-xl border border-rose-200 bg-white p-8 text-center"><h2 className="font-bold text-slate-900">Admin access required</h2><p className="mt-2 text-sm text-slate-600">This activity log is restricted to administrators.</p></div>
              ) : <ActivityLogView />
            )}
          </Suspense>
          </ErrorBoundary>
        </main>

        <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
          FactoryPulse · Manufacturing operations
        </footer>
      </div>

      {isNotificationCenterOpen&&<OperationalAlertCenter inbox={alertInbox} user={currentUser} onClose={()=>setIsNotificationCenterOpen(false)} onIncidents={()=>{setCurrentScreen('incidents');setIsNotificationCenterOpen(false);}}/>}

      {/* Global Quick Raise Alert Modal */}
      <RaiseAlertModal
        isOpen={isGlobalAlertOpen}
        onClose={() => setIsGlobalAlertOpen(false)}
        machine={currentFocusedMachine}
        latestTelemetry={apiClient.getLiveTelemetrySnapshot(currentFocusedMachine.code)}
        currentUser={currentUser}
        onIncidentCreated={(_newInc) => {
          refreshData();
        }}
      />

      <DraggableAssistant open={chatOpen} onOpenChange={setChatOpen} role={currentUser.role}>
        <ErrorBoundary fallbackTitle="Unable to load the assistant"><Suspense fallback={<PageLoading />}><FactoryChat machineId={(currentUser.role === 'Operator' ? machines.find(machine => machine.machineCode === currentUser.assignedMachine || machine.code === currentUser.assignedMachine) : machines.find(machine => machine.machineCode === selectedMachineCode || machine.code === selectedMachineCode))?.machineId} /></Suspense></ErrorBoundary>
      </DraggableAssistant>

      {/* User Profile & Permissions Modal */}
      <UserProfileModal
        user={currentUser}
        currentUser={currentUser}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}
