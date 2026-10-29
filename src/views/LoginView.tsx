import React, { useState } from 'react';
import { UserProfile } from '../types';
import { apiClient } from '../services/apiClient';
import { Activity, AlertCircle, ArrowRight, Eye, EyeOff, Factory, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

interface LoginViewProps { onLoginSuccess: (user: UserProfile) => void; }

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [workId, setWorkId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const authenticatedUser = await apiClient.login(workId, password);
      onLoginSuccess(authenticatedUser);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Sign-in could not be completed. Check your credentials or contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl grid lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative min-h-64 lg:min-h-[560px] overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 p-8 sm:p-10 flex flex-col justify-between bg-slate-50">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_25%_25%,#0d9488,transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black">FP</span>
              <div><p className="font-bold text-slate-900">FactoryPulse</p><p className="text-xs text-slate-600">Manufacturing operations</p></div>
            </div>
            <p className="mt-12 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-800"><Factory className="h-3.5 w-3.5"/> Workforce sign-in</p>
            <h1 className="mt-5 max-w-lg text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">One trusted account for your shift.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600">Your role, employee identity, and machine assignment come from the FactoryPulse authentication service.</p>
          </div>
          <div className="relative mt-10 grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-100/50 p-4"><ShieldCheck className="h-5 w-5 text-teal-800"/><p className="mt-3 text-sm font-semibold text-slate-800">Server verified access</p><p className="mt-1 text-xs text-slate-500">No role or employee picker on this screen.</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-100/50 p-4"><Activity className="h-5 w-5 text-slate-700"/><p className="mt-3 text-sm font-semibold text-slate-800">Auditable sessions</p><p className="mt-1 text-xs text-slate-500">Sign-in activity is recorded by the backend.</p></div>
          </div>
        </section>

        <section className="p-7 sm:p-10 flex flex-col justify-center">
          <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Secure access</p><h2 className="mt-2 text-2xl font-bold text-slate-900">Sign in</h2><p className="mt-2 text-sm text-slate-600">Use your assigned employee ID and password.</p></div>
          {errorMessage && <div role="alert" className="mb-5 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/><span>{errorMessage}</span></div>}
          <form onSubmit={handleLogin} className="space-y-5">
            <div><label htmlFor="employee-id" className="mb-2 block text-xs font-medium text-slate-700">Employee ID</label><div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input id="employee-id" autoComplete="username" required maxLength={32} value={workId} onChange={(event) => setWorkId(event.target.value.toUpperCase())} className="w-full rounded-lg border border-slate-200 bg-slate-100 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-teal-500" placeholder="Enter your employee ID"/></div></div>
            <div><label htmlFor="password" className="mb-2 block text-xs font-medium text-slate-700">Password</label><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-100 py-3 pl-10 pr-11 text-sm text-slate-900 outline-none focus:border-teal-500" placeholder="Enter your password"/><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-600 hover:text-teal-800">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:opacity-60">{loading ? 'Verifying account…' : 'Continue to FactoryPulse'}{!loading && <ArrowRight className="h-4 w-4"/>}</button>
          </form>
          <p className="mt-6 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">Accounts are provisioned by your administrator. If access is unavailable, contact your site administrator; do not use another employee’s credentials.</p>
        </section>
      </div>
    </main>
  );
};
