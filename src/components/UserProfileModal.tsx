import React from 'react';
import { UserProfile, UserRole } from '../types';
import {
  X,
  ShieldCheck,
  User,
  Mail,
  Cpu,
  Clock,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

interface UserProfileModalProps {
  user: UserProfile | null;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  isOpen,
  onClose,
  onLogout,
}) => {
  if (!isOpen || !user) return null;

  const isSelf = user.workId === currentUser.workId;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Operator':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Supervisor':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'Manager':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'Maintenance':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Admin':
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  const permissionsList = [
    {
      name: 'Report Machine Incidents',
      desc: 'Submit alerts with snapshot readings',
      allowed: ['Operator', 'Supervisor', 'Maintenance'].includes(user.role),
    },
    {
      name: 'View Real-time Telemetry',
      desc: 'Access vibration, speed & load charts',
      allowed: true, // all roles
    },
    {
      name: 'Assign Incident Work Orders',
      desc: 'Dispatch technicians and set priority',
      allowed: ['Supervisor'].includes(user.role),
    },
    {
      name: 'Log Maintenance Repair Progress',
      desc: 'Update investigation & action taken',
      allowed: ['Maintenance'].includes(user.role),
    },
    {
      name: 'Authorize Incident Closure',
      desc: 'Sign off and archive resolved tickets',
      allowed: ['Supervisor', 'Maintenance'].includes(user.role),
    },
    {
      name: 'Inject Simulated Telemetry & Faults',
      desc: 'Trigger chatter, thermal, or feed anomalies',
      allowed: ['Supervisor', 'Maintenance'].includes(user.role),
    },
    {
      name: 'Access Strategic Power BI & Analytics',
      desc: 'View tool wear, roughness & cycle benchmarks',
      allowed: ['Supervisor', 'Manager', 'Maintenance', 'Admin'].includes(user.role),
    },
    {
      name: 'Security Governance & User Management',
      desc: 'Configure RBAC, audit logs & personnel roster',
      allowed: ['Admin'].includes(user.role),
    },
  ];
  const grantedPermissions = permissionsList.filter((permission) => permission.allowed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-800">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Personnel Profile &amp; RBAC Clearance
              </h3>
              <p className="text-xs text-slate-600 font-mono">
                Badge Code: {user.workId} · ID #{user.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card Overview */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-lg text-teal-800 shrink-0">
                {user.fullName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-slate-900">{user.fullName}</span>
                  {isSelf && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${getRoleBadge(
                      user.role
                    )}`}
                  >
                    {user.role}
                  </span>
                  <span className="text-xs text-slate-600">
                    {user.department || 'Floor Operations'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-xs font-mono">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                {user.status || 'Active & Authorized'}
              </span>
              <span className="block text-slate-600 text-[11px] mt-1">
                {user.shift || 'Shift A'}
              </span>
            </div>
          </div>

          {/* Contact & Machine Assignment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-50/40 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                <Mail className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[10px] uppercase">Internal Email</span>
              </div>
              <span className="text-slate-800 truncate block">{user.email}</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50/40 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[10px] uppercase">Assigned Station</span>
              </div>
              <span className="text-teal-800 font-semibold block">
                {user.assignedMachine || 'Plant-Wide Roaming'}
              </span>
            </div>
          </div>

          {/* RBAC Permissions Matrix for this user */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                Allowed Permissions ({user.role})
              </span>
              <span className="text-[11px] font-mono text-slate-600">
                {grantedPermissions.length} available
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-800/60 bg-slate-50/30 text-xs">
              {grantedPermissions.map((perm) => (
                <div
                  key={perm.name}
                  className="p-2.5 flex items-center justify-between bg-slate-50/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="font-medium text-slate-900">
                        {perm.name}
                      </span>
                      <span className="block text-[11px] text-slate-600 font-mono">
                        {perm.desc}
                      </span>
                    </div>
                  </div>

                  <span
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded text-teal-800 bg-teal-50 border border-teal-200"
                  >
                    ALLOWED
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>Authenticated employee session</span>
          </div>

          <div className="flex items-center gap-2">
            {isSelf && onLogout && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-50 text-rose-800 border border-rose-200 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
