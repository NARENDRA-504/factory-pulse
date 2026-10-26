import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { SEED_USERS } from '../data/seedData';
import { apiClient } from '../services/apiClient';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  Cpu,
  Layers,
  Clock,
  Radio,
  Sparkles,
  Shield,
  Briefcase,
  Terminal,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'personas'>('personas');
  const [workId, setWorkId] = useState('OP-101');
  const [password, setPassword] = useState('pass123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedShift, setSelectedShift] = useState<'Shift A' | 'Shift B' | 'Night Shift'>('Shift A');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('CNC-MILL-01 (Milling Cell 1)');
  const [rememberSession, setRememberSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>(SEED_USERS);

  // Load available users including any custom registered users from store
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await apiClient.getUsers();
        if (users && users.length > 0) {
          setAvailableUsers(users);
        }
      } catch {
        setAvailableUsers(SEED_USERS);
      }
    };
    fetchUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const cleanWorkId = workId.trim().toUpperCase();
      const user = availableUsers.find(
        (u) => u.workId.trim().toUpperCase() === cleanWorkId
      );
      if (!user) {
        throw new Error(
          `Invalid Work ID "${workId}". Available demo badge IDs: OP-101, SUP-201, MGR-301, MNT-401, ADM-001.`
        );
      }
      if (password.length < 3) {
        throw new Error('Passphrase must be at least 3 characters.');
      }

      // Artificial authenticating delay for realistic industrial terminal response
      await new Promise((r) => setTimeout(r, 450));
      
      // Store session with selected shift
      const authenticatedUser: UserProfile = {
        ...user,
        shift: selectedShift,
      };
      
      await apiClient.login(authenticatedUser.workId, password);
      onLoginSuccess(authenticatedUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify badge credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLoginAsPersona = async (user: UserProfile) => {
    setErrorMessage(null);
    setLoading(true);
    setWorkId(user.workId);
    setPassword('pass123');

    try {
      await new Promise((r) => setTimeout(r, 350));
      const authenticatedUser: UserProfile = {
        ...user,
        shift: selectedShift,
      };
      await apiClient.login(user.workId, 'pass123');
      onLoginSuccess(authenticatedUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleTheme = (role: UserRole) => {
    switch (role) {
      case 'Operator':
        return {
          badge: 'text-emerald-400 bg-emerald-950/80 border-emerald-800/80',
          accent: 'border-emerald-500/40 hover:border-emerald-500',
          iconBg: 'bg-emerald-950/60 text-emerald-400',
          dot: 'bg-emerald-400',
          responsibilities: 'Machine telemetry, spindle vibration monitoring, pre-shift safety checklist, alert filing',
        };
      case 'Supervisor':
        return {
          badge: 'text-teal-400 bg-teal-950/80 border-teal-800/80',
          accent: 'border-teal-500/40 hover:border-teal-500',
          iconBg: 'bg-teal-950/60 text-teal-400',
          dot: 'bg-teal-400',
          responsibilities: 'Floor incident assignment, technician dispatch, ticket closure, anomaly validation',
        };
      case 'Manager':
        return {
          badge: 'text-purple-400 bg-purple-950/80 border-purple-800/80',
          accent: 'border-purple-500/40 hover:border-purple-500',
          iconBg: 'bg-purple-950/60 text-purple-400',
          dot: 'bg-purple-400',
          responsibilities: 'Operational KPI analytics, Power BI reporting views, plant throughput, tool lifespan benchmarks',
        };
      case 'Maintenance':
        return {
          badge: 'text-amber-400 bg-amber-950/80 border-amber-800/80',
          accent: 'border-amber-500/40 hover:border-amber-500',
          iconBg: 'bg-amber-950/60 text-amber-400',
          dot: 'bg-amber-400',
          responsibilities: 'Work order execution, technician repair progress, spindle diagnostics, LOTO protocols',
        };
      case 'Admin':
        return {
          badge: 'text-rose-400 bg-rose-950/80 border-rose-800/80',
          accent: 'border-rose-500/40 hover:border-rose-500',
          iconBg: 'bg-rose-950/60 text-rose-400',
          dot: 'bg-rose-400',
          responsibilities: 'User & RBAC management, MySQL 8.x schema governance, pipeline health, audit reconciliation',
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans selection:bg-teal-500/30 selection:text-teal-200">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 bg-[#0c1424] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
        {/* ========================================================= */}
        {/* Left Side: Industrial Facility Showcase & System Status   */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 relative flex flex-col justify-between p-6 sm:p-8 bg-[#091120] border-b lg:border-b-0 lg:border-r border-slate-800/90 overflow-hidden">
          <img
            src="/src/assets/images/industrial_cnc_facility_1791696388142.jpg"
            alt="Advanced Precision CNC Machining Plant"
            className="absolute inset-0 w-full h-full object-cover opacity-25 filter saturate-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#091120] via-[#091120]/80 to-[#091120]/40"></div>

          {/* Top Plant Branding & Live Pulse */}
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-800/70 text-teal-300 text-xs font-mono tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
                <span>Cell 01 · Live Station Online</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">v2.6.4</span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-md shadow-teal-950/50">
                  FP
                </div>
                <span className="font-display font-bold text-xl text-white tracking-tight">
                  FactoryPulse
                </span>
              </div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                ZIRO Incident &amp; Maintenance Response Platform
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Industrial monitoring, vibration anomaly detection, and maintenance response console unifying CNC machine telemetry and empirical research datasets.
              </p>
            </div>
          </div>

          {/* Machine Floor Status Highlight Card */}
          <div className="relative z-10 my-6 p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                Current Floor Status
              </span>
              <span className="text-emerald-400 font-mono text-[11px] font-semibold flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> All Cells Nominal
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-500 text-[10px] block">Active Workstations</span>
                <span className="text-white font-bold text-sm">3 Cells Online</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-500 text-[10px] block">Active Shift</span>
                <span className="text-teal-300 font-bold text-sm">Shift A (Morning)</span>
              </div>
            </div>
          </div>

          {/* Bottom Security & Architecture Compliance Strip */}
          <div className="relative z-10 pt-4 border-t border-slate-800/90">
            <div className="text-[11px] font-mono text-slate-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Database Engine</span>
                <span className="text-teal-300 font-semibold">MySQL 8.x DDL Verified</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Empirical Datasets</span>
                <span className="text-slate-200">28,920 Validated Rows</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Security Architecture</span>
                <span className="text-emerald-400">5-Tier RBAC Enforced</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Safety Compliance</span>
                <span className="text-amber-400">LOTO Protocol Compliant</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Right Side: Authentication Console & Role Selector       */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
          <div>
            {/* Header with Title and Mode Switcher Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-teal-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  Terminal Access Authorization
                </span>
                <h2 className="mt-1 font-display font-bold text-2xl text-white tracking-tight">
                  Sign In to Floor Console
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Select a certified employee persona or enter your badge credentials.
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('personas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === 'personas'
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Quick Personas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('credentials')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === 'credentials'
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Direct Entry
                </button>
              </div>
            </div>

            {/* Error Message Banner */}
            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-rose-300">Authentication Failed</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* ===================================================== */}
            {/* TAB 1: QUICK PERSONA CARDS (For Demonstrations & RBAC)*/}
            {/* ===================================================== */}
            {activeTab === 'personas' && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Click any persona to immediately authenticate as that role:</span>
                  <span className="font-mono text-[11px] text-teal-400">5 Configured Roles</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {availableUsers.map((user) => {
                    const theme = getRoleTheme(user.role);
                    const isSelected = workId.toUpperCase() === user.workId.toUpperCase();

                    return (
                      <div
                        key={user.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-slate-900/90 border-teal-500/70 shadow-md ring-1 ring-teal-500/30'
                            : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl ${theme.iconBg} border border-slate-800 flex items-center justify-center font-bold text-sm shrink-0`}
                            >
                              {user.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-white">
                                  {user.fullName}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold uppercase tracking-wider ${theme.badge}`}
                                >
                                  {user.role}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                                <span className="text-teal-300 font-semibold">{user.workId}</span>
                                <span>·</span>
                                <span>{user.department || `${user.role} Department`}</span>
                                {user.assignedMachine && (
                                  <>
                                    <span>·</span>
                                    <span className="text-slate-300">
                                      Assigned: {user.assignedMachine}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                                {theme.responsibilities}
                              </p>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleQuickLoginAsPersona(user)}
                              disabled={loading}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-medium transition-all flex items-center justify-center gap-1.5 hover:shadow-sm disabled:opacity-50"
                            >
                              <span>Sign In as {user.role}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===================================================== */}
            {/* TAB 2: DIRECT CREDENTIAL ENTRY FORM                   */}
            {/* ===================================================== */}
            {activeTab === 'credentials' && (
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Work ID */}
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Employee Work ID / Badge
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={workId}
                        onChange={(e) => setWorkId(e.target.value.toUpperCase())}
                        placeholder="e.g. OP-101, SUP-201, MNT-401"
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono tracking-wider"
                      />
                    </div>
                  </div>

                  {/* Passphrase with Show/Hide toggle */}
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Security Passphrase
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Station Terminal & Shift Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Workstation Terminal
                    </label>
                    <div className="relative">
                      <Terminal className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={selectedTerminal}
                        onChange={(e) => setSelectedTerminal(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                      >
                        <option value="CNC-MILL-01 (Milling Cell 1)">CNC-MILL-01 (Milling Cell 1)</option>
                        <option value="CNC-LATHE-02 (Turning Cell 2)">CNC-LATHE-02 (Turning Cell 2)</option>
                        <option value="CNC-MILL-03 (4-Axis Cell 3)">CNC-MILL-03 (4-Axis Cell 3)</option>
                        <option value="Central Control Room">Central Control Room</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Operating Shift Roster
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value as any)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                      >
                        <option value="Shift A">Shift A (Morning 06:00 - 14:00)</option>
                        <option value="Shift B">Shift B (Afternoon 14:00 - 22:00)</option>
                        <option value="Night Shift">Night Shift (Graveyard 22:00 - 06:00)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Remember Session Checkbox & Credentials hint */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                    />
                    <span>Remember terminal session</span>
                  </label>
                  <span className="font-mono text-slate-500 text-[11px]">
                    Default Passphrase: <span className="text-teal-400">pass123</span>
                  </span>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-semibold rounded-lg shadow-lg shadow-teal-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
                      Authenticating Badge Session...
                    </span>
                  ) : (
                    <>
                      <span>Authenticate &amp; Launch Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Quick Help Footer */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              Pre-configured for ZIRO Manufacturing Audit &amp; Demonstration
            </span>
            <span className="text-slate-400">
              Need access? Contact System Admin (ADM-001)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
