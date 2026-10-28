/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, Machine, Incident, MaintenanceWorkOrder, TelemetryReading } from './types';
import { apiClient } from './services/apiClient';
import { SEED_MACHINES, SEED_INCIDENTS, SEED_WORK_ORDERS } from './data/seedData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { RaiseAlertModal } from './components/RaiseAlertModal';
import { UserProfileModal } from './components/UserProfileModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { NotificationToast } from './components/NotificationToast';
import { notificationService, LiveNotification } from './services/notificationService';
import { ShieldAlert } from 'lucide-react';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { MachineConditionView } from './views/MachineConditionView';
import { IncidentsView } from './views/IncidentsView';
import { AnalyticsView } from './views/AnalyticsView';
import { UsersView } from './views/UsersView';
import { ActivityLogView } from './views/ActivityLogView';
import { MachineManagementView } from './views/MachineManagementView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<
    'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory'
  >('dashboard');
  const [machines, setMachines] = useState<Machine[]>(SEED_MACHINES);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('CNC-MILL-01');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isGlobalAlertOpen, setIsGlobalAlertOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<LiveNotification[]>(() =>
    notificationService.getNotificationsForRole(currentUser?.role)
  );
  const [activeToastNotification, setActiveToastNotification] = useState<LiveNotification | null>(null);

  // Handoff state for filing incident from telemetry anomaly snapshot
  const [handoffMachine, setHandoffMachine] = useState<string | undefined>(undefined);
  const [handoffSnapshot, setHandoffSnapshot] = useState<TelemetryReading | undefined>(undefined);

  // Load initial data
  const refreshData = async () => {
    if (!currentUser) return;
    const [machList, incList, woList] = await Promise.all([
      apiClient.getMachines(),
      apiClient.getIncidents(),
      currentUser.role === 'Operator' ? Promise.resolve([]) : apiClient.getWorkOrders(),
    ]);
    if (machList && machList.length > 0) setMachines(machList);
    if (incList) setIncidents(incList);
    if (woList) setWorkOrders(woList);
    setNotifications(notificationService.getNotificationsForRole(currentUser?.role));
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

  useEffect(() => {
    refreshData().catch(console.error);
    const timer=window.setInterval(()=>refreshData().catch(console.error),10000);
    return ()=>window.clearInterval(timer);
  }, [currentUser]);

  // Account assignments can change while an employee is signed in.
  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await apiClient.getCurrentUser();
        setCurrentUser(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      } catch { /* Keep the current page visible during a temporary API outage. */ }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [currentUser?.workId]);

  // Live real-time notification subscription: delivers notifications without page refresh
  useEffect(() => {
    if (currentUser) {
      notificationService.syncUserRole(currentUser.role, currentUser.assignedPlant);
    }

    const unsubscribe = notificationService.subscribe((incomingNotif) => {
      // Refresh local store and check role access
      if (!currentUser) return;
      const roleAllowed = incomingNotif.targetRoles.includes(currentUser.role);
      if (roleAllowed) {
        setNotifications((prev) => {
          const filtered = prev.filter((n) => n.id !== incomingNotif.id);
          return [incomingNotif, ...filtered];
        });
        // Pop floating toast notification
        setActiveToastNotification(incomingNotif);
        // Refresh incidents/machines state automatically
        refreshData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

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
    return <div className="min-h-screen bg-[#070d18] text-slate-300 flex items-center justify-center text-sm">Checking your FactoryPulse session…</div>;
  }
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const activeIncidentsCount = incidents.filter((i) => i.status !== 'Closed').length;
  const currentFocusedMachine = machines.find((m) => m.code === selectedMachineCode) || machines[0] || SEED_MACHINES[0];

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex font-sans antialiased selection:bg-teal-500/30 selection:text-teal-200">
      {/* 1. Left Navigation Sidebar (Deep Navy Industrial Look) */}
      <Sidebar
        currentUser={currentUser}
        currentScreen={currentScreen}
        onNavigate={(screen) => {
          setHandoffSnapshot(undefined);
          setHandoffMachine(undefined);
          setCurrentScreen(screen);
        }}
        onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        activeIncidentsCount={activeIncidentsCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Canvas (Slightly Lighter Dark Canvas) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Context Bar with Breadcrumb, Title, and Action Controls */}
        <TopBar
          currentUser={currentUser}
          currentScreen={currentScreen}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onRefreshData={refreshData}
          onRaiseAlert={() => setIsGlobalAlertOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          unreadNotificationsCount={notifications.filter((n) => !n.isRead && !n.acknowledgedAt).length}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        />

        {/* Viewport Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5">
          <ErrorBoundary fallbackTitle="View Rendering Interrupted">
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
                <div className="bg-[#0c1424] border border-rose-800/80 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
                  <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
                  <h2 className="text-lg font-bold text-white font-display">Access Restricted</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Operators are restricted to shop-floor telemetry and incident reporting. Full empirical data analytics and research datasets require Supervisor, Manager, or Maintenance authorization.
                  </p>
                  <button
                    onClick={() => setCurrentScreen('dashboard')}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold font-mono"
                  >
                    Return to My Machine Console
                  </button>
                </div>
              ) : (
                <AnalyticsView />
              )
            )}

            {currentScreen === 'users' && (
              currentUser.role !== 'Admin' ? (
                <div className="bg-[#0c1424] border border-rose-800/80 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
                  <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
                  <h2 className="text-lg font-bold text-white font-display">Administrative Authority Required</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Personnel administration and Role-Based Access Control (RBAC) governance is restricted exclusively to System Administrators.
                  </p>
                  <button
                    onClick={() => setCurrentScreen('dashboard')}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold font-mono"
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
            {currentScreen === 'inventory' && (currentUser.role === 'Admin'
              ? <MachineManagementView user={currentUser} machines={machines}/>
              : <p className="rounded-lg border border-rose-900 p-5 text-rose-200">Machine management requires Admin access.</p>)}
            {currentScreen === 'activity' && (
              currentUser.role !== 'Admin' ? (
                <div className="m-12 rounded-xl border border-rose-800 bg-[#0c1424] p-8 text-center"><h2 className="font-bold text-white">Admin access required</h2><p className="mt-2 text-sm text-slate-400">This activity log is restricted to administrators.</p></div>
              ) : <ActivityLogView />
            )}
          </ErrorBoundary>
        </main>

        {/* Industrial Platform Status Footer */}
        <footer className="border-t border-slate-800/80 py-3.5 bg-[#070d18] text-center text-xs text-slate-400 font-mono">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>FactoryPulse · Manufacturing operations</span>
            </span>
            <span className="text-slate-400">
              AI Simulator readings · persisted telemetry and history in MySQL
            </span>
          </div>
        </footer>
      </div>

      {/* Floating In-App Live Notification Toast (Zero-Refresh Alert) */}
      <NotificationToast
        notification={activeToastNotification}
        onClose={() => setActiveToastNotification(null)}
        onOpenCenter={() => {
          setActiveToastNotification(null);
          setIsNotificationCenterOpen(true);
        }}
      />

      {/* Live Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        currentUser={currentUser}
        notifications={notifications}
        onAcknowledge={(notifId) => {
          notificationService.acknowledgeNotification(notifId, currentUser.fullName);
          setNotifications(notificationService.getNotificationsForRole(currentUser.role));
        }}
        onDismiss={(notifId) => {
          notificationService.dismissNotification(notifId);
          setNotifications(notificationService.getNotificationsForRole(currentUser.role));
        }}
        onNavigateToMachine={(code) => {
          setSelectedMachineCode(code);
          setCurrentScreen('machines');
          setIsNotificationCenterOpen(false);
        }}
        onNavigateToIncidents={() => {
          setCurrentScreen('incidents');
          setIsNotificationCenterOpen(false);
        }}
      />

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
