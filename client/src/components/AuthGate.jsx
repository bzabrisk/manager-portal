import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api/client';

export default function AuthGate({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.auth.login(password);
      onLogin();
    } catch (err) {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/smash-logo.png" alt="SMASH" className="h-16 mb-4" />
          <h1 className="text-xl font-semibold text-slate-800">Manager Portal</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
