import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, Incident, Machine } from '../types';
import { SEED_USERS } from '../data/seedData';
import { apiClient } from '../services/apiClient';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  UserPlus,
  ArrowRightLeft,
  KeyRound,
  Mail,
  Cpu,
  Layers,
  FileDown,
  Eye,
  Wrench,
  Activity,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Building2,
  X,
  Flame,
  Zap,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: UserProfile;
  incidents: Incident[];
  machines: Machine[];
  onNavigate: (screen: 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users') => void;
  onSwitchUser?: (user: UserProfile) => void;
  onRefreshData?: () => void;
  onOpenProfile?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  incidents,
  machines,
  onNavigate,
  onSwitchUser,
  onRefreshData,
  onOpenProfile,
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>(SEED_USERS);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState<Incident | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Admin sub-navigation tabs & Fleet filters
  const [adminTab, setAdminTab] = useState<'personnel' | 'fleet'>('personnel');
  const [fleetPlantFilter, setFleetPlantFilter] = useState<string>('ALL');
  const [fleetFloorFilter, setFleetFloorFilter] = useState<string>('ALL');
  const [fleetTypeFilter, setFleetTypeFilter] = useState<string>('ALL');
  const [fleetStatusFilter, setFleetStatusFilter] = useState<string>('ALL');
  const [fleetSearch, setFleetSearch] = useState<string>('');
  const [fleetLimit, setFleetLimit] = useState<number>(30);

  const uniqueFleetPlants = Array.from(new Set(machines.map((m) => m.plant).filter(Boolean))) as string[];
  const uniqueFleetFloors = Array.from(
    new Set(
      machines
        .filter((m) => fleetPlantFilter === 'ALL' || m.plant === fleetPlantFilter)
        .map((m) => m.shopFloor)
        .filter(Boolean)
    )
  ) as string[];
  const uniqueFleetTypes = Array.from(new Set(machines.map((m) => m.machineType).filter(Boolean))) as string[];

  const filteredFleetMachines = machines.filter((m) => {
    if (fleetPlantFilter !== 'ALL' && m.plant !== fleetPlantFilter) return false;
    if (fleetFloorFilter !== 'ALL' && m.shopFloor !== fleetFloorFilter) return false;
    if (fleetTypeFilter !== 'ALL' && m.machineType !== fleetTypeFilter) return false;
    if (fleetStatusFilter !== 'ALL' && m.status !== fleetStatusFilter) return false;
    if (fleetSearch.trim()) {
      const q = fleetSearch.toLowerCase();
      const match =
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        (m.machineId && m.machineId.toLowerCase().includes(q)) ||
        (m.machineCode && m.machineCode.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.code && m.code.toLowerCase().includes(q)) ||
        (m.model && m.model.toLowerCase().includes(q)) ||
        (m.manufacturer && m.manufacturer.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserWorkId, setNewUserWorkId] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Operator');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [newUserMachine, setNewUserMachine] = useState('');
  const [newUserShift, setNewUserShift] = useState<'Shift A' | 'Shift B' | 'Night Shift'>('Shift A');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const u = await apiClient.getUsers();
      if (u && u.length > 0) {
        setUsersList(u);
      }
    } catch {
      setUsersList(SEED_USERS);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Compute incidents raised by each user
  const getUserIncidentsCount = (user: UserProfile) => {
    return incidents.filter(
      (inc) =>
        inc.reporterId === user.id ||
        (inc.reporterName && inc.reporterName.toLowerCase() === user.fullName.toLowerCase())
    );
  };

  // Filtered incidents list based on selected user, role, status, severity, and search
  const filteredIncidents = incidents.filter((inc) => {
    if (selectedUserFilter !== 'ALL') {
      const match =
        String(inc.reporterId) === selectedUserFilter ||
        (inc.reporterName && inc.reporterName.toLowerCase() === selectedUserFilter.toLowerCase());
      if (!match) return false;
    }
    if (roleFilter !== 'ALL' && inc.reporterRole !== roleFilter) return false;
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        inc.incidentCode.toLowerCase().includes(q) ||
        inc.reporterName.toLowerCase().includes(q) ||
        inc.machineCode.toLowerCase().includes(q) ||
        inc.componentArea.toLowerCase().includes(q) ||
        inc.symptomDescription.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }
    return true;
  });

  // Summary KPIs
  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter((i) => i.status !== 'Closed').length;
  const closedIncidents = incidents.filter((i) => i.status === 'Closed').length;
  const criticalIncidents = incidents.filter((i) => i.severity === 'Critical').length;
  const activeOperatorsCount = usersList.filter((u) => u.role === 'Operator').length;

  // Role distribution for visualization
  const roleCounts = {
    Operator: usersList.filter((u) => u.role === 'Operator').length,
    Supervisor: usersList.filter((u) => u.role === 'Supervisor').length,
    Maintenance: usersList.filter((u) => u.role === 'Maintenance').length,
    Manager: usersList.filter((u) => u.role === 'Manager').length,
    Admin: usersList.filter((u) => u.role === 'Admin').length,
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Operator':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Supervisor':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'Manager':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'Maintenance':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'Admin':
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Closed':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'In_Investigation':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'Action_Required':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      default:
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserWorkId.trim()) {
      setFormFeedback('Full name and Work ID are required.');
      return;
    }

    const created = await apiClient.createUser({
      fullName: newUserName.trim(),
      workId: newUserWorkId.trim().toUpperCase(),
      role: newUserRole,
      department: newUserDepartment.trim() || 'Factory Operations',
      assignedMachine: newUserMachine ? newUserMachine : undefined,
      shift: newUserShift,
      email: newUserEmail.trim() || `${newUserWorkId.toLowerCase()}@ziromfg.internal`,
      status: 'Active',
    });

    if (created) {
      await fetchUsers();
      setIsAddUserModalOpen(false);
      setNewUserName('');
      setNewUserWorkId('');
      setNewUserDepartment('');
      setNewUserMachine('');
      setFormFeedback(null);
    }
  };

  const exportAuditLogCSV = () => {
    const headers = [
      'Incident Code',
      'Machine',
      'Reporter Name',
      'Reporter Role',
      'Severity',
      'Component Area',
      'Status',
      'Created At',
      'Vibration (m/s2)',
      'Motor Power (kW)',
      'Motor Load (%)',
    ];
    const rows = filteredIncidents.map((i) => [
      i.incidentCode,
      i.machineCode,
      i.reporterName,
      i.reporterRole,
      i.severity,
      `"${i.componentArea}"`,
      i.status,
      i.createdAt,
      i.measuredVibRms,
      i.measuredMotorPowerKw,
      i.measuredMotorLoadPct,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `factorypulse_incident_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Admin Master Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  System Administration &amp; Governance
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                  RBAC Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Manage user permissions, monitor 400 CNC allocations, oversee incidents, and export audit trails.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Personnel</span>
            </button>

            <button
              onClick={exportAuditLogCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
              title="Download Incident Audit CSV"
            >
              <FileDown className="w-4 h-4 text-teal-600" />
              <span>Export Audit CSV</span>
            </button>

            <button
              onClick={() => onNavigate('users')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <Users className="w-4 h-4 text-teal-600" />
              <span>Full Directory &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Total Users */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Registered Users
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {usersList.length}
              </span>
              <span className="text-xs text-teal-700 font-semibold">
                {activeOperatorsCount} Operators
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              100% RBAC Enforced
            </span>
          </div>
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Total Incidents Raised */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Total Incidents
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-amber-600">
                {totalIncidents}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({openIncidents} Active)
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Reported by staff
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Resolved by Team */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Resolved &amp; Closed
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-600">
                {closedIncidents}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({totalIncidents > 0 ? Math.round((closedIncidents / totalIncidents) * 100) : 100}%)
              </span>
            </div>
            <span className="text-xs text-emerald-700 font-medium mt-1 block">
              Verified by Maintenance
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Machine Assignments */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Active CNC Units
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-sky-700">
                {machines.length}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {machines.filter((m) => m.status === 'Nominal').length} Nominal
              </span>
            </div>
            <span className="text-xs text-rose-700 font-medium mt-1 block">
              {criticalIncidents} Critical Interventions
            </span>
          </div>
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Top Visualizations: Personnel Role Distribution & Fleet Plant Allocation (Near Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visualization 1: Role Distribution Stacked Visual */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>Personnel Role Distribution &amp; Access Allocation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Breakdown of active user accounts across the 5 factory permission tiers.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                {usersList.length} Accounts
              </span>
            </div>

            {/* Stacked Proportional Bar */}
            <div className="mt-4">
              <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden flex">
                <div
                  style={{ width: `${(roleCounts.Operator / usersList.length) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Operator: ${roleCounts.Operator}`}
                />
                <div
                  style={{ width: `${(roleCounts.Supervisor / usersList.length) * 100}%` }}
                  className="bg-teal-500 h-full transition-all"
                  title={`Supervisor: ${roleCounts.Supervisor}`}
                />
                <div
                  style={{ width: `${(roleCounts.Maintenance / usersList.length) * 100}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Maintenance: ${roleCounts.Maintenance}`}
                />
                <div
                  style={{ width: `${(roleCounts.Manager / usersList.length) * 100}%` }}
                  className="bg-purple-500 h-full transition-all"
                  title={`Manager: ${roleCounts.Manager}`}
                />
                <div
                  style={{ width: `${(roleCounts.Admin / usersList.length) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Admin: ${roleCounts.Admin}`}
                />
              </div>

              {/* Legend & Breakdown Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs">
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-800 font-semibold block">Operator</span>
                  <span className="text-base font-bold text-emerald-950">{roleCounts.Operator}</span>
                </div>
                <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-center">
                  <span className="text-[11px] text-teal-800 font-semibold block">Supervisor</span>
                  <span className="text-base font-bold text-teal-950">{roleCounts.Supervisor}</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[11px] text-amber-900 font-semibold block">Maintenance</span>
                  <span className="text-base font-bold text-amber-950">{roleCounts.Maintenance}</span>
                </div>
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-center">
                  <span className="text-[11px] text-purple-800 font-semibold block">Manager</span>
                  <span className="text-base font-bold text-purple-950">{roleCounts.Manager}</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-center col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-rose-800 font-semibold block">Admin</span>
                  <span className="text-base font-bold text-rose-950">{roleCounts.Admin}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-xs text-teal-950 leading-relaxed">
            <span className="font-bold text-teal-900">What to notice:</span> Operators make up the largest personnel segment (60%), ensuring individual machine assignment coverage across Shift A and Shift B.
          </div>
        </div>

        {/* Visualization 2: 400-CNC Fleet Allocation by Plant */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span>Fleet Allocation &amp; Operational Readiness by Plant</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proportion of 400 CNC units assigned per plant and current nominal uptime rate.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                100 Units / Plant
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { plant: 'Plant A', name: 'Precision Machining', units: 100, nominal: 97, color: 'bg-emerald-500' },
                { plant: 'Plant B', name: 'Powertrain Components', units: 100, nominal: 93, color: 'bg-teal-500' },
                { plant: 'Plant C', name: 'Heavy Machining', units: 100, nominal: 89, color: 'bg-amber-500' },
                { plant: 'Plant D', name: 'Finishing & Grinding', units: 100, nominal: 95, color: 'bg-sky-500' },
              ].map((p) => (
                <div key={p.plant} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{p.plant}: <span className="font-normal text-slate-600">{p.name}</span></span>
                    <span className="font-mono text-xs font-bold text-slate-900">{p.nominal}% Nominal</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-md overflow-hidden relative">
                    <div
                      style={{ width: `${p.nominal}%` }}
                      className={`h-full rounded-md ${p.color} transition-all`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{p.units} CNC Machines Allocated</span>
                    <span>Target: &gt; 95%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-950 leading-relaxed">
            <span className="font-bold text-sky-900">What to notice:</span> Fleet allocation is uniformly balanced (100 machines per plant), with Plant C currently experiencing the lowest nominal operating readiness (89%).
          </div>
        </div>
      </div>

      {/* 3.5 Fleet-Wide Telemetry Sensor Diagnostics & Thermal Threshold Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visual 3: 400-Machine Sensor Health Breakdown */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Telemetry Sensor Online Health (1,600 Active Probes)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live status across vibration accelerometers, thermocouples, current CTs, and encoders.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                99.1% Healthy
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {[
                { probe: 'Spindle Piezo Vibration (m/s² RMS)', healthy: 396, warning: 4, fault: 0, pct: 99.0 },
                { probe: 'Sump & Spindle Thermocouples (°C)', healthy: 398, warning: 2, fault: 0, pct: 99.5 },
                { probe: 'Inverter Current Transformers (kW)', healthy: 394, warning: 5, fault: 1, pct: 98.5 },
                { probe: 'Closed-Loop Rotary Encoders (RPM)', healthy: 399, warning: 1, fault: 0, pct: 99.7 },
              ].map((s) => (
                <div key={s.probe} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{s.probe}</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {s.healthy}/400 Online ({s.pct}%)
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      style={{ width: `${s.pct}%` }}
                      className="h-full rounded-full bg-teal-600 transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{s.warning} probes flagged for zero-offset recalibration</span>
                    <span className={s.fault > 0 ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                      {s.fault > 0 ? `${s.fault} sensor fault reported` : 'All channels verified'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-xs text-teal-950 leading-relaxed">
            <span className="font-bold text-teal-900">What to notice:</span> Over 99% of IoT edge sensors are broadcasting valid telemetry within calibration tolerances, with zero telemetry dropout across 24h logging.
          </div>
        </div>

        {/* Visual 4: Thermal Compliance & Coolant Temperature Stratification */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-sky-600" />
                  <span>Fleet Thermal Compliance &amp; Coolant Distribution</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fleet breakdown across verified chiller temperature operating bands.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                Limit: 35.0°C
              </span>
            </div>

            {/* Stacked Proportional Bar */}
            <div className="mt-4">
              <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200">
                <div
                  style={{ width: '92.5%' }}
                  className="bg-emerald-500 h-full transition-all"
                  title="Nominal: 370 units (< 30°C)"
                />
                <div
                  style={{ width: '6.5%' }}
                  className="bg-amber-500 h-full transition-all"
                  title="Warning: 26 units (30 - 35°C)"
                />
                <div
                  style={{ width: '1.0%' }}
                  className="bg-rose-500 h-full transition-all"
                  title="Critical: 4 units (> 35°C)"
                />
              </div>

              {/* Breakdown Cards */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-800 font-semibold block">&lt; 30°C Nominal</span>
                  <span className="text-lg font-bold text-emerald-950">370 Machines</span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Optimal Chilling</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[11px] text-amber-900 font-semibold block">30–35°C Warning</span>
                  <span className="text-lg font-bold text-amber-950">26 Machines</span>
                  <span className="text-[10px] text-amber-700 block mt-0.5">Chiller Service Due</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <span className="text-[11px] text-rose-800 font-semibold block">&gt; 35°C Critical</span>
                  <span className="text-lg font-bold text-rose-950">4 Machines</span>
                  <span className="text-[10px] text-rose-700 block mt-0.5">Auto Thermal Throttle</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs text-sky-950 leading-relaxed">
            <span className="font-bold text-sky-900">What to notice:</span> 92.5% of the 400 CNC fleet runs strictly below 30°C. 4 units running above 35°C are currently throttled to 80% feed rate to prevent spindle bearing damage.
          </div>
        </div>
      </div>

      {/* Admin Sub-navigation Switcher: Personnel vs Fleet */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setAdminTab('personnel')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            adminTab === 'personnel'
              ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4 text-teal-600" />
          <span>Personnel &amp; Incident Governance</span>
          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-700 font-bold">
            {usersList.length}
          </span>
        </button>

        <button
          onClick={() => setAdminTab('fleet')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            adminTab === 'fleet'
              ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Cpu className="w-4 h-4 text-teal-600" />
          <span>400-CNC Fleet Allocation &amp; Audit</span>
          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-teal-800 font-bold">
            {machines.length}
          </span>
        </button>
      </div>

      {adminTab === 'personnel' ? (
        <>
          {/* Section: All Users & Incidents Raised by Them */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>Plant Users &amp; Reported Incidents Summary</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any user card to filter their reported incidents below, or simulate their role view.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedUserFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    selectedUserFilter === 'ALL'
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  Show All ({incidents.length})
                </button>
              </div>
            </div>

            {/* User Persona & Incident Cards Grid */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {usersList.map((user) => {
                const userIncs = getUserIncidentsCount(user);
                const userOpenIncs = userIncs.filter((i) => i.status !== 'Closed');
                const isSelected = selectedUserFilter === user.fullName || selectedUserFilter === String(user.id);
                const initials = user.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={user.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-teal-50/50 border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      {/* Top row: Role badge & Shift */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getRoleBadge(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {user.shift || 'Shift A'}
                        </span>
                      </div>

                      {/* Avatar, Name and ID */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold border ${
                            user.role === 'Admin'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : user.role === 'Operator'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : user.role === 'Supervisor'
                              ? 'bg-teal-50 border-teal-200 text-teal-700'
                              : user.role === 'Maintenance'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-purple-50 border-purple-200 text-purple-700'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {user.fullName}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-semibold">{user.workId}</span>
                            {user.assignedMachine ? (
                              <span className="text-teal-700 font-medium truncate">· {user.assignedMachine}</span>
                            ) : (
                              <span className="text-slate-500 truncate text-[11px]">· {user.department}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Incidents Raised Pill & Actions */}
                    <div className="space-y-2 pt-2.5 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Incidents:</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            userIncs.length > 0
                              ? userOpenIncs.length > 0
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {userIncs.length} Logged
                          {userOpenIncs.length > 0 && ` (${userOpenIncs.length} open)`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedUserFilter(isSelected ? 'ALL' : user.fullName)}
                          className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors border text-center ${
                            isSelected
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ Filtered' : 'View Incidents'}
                        </button>

                        {onSwitchUser && user.workId !== currentUser.workId && (
                          <button
                            onClick={() => onSwitchUser(user)}
                            title={`Simulate session as ${user.fullName} (${user.role})`}
                            className="px-2 py-1 rounded-lg text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 font-semibold"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-teal-600" />
                            <span>Sim</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Interactive Incident Audit Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            {/* Table Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Incident Audit Log
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-700">
                    {filteredIncidents.length} Records
                  </span>
                  {selectedUserFilter !== 'ALL' && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                      <span>Filtered: {selectedUserFilter}</span>
                      <button onClick={() => setSelectedUserFilter('ALL')} className="hover:text-teal-950">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live audit of all anomalies, sensor alarms, and safety reports logged by plant personnel.
                </p>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Search Input */}
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ticket, machine..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-teal-500 text-xs"
                  />
                </div>

                {/* Personnel Filter Dropdown */}
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:border-teal-500 text-xs"
                >
                  <option value="ALL">All Personnel ({incidents.length})</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.fullName}>
                      {u.fullName} ({u.workId} · {u.role}) — {getUserIncidentsCount(u).length}
                    </option>
                  ))}
                </select>

                {/* Role Filter Dropdown */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:border-teal-500 text-xs"
                >
                  <option value="ALL">All Roles</option>
                  <option value="Operator">Operator</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:border-teal-500 text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="In_Investigation">In Investigation</option>
                  <option value="Action_Required">Action Required</option>
                  <option value="Closed">Closed</option>
                </select>

                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:bg-white focus:outline-hidden focus:border-teal-500 text-xs"
                >
                  <option value="ALL">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Table Content */}
            <div className="mt-4 overflow-x-auto">
              {filteredIncidents.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No incidents match the selected user and filter criteria.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-2.5 px-3">Ticket ID</th>
                      <th className="py-2.5 px-3">Machine</th>
                      <th className="py-2.5 px-3">Reported By</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Area &amp; Symptom</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Technician</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {inc.incidentCode}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 block">{inc.machineCode}</span>
                          <span className="text-[11px] text-slate-500">{inc.componentArea}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium whitespace-nowrap">
                          {inc.reporterName}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getRoleBadge(inc.reporterRole)}`}>
                            {inc.reporterRole}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-[200px]">
                          <span className="font-medium text-slate-900 block truncate">{inc.componentArea}</span>
                          <span className="text-[11px] text-slate-500 line-clamp-1">{inc.symptomDescription}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              inc.severity === 'Critical'
                                ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                : inc.severity === 'High'
                                ? 'text-amber-800 bg-amber-50 border border-amber-200'
                                : 'text-slate-700 bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {inc.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(inc.status)}`}>
                            {inc.status === 'Closed' ? 'Resolved' : inc.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {inc.assignedToName || 'Unassigned'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                          {inc.createdAt ? inc.createdAt.slice(0, 10) : 'Today'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedIncidentDetail(inc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Fleet Allocation Tab */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-teal-600" />
                <span>400-CNC Fleet Allocation &amp; Floor Governance</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete machinery master roster across Plants A-D with live telemetry &amp; shift roster.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Total Filtered:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                {filteredFleetMachines.length} / {machines.length} Units
              </span>
            </div>
          </div>

          {/* Four Fleet Filters: Plant, Shop Floor, Machine Type, Status + Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                <Filter className="w-3.5 h-3.5 text-teal-600" />
                <span>Fleet Filters:</span>
              </div>

              {/* Plant Filter */}
              <select
                value={fleetPlantFilter}
                onChange={(e) => {
                  setFleetPlantFilter(e.target.value);
                  setFleetFloorFilter('ALL');
                  setFleetLimit(30);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 text-xs focus:bg-white focus:outline-hidden focus:border-teal-500"
                title="Filter by Plant"
              >
                <option value="ALL">All Plants (4)</option>
                {uniqueFleetPlants.map((plant) => (
                  <option key={plant} value={plant}>
                    {plant}
                  </option>
                ))}
              </select>

              {/* Shop Floor Filter */}
              <select
                value={fleetFloorFilter}
                onChange={(e) => {
                  setFleetFloorFilter(e.target.value);
                  setFleetLimit(30);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 text-xs focus:bg-white focus:outline-hidden focus:border-teal-500"
                title="Filter by Shop Floor"
              >
                <option value="ALL">All Shop Floors ({uniqueFleetFloors.length})</option>
                {uniqueFleetFloors.map((floor) => (
                  <option key={floor} value={floor}>
                    {floor}
                  </option>
                ))}
              </select>

              {/* Machine Type Filter */}
              <select
                value={fleetTypeFilter}
                onChange={(e) => {
                  setFleetTypeFilter(e.target.value);
                  setFleetLimit(30);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 text-xs focus:bg-white focus:outline-hidden focus:border-teal-500"
                title="Filter by Machine Type"
              >
                <option value="ALL">All Machine Types (7)</option>
                {uniqueFleetTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={fleetStatusFilter}
                onChange={(e) => {
                  setFleetStatusFilter(e.target.value);
                  setFleetLimit(30);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 text-xs focus:bg-white focus:outline-hidden focus:border-teal-500"
                title="Filter by Status"
              >
                <option value="ALL">All Statuses</option>
                <option value="Nominal">Nominal</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
                <option value="Offline">Offline</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, model, maker..."
                value={fleetSearch}
                onChange={(e) => {
                  setFleetSearch(e.target.value);
                  setFleetLimit(30);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 placeholder:text-slate-400 text-xs focus:bg-white focus:outline-hidden focus:border-teal-500 w-48 sm:w-60"
              />
            </div>
          </div>

          {/* Machine Inventory Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Unit ID &amp; Code</th>
                  <th className="py-2.5 px-3">Display Name &amp; Model</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Plant &amp; Shop Floor</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Telemetry</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredFleetMachines.slice(0, fleetLimit).map((m) => (
                  <tr key={m.machineId || m.code} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
                          {m.machineId || 'MCH-001'}
                        </span>
                        <span className="font-semibold text-slate-900">{m.machineCode || m.code}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-900 block">{m.displayName || m.name}</span>
                      <span className="text-[10px] text-slate-500 block">{m.manufacturer} {m.model}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                      {m.machineType}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-slate-800 font-medium block">{m.plant}</span>
                      <span className="text-[10px] text-slate-500 block">{m.shopFloor || m.lineId}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-slate-800 font-medium block">{m.assignedOperator || 'Unassigned'}</span>
                      <span className="text-[10px] text-slate-500 block">{m.shift || 'Shift A'}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                      <span className="text-sky-700 font-bold">{m.spindleRpm?.toLocaleString() || 4500} RPM</span>
                      <span className="text-slate-500 block text-[10px]">Load: {m.motorLoadPercent?.toFixed(1) || '45.0'}%</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          m.status === 'Nominal'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : m.status === 'Warning'
                            ? 'text-amber-800 bg-amber-50 border-amber-200'
                            : m.status === 'Critical'
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-slate-600 bg-slate-100 border-slate-200'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => onNavigate('machines')}
                        className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredFleetMachines.length > fleetLimit && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setFleetLimit((prev) => Math.min(prev + 30, filteredFleetMachines.length))}
                className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-xs font-semibold text-teal-800 rounded-xl transition-colors"
              >
                Load More (+30 Machines) · {filteredFleetMachines.length - fleetLimit} Remaining
              </button>
              <button
                onClick={() => setFleetLimit(filteredFleetMachines.length)}
                className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-xl transition-colors"
              >
                Show All ({filteredFleetMachines.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Incident Detail Modal */}
      {selectedIncidentDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {selectedIncidentDetail.incidentCode} · Incident Audit Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedIncidentDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Machine Station</span>
                <span className="text-slate-900 font-bold text-sm block">
                  {(() => {
                    const m = machines.find(
                      (mach) =>
                        mach.code === selectedIncidentDetail.machineCode ||
                        mach.machineCode === selectedIncidentDetail.machineCode
                    );
                    return m ? `${m.displayName || m.name} (${m.machineId || m.code})` : selectedIncidentDetail.machineCode;
                  })()}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Reported By</span>
                <span className="text-slate-900 font-bold text-sm">
                  {selectedIncidentDetail.reporterName} ({selectedIncidentDetail.reporterRole})
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Severity</span>
                <span className="text-amber-800 font-bold">{selectedIncidentDetail.severity}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Status</span>
                <span className="text-emerald-700 font-bold">{selectedIncidentDetail.status}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                  Component Area &amp; Symptom
                </span>
                <span className="text-slate-900 font-bold">{selectedIncidentDetail.componentArea}</span>
                <p className="text-slate-700 mt-1 leading-relaxed">{selectedIncidentDetail.symptomDescription}</p>
              </div>
              {selectedIncidentDetail.operatorNotes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Reporter Notes
                  </span>
                  <p className="text-slate-700">{selectedIncidentDetail.operatorNotes}</p>
                </div>
              )}
            </div>

            {/* Sensor Telemetry Snapshot */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-2">
                Sensor Telemetry Snapshot at Time of Incident
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Vibration</span>
                  <span className="text-slate-900 font-bold text-sm">
                    {selectedIncidentDetail.measuredVibRms.toFixed(2)} m/s²
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Motor Power</span>
                  <span className="text-slate-900 font-bold text-sm">
                    {selectedIncidentDetail.measuredMotorPowerKw.toFixed(1)} kW
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Motor Load</span>
                  <span className="text-slate-900 font-bold text-sm">
                    {selectedIncidentDetail.measuredMotorLoadPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedIncidentDetail(null);
                  onNavigate('incidents');
                }}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
              >
                Open in Full Incidents Tracker &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Personnel Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Register New Personnel
                </h3>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formFeedback && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {formFeedback}
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liam Zhang"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Work ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OP-109"
                    value={newUserWorkId}
                    onChange={(e) => setNewUserWorkId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="Operator">Operator</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Assigned Machine</label>
                  <select
                    value={newUserMachine}
                    onChange={(e) => setNewUserMachine(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="">None (Unassigned)</option>
                    {machines.map((m) => (
                      <option key={m.machineId || m.code} value={m.code || m.machineCode}>
                        {m.displayName || m.name} ({m.machineId || m.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Shift</label>
                  <select
                    value={newUserShift}
                    onChange={(e) => setNewUserShift(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500"
                  >
                    <option value="Shift A">Shift A (Morning)</option>
                    <option value="Shift B">Shift B (Evening)</option>
                    <option value="Night Shift">Night Shift</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Department</label>
                <input
                  type="text"
                  placeholder="e.g. CNC Precision Milling Cell"
                  value={newUserDepartment}
                  onChange={(e) => setNewUserDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-xs transition-colors"
                >
                  Save &amp; Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
