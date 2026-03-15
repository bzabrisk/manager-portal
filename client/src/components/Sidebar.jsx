import { NavLink } from 'react-router-dom';
import { CheckSquare, Calendar, Play, Flag, LogOut } from 'lucide-react';
import { api } from '../api/client';

const navItems = [
  { to: '/', label: 'Dashboard', icon: CheckSquare, badgeKey: 'dashboard' },
  { to: '/upcoming', label: 'Upcoming', icon: Calendar, badgeKey: 'upcoming' },
  { to: '/active', label: 'Active', icon: Play, badgeKey: 'active' },
  { to: '/ended', label: 'Ended', icon: Flag, badgeKey: 'ended' },
];

export default function Sidebar({ activeTaskCount, upcomingCount, activeCount, failedPayouts, onLogout }) {
  const handleLogout = async () => {
    await api.auth.logout();
    onLogout();
  };

  return (
    <aside className="w-60 bg-slate-800 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-slate-700">
        <img src="/smash-logo.png" alt="SMASH" className="h-10 mx-auto" />
      </div>

      <nav className="flex-1 py-3">
        {navItems.map(({ to, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey === 'dashboard' ? activeTaskCount
            : badgeKey === 'upcoming' ? upcomingCount
            : badgeKey === 'active' ? activeCount
            : null;
          const showRedDot = badgeKey === 'active' && failedPayouts > 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors border-l-[3px] ${
                  isActive
                    ? 'border-smash bg-slate-700 text-white'
                    : 'border-transparent text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge !== null && badge > 0 && badgeKey === 'dashboard' && (
                <span className="bg-[#ff5000] text-white text-sm font-bold px-2 py-0.5 rounded">
                  {badge}
                </span>
              )}
              {badge !== null && badge > 0 && badgeKey !== 'dashboard' && (
                <span className="relative bg-slate-600 text-slate-300 text-sm font-bold px-2 py-0.5 rounded">
                  {badge}
                  {showRedDot && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-800" />
                  )}
                </span>
              )}
              {(badge === null || badge === 0) && badgeKey !== 'dashboard' && (
                <span className="text-slate-500 text-xs">&mdash;</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-white rounded-lg transition-colors"
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
