import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, Machine, Incident } from '../types';
import { SEED_USERS, SEED_MACHINES } from '../data/seedData';
import { apiClient } from '../services/apiClient';
import { UserProfileModal } from '../components/UserProfileModal';
import { SimpleBarChart } from '../components/SimpleBarChart';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  ArrowRightLeft,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Mail,
  Edit2,
  Trash2,
  RotateCcw,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

interface UsersViewProps {
  currentUser: UserProfile;
  machines?: Machine[];
  incidents?: Incident[];
  onSwitchUser: (user: UserProfile) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  currentUser,
  machines = SEED_MACHINES,
  incidents = [],
  onSwitchUser,
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>(SEED_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState<UserProfile | null>(null);
  const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Form states for creating/editing users
  const [formName, setFormName] = useState('');
  const [formWorkId, setFormWorkId] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Operator');
  const [formDepartment, setFormDepartment] = useState('');
  const [formMachine, setFormMachine] = useState('');
  const [formShift, setFormShift] = useState<'Shift A' | 'Shift B' | 'Night Shift'>('Shift A');
  const [formEmail, setFormEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const users = await apiClient.getUsers();
      if (users) {
        setUsersList(users);
      }
    } catch {
      setUsersList(SEED_USERS);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const isAdmin = currentUser.role === 'Admin';

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'Operator':
        return 'text-emerald-400 bg-emerald-950/80 border-emerald-800/80';
      case 'Supervisor':
        return 'text-teal-400 bg-teal-950/80 border-teal-800/80';
      case 'Manager':
        return 'text-purple-400 bg-purple-950/80 border-purple-800/80';
      case 'Maintenance':
        return 'text-amber-400 bg-amber-950/80 border-amber-800/80';
      case 'Admin':
        return 'text-rose-400 bg-rose-950/80 border-rose-800/80';
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.workId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.assignedMachine && u.assignedMachine.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      selectedRoleFilter === 'ALL' || u.role.toUpperCase() === selectedRoleFilter.toUpperCase();

    const matchesShift =
      selectedShiftFilter === 'ALL' || (u.shift && u.shift === selectedShiftFilter);

    return matchesSearch && matchesRole && matchesShift;
  });

  const handleOpenRegister = () => {
    setIsEditingUser(null);
    setFormName('');
    setFormWorkId(`OP-${Math.floor(100 + Math.random() * 900)}`);
    setFormRole('Operator');
    setFormDepartment('Milling & Machining Cell 1');
    setFormMachine('CNC-MILL-01');
    setFormShift('Shift A');
    setFormEmail('');
    setFormError(null);
    setIsRegisterModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setIsEditingUser(user);
    setFormName(user.fullName);
    setFormWorkId(user.workId);
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormMachine(user.assignedMachine || '');
    setFormShift(user.shift || 'Shift A');
    setFormEmail(user.email);
    setFormError(null);
    setIsRegisterModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formWorkId.trim() || !formEmail.trim()) {
      setFormError('Please fill out all required fields.');
      return;
    }

