import { useState, useRef } from 'react';
import { Clock, User, Play, DollarSign, AlertTriangle, Coffee } from 'lucide-react';
import { api } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import TaskDetailModal from '../components/TaskDetailModal';
import FundraiserDetailModal from '../components/FundraiserDetailModal';
import { formatAsbType, getAsbColor } from '../utils/asb';

const PAYOUT_STATUS_COLORS = {
  awaiting_data: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount) {
  if (amount == null || amount === 0) return '\u2014';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysRemaining(endDate) {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + 'T00:00:00');
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function daysRemainingClasses(days) {
  if (days >= 5) return 'bg-green-50 text-green-700 border-green-200';
  if (days >= 2) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

const PRODUCT_BADGE_COLORS = {
  primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  secondary: 'bg-violet-50 text-violet-700 border-violet-200',
  donations: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function ProductBadges({ products }) {
  if (!products || products.length === 0) return <span className="text-slate-400">{'\u2014'}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {products.map(p => (
        <span key={p.type} className={`text-xs font-medium px-2 py-0.5 rounded border ${PRODUCT_BADGE_COLORS[p.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {p.name}
        </span>
      ))}
    </div>
  );
}

function getCampaignProgress(kickoff, end) {
  if (!kickoff || !end) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(kickoff + 'T00:00:00');
  const finish = new Date(end + 'T00:00:00');
  const total = finish - start;
  if (total <= 0) return 100;
  const elapsed = today - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function TaskBadge({ task, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-sm border bg-orange-50 text-[#ff5000] border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
    >
      {task.name}
    </button>
  );
}

function ActiveFundraiserCard({ fundraiser, onTaskClick, onFundraiserClick }) {
  const days = getDaysRemaining(fundraiser.end_date);
  const progress = getCampaignProgress(fundraiser.kickoff_date, fundraiser.end_date);
  const openTasks = fundraiser.open_tasks || [];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={() => onFundraiserClick(fundraiser.id)}
            className="text-lg font-bold text-slate-800 hover:text-[#ff5000] transition-colors text-left"
          >
            {fundraiser.organization} — {fundraiser.team}
          </button>
          <p className="text-sm text-slate-400 mt-0.5">
            {formatDate(fundraiser.kickoff_date)} – {formatDate(fundraiser.end_date)}
          </p>
        </div>
        {days !== null && (
          <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${daysRemainingClasses(days)}`}>
            <Clock size={14} />
            {days <= 0 ? 'Ending today' : `${days} ${days === 1 ? 'day' : 'days'} left`}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full relative">
        {/* Track */}
        <div className="bg-gray-200 rounded-full h-3 relative">
          {/* Milestone dots */}
          {[25, 50, 75, 100].map(milestone => (
            <div
              key={milestone}
              className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 ${
                progress >= milestone
                  ? 'bg-white shadow-sm'
                  : 'bg-gray-300'
              }`}
              style={{ left: `${milestone}%`, transform: `translate(-50%, -50%)` }}
            />
          ))}
          {/* Fill */}
          <div
            className="h-3 rounded-full overflow-hidden relative transition-all"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(to right, #10b981, #34d399, #fbbf24, #f59e0b)',
              backgroundSize: `${progress > 0 ? (100 / (progress / 100)) : 100}% 100%`,
            }}
          >
            {/* Shimmer overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.15) 60%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s ease-in-out infinite',
              }}
            />
          </div>
          {/* Current position indicator */}
          {progress > 0 && (
            <div
              className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow z-20"
              style={{
                left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </div>
      </div>

      {/* Key info row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Rep:</span>
          <span className="font-medium text-slate-700">{fundraiser.rep_name || '\u2014'}</span>
          {fundraiser.rep_photo ? (
            <img src={fundraiser.rep_photo} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-200" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
              <User size={12} className="text-slate-400" />
            </div>
          )}
        </div>
        <div>
          <ProductBadges products={fundraiser.products} />
        </div>
        <div>
          <span className="text-slate-400">Primary: </span>
          <span className="font-medium text-slate-700">{fundraiser.primary_contact_name || '\u2014'}</span>
        </div>
        <div>
          <span className="text-slate-400">Accounting: </span>
          {fundraiser.accounting_contact_name ? (
            <span className="font-medium text-slate-700">{fundraiser.accounting_contact_name}</span>
          ) : (
            <span className="text-amber-600 text-xs font-medium">No accounting contact</span>
          )}
        </div>
      </div>
      {fundraiser.asb_boosters && getAsbColor(fundraiser.asb_boosters) && (
        <div className="mt-2 text-sm">
          <span className="text-slate-400">ASB: </span>
          <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${getAsbColor(fundraiser.asb_boosters)}`}>
            {formatAsbType(fundraiser.asb_boosters)}
          </span>
        </div>
      )}

      {/* Task badges */}
      {openTasks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {openTasks.map(task => (
            <TaskBadge
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task, fundraiser)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckNumberCell({ payout }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(payout.check_number || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const handleSave = async () => {
    if (value === (payout.check_number || '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await api.payouts.update(payout.id, { check_number: value });
      payout.check_number = value;
    } catch (err) {
      console.error('Failed to save check number:', err);
      setValue(payout.check_number || '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        disabled={saving}
        className="w-20 px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#ff5000]"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-1.5 py-0.5 rounded min-w-[3rem] text-left transition-colors"
    >
      {saving ? '...' : value || '\u2014'}
    </button>
  );
}

function PayoutsTable({ payouts, displayLabel, onFundraiserClick }) {
  const failedPayouts = payouts.filter(p => p.status === 'failed');

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <DollarSign size={20} className="text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-800">{displayLabel || 'Payouts'}</h2>
        <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded">
          {payouts.length}
        </span>
      </div>

      {/* Failed payout alert */}
      {failedPayouts.length > 0 && (
        <div className="bg-red-600 text-white rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <AlertTriangle size={18} />
            {failedPayouts.length} payout{failedPayouts.length !== 1 ? 's' : ''} failed
          </div>
          {failedPayouts.map(p => (
            <div key={p.id} className="ml-6 text-sm">
              <span className="font-medium">{p.organization} — {p.team}</span>
              {p.error_message && (
                <p className="text-red-200 text-xs mt-0.5">{p.error_message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {payouts.length === 0 ? (
        <p className="text-slate-400 text-sm py-4">No payouts scheduled for today</p>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-[30%]">Org + Team</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 w-[22%]">Payee</th>
                <th className="text-right px-3 py-2.5 font-medium text-slate-500 w-[18%]">Payout Amount</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[15%]">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 w-[15%]">Check #</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => {
                const isZero = !p.payout_amount || p.payout_amount === 0;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-2.5">
                      {p.fundraiser_id ? (
                        <button
                          onClick={() => onFundraiserClick(p.fundraiser_id)}
                          className="text-slate-800 font-medium hover:text-[#ff5000] transition-colors text-left"
                        >
                          {p.organization} — {p.team}
                        </button>
                      ) : (
                        <span className="text-slate-800 font-medium">{p.organization} — {p.team}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{p.accounting_contact_name || '\u2014'}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${isZero ? 'text-slate-300' : 'text-slate-800'}`}>
                      {formatCurrency(p.payout_amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded ${PAYOUT_STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'awaiting_data' ? 'Awaiting Data' : p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : '\u2014'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <CheckNumberCell payout={p} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Active() {
  const { data: fundraisers, loading: loadingFundraisers, error: errorFundraisers, refresh: refreshFundraisers } = usePolling(() => api.fundraisers.active());
  const { data: payoutData, loading: loadingPayouts, error: errorPayouts, refresh: refreshPayouts } = usePolling(() => api.payouts.today());
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailFundraiserId, setDetailFundraiserId] = useState(null);

  const loading = loadingFundraisers && !fundraisers;
  const error = errorFundraisers || errorPayouts;

  const handleTaskClick = (task, fundraiser) => {
    setSelectedTask({
      ...task,
      fundraiser: {
        id: fundraiser.id,
        organization: fundraiser.organization,
        team: fundraiser.team,
        asb_boosters: fundraiser.asb_boosters,
        rep_photo: fundraiser.rep_photo,
        rep_name: fundraiser.rep_name,
      },
    });
  };

  const refresh = () => {
    refreshFundraisers();
    refreshPayouts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Loading active fundraisers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load data</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const activeFundraisers = fundraisers || [];
  const payouts = payoutData?.payouts || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-5">Active Fundraisers</h1>

      {/* Active Fundraisers List */}
      {activeFundraisers.length === 0 ? (
        <div className="text-center py-8">
          <Play size={48} className="text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-600">No active fundraisers</h2>
        </div>
      ) : (
        <div className="space-y-4">
          {activeFundraisers.map(f => (
            <ActiveFundraiserCard
              key={f.id}
              fundraiser={f}
              onTaskClick={handleTaskClick}
              onFundraiserClick={setDetailFundraiserId}
            />
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-200 my-8" />

      {/* Payouts — hide on weekends (Pacific time) */}
      {(() => {
        const pacificDay = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' });
        const isWeekend = pacificDay === 'Saturday' || pacificDay === 'Sunday';
        if (isWeekend) {
          return (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                <Coffee size={20} className="text-amber-700" />
              </div>
              <p className="text-slate-700 text-sm">
                <span className="font-semibold">No e-checks on the weekend.</span>{' '}
                <span className="italic">In fact, quit working and go play!</span> <span className="not-italic">{'\u2615'}</span>
                <span className="text-slate-400 ml-1">{'\u2014'}Cash</span>
              </p>
            </div>
          );
        }
        return <PayoutsTable payouts={payouts} displayLabel={payoutData?.displayLabel} onFundraiserClick={setDetailFundraiserId} />;
      })()}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onRefresh={refresh}
        />
      )}

      {/* Fundraiser Detail Modal */}
      {detailFundraiserId && (
        <FundraiserDetailModal
          recordId={detailFundraiserId}
          onClose={() => setDetailFundraiserId(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
