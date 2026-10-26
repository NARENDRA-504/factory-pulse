import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { SEED_USERS } from '../data/seedData';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  ChevronDown,
  LogOut,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  X,
  Gauge,
  Layers,
  Wrench,
  Radio,
  Users,
} from 'lucide-react';

interface SidebarProps {
  currentUser: UserProfile;
  currentScreen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users';
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
  onSwitchUser: (user: UserProfile) => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  activeIncidentsCount?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentScreen,
  onNavigate,
  onSwitchUser,
  onLogout,
  onOpenProfile,
  activeIncidentsCount = 0,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Operator':
        return 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80';
      case 'Supervisor':
        return 'text-teal-400 bg-teal-950/70 border-teal-800/80';
      case 'Manager':
        return 'text-purple-400 bg-purple-950/70 border-purple-800/80';
      case 'Maintenance':
        return 'text-amber-400 bg-amber-950/70 border-amber-800/80';
      case 'Admin':
        return 'text-rose-400 bg-rose-950/70 border-rose-800/80';
    }
  };

  const isOperator = currentUser.role === 'Operator';

  const handleNavClick = (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => {
    onNavigate(screen);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Deep Navy Industrial Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#070d18] border-r border-slate-800/90 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="flex flex-col">
          <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-md shadow-teal-950/50">
                FP
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-sm text-slate-100 tracking-tight">
                    FactoryPulse
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-950/80 border border-teal-800/60 text-teal-400 font-semibold">
                    v2.6
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 tracking-tight">
                  ZIRO Machining Cell
                </span>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Plant Node Status Pill */}
          <div className="mx-3 my-3 px-3 py-2 rounded-lg bg-[#0b1322] border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              <span className="text-[11px] font-mono text-slate-300 font-medium">
                Live Simulator Node
              </span>
            </div>
            <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider font-semibold">
              Online
            </span>
          </div>

          {/* Navigation Links Grouped */}
          <div className="px-3 space-y-5">
            {/* Group 1: Operations */}
            <div>
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">
                Operations
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => handleNavClick('dashboard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    currentScreen === 'dashboard'
                      ? currentUser.role === 'Admin'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-xs'
                        : 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {currentUser.role === 'Admin' ? (
                      <ShieldCheck
                        className={`w-4 h-4 ${
                          currentScreen === 'dashboard' ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      />
                    ) : (
                      <Activity
                        className={`w-4 h-4 ${
                          currentScreen === 'dashboard' ? 'text-teal-400' : 'text-slate-400'
                        }`}
                      />
                    )}
                    <span>{currentUser.role === 'Admin' ? 'Admin Dashboard' : 'Dashboard'}</span>
                  </div>
                  {currentScreen === 'dashboard' && (
                    <span className={`w-1.5 h-1.5 rounded-full ${currentUser.role === 'Admin' ? 'bg-rose-400' : 'bg-teal-400'}`} />
                  )}
                </button>

                <button
                  onClick={() => handleNavClick('machines')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    currentScreen === 'machines'
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Cpu
                      className={`w-4 h-4 ${
                        currentScreen === 'machines' ? 'text-teal-400' : 'text-slate-400'
                      }`}
                    />
                    <span>Machine Condition</span>
                  </div>
                  {currentScreen === 'machines' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  )}
                </button>

                <button
                  onClick={() => handleNavClick('incidents')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    currentScreen === 'incidents'
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        currentScreen === 'incidents' ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <span>Incidents &amp; Issues</span>
                  </div>
                  {activeIncidentsCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-700/60">
                      {activeIncidentsCount}
                    </span>
                  ) : currentScreen === 'incidents' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  ) : null}
                </button>
              </nav>
            </div>

            {/* Group 2: Intelligence & Maintenance (Hidden for Operator role per RBAC) */}
            {!isOperator && (
              <div>
                <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">
                  Intelligence &amp; Governance
                </span>
                <nav className="space-y-1">
                  <button
                    onClick={() => handleNavClick('analytics')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      currentScreen === 'analytics'
                        ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BarChart3
                        className={`w-4 h-4 ${
                          currentScreen === 'analytics' ? 'text-teal-400' : 'text-slate-400'
                        }`}
                      />
                      <span>Analytics &amp; Maintenance</span>
                    </div>
                    {currentScreen === 'analytics' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    )}
                  </button>

                  {currentUser.role === 'Admin' && (
                    <button
                      onClick={() => handleNavClick('users')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        currentScreen === 'users'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Users
                          className={`w-4 h-4 ${
                            currentScreen === 'users' ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        />
                        <span>Personnel &amp; RBAC</span>
                      </div>
                      {currentScreen === 'users' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      )}
                    </button>
                  )}
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Quick Health Info & User Profile Switcher */}
        <div className="p-3 border-t border-slate-800/80 space-y-3">
          {/* Quick System Telemetry Status Badge */}
          <div className="p-2.5 rounded-lg bg-[#0b1322] border border-slate-800/80 text-[11px] font-mono space-y-1 text-slate-400">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Telemetry Stream</span>
              <span className="text-teal-400 font-semibold flex items-center gap-1">
                <Radio className="w-3 h-3 text-teal-400 animate-pulse" /> 1.8s
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Database Engine</span>
              <span className="text-slate-300 font-medium">MySQL 8.x schema</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Empirical Datasets</span>
              <span className="text-emerald-400 font-semibold">4 Verified</span>
            </div>
          </div>

          {/* User Profile & Demo Switcher */}
          <div className="relative">
            <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => (onOpenProfile ? onOpenProfile() : setRoleMenuOpen(!roleMenuOpen))}
                className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-90 transition-opacity flex-1 min-w-0"
                title="View Personnel Profile & Permissions"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-teal-300 shrink-0">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {currentUser.fullName}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-slate-400">
                      {currentUser.workId}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded border uppercase font-medium ${getRoleBadgeColor(
                        currentUser.role
                      )}`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Switch Demo User Role"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={onLogout}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fast Role Switcher Dropdown */}
            {roleMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-[#0d1627] border border-slate-700 rounded-lg shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-teal-400 tracking-wider font-semibold">
                    Fast Demo Role Switcher
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Switch user to verify role-based permissions
                  </p>
                </div>
                {SEED_USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      onSwitchUser(user);
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 transition-colors ${
                      user.id === currentUser.id
                        ? 'bg-teal-950/40 text-teal-300 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs">{user.fullName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{user.workId}</div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