    try {
      if (isEditingUser) {
        await apiClient.updateUser(isEditingUser.id, {
          fullName: formName.trim(),
          workId: formWorkId.trim().toUpperCase(),
          role: formRole,
          department: formDepartment.trim() || undefined,
          assignedMachine: formMachine.trim() || undefined,
          shift: formShift,
          email: formEmail.trim(),
        });
        setFeedbackMessage(`Updated personnel profile for ${formName}.`);
      } else {
        await apiClient.createUser({
          fullName: formName.trim(),
          workId: formWorkId.trim().toUpperCase(),
          role: formRole,
          department: formDepartment.trim() || `${formRole} Team`,
          assignedMachine: formMachine.trim() || undefined,
          shift: formShift,
          email: formEmail.trim(),
          status: 'Active',
        });
        setFeedbackMessage(`Registered new personnel badge ${formWorkId} (${formName}).`);
      }

      await fetchUsers();
      setIsRegisterModalOpen(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save personnel record.');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.workId === currentUser.workId) {
      setFeedbackMessage('Cannot delete the currently logged in session.');
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }
    try {
      await apiClient.deleteUser(user.id);
      await fetchUsers();
      setFeedbackMessage(`Removed personnel badge ${user.workId} (${user.fullName}).`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to delete user.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleResetDefaults = async () => {
    await apiClient.resetUsersToDefaults();
    await fetchUsers();
    setFeedbackMessage('Reset personnel directory to standard 5 demo personas.');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. VIEW HEADER & BREADCRUMBS                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0c1424] border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-teal-400 mb-1">
            <span>Factory Governance</span>
            <span>&gt;</span>
            <span>Access Control</span>
            <span>&gt;</span>
            <span className="text-slate-300">Personnel &amp; RBAC</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-400" />
            <span>Personnel Directory &amp; Access Governance</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Maintain employee badge codes, machine access permissions, active shifts, and 5-tier role-based access control.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPermissionsMatrix(!showPermissionsMatrix)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>RBAC Matrix</span>
            {showPermissionsMatrix ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenRegister}
            className="px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-950/40"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Personnel</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-teal-950/80 border border-teal-800/80 text-teal-200 text-xs flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-teal-400 hover:text-teal-200 font-mono text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. KPI SUMMARY STRIP                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-[#0c1424] border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>Total Registered</span>
            <Users className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-white">{usersList.length}</span>
          <span className="text-[11px] font-mono text-teal-400 block mt-1">
            5 Distinct Tier Roles
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1424] border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>On-Duty Staff</span>
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {usersList.filter((u) => u.status === 'On Duty' || !u.status).length}
          </span>
          <span className="text-[11px] font-mono text-slate-400 block mt-1">
            Shift A (06:00 - 14:00)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1424] border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>Machine Assignments</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {usersList.filter((u) => !!u.assignedMachine).length}
          </span>
          <span className="text-[11px] font-mono text-slate-400 block mt-1">
            Cell Coverage: 100%
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1424] border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
            <span>Current Persona</span>
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-white truncate">{currentUser.fullName}</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold uppercase ${getRoleBadgeStyle(
                currentUser.role
              )}`}
            >
              {currentUser.role}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 block mt-1">
            Work ID: {currentUser.workId}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Personnel charts">
        <div className="rounded-xl border border-slate-800/80 bg-[#0c1424] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100">Team by role</h2>
          <p className="mb-3 mt-1 text-xs text-slate-400">Current personnel directory counts.</p>
          <SimpleBarChart data={(['Operator', 'Supervisor', 'Manager', 'Maintenance', 'Admin'] as UserRole[]).map((role) => ({
            label: role, value: usersList.filter((user) => user.role === role).length,
            color: role === 'Operator' ? '#34d399' : role === 'Supervisor' ? '#2dd4bf' : role === 'Manager' ? '#a78bfa' : role === 'Maintenance' ? '#fbbf24' : '#fb7185',
          }))} />
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0c1424] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-100">Shift coverage</h2>
          <p className="mb-3 mt-1 text-xs text-slate-400">Personnel records grouped by assigned shift.</p>
          <SimpleBarChart data={(['Shift A', 'Shift B', 'Night Shift'] as const).map((shift, index) => ({
            label: shift, value: usersList.filter((user) => (user.shift || 'Shift A') === shift).length,
            color: ['#2dd4bf', '#38bdf8', '#a78bfa'][index],
          }))} />
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. COLLAPSIBLE RBAC PERMISSIONS REFERENCE MATRIX              */}
      {/* ------------------------------------------------------------- */}
      {showPermissionsMatrix && (
        <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <h2 className="font-display font-bold text-sm text-white">
                5-Tier Role-Based Access Control (RBAC) Authority Matrix
              </h2>
            </div>
            <span className="text-xs font-mono text-teal-400">
              Granular Security Policy Enforced
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="pb-2.5">Platform Capability / Action</th>
                  <th className="pb-2.5 text-center text-emerald-400">Operator</th>
                  <th className="pb-2.5 text-center text-teal-400">Supervisor</th>
                  <th className="pb-2.5 text-center text-purple-400">Manager</th>
                  <th className="pb-2.5 text-center text-amber-400">Maintenance</th>
                  <th className="pb-2.5 text-center text-rose-400">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Submit Machine Incident Alerts (Vibration / Chatter)
                  </td>
                  <td className="py-2.5 text-center text-emerald-400">✓ (Assigned)</td>
                  <td className="py-2.5 text-center text-teal-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    View Real-time Sensor Streams &amp; Vibration Charts
                  </td>
                  <td className="py-2.5 text-center text-emerald-400">✓</td>
                  <td className="py-2.5 text-center text-teal-400">✓</td>
                  <td className="py-2.5 text-center text-purple-400">✓</td>
                  <td className="py-2.5 text-center text-amber-400">✓</td>
                  <td className="py-2.5 text-center text-rose-400">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Assign Technicians &amp; Dispatch Work Orders
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-400">✓ (Exclusive)</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Execute Work Orders &amp; Log Repair Notes
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Authorize Incident Resolution &amp; Close Ticket
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Inject Simulated Sensor Faults (Chatter / Thermal / Feed)
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-400">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Access Empirical Research Datasets &amp; Power BI Analytics
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-400">✓</td>
                  <td className="py-2.5 text-center text-purple-400">✓</td>
                  <td className="py-2.5 text-center text-amber-400">✓</td>
                  <td className="py-2.5 text-center text-rose-400">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-white">
                    Manage User Directory, Personnel Badges &amp; System Health
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-rose-400">✓ (Exclusive)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. SEARCH & FILTER TOOLBAR                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0c1424] border border-slate-800/80 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, Work ID (e.g. OP-101), machine, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
            {['ALL', 'Operator', 'Supervisor', 'Manager', 'Maintenance', 'Admin'].map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRoleFilter(role)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedRoleFilter === role
                    ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {/* Reset to Seed Defaults */}
          <button
            onClick={handleResetDefaults}
            title="Reset to 5 Seed Personas"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. PERSONNEL ROSTER TABLE                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-[#0c1424] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono uppercase text-[10px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Badge / Work ID</th>
                <th className="py-3 px-3">Role &amp; Tier</th>
                <th className="py-3 px-3">Department &amp; Shift</th>
                <th className="py-3 px-3">Assigned Station</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                    No personnel records matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.workId === currentUser.workId;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isCurrent ? 'bg-teal-950/20' : ''
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-teal-300 shrink-0">
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-teal-950 text-teal-400 border border-teal-800">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Work ID */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-semibold text-teal-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-xs">
                          {user.workId}
                        </span>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${getRoleBadgeStyle(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Department & Shift */}
                      <td className="py-3 px-3">
                        <span className="block text-slate-300">
                          {user.department || 'Floor Cell'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {user.shift || 'Shift A'}
                        </span>
                      </td>

                      {/* Assigned Station */}
                      <td className="py-3 px-3">
                        {user.assignedMachine ? (
                          <span className="font-mono text-xs text-teal-300 font-medium">
                            {user.assignedMachine}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Plant-Wide
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{user.status || 'Active'}</span>
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Profile details */}
                          <button
                            type="button"
                            onClick={() => setInspectingUser(user)}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono transition-colors"
                            title="Inspect User Profile & Permissions"
                          >
                            Details
                          </button>

                          {/* Quick switch persona */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(user)}
                              className="px-2 py-1 rounded bg-teal-950/70 border border-teal-800 hover:bg-teal-900 text-teal-300 text-[11px] font-mono transition-colors flex items-center gap-1"
                              title="Switch to this persona session"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Switch</span>
                            </button>
                          )}

                          {/* Edit / Delete actions for Admin */}
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(user)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Edit Personnel Record"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                  title="Delete Personnel Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. REGISTER / EDIT PERSONNEL MODAL                            */}
      {/* ------------------------------------------------------------- */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0c1424] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {isEditingUser ? 'Edit Personnel Record' : 'Register New Personnel'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {isEditingUser ? `Updating ${isEditingUser.workId}` : 'Assign Badge & RBAC Role'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Miller"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Badge / Work ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formWorkId}
                    onChange={(e) => setFormWorkId(e.target.value.toUpperCase())}
                    placeholder="e.g. OP-102"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Role Clearance *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="Operator">Operator (Floor Machine Control)</option>
                    <option value="Supervisor">Supervisor (Approval &amp; Assignee)</option>
                    <option value="Manager">Manager (Executive &amp; Power BI)</option>
                    <option value="Maintenance">Maintenance (Work Orders &amp; Repairs)</option>
                    <option value="Admin">Admin (System Governance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Shift Roster
                  </label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="Shift A">Shift A (Morning 06:00 - 14:00)</option>
                    <option value="Shift B">Shift B (Afternoon 14:00 - 22:00)</option>
                    <option value="Night Shift">Night Shift (Graveyard 22:00 - 06:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Assigned Machine
                  </label>
                  <select
                    value={formMachine}
                    onChange={(e) => setFormMachine(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="">None (Plant-Wide / Roaming)</option>
                    {machines.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.code} ({m.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Milling &amp; Machining Cell"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. employee@ziromfg.internal"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-all shadow-md shadow-teal-950/40"
                >
                  {isEditingUser ? 'Save Profile Changes' : 'Register Badge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. USER PROFILE & PERMISSIONS DRAWER/MODAL                    */}
      {/* ------------------------------------------------------------- */}
      <UserProfileModal
        user={inspectingUser}
        currentUser={currentUser}
        isOpen={!!inspectingUser}
        onClose={() => setInspectingUser(null)}
        onSwitchToUser={onSwitchUser}
      />
    </div>
  );
};
