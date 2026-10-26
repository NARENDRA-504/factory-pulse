import React from 'react';
import { UserProfile, UserRole } from '../types';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile;
  currentScreen: 'dashboard' | 'machines' | 'incidents' | 'analytics';
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentScreen,
  onNavigate,
  onLogout,
}) => {

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

        {/* Zone 3: Authenticated Profile */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900/80 border border-slate-700 text-left">
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
