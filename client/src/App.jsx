import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from './api/client';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
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

function AuthenticatedApp({ onLogout }) {
  const { data: tasks, loading, error, refresh } = usePolling(() => api.tasks.list());

  const activeTasks = (tasks || []).filter(t =>
    t.assignee === 'Office Manager' && (t.status === 'To do' || t.status === 'Doing')
  );

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar activeTaskCount={activeTasks.length} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={
            <Dashboard tasks={tasks || []} loading={loading} error={error} refresh={refresh} />
          } />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/active" element={<Active />} />
          <Route path="/ended" element={<Ended />} />
        </Routes>
      </main>
    </div>
  );
}
