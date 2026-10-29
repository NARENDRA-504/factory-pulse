import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, Machine, Incident } from '../types';
import { SEED_MACHINES } from '../data/seedData';
import { apiClient } from '../services/apiClient';
import { UserProfileModal } from '../components/UserProfileModal';
import { SimpleBarChart } from '../components/SimpleBarChart';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Mail,
  Edit2,
  Trash2,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

interface UsersViewProps {
  currentUser: UserProfile;
  machines?: Machine[];
  incidents?: Incident[];
}

export const UsersView: React.FC<UsersViewProps> = ({
  currentUser,
  machines = SEED_MACHINES,
  incidents = [],
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
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
  const [machineSearch, setMachineSearch] = useState('');
  const [formShift, setFormShift] = useState<'Shift A' | 'Shift B' | 'Night Shift'>('Shift A');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const users = await apiClient.getUsers();
      if (users) {
        setUsersList(users);
      }
    } catch {
      setUsersList([]);
      setFeedbackMessage('Personnel directory unavailable. Check your Admin session and database connection.');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const isAdmin = currentUser.role === 'Admin';

  const getRoleBadgeStyle = (role: UserRole) => {
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
    setMachineSearch('');
    setFormShift('Shift A');
    setFormEmail('');
    setFormPassword('');
    setShowPassword(false);
    setFormActive(true);
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
    setMachineSearch(user.assignedMachine || '');
    setFormShift(user.shift || 'Shift A');
    setFormEmail(user.email);
    setFormPassword('');
    setShowPassword(false);
    setFormActive(user.status !== 'Offline');
    setFormError(null);
    setIsRegisterModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formWorkId.trim() || !formEmail.trim() || (!isEditingUser && formPassword.length < 12) || (formPassword.length > 0 && formPassword.length < 12)) {
      setFormError('Complete the required fields. Passwords must be at least 12 characters.');
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
          password: formPassword || undefined,
          isActive: formActive,
        });
        setFeedbackMessage(formPassword ? `Updated ${formName}'s profile and reset their password. Existing sessions were revoked.` : `Updated personnel profile for ${formName}.`);
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
          password: formPassword,
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
      setFeedbackMessage(`Deactivated personnel badge ${user.workId} (${user.fullName}); their active sessions were revoked.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to delete user.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleSetUserActive = async (user: UserProfile, active: boolean) => {
    try {
      await apiClient.updateUser(user.id, { isActive: active });
      await fetchUsers();
      setFeedbackMessage(active ? `Reactivated ${user.workId}; the employee can sign in again.` : `Deactivated ${user.workId}; existing sessions were revoked.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(err.message || 'Failed to update user access.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. VIEW HEADER & BREADCRUMBS                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-teal-700 mb-1">
            <span>Factory Governance</span>
            <span>&gt;</span>
            <span>Access Control</span>
            <span>&gt;</span>
            <span className="text-slate-700">Personnel &amp; RBAC</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-700" />
            <span>Personnel Directory &amp; Access Governance</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Maintain employee badge codes, machine access permissions, active shifts, and 5-tier role-based access control.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPermissionsMatrix(!showPermissionsMatrix)}
            className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
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
        <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-slate-700 text-xs flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-teal-700 hover:text-slate-700 font-mono text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. KPI SUMMARY STRIP                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-1">
            <span>Registered Accounts</span>
            <Users className="w-3.5 h-3.5 text-teal-700" />
          </div>
          <span className="text-2xl font-bold font-mono text-slate-900">{usersList.length}</span>
          <span className="text-[11px] font-mono text-teal-700 block mt-1">
            {usersList.filter((user) => user.status !== 'Offline').length} active accounts
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-1">
            <span>On-Duty Staff</span>
            <Clock className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-700">
            {usersList.filter((u) => u.status === 'On Duty' || !u.status).length}
          </span>
          <span className="text-[11px] font-mono text-slate-600 block mt-1">
            Shift A (06:00 - 14:00)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-1">
            <span>Machine Assignments</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-700" />
          </div>
          <span className="text-2xl font-bold font-mono text-cyan-800">
            {usersList.filter((u) => !!u.assignedMachine).length}
          </span>
          <span className="text-[11px] font-mono text-slate-600 block mt-1">
            Cell Coverage: 100%
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-1">
            <span>Total Machines</span>
            <Cpu className="w-3.5 h-3.5 text-purple-700" />
          </div>
          <span className="text-2xl font-bold font-mono text-purple-800">{machines.length}</span>
          <span className="text-[11px] font-mono text-slate-600 block mt-1">
            Machines in the current plant roster
          </span>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Personnel charts">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Team by role</h2>
          <p className="mb-3 mt-1 text-xs text-slate-600">Current personnel directory counts.</p>
          <SimpleBarChart data={(['Operator', 'Supervisor', 'Manager', 'Maintenance', 'Admin'] as UserRole[]).map((role) => ({
            label: role, value: usersList.filter((user) => user.role === role).length,
            color: role === 'Operator' ? '#34d399' : role === 'Supervisor' ? '#2dd4bf' : role === 'Manager' ? '#a78bfa' : role === 'Maintenance' ? '#fbbf24' : '#fb7185',
          }))} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Shift coverage</h2>
          <p className="mb-3 mt-1 text-xs text-slate-600">Personnel records grouped by assigned shift.</p>
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <h2 className="font-display font-bold text-sm text-slate-900">
                5-Tier Role-Based Access Control (RBAC) Authority Matrix
              </h2>
            </div>
            <span className="text-xs font-mono text-teal-700">
              Granular Security Policy Enforced
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                  <th className="pb-2.5">Platform Capability / Action</th>
                  <th className="pb-2.5 text-center text-emerald-700">Operator</th>
                  <th className="pb-2.5 text-center text-teal-700">Supervisor</th>
                  <th className="pb-2.5 text-center text-purple-700">Manager</th>
                  <th className="pb-2.5 text-center text-amber-700">Maintenance</th>
                  <th className="pb-2.5 text-center text-rose-700">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-700">
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Submit Machine Incident Alerts (Vibration / Chatter)
                  </td>
                  <td className="py-2.5 text-center text-emerald-700">✓ (Assigned)</td>
                  <td className="py-2.5 text-center text-teal-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    View Real-time Sensor Streams &amp; Vibration Charts
                  </td>
                  <td className="py-2.5 text-center text-emerald-700">✓</td>
                  <td className="py-2.5 text-center text-teal-700">✓</td>
                  <td className="py-2.5 text-center text-purple-700">✓</td>
                  <td className="py-2.5 text-center text-amber-700">✓</td>
                  <td className="py-2.5 text-center text-rose-700">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Assign Technicians &amp; Dispatch Work Orders
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-700">✓ (Exclusive)</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Execute Work Orders &amp; Log Repair Notes
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Authorize Incident Resolution &amp; Close Ticket
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Inject Simulated Sensor Faults (Chatter / Thermal / Feed)
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-amber-700">✓</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Access Empirical Research Datasets &amp; Power BI Analytics
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-teal-700">✓</td>
                  <td className="py-2.5 text-center text-purple-700">✓</td>
                  <td className="py-2.5 text-center text-amber-700">✓</td>
                  <td className="py-2.5 text-center text-rose-700">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans font-medium text-slate-900">
                    Manage User Directory, Personnel Badges &amp; System Health
                  </td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-slate-600">—</td>
                  <td className="py-2.5 text-center text-rose-700">✓ (Exclusive)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. SEARCH & FILTER TOOLBAR                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, Work ID (e.g. OP-101), machine, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono">
            {['ALL', 'Operator', 'Supervisor', 'Manager', 'Maintenance', 'Admin'].map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRoleFilter(role)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedRoleFilter === role
                    ? 'bg-teal-500/20 text-teal-800 font-semibold border border-teal-500/40'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. PERSONNEL ROSTER TABLE                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono uppercase text-[10px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Badge / Work ID</th>
                <th className="py-3 px-3">Role &amp; Tier</th>
                <th className="py-3 px-3">Department &amp; Shift</th>
                <th className="py-3 px-3">Assigned Station</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-700">
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
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-teal-50' : ''
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-teal-800 shrink-0">
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-600 font-mono">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Work ID */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-semibold text-teal-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-xs">
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
                        <span className="block text-slate-700">
                          {user.department || 'Floor Cell'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600">
                          {user.shift || 'Shift A'}
                        </span>
                      </td>

                      {/* Assigned Station */}
                      <td className="py-3 px-3">
                        {user.assignedMachine ? (
                          <span className="font-mono text-xs text-teal-800 font-medium">
                            {user.assignedMachine}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600 font-mono">
                            Plant-Wide
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono ${user.status === 'Offline' ? 'text-slate-500' : 'text-emerald-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Offline' ? 'bg-slate-500' : 'bg-emerald-400'}`} />
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
                            className="px-2 py-1 rounded bg-slate-50 border border-slate-200 hover:border-slate-200 text-slate-700 hover:text-slate-900 text-[11px] font-mono transition-colors"
                            title="Inspect User Profile & Permissions"
                          >
                            Details
                          </button>

                          {/* Edit / Delete actions for Admin */}
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(user)}
                                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                title="Edit Personnel Record"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isCurrent && user.status !== 'Offline' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-slate-100 transition-colors"
                                  title="Remove account access (deactivate; keeps audit history)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!isCurrent && user.status === 'Offline' && (
                                <button
                                  type="button"
                                  onClick={() => handleSetUserActive(user, true)}
                                  className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
                                  title="Reactivate account"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-800">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {isEditingUser ? 'Edit Personnel Record' : 'Register New Personnel'}
                  </h3>
                  <p className="text-xs text-slate-600 font-mono">
                    {isEditingUser ? `Updating ${isEditingUser.workId}` : 'Assign Badge & RBAC Role'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-slate-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Miller"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                    Badge / Work ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formWorkId}
                    onChange={(e) => setFormWorkId(e.target.value.toUpperCase())}
                    placeholder="e.g. OP-102"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                    Role Clearance *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="Operator">Operator (Floor Machine Control)</option>
                    <option value="Supervisor">Supervisor (Approval &amp; Assignee)</option>
                    <option value="Manager">Manager (Executive &amp; Power BI)</option>
                    <option value="Maintenance">Maintenance (Work Orders &amp; Repairs)</option>
                    <option value="Admin">Admin (System Governance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                    Shift Roster
                  </label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="Shift A">Shift A (Morning 06:00 - 14:00)</option>
                    <option value="Shift B">Shift B (Afternoon 14:00 - 22:00)</option>
                    <option value="Night Shift">Night Shift (Graveyard 22:00 - 06:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                    Assigned Machine
                  </label>
                  <input
                    type="search"
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                    placeholder="Search machine ID, code, or name (e.g. MCH-001)"
                    className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
                  />
                  <select
                    value={formMachine}
                    onChange={(e) => setFormMachine(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="">None (Plant-Wide / Roaming)</option>
                    {machines
                      .filter((m) => {
                        const query = machineSearch.trim().toLowerCase();
                        return !query || [m.machineId, m.code, m.machineCode, m.displayName, m.name]
                          .some((value) => value?.toLowerCase().includes(query));
                      })
                      .map((m) => (
                        <option key={m.machineId || m.code} value={m.code || m.machineCode}>
                          {m.machineId} · {m.code || m.machineCode} ({m.displayName || m.name})
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500">Simulator machine: MCH-001 · CNC-5AX-001 · 5-Axis-01 — Mazak VARIAXIS C-600</p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Milling &amp; Machining Cell"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. employee@ziromfg.internal"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-700 mb-1">{isEditingUser ? 'Set a new password (optional)' : 'Initial password *'}</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required={!isEditingUser} minLength={12} maxLength={256} autoComplete="new-password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder={isEditingUser ? 'Leave blank to keep current password' : 'At least 12 characters'} className="w-full px-3 py-2 pr-11 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono" />
                  <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide typed password' : 'Show typed password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-600 hover:text-teal-800" title={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Passwords are stored as one-way hashes and can’t be viewed. Setting a new password revokes existing sessions.</p>
              </div>

              {isEditingUser && <div>
                <label className="block text-xs font-mono font-medium text-slate-700 mb-1">Account access</label>
                <select value={formActive ? 'active' : 'inactive'} onChange={(e) => setFormActive(e.target.value === 'active')} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono">
                  <option value="active">Active — may sign in</option>
                  <option value="inactive">Deactivated — sign-in blocked</option>
                </select>
              </div>}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
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
      />
    </div>
  );
};
