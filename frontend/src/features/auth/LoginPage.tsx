/**
 * Login Page — enterprise-styled authentication screen.
 */
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';

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
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: 'elena.vance', role: 'Sales Manager', password: 'pass123' },
    { username: 'marcus.ross', role: 'Sales Rep', password: 'pass123' },
    { username: 'michael.shah', role: 'Finance', password: 'pass123' },
    { username: 'admin', role: 'Admin', password: 'admin123' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface-canvas)' }}>
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12"
           style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #2563EB 100%)' }}>
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                 style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
              A
            </div>
            <span className="text-white text-xl font-semibold">DealFlow360</span>
          </div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
            Enterprise Revenue<br />Operations Platform
          </h1>
          <p className="text-blue-200 text-base leading-relaxed max-w-md">
            Self-governing deal engine with automated discount governance,
            real-time warehouse fulfillment, and hybrid billing — all in one platform.
          </p>
        </div>
        <div className="flex items-center gap-6 text-blue-300 text-xs">
          <span>SOC2 Type II Certified</span>
          <span>•</span>
          <span>System SLA 99.98%</span>
          <span>•</span>
          <span>Enterprise Grade</span>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-2 lg:hidden">
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
                 style={{ background: '#2563EB' }}>A</div>
            <span className="font-semibold text-lg">DealFlow<span style={{ color: '#2563EB' }}>360</span></span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Sign in to your account
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-caption)' }}>
            Access the Sales Operations workspace
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded text-sm"
                 style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: '1px solid var(--color-danger-border)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                     style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                     style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-caption)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2"
              style={{ height: 42 }}
            >
              {loading ? (
                <RefreshCwIcon />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-surface-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3"
               style={{ color: 'var(--color-text-caption)', letterSpacing: '0.05em' }}>
              Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                  className="card flex flex-col items-start p-3 cursor-pointer transition-all hover:border-blue-400"
                  style={{ fontSize: 12 }}
                >
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{acc.username}</span>
                  <span style={{ color: 'var(--color-text-caption)', fontSize: 10 }}>{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
