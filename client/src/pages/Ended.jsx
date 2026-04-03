import { useState } from 'react';
import { AlertTriangle, Clock, Hourglass, CheckCircle2, User, Archive, Flag } from 'lucide-react';
import { api } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import TaskDetailModal from '../components/TaskDetailModal';
import FundraiserDetailModal from '../components/FundraiserDetailModal';
import { formatAsbType, getAsbColor } from '../utils/asb';

const PRODUCT_BADGE_COLORS = {
  primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  secondary: 'bg-violet-50 text-violet-700 border-violet-200',
  donations: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function formatCurrency(amount) {
  if (amount == null || amount === 0) return '\u2014';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDaysAgo(endDate) {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + 'T00:00:00');
  return Math.floor((today - end) / (1000 * 60 * 60 * 24));
}

function daysAgoClasses(days) {
  if (days < 7) return 'bg-green-50 text-green-700 border-green-200';
  if (days < 14) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

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

function CloseoutChecklist({ closeout, greenTint, fundraiser }) {
  const hasMdProduct = (fundraiser.product_primary_string || '').toLowerCase().includes('md');
  const requiresInvoice = fundraiser.asb_boosters === 'WA State ASB'
    || (fundraiser.product_primary_string || '').toLowerCase().includes('traditional no-risk')
    || (fundraiser.product_primary_string || '').toLowerCase().includes('traditional upfront');

  const items = [
    ...(hasMdProduct ? [{ key: 'md_payout_received', label: 'MD Payout received', value: closeout.md_payout_received }] : []),
    { key: 'check_invoice_sent', label: 'Check/Invoice sent', value: closeout.check_invoice_sent },
    { key: 'rep_paid', label: 'Rep paid', value: closeout.rep_paid },
    ...(requiresInvoice ? [{ key: 'invoice_payment_received', label: 'Invoice payment received', value: closeout.invoice_payment_received }] : []),
  ];
  return (
    <div className={`rounded-lg border px-4 py-2.5 mt-3 ${greenTint ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {items.map(item => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            {item.value ? (
              <span className="text-green-600">{'\u2705'}</span>
            ) : (
              <span className="text-slate-400">{'\u274C'}</span>
            )}
            <span className={item.value ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function WaitingBadges({ waiting, onMarkReceived, markingReceived, onMarkInvoiceReceived, markingInvoiceReceived }) {
  const badges = [];
  if (waiting.waiting_on_md_payout) {
    badges.push(
      <span key="md" className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
        Waiting on MD Payout
        <button
          onClick={(e) => { e.stopPropagation(); onMarkReceived(); }}
          disabled={markingReceived}
          className="ml-1 text-[10px] font-semibold bg-blue-200 hover:bg-blue-300 text-blue-800 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
        >
          {markingReceived ? '...' : 'Mark Received'}
        </button>
      </span>
    );
  }
  if (waiting.waiting_on_invoice_payment) {
    badges.push(
      <span key="invoice" className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
        Waiting on Invoice Payment
        <button
          onClick={(e) => { e.stopPropagation(); onMarkInvoiceReceived(); }}
          disabled={markingInvoiceReceived}
          className="ml-1 text-[10px] font-semibold bg-purple-200 hover:bg-purple-300 text-purple-800 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
        >
          {markingInvoiceReceived ? '...' : 'Mark Received'}
        </button>
      </span>
    );
  }
  if (waiting.needs_accounting_contact) {
    badges.push(
      <span key="acct" className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
        Needs Accounting Contact
      </span>
    );
  }
  if (waiting.org_name_needs_follow_up) {
    badges.push(
      <span key="org" className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
        Org Name Needs Follow-Up
      </span>
    );
  }
  if (waiting.needs_card_count) {
    badges.push(
      <span key="cards" className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
        Needs Card Count
      </span>
    );
  }
  if (badges.length === 0) return null;
  return <div className="flex flex-wrap gap-2 mt-3">{badges}</div>;
}

function EndedFundraiserCard({ fundraiser, section, onTaskClick, onFundraiserClick, onMarkReceived, markingReceived, onMarkInvoiceReceived, markingInvoiceReceived, onCloseOut, closingOut }) {
  const daysAgo = getDaysAgo(fundraiser.end_date);
  const openTasks = fundraiser.open_tasks || [];
  const isReady = section === 'ready';

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-5 w-full ${isReady ? 'border-l-4 border-l-green-400 border-slate-200' : 'border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={() => onFundraiserClick(fundraiser.id)}
            className="text-lg font-bold text-slate-800 hover:text-[#ff5000] transition-colors text-left"
          >
            {fundraiser.organization} — {fundraiser.team}
          </button>
          <div className="flex items-center gap-2 mt-1 text-sm">
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isReady && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
              <CheckCircle2 size={12} />
              Ready
            </span>
          )}
          {daysAgo !== null && (
            <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${daysAgoClasses(daysAgo)}`}>
              <Clock size={14} />
              {daysAgo <= 0 ? 'Ended today' : `Ended ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`}
            </span>
          )}
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm">
        <ProductBadges products={fundraiser.products} />
        {fundraiser.asb_boosters && getAsbColor(fundraiser.asb_boosters) && (
          <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${getAsbColor(fundraiser.asb_boosters)}`}>
            {formatAsbType(fundraiser.asb_boosters)}
          </span>
        )}
        <div>
          <span className="text-slate-400">Gross: </span>
          <span className="font-medium text-slate-700">{formatCurrency(fundraiser.gross_sales_md)}</span>
        </div>
        <div>
          <span className="text-slate-400">MD: </span>
          <span className="font-medium text-slate-700">{formatCurrency(fundraiser.md_payout)}</span>
        </div>
      </div>

      {/* Closeout checklist */}
      <CloseoutChecklist closeout={fundraiser.closeout} greenTint={isReady} fundraiser={fundraiser} />

      {/* Waiting badges */}
      <WaitingBadges
        waiting={fundraiser.waiting}
        onMarkReceived={() => onMarkReceived(fundraiser.id)}
        markingReceived={markingReceived === fundraiser.id}
        onMarkInvoiceReceived={() => onMarkInvoiceReceived(fundraiser.id)}
        markingInvoiceReceived={markingInvoiceReceived === fundraiser.id}
      />

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

      {/* Close Out button (only for ready section) */}
      {isReady && (
        <div className="mt-4">
          <button
            onClick={() => onCloseOut(fundraiser.id)}
            disabled={closingOut === fundraiser.id}
            className="inline-flex items-center gap-2 bg-[#ff5000] hover:bg-[#e04800] text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            <Archive size={16} />
            {closingOut === fundraiser.id ? 'Closing out...' : 'Mark as Closed Out'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Ended() {
  const { data: fundraisers, loading, error, refresh } = usePolling(() => api.fundraisers.ended());
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailFundraiserId, setDetailFundraiserId] = useState(null);
  const [markingReceived, setMarkingReceived] = useState(null);
  const [markingInvoiceReceived, setMarkingInvoiceReceived] = useState(null);
  const [closingOut, setClosingOut] = useState(null);

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

  const handleMarkReceived = async (fundraiserId) => {
    setMarkingReceived(fundraiserId);
    try {
      await api.fundraisers.update(fundraiserId, { md_payout_received: true });
      await refresh();
    } catch (err) {
      console.error('Failed to mark MD payout received:', err);
      // Re-fetch to revert UI to actual Airtable state
      await refresh();
    } finally {
      setMarkingReceived(null);
    }
  };

  const handleMarkInvoiceReceived = async (fundraiserId) => {
    setMarkingInvoiceReceived(fundraiserId);
    try {
      await api.fundraisers.update(fundraiserId, { invoice_payment_received: true });
      await refresh();
    } catch (err) {
      console.error('Failed to mark invoice payment received:', err);
      await refresh();
    } finally {
      setMarkingInvoiceReceived(null);
    }
  };

  const handleCloseOut = async (fundraiserId) => {
    setClosingOut(fundraiserId);
    try {
      await api.fundraisers.update(fundraiserId, { manual_status_override: 'Closed Out' });
      refresh();
    } catch (err) {
      console.error('Failed to close out fundraiser:', err);
    } finally {
      setClosingOut(null);
    }
  };

  if (loading && !fundraisers) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Loading ended fundraisers...</p>
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

  const all = fundraisers || [];

  // Section splitting
  const needsAction = all.filter(f => f.open_manager_tasks_count > 0);

  const readyToClose = all.filter(f => {
    if (f.open_manager_tasks_count > 0) return false;
    // MD payout only required for MD products
    const hasMdProduct = (f.product_primary_string || '').toLowerCase().includes('md');
    if (hasMdProduct && !f.closeout.md_payout_received) return false;
    if (!f.closeout.check_invoice_sent) return false;
    if (!f.closeout.rep_paid) return false;
    // Invoice payment only required if applicable
    const requiresInvoice = f.asb_boosters === 'WA State ASB'
      || (f.product_primary_string || '').toLowerCase().includes('traditional no-risk')
      || (f.product_primary_string || '').toLowerCase().includes('traditional upfront');
    if (requiresInvoice && !f.closeout.invoice_payment_received) return false;
    const w = f.waiting;
    if (w.waiting_on_md_payout || w.waiting_on_invoice_payment || w.needs_accounting_contact || w.org_name_needs_follow_up || w.needs_card_count) return false;
    return true;
  });

  const readyIds = new Set(readyToClose.map(f => f.id));
  const needsActionIds = new Set(needsAction.map(f => f.id));
  const waitingOn = all.filter(f => !needsActionIds.has(f.id) && !readyIds.has(f.id));

  const hasAny = all.length > 0;

  if (!hasAny) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Flag size={48} className="text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-600">No ended fundraisers — all caught up!</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-5">Ended Fundraisers</h1>

      {/* Section 1: Needs Action */}
      {needsAction.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-800">Needs Action</h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded">
              {needsAction.length}
            </span>
            <span className="text-sm text-slate-400">These fundraisers have open tasks</span>
          </div>
          <div className="space-y-4">
            {needsAction.map(f => (
              <EndedFundraiserCard
                key={f.id}
                fundraiser={f}
                section="action"
                onTaskClick={handleTaskClick}
                onFundraiserClick={setDetailFundraiserId}
                onMarkReceived={handleMarkReceived}
                markingReceived={markingReceived}
                onMarkInvoiceReceived={handleMarkInvoiceReceived}
                markingInvoiceReceived={markingInvoiceReceived}
                onCloseOut={handleCloseOut}
                closingOut={closingOut}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {needsAction.length > 0 && waitingOn.length > 0 && (
        <div className="border-t border-gray-200 my-8" />
      )}

      {/* Section 2: Waiting */}
      {waitingOn.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Hourglass size={20} className="text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">Waiting</h2>
            <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded">
              {waitingOn.length}
            </span>
            <span className="text-sm text-slate-400">No open tasks — waiting on external items</span>
          </div>
          <div className="space-y-4">
            {waitingOn.map(f => (
              <EndedFundraiserCard
                key={f.id}
                fundraiser={f}
                section="waiting"
                onTaskClick={handleTaskClick}
                onFundraiserClick={setDetailFundraiserId}
                onMarkReceived={handleMarkReceived}
                markingReceived={markingReceived}
                onMarkInvoiceReceived={handleMarkInvoiceReceived}
                markingInvoiceReceived={markingInvoiceReceived}
                onCloseOut={handleCloseOut}
                closingOut={closingOut}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {(needsAction.length > 0 || waitingOn.length > 0) && readyToClose.length > 0 && (
        <div className="border-t border-gray-200 my-8" />
      )}

      {/* Section 3: Ready to Close Out */}
      {readyToClose.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={20} className="text-green-500" />
            <h2 className="text-lg font-semibold text-slate-800">Ready to Close Out</h2>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
              {readyToClose.length}
            </span>
            <span className="text-sm text-slate-400">All items complete — ready to archive</span>
          </div>
          <div className="space-y-4">
            {readyToClose.map(f => (
              <EndedFundraiserCard
                key={f.id}
                fundraiser={f}
                section="ready"
                onTaskClick={handleTaskClick}
                onFundraiserClick={setDetailFundraiserId}
                onMarkReceived={handleMarkReceived}
                markingReceived={markingReceived}
                onMarkInvoiceReceived={handleMarkInvoiceReceived}
                markingInvoiceReceived={markingInvoiceReceived}
                onCloseOut={handleCloseOut}
                closingOut={closingOut}
              />
            ))}
          </div>
        </div>
      )}

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
