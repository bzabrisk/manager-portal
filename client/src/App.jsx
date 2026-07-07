import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { api } from './api/client';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import FundraiserDetailModal from './components/FundraiserDetailModal';
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

function AuthenticatedApp({ onLogout }) {
  const [deepLinkFundraiserId, setDeepLinkFundraiserId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fundraiserId = params.get('fundraiser');
    if (fundraiserId && fundraiserId.startsWith('rec')) {
      setDeepLinkFundraiserId(fundraiserId);
      const url = new URL(window.location.href);
      url.searchParams.delete('fundraiser');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const { data: tasks, loading, error, refresh } = usePolling(() => api.tasks.list());
  const { data: upcomingData } = usePolling(() => api.fundraisers.upcomingCount());
  const { data: activeData } = usePolling(() => api.fundraisers.activeCount());
  const { data: endedData } = usePolling(() => api.fundraisers.endedCount());
  const { data: payoutSummary } = usePolling(() => api.payouts.todaySummary());

  const activeTasks = (tasks || []).filter(t =>
    t.assignee === 'Office Manager' && (t.status === 'To do' || t.status === 'Doing')
  );

  const upcomingCount = upcomingData?.needsAttention ?? 0;
  const activeCount = activeData?.total ?? 0;
  const endedCount = endedData?.needsAction ?? 0;
  const failedPayouts = payoutSummary?.failed ?? 0;

  const sidebarProps = {
    activeTaskCount: activeTasks.length,
    upcomingCount,
    activeCount,
    endedCount,
    failedPayouts,
    onLogout,
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen max-lg:h-dvh bg-slate-50">
      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center gap-2 bg-slate-800 px-3 h-14 shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="flex items-center justify-center min-w-11 min-h-11 text-white rounded-lg active:bg-slate-700"
        >
          <Menu size={24} />
        </button>
        <img src="/smash-logo.png" alt="SMASH" className="h-8 object-contain" />
      </header>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 flex max-w-[80vw] transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar {...sidebarProps} onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

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
      <CashChat />

      {deepLinkFundraiserId && (
        <FundraiserDetailModal
          recordId={deepLinkFundraiserId}
          onClose={() => setDeepLinkFundraiserId(null)}
        />
      )}
    </div>
  );
}
