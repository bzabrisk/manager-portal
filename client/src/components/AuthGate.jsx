import { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

export default function AuthGate({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // A 429 means the server has locked the login for a while. Show it
  // differently from "Incorrect password" so it's clear retyping won't help.
  const [lockedOut, setLockedOut] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLockedOut(false);
    try {
      await api.auth.login(password);
      onLogin();
    } catch (err) {
      if (err.status === 429) {
        setLockedOut(true);
        setError(err.message || 'Too many attempts. Try again in 15 minutes.');
      } else {
        setError('Incorrect password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-900 max-lg:px-4">
      <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/smash-logo.png" alt="SMASH" className="max-w-[200px] mb-4" />
          <h1 className="text-xl font-semibold text-white">Manager Portal</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-600 bg-slate-800 text-white placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff5000] focus:border-transparent"
              autoFocus
            />
          </div>
          {error && !lockedOut && <p className="text-red-500 text-sm mb-3">{error}</p>}
          {error && lockedOut && (
            <div className="flex items-start gap-2 mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" size={16} />
              <p className="text-amber-300 text-sm">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-[#ff5000] text-white rounded-lg font-medium hover:bg-[#e04800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
