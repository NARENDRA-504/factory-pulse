import React from 'react';
import { UserProfile } from '../types';
import {
  Menu,
  RotateCcw,
  Clock,
  Shield,
  Radio,
  AlertTriangle,
  ChevronRight,
  Bell,
} from 'lucide-react';

interface TopBarProps {
  currentUser: UserProfile;
  currentScreen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory' | 'maintenance';
  onOpenMobileSidebar: () => void;
  onRefreshData?: () => void;
  onRaiseAlert?: () => void;
  onOpenProfile?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  currentScreen,
  onOpenMobileSidebar,
  onRefreshData,
  onRaiseAlert,
  onOpenProfile,
  unreadNotificationsCount,
  onOpenNotifications,
}) => {
  const getBreadcrumb = () => {
    switch (currentScreen) {
      case 'dashboard':
        if (currentUser.role === 'Admin') {
          return {
            parent: 'Factory Governance',
            current: 'Admin Master Oversight',
            subtitle: 'Personnel directory, incidents raised by users, machine allocations & root audit',
          };
        }
        return {
          parent: 'Operations',
          current: 'Control Console',
          subtitle: 'Live machine readings and operational actions',
        };
      case 'machines':
        return {
          parent: 'Operations',
          current: 'Machine Condition',
          subtitle: 'Saved simulator readings, roster values & reference limits',
        };
      case 'incidents':
        return {
          parent: 'Operations',
          current: 'Incidents & Issues',
          subtitle: 'Reported issues, triage status & maintenance dispatch',
        };
      case 'analytics':
        return {
          parent: 'Intelligence & Assets',
          current: 'Analytics & Maintenance',
          subtitle: 'Project dataset summaries and analysis tools',
        };
    case 'users':
      return {
          parent: 'Factory Governance',
          current: 'Personnel & Access Control',
          subtitle: 'Employee credentials, 5-tier RBAC matrix & station clearances',
      };
    case 'activity':
      return {
        parent: 'Governance',
        current: 'Activity Log',
        subtitle: 'Authentication and operational audit events',
      };
    case 'inventory':
      return { parent: 'Governance', current: 'Machine Management', subtitle: 'Registry provenance, live connections and selected machine evidence' };
    case 'maintenance':
      return { parent: 'Operations', current: 'Maintenance Management', subtitle: 'Work orders, technician dispatch & MTTR repair metrics' };
    }
  };

  const info = getBreadcrumb();

  return (
    <header className="sticky top-0 z-30 bg-[#0c1424]/95 backdrop-blur-md border-b border-slate-800/90 shadow-sm px-4 sm:px-6 lg:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Hamburger (mobile) + Breadcrumbs + Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex flex-col min-w-0">
            {/* Breadcrumb Context */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span>Factory Floor</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>{info.parent}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="text-teal-300 font-semibold truncate">{info.current}</span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="font-display font-bold text-base sm:text-lg text-slate-100 tracking-tight truncate">
                {info.current}
              </h1>
              <span className="hidden md:inline-block text-xs text-slate-400 font-normal truncate">
                — {info.subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Operational Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Refresh Button */}
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 shadow-xs text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Refresh platform data"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Raise an Alert Quick Action */}
          {onRaiseAlert && (
            <button
              onClick={onRaiseAlert}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs transition-all tracking-wide"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
              <span>Report Problem</span>
            </button>
          )}

          {/* Live Notification Bell */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 shadow-xs transition-colors"
              title="Open Notifications & Alerts"
              aria-label="Open Notifications"
            >
              <Bell className="w-4 h-4 text-slate-300" />
              {(unreadNotificationsCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center animate-pulse shadow-xs">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Role badge */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 pl-2 sm:border-l border-slate-700 hover:opacity-85 transition-opacity"
            title="View User Profile & Permissions"
          >
            <span className="text-xs text-slate-300 font-medium hidden md:inline">
              {currentUser.workId}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
              {currentUser.role}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
