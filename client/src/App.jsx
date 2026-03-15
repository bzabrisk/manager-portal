import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from './api/client';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import CashChat from './components/CashChat';
import Dashboard from './pages/Dashboard';
import Upcoming from './pages/Upcoming';
import Active from './pages/Active';
import Ended from './pages/Ended';
import { usePolling } from './hooks/usePolling';

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    api.auth.check()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthGate onLogin={() => setAuthenticated(true)} />;
  }

  return <AuthenticatedApp onLogout={() => setAuthenticated(false)} />;
}

function FundraiserDetailPlaceholder() {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">Fundraiser Detail</h1>
      <p className="text-slate-400">Coming soon</p>
    </div>
  );
}

function AuthenticatedApp({ onLogout }) {
  const { data: tasks, loading, error, refresh } = usePolling(() => api.tasks.list());
  const { data: upcomingData } = usePolling(() => api.fundraisers.upcomingCount());

  const activeTasks = (tasks || []).filter(t =>
    t.assignee === 'Office Manager' && (t.status === 'To do' || t.status === 'Doing')
  );

  const upcomingCount = upcomingData?.needsAttention ?? 0;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar activeTaskCount={activeTasks.length} upcomingCount={upcomingCount} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={
            <Dashboard tasks={tasks || []} loading={loading} error={error} refresh={refresh} />
          } />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/active" element={<Active />} />
          <Route path="/ended" element={<Ended />} />
          <Route path="/fundraiser/:id" element={<FundraiserDetailPlaceholder />} />
        </Routes>
      </main>
      <CashChat />
    </div>
  );
}
