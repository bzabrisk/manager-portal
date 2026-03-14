import { NavLink } from 'react-router-dom';
import { CheckSquare, Calendar, Play, Flag, MessageCircle, LogOut } from 'lucide-react';
import { api } from '../api/client';

const navItems = [
  { to: '/', label: 'Dashboard', icon: CheckSquare, badgeKey: 'dashboard' },
  { to: '/upcoming', label: 'Upcoming', icon: Calendar, badgeKey: 'upcoming' },
  { to: '/active', label: 'Active', icon: Play, badgeKey: 'active' },
  { to: '/ended', label: 'Ended', icon: Flag, badgeKey: 'ended' },
];

export default function Sidebar({ activeTaskCount, onLogout }) {
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
          const badge = badgeKey === 'dashboard' ? activeTaskCount : null;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge !== null && badge > 0 && (
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
              {badge === null && badgeKey !== 'dashboard' && (
                <span className="text-slate-500 text-xs">&mdash;</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-3 space-y-1">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-colors">
          <MessageCircle size={18} />
          <span>Cash</span>
        </button>
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
