/**
 * Login Page — Sign in / Sign up forms.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../../api/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register({ username, email, password, first_name: firstName, last_name: lastName });
      } else {
        await login(username, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-xl">
              A
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">DealFlow360</h1>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Enterprise Revenue Operations Platform</p>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-[var(--color-border)] rounded-lg p-8 elevation-1">
          <h2 className="text-headline-md mb-6">{isRegister ? 'Create Account' : 'Login / Signup'}</h2>

          {/* Quick login buttons */}
          {!isRegister && (
            <div className="mb-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-2 font-medium uppercase tracking-wider">Quick Demo Login</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { user: 'elena.vance', label: 'Sales Rep', pass: 'demo123' },
                  { user: 'm.shah', label: 'Manager', pass: 'demo123' },
                  { user: 'r.iyer', label: 'Finance', pass: 'demo123' },
                  { user: 'admin', label: 'Admin', pass: 'admin123' },
                ].map(({ user, label, pass }) => (
                  <button
                    key={user}
                    type="button"
                    onClick={async () => {
                      setError('');
                      setLoading(true);
                      try {
                        await login(user, pass);
                        navigate('/');
                      } catch (err) {
                        setError('Seed data not loaded. Run: python manage.py seed_data');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-3 py-2 text-sm font-medium border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-alt)] transition text-left"
                  >
                    <span className="text-[var(--color-text-primary)]">{label}</span>
                    <span className="block text-xs text-[var(--color-text-muted)] font-mono">{user}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 my-4">
                <hr className="flex-1 border-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-muted)]">or enter credentials</span>
                <hr className="flex-1 border-[var(--color-border)]" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label-uppercase block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                required
              />
            </div>

            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-label-uppercase block mb-1">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                    />
                  </div>
                  <div>
                    <label className="text-label-uppercase block mb-1">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-label-uppercase block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-label-uppercase block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-9 px-3 border border-[var(--color-border-muted)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-[var(--color-rose-bg)] border border-[var(--color-rose-border)] rounded text-sm text-[var(--color-rose-text)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded border border-[var(--color-primary-hover)] transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Login')}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </p>

          <p className="text-center text-xs text-[var(--color-text-disabled)] mt-3">
            Tip: Click a demo account button for instant access, or create a new internal or customer account.
          </p>
        </div>
      </div>
    </div>
  );
}
