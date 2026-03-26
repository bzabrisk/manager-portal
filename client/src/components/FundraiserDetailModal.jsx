import { useState, useEffect, useCallback } from 'react';
import {
  X, Pencil, Mail, Phone, User, ExternalLink,
  CheckCircle, Circle, FileText, Plus, AlertTriangle, Lock,
} from 'lucide-react';
import { api } from '../api/client';
import TaskDetailModal from './TaskDetailModal';
import NewTaskModal from './NewTaskModal';
import { formatAsbType, getAsbColor } from '../utils/asb';

const STATUS_COLORS = {
  'Upcoming': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Campaign Ended': 'bg-orange-100 text-orange-700',
  'Ready to Close': 'bg-purple-100 text-purple-700',
  'Closed Out': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'Awaiting PO/Rep': 'bg-gray-100 text-gray-600',
};

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
    year: 'numeric',
  });
}

function formatCurrency(val) {
  if (val == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">
      {children}
    </h3>
  );
}

function ProgressBar({ kickoff, end }) {
  if (!kickoff || !end) return null;
  const start = new Date(kickoff + 'T00:00:00').getTime();
  const finish = new Date(end + 'T00:00:00').getTime();
  const now = Date.now();
  const total = finish - start;
  if (total <= 0) return null;
  const elapsed = Math.max(0, Math.min(now - start, total));
  const pct = Math.round((elapsed / total) * 100);
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
      <div
        className="h-full bg-[#ff5000] rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function FundraiserDetailModal({ recordId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields state
  const [edits, setEdits] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);

  // Lookup data for edit mode dropdowns
  const [lookups, setLookups] = useState({ reps: [], contacts: [], accountingContacts: [], products: [] });
  const [lookupsLoading, setLookupsLoading] = useState(false);

  function initEdits(result) {
    return {
      organization: result.organization,
      team: result.team,
      kickoff_date: result.kickoff_date || '',
      end_date: result.end_date || '',
      manual_status_override: result.manual_status_override || '',
      rep_id: result.rep_id || '',
      primary_contact_id: result.primary_contact_id || '',
      accounting_contact_id: result.accounting_contact_id || '',
      product_primary_id: result.product_primary_id || '',
      product_secondary_id: result.product_secondary_id || '',
      asb_boosters: result.asb_boosters || '',
      team_size: result.team_size ?? '',
      cards_ordered: result.cards_ordered ?? '',
      cards_sold_manual: result.cards_sold_manual ?? '',
      cards_lost: result.cards_lost ?? '',
      md_portal_url: result.md_portal_url || '',
      include_md_donations: result.include_md_donations || false,
      gross_sales_md: result.gross_sales_md ?? '',
      md_payout: result.md_payout ?? '',
      md_payout_received: result.md_payout_received,
      check_invoice_sent: result.check_invoice_sent,
      rep_paid: result.rep_paid,
      invoice_payment_received: result.invoice_payment_received,
      admin_notes: result.admin_notes,
    };
  }

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.fundraisers.getDetail(recordId);
      setData(result);
      setEdits(initEdits(result));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const hasChanges = data && (() => {
    const checks = [
      edits.organization !== data.organization,
      edits.team !== data.team,
      edits.kickoff_date !== (data.kickoff_date || ''),
      edits.end_date !== (data.end_date || ''),
      edits.manual_status_override !== (data.manual_status_override || ''),
      edits.rep_id !== (data.rep_id || ''),
      edits.primary_contact_id !== (data.primary_contact_id || ''),
      edits.accounting_contact_id !== (data.accounting_contact_id || ''),
      edits.product_primary_id !== (data.product_primary_id || ''),
      edits.product_secondary_id !== (data.product_secondary_id || ''),
      edits.asb_boosters !== (data.asb_boosters || ''),
      edits.team_size !== (data.team_size ?? ''),
      edits.cards_ordered !== (data.cards_ordered ?? ''),
      edits.cards_sold_manual !== (data.cards_sold_manual ?? ''),
      edits.cards_lost !== (data.cards_lost ?? ''),
      edits.md_portal_url !== (data.md_portal_url || ''),
      edits.include_md_donations !== (data.include_md_donations || false),
      edits.gross_sales_md !== (data.gross_sales_md ?? ''),
      edits.md_payout !== (data.md_payout ?? ''),
      edits.md_payout_received !== data.md_payout_received,
      edits.check_invoice_sent !== data.check_invoice_sent,
      edits.rep_paid !== data.rep_paid,
      edits.invoice_payment_received !== data.invoice_payment_received,
      edits.admin_notes !== data.admin_notes,
    ];
    return checks.some(Boolean);
  })();

  const handleEditClick = async () => {
    setEditMode(true);
    setLookupsLoading(true);
    try {
      const [reps, contacts, accountingContacts, products] = await Promise.all([
        api.fundraisers.lookupReps(),
        api.fundraisers.lookupContacts(),
        api.fundraisers.lookupAccountingContacts(),
        api.fundraisers.lookupProducts(),
      ]);
      setLookups({ reps, contacts, accountingContacts, products });
    } catch (err) {
      console.error('Failed to load lookups:', err);
    } finally {
      setLookupsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (edits.organization !== data.organization) payload.organization = edits.organization;
      if (edits.team !== data.team) payload.team = edits.team;
      if (edits.md_portal_url !== (data.md_portal_url || '')) payload.md_portal_url = edits.md_portal_url;
      if (edits.kickoff_date !== (data.kickoff_date || '')) payload.kickoff_date = edits.kickoff_date || null;
      if (edits.end_date !== (data.end_date || '')) payload.end_date = edits.end_date || null;
      if (edits.manual_status_override !== (data.manual_status_override || '')) payload.manual_status_override = edits.manual_status_override || null;
      if (edits.asb_boosters !== (data.asb_boosters || '')) payload.asb_boosters = edits.asb_boosters || null;
      if (edits.rep_id !== (data.rep_id || '')) payload.rep_id = edits.rep_id || null;
      if (edits.primary_contact_id !== (data.primary_contact_id || '')) payload.primary_contact_id = edits.primary_contact_id || null;
      if (edits.accounting_contact_id !== (data.accounting_contact_id || '')) payload.accounting_contact_id = edits.accounting_contact_id || null;
      if (edits.product_primary_id !== (data.product_primary_id || '')) payload.product_primary_id = edits.product_primary_id || null;
      if (edits.product_secondary_id !== (data.product_secondary_id || '')) payload.product_secondary_id = edits.product_secondary_id || null;
      if (edits.team_size !== (data.team_size ?? '')) payload.team_size = edits.team_size;
      if (edits.cards_ordered !== (data.cards_ordered ?? '')) payload.cards_ordered = edits.cards_ordered;
      if (edits.cards_sold_manual !== (data.cards_sold_manual ?? '')) payload.cards_sold_manual = edits.cards_sold_manual;
      if (edits.cards_lost !== (data.cards_lost ?? '')) payload.cards_lost = edits.cards_lost;
      if (edits.gross_sales_md !== (data.gross_sales_md ?? '')) payload.gross_sales_md = edits.gross_sales_md;
      if (edits.md_payout !== (data.md_payout ?? '')) payload.md_payout = edits.md_payout;
      if (edits.include_md_donations !== (data.include_md_donations || false)) payload.include_md_donations = edits.include_md_donations;
      if (edits.md_payout_received !== data.md_payout_received) payload.md_payout_received = edits.md_payout_received;
      if (edits.check_invoice_sent !== data.check_invoice_sent) payload.check_invoice_sent = edits.check_invoice_sent;
      if (edits.rep_paid !== data.rep_paid) payload.rep_paid = edits.rep_paid;
      if (edits.invoice_payment_received !== data.invoice_payment_received) payload.invoice_payment_received = edits.invoice_payment_received;
      if (edits.admin_notes !== data.admin_notes) payload.admin_notes = edits.admin_notes;

      if (Object.keys(payload).length > 0) {
        await api.fundraisers.update(recordId, payload);
      }
      await fetchDetail();
      setEditMode(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (data) {
      setEdits(initEdits(data));
    }
    setEditMode(false);
  };

  const handleOverlayClick = () => {
    if (editMode && hasChanges) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  };

  const handleTaskRefresh = () => {
    fetchDetail();
    if (onRefresh) onRefresh();
  };

  if (loading && !data) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ paddingLeft: '208px' }}>
        <div className="bg-white rounded-xl shadow-xl p-10 text-center">
          <p className="text-slate-400">Loading fundraiser details...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ paddingLeft: '208px' }} onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl p-10 text-center" onClick={e => e.stopPropagation()}>
          <p className="text-red-500 mb-2">Failed to load fundraiser</p>
          <p className="text-sm text-slate-400">{error}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200">Close</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isTraditional = data.product_primary_string?.toLowerCase().includes('traditional');
  const showCloseout = ['Campaign Ended', 'Ready to Close', 'Closed Out'].includes(data.status);
  const hasMdProduct = data.product_primary_string?.toLowerCase().includes('md');
  const requiresInvoice = data.asb_boosters === 'WA State ASB'
    || data.product_primary_string?.toLowerCase().includes('traditional no-risk')
    || data.product_primary_string?.toLowerCase().includes('traditional upfront');
  const showDailyPayouts = data.asb_boosters === 'WA State ASB';

  // Financials
  const financials = [
    { label: 'Gross Sales', value: data.gross_sales_md },
    { label: 'Team Profit', value: data.final_team_profit },
    { label: 'Invoice Amount', value: data.final_invoice_amount },
    { label: 'Rep Commission', value: data.rep_commission },
    { label: 'SMASH Profit', value: data.smash_profit },
    { label: 'MD Payout', value: data.md_payout },
  ].filter(f => f.value != null);

  // Tasks
  const openTasks = (data.tasks || []).filter(t => t.status !== 'Done').sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
  const completedTasks = (data.tasks || []).filter(t => t.status === 'Done');

  // Daily payouts sorted by run_date desc
  const sortedPayouts = [...(data.daily_payouts || [])].sort((a, b) => {
    if (!a.run_date) return 1;
    if (!b.run_date) return -1;
    return b.run_date.localeCompare(a.run_date);
  });

  // Documents
  const documents = [
    { label: 'Fundraiser Agreement', files: data.fundraiser_agreement },
    { label: 'Fundraiser Profit Report', files: data.fundraiser_profit_report },
    { label: 'Rep Commission Report', files: data.rep_commission_report },
    { label: 'Invoice', files: data.invoice_attachment },
    { label: 'MD Payout Report', files: data.md_payout_report },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ paddingLeft: '208px' }} onClick={handleOverlayClick}>
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 bg-white rounded-t-xl border-b border-slate-100 px-6 py-4 z-10 flex items-start justify-between gap-4">
            {editMode ? (
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={edits.organization} onChange={e => setEdits(prev => ({...prev, organization: e.target.value}))}
                    placeholder="Organization" className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  <input type="text" value={edits.team} onChange={e => setEdits(prev => ({...prev, team: e.target.value}))}
                    placeholder="Team" className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <select value={edits.manual_status_override} onChange={e => setEdits(prev => ({...prev, manual_status_override: e.target.value}))}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                    <option value="">Auto (calculated)</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Awaiting PO/Rep">Awaiting PO/Rep</option>
                    <option value="Ready to Close">Ready to Close</option>
                    <option value="Closed Out">Closed Out</option>
                  </select>
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-slate-400 text-xs">Kickoff:</label>
                    <input type="date" value={edits.kickoff_date} onChange={e => setEdits(prev => ({...prev, kickoff_date: e.target.value}))}
                      className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                    <label className="text-slate-400 text-xs">End:</label>
                    <input type="date" value={edits.end_date} onChange={e => setEdits(prev => ({...prev, end_date: e.target.value}))}
                      className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-800 truncate">
                  {data.organization} — {data.team}
                </h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[data.status] || 'bg-gray-100 text-gray-600'}`}>
                    {data.status}
                  </span>
                  <span className="text-sm text-slate-400">
                    {formatDate(data.kickoff_date)} — {formatDate(data.end_date)}
                  </span>
                </div>
                {data.status === 'In Progress' && (
                  <ProgressBar kickoff={data.kickoff_date} end={data.end_date} />
                )}
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {!editMode && (
                <button
                  onClick={handleEditClick}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button
                onClick={handleOverlayClick}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Section 1: Key People */}
            <section>
              <SectionHeader>Key People</SectionHeader>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rep */}
                <div className="border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1.5">Rep</p>
                  {editMode ? (
                    <>
                      <select value={edits.rep_id} onChange={e => setEdits(prev => ({...prev, rep_id: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                        <option value="">Select rep...</option>
                        {lookups.reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      {lookupsLoading && <p className="text-xs text-slate-400 mt-1">Loading options...</p>}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {data.rep?.photo ? (
                        <img src={data.rep.photo} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                          <User size={14} className="text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{data.rep?.name || 'Unknown'}</p>
                        {data.rep?.email && (
                          <a href={`mailto:${data.rep.email}`} className="text-xs text-[#ff5000] hover:underline flex items-center gap-0.5 truncate">
                            <Mail size={10} /> {data.rep.email}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* Primary Contact */}
                <div className="border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1.5">Primary Contact</p>
                  {editMode ? (
                    <>
                      <select value={edits.primary_contact_id} onChange={e => setEdits(prev => ({...prev, primary_contact_id: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                        <option value="">Select contact...</option>
                        {lookups.contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>)}
                      </select>
                      {lookupsLoading && <p className="text-xs text-slate-400 mt-1">Loading options...</p>}
                    </>
                  ) : data.primary_contact ? (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{data.primary_contact.name}</p>
                      {data.primary_contact.email && (
                        <a href={`mailto:${data.primary_contact.email}`} className="text-xs text-[#ff5000] hover:underline flex items-center gap-0.5 mt-0.5">
                          <Mail size={10} /> {data.primary_contact.email}
                        </a>
                      )}
                      {data.primary_contact.phone && (
                        <a href={`tel:${data.primary_contact.phone}`} className="text-xs text-slate-500 hover:underline flex items-center gap-0.5 mt-0.5">
                          <Phone size={10} /> {data.primary_contact.phone}
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not set</p>
                  )}
                </div>
                {/* Accounting Contact */}
                <div className="border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1.5">Accounting Contact</p>
                  {editMode ? (
                    <>
                      <select value={edits.accounting_contact_id} onChange={e => setEdits(prev => ({...prev, accounting_contact_id: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                        <option value="">Select accounting contact...</option>
                        {lookups.accountingContacts.map(a => <option key={a.id} value={a.id}>{a.name}{a.email ? ` (${a.email})` : ''}{a.status ? ` [${a.status}]` : ''}</option>)}
                      </select>
                      {lookupsLoading && <p className="text-xs text-slate-400 mt-1">Loading options...</p>}
                    </>
                  ) : data.accounting_contact ? (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{data.accounting_contact.name}</p>
                      {data.accounting_contact.email && (
                        <a href={`mailto:${data.accounting_contact.email}`} className="text-xs text-[#ff5000] hover:underline flex items-center gap-0.5 mt-0.5">
                          <Mail size={10} /> {data.accounting_contact.email}
                        </a>
                      )}
                      {data.accounting_contact.payment_method && (
                        <p className="text-xs text-slate-500 mt-0.5">Payment: {data.accounting_contact.payment_method}</p>
                      )}
                      {data.accounting_contact.status && (
                        <span className="inline-flex text-xs mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {data.accounting_contact.status}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600 text-sm">
                      <AlertTriangle size={14} />
                      No accounting contact assigned
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Fundraiser Setup */}
            <section>
              <SectionHeader>Setup</SectionHeader>
              {editMode ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <div className="col-span-2 md:col-span-3 flex gap-3">
                    <div className="flex-1">
                      <span className="text-slate-400 text-xs">Primary Product:</span>
                      <select value={edits.product_primary_id} onChange={e => setEdits(prev => ({...prev, product_primary_id: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                        <option value="">None</option>
                        {lookups.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {lookupsLoading && <p className="text-xs text-slate-400 mt-1">Loading options...</p>}
                    </div>
                    <div className="flex-1">
                      <span className="text-slate-400 text-xs">Secondary Product:</span>
                      <select value={edits.product_secondary_id} onChange={e => setEdits(prev => ({...prev, product_secondary_id: e.target.value}))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                        <option value="">None</option>
                        {lookups.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input type="checkbox" checked={edits.include_md_donations || false}
                        onChange={e => setEdits(prev => ({...prev, include_md_donations: e.target.checked}))}
                        className="w-4 h-4 rounded border-slate-300 text-[#ff5000] focus:ring-[#ff5000]" />
                      Include MD Donations
                    </label>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Type:</span>
                    <select value={edits.asb_boosters} onChange={e => setEdits(prev => ({...prev, asb_boosters: e.target.value}))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
                      <option value="">Select...</option>
                      <option value="WA State ASB">WA State ASB</option>
                      <option value="School - other than WA State ASB">School - other than WA State ASB</option>
                      <option value="Booster Club">Booster Club</option>
                      <option value="Rec">Rec</option>
                      <option value="I don't know yet">I don't know yet</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Team size:</span>
                    <input type="number" value={edits.team_size} onChange={e => setEdits(prev => ({...prev, team_size: e.target.value}))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Cards ordered:</span>
                    <input type="number" value={edits.cards_ordered} onChange={e => setEdits(prev => ({...prev, cards_ordered: e.target.value}))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Cards sold:</span>
                    <input type="number" value={edits.cards_sold_manual} onChange={e => setEdits(prev => ({...prev, cards_sold_manual: e.target.value}))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Cards lost:</span>
                    <input type="number" value={edits.cards_lost} onChange={e => setEdits(prev => ({...prev, cards_lost: e.target.value}))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">MD Portal URL:</span>
                    <input type="text" value={edits.md_portal_url} onChange={e => setEdits(prev => ({...prev, md_portal_url: e.target.value}))}
                      placeholder="https://..." className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-slate-400">Products:</span>{' '}
                    <span className="inline-block align-middle ml-1"><ProductBadges products={data.products} /></span>
                  </div>
                  <div>
                    <span className="text-slate-400">Type:</span>{' '}
                    {data.asb_boosters && getAsbColor(data.asb_boosters) ? (
                      <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${getAsbColor(data.asb_boosters)}`}>
                        {formatAsbType(data.asb_boosters)}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-700">{data.asb_boosters || '\u2014'}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">Team size:</span>{' '}
                    <span className="font-medium text-slate-700">{data.team_size ?? '\u2014'}</span>
                  </div>
                  {isTraditional && (
                    <>
                      {data.cards_ordered != null && (
                        <div>
                          <span className="text-slate-400">Cards ordered:</span>{' '}
                          <span className="font-medium text-slate-700">{data.cards_ordered}</span>
                        </div>
                      )}
                      {data.cards_sold != null && (
                        <div>
                          <span className="text-slate-400">Cards sold:</span>{' '}
                          <span className="font-medium text-slate-700">{data.cards_sold}</span>
                        </div>
                      )}
                      {data.cards_lost != null && (
                        <div>
                          <span className="text-slate-400">Cards lost:</span>{' '}
                          <span className="font-medium text-slate-700">{data.cards_lost}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <span className="text-slate-400">MD Portal:</span>{' '}
                    {data.md_portal_url ? (
                      <a
                        href={data.md_portal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1 rounded bg-[#ff5000] hover:bg-[#e04800] transition-colors"
                      >
                        <ExternalLink size={12} /> Open MD Portal
                      </a>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Section 3: Financials */}
            {editMode ? (
              <section>
                <SectionHeader>Financials</SectionHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">Gross Sales</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm text-slate-400">$</span>
                      <input type="number" step="0.01" value={edits.gross_sales_md}
                        onChange={e => setEdits(prev => ({...prev, gross_sales_md: e.target.value}))}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 opacity-60">
                    <p className="text-xs text-slate-400">Team Profit <span className="text-slate-300">(auto)</span></p>
                    <p className="text-lg font-semibold text-slate-800 mt-0.5">{formatCurrency(data.final_team_profit) || '\u2014'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 opacity-60">
                    <p className="text-xs text-slate-400">Invoice Amount <span className="text-slate-300">(auto)</span></p>
                    <p className="text-lg font-semibold text-slate-800 mt-0.5">{formatCurrency(data.final_invoice_amount) || '\u2014'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 opacity-60">
                    <p className="text-xs text-slate-400">Rep Commission <span className="text-slate-300">(auto)</span></p>
                    <p className="text-lg font-semibold text-slate-800 mt-0.5">{formatCurrency(data.rep_commission) || '\u2014'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 opacity-60">
                    <p className="text-xs text-slate-400">SMASH Profit <span className="text-slate-300">(auto)</span></p>
                    <p className="text-lg font-semibold text-slate-800 mt-0.5">{formatCurrency(data.smash_profit) || '\u2014'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">MD Payout</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm text-slate-400">$</span>
                      <input type="number" step="0.01" value={edits.md_payout}
                        onChange={e => setEdits(prev => ({...prev, md_payout: e.target.value}))}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                    </div>
                  </div>
                </div>
              </section>
            ) : financials.length > 0 && (
              <section>
                <SectionHeader>Financials</SectionHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {financials.map(f => (
                    <div key={f.label} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400">{f.label}</p>
                      <p className="text-lg font-semibold text-slate-800 mt-0.5">{formatCurrency(f.value)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Section 4: Closeout Checklist */}
            {showCloseout && (
              <section>
                <SectionHeader>Closeout</SectionHeader>
                <div className="space-y-2">
                  {[
                    ...(hasMdProduct ? [{ key: 'md_payout_received', label: 'MD Payout received' }] : []),
                    { key: 'check_invoice_sent', label: 'Check/Invoice sent' },
                    { key: 'rep_paid', label: 'Rep paid' },
                    ...(requiresInvoice ? [{ key: 'invoice_payment_received', label: 'Invoice payment received' }] : []),
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2.5">
                      {editMode ? (
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={edits[item.key] || false}
                            onChange={e => setEdits(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-[#ff5000] focus:ring-[#ff5000]"
                          />
                          {item.label}
                        </label>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          {data[item.key] ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <Circle size={16} className="text-slate-300" />
                          )}
                          <span className={data[item.key] ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Section 5: Documents */}
            <section>
              <SectionHeader>Documents</SectionHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map(doc => (
                  <div key={doc.label}>
                    {doc.files && doc.files.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">{doc.label}</p>
                        {doc.files.map((file, i) => (
                          <a
                            key={i}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-[#ff5000] hover:underline min-w-0"
                          >
                            <FileText size={14} className="shrink-0" />
                            <span className="break-all">{file.filename}</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-400 mb-1">{doc.label}</p>
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300">
                          <FileText size={14} /> No file uploaded
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Section 6: Tasks */}
            <section>
              <SectionHeader>Tasks</SectionHeader>
              <div className="space-y-2">
                {openTasks.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1.5">Open</p>
                    <div className="flex flex-wrap gap-2">
                      {openTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border bg-orange-50 text-[#ff5000] border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                        >
                          {task.name}
                          {task.deadline && (
                            <span className="ml-1.5 text-slate-400">({formatDate(task.deadline).replace(/, \d{4}$/, '')})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {completedTasks.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1.5">Completed</p>
                    <div className="flex flex-wrap gap-2">
                      {completedTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-sm border bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer opacity-60"
                        >
                          <CheckCircle size={12} className="mr-1 text-green-400" />
                          {task.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {openTasks.length === 0 && completedTasks.length === 0 && (
                  <p className="text-sm text-slate-400">No tasks linked to this fundraiser.</p>
                )}
                <button
                  onClick={() => setShowNewTask(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#ff5000] hover:underline mt-1"
                >
                  <Plus size={14} /> New Task
                </button>
              </div>
            </section>

            {/* Section 7: Daily Payouts */}
            {showDailyPayouts && sortedPayouts.length > 0 && (
              <section>
                <SectionHeader>Daily Payouts</SectionHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium">Gross</th>
                        <th className="pb-2 pr-3 font-medium">Payout</th>
                        <th className="pb-2 pr-3 font-medium">Status</th>
                        <th className="pb-2 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPayouts.map(p => (
                        <>
                          <tr key={p.id} className="border-b border-slate-50">
                            <td className="py-2 pr-3 text-slate-700">{p.run_date ? new Date(p.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</td>
                            <td className="py-2 pr-3 text-slate-700">{formatCurrency(p.gross_sales_today) || '—'}</td>
                            <td className={`py-2 pr-3 ${p.payout_amount === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                              {formatCurrency(p.payout_amount) || '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <span className={`inline-flex text-xs font-medium px-1.5 py-0.5 rounded ${PAYOUT_STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2 text-slate-500 text-xs">{p.reference_number || '—'}</td>
                          </tr>
                          {p.status === 'failed' && p.error_message && (
                            <tr key={`${p.id}-err`}>
                              <td colSpan={5} className="pb-2 pt-0 px-2">
                                <p className="text-xs text-red-500">{p.error_message}</p>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section 8: Notes */}
            {(data.admin_notes || data.rep_notes || editMode) && (
              <section>
                <SectionHeader>Notes</SectionHeader>
                <div className="space-y-4">
                  {/* Admin Notes */}
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Admin Notes</p>
                    {editMode ? (
                      <textarea
                        value={edits.admin_notes}
                        onChange={e => setEdits(prev => ({ ...prev, admin_notes: e.target.value }))}
                        rows={4}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                      />
                    ) : (
                      data.admin_notes ? (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{data.admin_notes}</p>
                      ) : (
                        <p className="text-sm text-slate-400">No admin notes.</p>
                      )
                    )}
                  </div>
                  {/* Rep Notes */}
                  {data.rep_notes && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Rep Notes <span className="text-slate-300">(read-only)</span></p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{data.rep_notes}</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Sticky Save/Cancel Bar */}
          {editMode && (
            <div className="sticky bottom-0 bg-white border-t border-slate-100 rounded-b-xl px-6 py-3 flex justify-end gap-2 z-10">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                  hasChanges ? 'bg-[#ff5000] hover:bg-[#e04800]' : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Modal (nested) */}
      {selectedTask && (
        <TaskDetailModal
          task={{
            ...selectedTask,
            fundraiser: {
              id: data.id,
              organization: data.organization,
              team: data.team,
              asb_boosters: data.asb_boosters,
              rep_photo: data.rep_photo,
              rep_name: data.rep?.name,
            },
          }}
          onClose={() => setSelectedTask(null)}
          onEdit={() => {
            setEditingTask(selectedTask);
            setSelectedTask(null);
          }}
          onRefresh={handleTaskRefresh}
        />
      )}

      {/* Edit Task Modal (nested) */}
      {editingTask && (
        <EditTaskFromDetail
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={async (taskId, updates) => {
            const payload = { ...updates };
            if (payload.action_url && payload.action_url.trim()) {
              const url = payload.action_url.trim();
              payload.action_url = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
            }
            await api.tasks.update(taskId, payload);
            setEditingTask(null);
            handleTaskRefresh();
          }}
        />
      )}

      {/* New Task Modal (nested) */}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onRefresh={handleTaskRefresh}
          initialFundraiserId={data.id}
        />
      )}
    </>
  );
}

// Inline edit task modal (same as Upcoming page pattern)
function EditTaskFromDetail({ task, onClose, onSave }) {
  const [form, setForm] = useState({
    name: task.name,
    description: task.description || '',
    deadline: task.deadline || '',
    show_date: task.show_date || '',
    action_url: task.action_url || '',
    button_words: task.button_words || '',
    status: task.status,
    fundraiserIds: task.fundraiserIds || [],
  });
  const [fundraisers, setFundraisers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.fundraisers.list().then(setFundraisers).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await onSave(task.id, form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 mb-4">Edit Task</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Task Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
            <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Show Date</label>
            <input type="date" value={form.show_date} onChange={e => setForm(f => ({ ...f, show_date: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fundraiser</label>
            <select value={form.fundraiserIds[0] || ''} onChange={e => setForm(f => ({ ...f, fundraiserIds: e.target.value ? [e.target.value] : [] }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
              <option value="">None</option>
              {fundraisers.map(f => <option key={f.id} value={f.id}>{f.organization} {f.team}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action URL</label>
            <input type="text" value={form.action_url} onChange={e => setForm(f => ({ ...f, action_url: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action Button Label</label>
            <input type="text" value={form.button_words} onChange={e => setForm(f => ({ ...f, button_words: e.target.value }))} placeholder="e.g. Send Email, Open Portal"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]">
              {['On deck', 'To do', 'Doing', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-[#ff5000] text-white rounded-lg hover:bg-[#e04800] disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
