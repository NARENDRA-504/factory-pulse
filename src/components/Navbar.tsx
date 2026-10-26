import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { SEED_USERS } from '../data/seedData';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  LogOut,
  ShieldCheck,
  User,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile;
  currentScreen: 'dashboard' | 'machines' | 'incidents' | 'analytics';
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics') => void;
  onSwitchUser: (user: UserProfile) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentScreen,
  onNavigate,
  onSwitchUser,
  onLogout,
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Operator':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      case 'Supervisor':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
      case 'Manager':
        return 'text-purple-400 bg-purple-950/60 border-purple-800';
      case 'Maintenance':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'Admin':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#090e17]/95 backdrop-blur border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-6">
        {/* Zone 1: Clean Brand Wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-7 h-7 rounded bg-cyan-600 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm">
            ZI
          </div>
          <span className="font-semibold text-sm text-slate-100 tracking-tight">
            ZIRO Operations
          </span>
        </div>

        {/* Zone 2: Navigation Links (Single-Line) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentScreen === 'dashboard'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onNavigate('machines')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentScreen === 'machines'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Machine Condition</span>
          </button>

          <button
            onClick={() => onNavigate('incidents')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentScreen === 'incidents'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Incidents &amp; Issues</span>
          </button>

          <button
            onClick={() => onNavigate('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentScreen === 'analytics'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Analytics &amp; Maintenance</span>
          </button>
        </nav>

        {/* Zone 3: Active Profile & Fast Role Selector for Review */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900/80 border border-slate-700 hover:border-slate-600 transition-colors text-left"
              title="Click to switch test user for role demonstration"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {currentUser.fullName}
                </span>
                <span className="text-[10px] font-mono text-slate-400 leading-tight">
                  {currentUser.workId}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${getRoleBadgeColor(
                  currentUser.role
                )}`}
              >
                {currentUser.role}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                    Fast Demo Role Switcher
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Switch user to verify backend-enforced permissions
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
                      user.id === currentUser.id ? 'bg-slate-800/50 text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{user.workId}</div>
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

          <button
            onClick={onLogout}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
