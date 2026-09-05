/**
 * Login Page — Enterprise Authentication Screen.
 * Styled in the exact visual design system of VendorBridge:
 * - Gradient slate backdrop with glowing ambient orbs
 * - Glassmorphic card container with Outfit typography
 * - Quick Demo persona auto-fill buttons
 * - Clear inputs with eye toggle and smooth hover/focus transitions
 */
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Zap, AlertCircle, Eye, EyeOff, Lock, User, LogIn } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.detail || err?.message || (typeof err === 'string' ? err : 'Invalid credentials. Please verify and try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: 'elena.vance', role: 'Sales Rep', password: 'demo123', label: '💼 Sales Rep (Elena)' },
    { username: 'm.shah', role: 'Sales Manager', password: 'demo123', label: '🛡️ Manager (M. Shah)' },
    { username: 'r.iyer', role: 'Finance', password: 'demo123', label: '📊 Finance (R. Iyer)' },
    { username: 'admin', role: 'Admin', password: 'admin123', label: '🔑 Admin (Full Access)' },
  ];

  const autofillDemo = (acc: typeof demoAccounts[0]) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden font-sans">
      {/* Dynamic Background Glowing Orbs (VendorBridge exact style) */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30">
            <Zap className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-outfit text-3xl font-extrabold tracking-tight text-white">
            DealFlow<span className="text-primary">360</span>
          </h2>
          <p className="mt-1.5 text-xs text-slate-400 font-medium">
            Autonomous Deal Governance & Revenue Operations Platform
          </p>
        </div>

        {/* Auth Card (VendorBridge style) */}
        <div className="bg-slate-800/80 border border-slate-700/50 backdrop-blur-md rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="border-b border-slate-700/60 pb-4 text-center">
            <h3 className="text-base font-bold text-white font-outfit">Sign in to your account</h3>
            <p className="text-xs text-slate-400 mt-0.5">Access your role-based deal desk workspace</p>
          </div>

          {error && (
            <div className="flex items-center space-x-2 rounded-lg border border-danger/20 bg-danger/10 p-3 text-xs font-medium text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. elena.vance or admin"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-lg shadow-primary/20 transition-all disabled:opacity-50 mt-6 cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Sign In to Workspace</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Triggers (VendorBridge exact pattern) */}
          <div className="pt-4 border-t border-slate-700/50">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center mb-2.5">
              Quick Demo Personas
            </span>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map(acc => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => autofillDemo(acc)}
                  className="bg-slate-900 hover:bg-slate-950 text-slate-300 hover:text-white px-2.5 py-2 text-xs font-semibold border border-slate-700 rounded-lg text-left truncate transition-all cursor-pointer"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="flex items-center justify-center space-x-4 text-[11px] text-slate-500">
          <span>SOC2 Type II Certified</span>
          <span>•</span>
          <span>SLA 99.98%</span>
          <span>•</span>
          <span>Enterprise RevOps</span>
        </div>
      </div>
    </div>
  );
}
