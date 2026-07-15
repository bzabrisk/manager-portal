import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Pencil, Mail, Phone, User, ExternalLink, ChevronRight, ChevronDown,
  CheckCircle, Circle, FileText, Plus, AlertTriangle, Lock, Upload,
} from 'lucide-react';
import { api } from '../api/client';
import TaskDetailModal from './TaskDetailModal';
import NewTaskModal from './NewTaskModal';
import { formatAsbType, getAsbColor } from '../utils/asb';

const AIRTABLE_FUNDRAISER_URL_BASE = 'https://airtable.com/appxDlniu6IPMVIVp/tbl7aH2mtkAGC9jk9';

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

function ReportDocSlot({ label, files, generating, error, isDataReady, onGenerate, awaitingMdPayout, isStale, isMdFundraiser = true, blocked, blockedReason }) {
  const hasFile = files && files.length > 0;

  if (hasFile) {
    return (
      <div>
        <div className={`rounded-lg p-3 flex items-center justify-between gap-3 border ${isStale ? 'bg-amber-50 border-amber-300' : 'border-slate-200'}`}>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <a
              href={files[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#ff5000] hover:underline min-w-0"
            >
              <FileText size={14} className="shrink-0" />
              <span className="break-all">{files[0].filename}</span>
            </a>
            {isStale && (
              <p className="text-xs text-amber-700 italic mt-1">This report may be out of date — regenerate to apply recent changes.</p>
            )}
          </div>
          <button
            onClick={onGenerate}
            disabled={generating || blocked}
            title={blocked ? blockedReason : undefined}
            className={`text-xs font-medium px-3 py-1.5 rounded border disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${isStale ? 'border-amber-300 text-amber-700 hover:bg-amber-100' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {generating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 h-full flex flex-col justify-center">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 mb-1">
              {label} — waiting on manual product split
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              This is a two-product fundraiser. Enter the product split in the form above before reports can be generated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (awaitingMdPayout) {
    return (
      <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-xs text-slate-400 italic">Will auto-generate once MD Payout Report is uploaded.</p>
      </div>
    );
  }

  // Non-MD fundraiser with no file: always show Generate button
  if (!isMdFundraiser) {
    return (
      <div>
        <button
          onClick={onGenerate}
          disabled={generating || blocked}
          title={blocked ? blockedReason : undefined}
          className="w-full h-full bg-[#ff5000] hover:bg-[#e64600] active:bg-[#cc3f00] text-white font-semibold py-4 px-4 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <FileText size={18} />
          {generating ? 'Generating...' : `Generate ${label}`}
        </button>
        {!isDataReady && (
          <p className="text-xs text-slate-400 mt-1.5 text-center">Make sure Qty Sold is entered above before generating.</p>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onGenerate}
        disabled={generating || !isDataReady || blocked}
        title={blocked ? blockedReason : !isDataReady ? 'Financial data not yet available' : undefined}
        className="w-full h-full bg-[#ff5000] hover:bg-[#e64600] active:bg-[#cc3f00] text-white font-semibold py-4 px-4 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <FileText size={18} />
        {generating ? 'Generating...' : `Generate ${label}`}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

function ManualProductSplitCallout({ data, onSaved, mode }) {
  const [ppInput, setPpInput] = useState(data.pp_gross_manual ?? '');
  const [spInput, setSpInput] = useState(data.sp_gross ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const referenceTotal = data.pp_gross_automd;

  const handleSave = async () => {
    setError('');
    const pp = parseFloat(ppInput);
    const sp = parseFloat(spInput);
    if (isNaN(pp) || isNaN(sp) || pp < 0 || sp < 0) {
      setError('Both fields must be valid positive numbers.');
      return;
    }
    setSaving(true);
    try {
      await api.fundraisers.update(data.id, { pp_gross_manual: pp, sp_gross: sp });
      await onSaved();
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPpInput(data.pp_gross_manual ?? '');
    setSpInput(data.sp_gross ?? '');
    setEditing(false);
    setError('');
  };

  const fmt = (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';

  const formFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Primary — {data.product_primary_string || 'product'}
        </label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={ppInput}
            onChange={e => setPpInput(e.target.value)}
            disabled={saving}
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-[#ff5000]"
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Secondary — {data.product_secondary_name || 'product'}
        </label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={spInput}
            onChange={e => setSpInput(e.target.value)}
            disabled={saving}
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-[#ff5000]"
            placeholder="0.00"
          />
        </div>
      </div>
      {referenceTotal != null && (
        <p className="text-xs text-slate-500 mt-2 italic">
          For reference, the combined gross from the MD Payout Report was{' '}
          <strong>${Number(referenceTotal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>.{' '}
          Your split must add up to exactly this amount.
        </p>
      )}
    </>
  );

  // Mode A: values missing — prominent amber blocking callout
  if (mode === 'needed') {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-3 mb-3">
        <div className="flex items-start gap-2.5 mb-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900 mb-1">
              Two-product fundraiser — manual split needed
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              The MD Payout Report combines product totals into one number, so the breakdown can't be detected automatically. Please enter how much of the combined total came from each product before generating reports.
            </p>
          </div>
        </div>
        <div className="space-y-2 ml-7">
          {formFields}
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-2 px-4 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save split'}
          </button>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  // Mode B: values present — compact neutral summary with edit toggle
  return (
    <div className="border border-slate-200 rounded-lg p-3 mt-3 mb-3">
      {!editing ? (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Product split:</span>{' '}
              {data.product_primary_string || 'Primary'} {fmt(data.pp_gross_manual)}{' · '}
              {data.product_secondary_name || 'Secondary'} {fmt(data.sp_gross)}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-[#ff5000] hover:underline shrink-0 ml-3"
            >
              Edit split
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 mb-2">Edit product split</p>
          {formFields}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium bg-[#ff5000] hover:bg-[#e04800] text-white rounded shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function FundraiserDetailModal({ recordId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Collapsible breakdown sections
  const [rcrOpen, setRcrOpen] = useState(false);
  const [fprOpen, setFprOpen] = useState(false);
  const [smashOpen, setSmashOpen] = useState(false);

  // Editable fields state
  const [edits, setEdits] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);

  // MD Payout Report upload
  const [uploadingMdPayout, setUploadingMdPayout] = useState(false);
  const [mdPayoutError, setMdPayoutError] = useState('');
  const mdPayoutFileInputRef = useRef(null);

  // Report generation
  const [generatingFpr, setGeneratingFpr] = useState(false);
  const [generatingRcr, setGeneratingRcr] = useState(false);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [reportError, setReportError] = useState({ fpr: '', rcr: '', agreement: '' });

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
      md_payout_received: result.md_payout_received,
      check_invoice_sent: result.check_invoice_sent,
      rep_paid: result.rep_paid,
      invoice_payment_received: result.invoice_payment_received,
      admin_notes: result.admin_notes,
      agreement_notes: result.agreement_notes || '',
      // Rep Commission breakdown editable fields
      rcr_adj_team_to_rep: result.rcr_adj_team_to_rep ?? '',
      fpr_adj_team_to_rep_label: result.fpr_adj_team_to_rep_label || '',
      rcr_adj_misc: result.rcr_adj_misc ?? '',
      rcr_comment: result.rcr_comment || '',
      extra_cd_boxes_ordered: result.extra_cd_boxes_ordered ?? '',
      cost_product: result.cost_product ?? '',
      // Accounting-contact paper-check fields (live on the accounting_contact record)
      ac_prefers_paper_check: result.accounting_contact?.prefers_paper_check || false,
      ac_check_addr_line1: result.accounting_contact?.check_addr_line1 || '',
      ac_check_addr_line2: result.accounting_contact?.check_addr_line2 || '',
      ac_check_addr_city: result.accounting_contact?.check_addr_city || '',
      ac_check_addr_state: result.accounting_contact?.check_addr_state || '',
      ac_check_addr_zip: result.accounting_contact?.check_addr_zip || '',
    };
  }

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.fundraisers.getDetail(recordId);
      setData(result);
      setEdits(initEdits(result));
      setError('');
      return result;
    } catch (err) {
      setError(err.message);
      return null;
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
      edits.md_payout_received !== data.md_payout_received,
      edits.check_invoice_sent !== data.check_invoice_sent,
      edits.rep_paid !== data.rep_paid,
      edits.invoice_payment_received !== data.invoice_payment_received,
      edits.admin_notes !== data.admin_notes,
      edits.agreement_notes !== (data.agreement_notes || ''),
      edits.rcr_adj_team_to_rep !== (data.rcr_adj_team_to_rep ?? ''),
      edits.fpr_adj_team_to_rep_label !== (data.fpr_adj_team_to_rep_label || ''),
      edits.rcr_adj_misc !== (data.rcr_adj_misc ?? ''),
      edits.rcr_comment !== (data.rcr_comment || ''),
      edits.extra_cd_boxes_ordered !== (data.extra_cd_boxes_ordered ?? ''),
      edits.cost_product !== (data.cost_product ?? ''),
      edits.ac_prefers_paper_check !== (data.accounting_contact?.prefers_paper_check || false),
      edits.ac_check_addr_line1 !== (data.accounting_contact?.check_addr_line1 || ''),
      edits.ac_check_addr_line2 !== (data.accounting_contact?.check_addr_line2 || ''),
      edits.ac_check_addr_city !== (data.accounting_contact?.check_addr_city || ''),
      edits.ac_check_addr_state !== (data.accounting_contact?.check_addr_state || ''),
      edits.ac_check_addr_zip !== (data.accounting_contact?.check_addr_zip || ''),
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
      if (edits.include_md_donations !== (data.include_md_donations || false)) payload.include_md_donations = edits.include_md_donations;
      if (edits.md_payout_received !== data.md_payout_received) payload.md_payout_received = edits.md_payout_received;
      if (edits.check_invoice_sent !== data.check_invoice_sent) payload.check_invoice_sent = edits.check_invoice_sent;
      if (edits.rep_paid !== data.rep_paid) payload.rep_paid = edits.rep_paid;
      if (edits.invoice_payment_received !== data.invoice_payment_received) payload.invoice_payment_received = edits.invoice_payment_received;
      if (edits.admin_notes !== data.admin_notes) payload.admin_notes = edits.admin_notes;
      if (edits.agreement_notes !== (data.agreement_notes || '')) payload.agreement_notes = edits.agreement_notes;
      if (edits.rcr_adj_team_to_rep !== (data.rcr_adj_team_to_rep ?? '')) payload.rcr_adj_team_to_rep = edits.rcr_adj_team_to_rep;
      if (edits.fpr_adj_team_to_rep_label !== (data.fpr_adj_team_to_rep_label || '')) payload.fpr_adj_team_to_rep_label = edits.fpr_adj_team_to_rep_label;
      if (edits.rcr_adj_misc !== (data.rcr_adj_misc ?? '')) payload.rcr_adj_misc = edits.rcr_adj_misc;
      if (edits.rcr_comment !== (data.rcr_comment || '')) payload.rcr_comment = edits.rcr_comment;
      if (edits.extra_cd_boxes_ordered !== (data.extra_cd_boxes_ordered ?? '')) payload.extra_cd_boxes_ordered = edits.extra_cd_boxes_ordered;
      if (edits.cost_product !== (data.cost_product ?? '')) payload.cost_product = edits.cost_product;

      // Accounting-contact paper-check fields save to the accounting_contact record, not the fundraiser
      const ac = data.accounting_contact;
      const acPayload = {};
      if (ac && data.accounting_contact_id && edits.accounting_contact_id === (data.accounting_contact_id || '')) {
        if (edits.ac_prefers_paper_check !== (ac.prefers_paper_check || false)) acPayload.prefers_paper_check = edits.ac_prefers_paper_check;
        if (edits.ac_check_addr_line1 !== (ac.check_addr_line1 || '')) acPayload.check_addr_line1 = edits.ac_check_addr_line1;
        if (edits.ac_check_addr_line2 !== (ac.check_addr_line2 || '')) acPayload.check_addr_line2 = edits.ac_check_addr_line2;
        if (edits.ac_check_addr_city !== (ac.check_addr_city || '')) acPayload.check_addr_city = edits.ac_check_addr_city;
        if (edits.ac_check_addr_state !== (ac.check_addr_state || '')) acPayload.check_addr_state = edits.ac_check_addr_state;
        if (edits.ac_check_addr_zip !== (ac.check_addr_zip || '')) acPayload.check_addr_zip = edits.ac_check_addr_zip;
      }

      if (Object.keys(payload).length > 0) {
        await api.fundraisers.update(recordId, payload);
      }
      if (Object.keys(acPayload).length > 0) {
        await api.fundraisers.updateAccountingContact(data.accounting_contact_id, acPayload);
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

  const handleMdPayoutFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMdPayout(true);
    setMdPayoutError('');

    try {
      // Extract data from the PDF synchronously via Claude
      const extraction = await api.fundraisers.extractMdPayout(data.id, file);

      if (!extraction.success) {
        throw new Error(extraction.warnings?.[0] || 'Could not read the payout report. Please check the file and try again.');
      }

      // Save extracted values + attach PDF + generate reports (all synchronous)
      await api.fundraisers.saveMdPayout(data.id, file, extraction.values);

      // Refresh modal to show updated data, attached PDF, and generated reports
      await fetchDetail();
    } catch (err) {
      setMdPayoutError(err.message || 'Upload failed.');
    } finally {
      setUploadingMdPayout(false);
      if (mdPayoutFileInputRef.current) mdPayoutFileInputRef.current.value = '';
    }
  };

  const handleGenerateReport = async (kind) => {
    const setStateMap = { fpr: setGeneratingFpr, rcr: setGeneratingRcr, agreement: setGeneratingAgreement };
    const setState = setStateMap[kind];
    setState(true);
    setReportError(prev => ({ ...prev, [kind]: '' }));
    try {
      const res = await fetch(`/api/reports/${kind}/${data.id}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.code === 'MANUAL_SPLIT_REQUIRED') {
          throw new Error('Please complete the product split above before generating.');
        }
        throw new Error(err.error || 'Generation failed');
      }
      await fetchDetail();
    } catch (err) {
      setReportError(prev => ({ ...prev, [kind]: err.message }));
    } finally {
      setState(false);
    }
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
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 lg:pl-[208px]">
        <div className="bg-white rounded-xl shadow-xl p-10 text-center">
          <p className="text-slate-400">Loading fundraiser details...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 lg:pl-[208px] max-lg:p-4" onClick={onClose}>
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
  const isCookieDough = data.product_primary_string?.toLowerCase().includes('cookie dough');
  const cdBoxesInvalid = edits.extra_cd_boxes_ordered !== '' && (isNaN(edits.extra_cd_boxes_ordered) || Number(edits.extra_cd_boxes_ordered) < 0 || !Number.isInteger(Number(edits.extra_cd_boxes_ordered)));
  const costProductInvalid = edits.cost_product !== '' && (isNaN(edits.cost_product) || Number(edits.cost_product) < 0);

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
  const isMdFundraiser = (data.product_primary_string || '').toLowerCase().includes('md')
    || data.md_payout_report?.length > 0
    || data.include_md_donations;
  const isReportDataReady = !!(data.gross_sales_md && data.final_team_profit && data.rep_commission);
  const fprStale = data.fprStale;
  const rcrStale = data.rcrStale;
  const hasSecondary = data.has_secondary;
  const isTwoProduct = isMdFundraiser && hasSecondary;
  const needsManualProductSplit = isTwoProduct
    && (!data.pp_gross_manual || data.pp_gross_manual === 0 || data.sp_gross == null || data.sp_gross === 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 lg:pl-[208px]" onClick={handleOverlayClick}>
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 max-lg:h-full max-lg:max-h-full max-lg:rounded-none"
          onClick={e => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 bg-white rounded-t-xl border-b border-slate-100 px-6 py-4 z-10 flex items-start justify-between gap-4 max-lg:px-4 max-lg:rounded-none shrink-0">
            {editMode ? (
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex gap-2 max-lg:flex-col">
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
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors max-lg:p-2.5"
              >
                <X size={20} />
              </button>
            </div>
          </div>


          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6 max-lg:px-4">
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
                      {data.accounting_contact && edits.accounting_contact_id === (data.accounting_contact_id || '') && (
                        <div className="mt-2 space-y-1.5">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={edits.ac_prefers_paper_check}
                              onChange={e => setEdits(prev => ({...prev, ac_prefers_paper_check: e.target.checked}))}
                              className="accent-[#ff5000]"
                            />
                            Prefers paper check
                          </label>
                          {edits.ac_prefers_paper_check && (
                            <>
                              <input type="text" placeholder="Address Line 1" value={edits.ac_check_addr_line1}
                                onChange={e => setEdits(prev => ({...prev, ac_check_addr_line1: e.target.value}))}
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                              <input type="text" placeholder="Address Line 2 (optional)" value={edits.ac_check_addr_line2}
                                onChange={e => setEdits(prev => ({...prev, ac_check_addr_line2: e.target.value}))}
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                              <div className="flex gap-1.5">
                                <input type="text" placeholder="City" value={edits.ac_check_addr_city}
                                  onChange={e => setEdits(prev => ({...prev, ac_check_addr_city: e.target.value}))}
                                  className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                                <input type="text" placeholder="ST" maxLength={2} value={edits.ac_check_addr_state}
                                  onChange={e => setEdits(prev => ({...prev, ac_check_addr_state: e.target.value}))}
                                  className="w-12 border border-slate-300 rounded-lg px-2 py-1.5 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                                <input type="text" placeholder="ZIP" value={edits.ac_check_addr_zip}
                                  onChange={e => setEdits(prev => ({...prev, ac_check_addr_zip: e.target.value}))}
                                  className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : data.accounting_contact ? (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{data.accounting_contact.name}</p>
                      {data.accounting_contact.email && (
                        <a href={`mailto:${data.accounting_contact.email}`} className="text-xs text-[#ff5000] hover:underline flex items-center gap-0.5 mt-0.5">
                          <Mail size={10} /> {data.accounting_contact.email}
                        </a>
                      )}
                      {data.accounting_contact.prefers_paper_check && (
                        <div className="mt-0.5">
                          <p className="text-xs text-slate-500">Payment: Paper check (mailed)</p>
                          {data.accounting_contact.check_addr_line1 && (
                            <p className="text-xs text-slate-500 whitespace-pre-line">
                              {[
                                data.accounting_contact.check_addr_line1,
                                data.accounting_contact.check_addr_line2,
                                `${data.accounting_contact.check_addr_city}, ${data.accounting_contact.check_addr_state} ${data.accounting_contact.check_addr_zip}`,
                              ].filter(Boolean).join('\n')}
                            </p>
                          )}
                        </div>
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm max-sm:grid-cols-1">
                  <div className="col-span-full flex gap-3 max-sm:flex-col">
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
                  <div className="col-span-full">
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm max-sm:grid-cols-1">
                  <div className="col-span-full">
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
            <section>
              <SectionHeader>Financials</SectionHeader>

              {/* Part A: Summary (all read-only) */}
              {financials.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-sm:grid-cols-1">
                  {financials.map(f => (
                    <div key={f.label} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400">{f.label}</p>
                      <p className="text-lg font-semibold text-slate-800 mt-0.5">{formatCurrency(f.value)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Part B: Rep Commission Breakdown */}
              <div className="mt-4 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRcrOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    {rcrOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Rep Commission Breakdown
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    Final: {formatCurrency(data.rep_commission) || '\u2014'}
                  </span>
                </button>

                {rcrOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {/* Subtotal */}
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-700">Subtotal</span>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(data.rep_comm_before_adj) || '\u2014'}</span>
                    </div>

                    {/* Adjustment between Team & Rep */}
                    <div className="py-1.5">
                      {editMode ? (
                        <>
                          <div className="flex justify-between items-start gap-3 max-lg:flex-wrap">
                            <div>
                              <span className="text-sm text-slate-600">Adjustment between Team & Rep</span>
                              <p className="text-xs text-slate-400 mt-0.5">Positive = team gives rep &middot; Negative = rep gives team</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="flex items-center gap-1 w-28">
                                <span className="text-sm text-slate-400">$</span>
                                <input type="number" step="0.01" value={edits.rcr_adj_team_to_rep}
                                  onChange={e => setEdits(prev => ({...prev, rcr_adj_team_to_rep: e.target.value}))}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                              </div>
                              <input type="text" placeholder="Label" value={edits.fpr_adj_team_to_rep_label}
                                onChange={e => setEdits(prev => ({...prev, fpr_adj_team_to_rep_label: e.target.value}))}
                                className="w-40 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <div>
                            <span className="text-sm text-slate-600">Adjustment between Team & Rep</span>
                            {data.fpr_adj_team_to_rep_label && <p className="text-xs text-slate-400 mt-0.5">{data.fpr_adj_team_to_rep_label}</p>}
                          </div>
                          <span className={`text-sm ${data.rcr_adj_team_to_rep ? 'text-slate-700' : 'text-slate-400'}`}>
                            {data.rcr_adj_team_to_rep ? formatCurrency(data.rcr_adj_team_to_rep) : '\u2014'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* WA State ASB Fee */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">WA State ASB Fee</span>
                      <span className={`text-sm ${data.rcr_adj_asbfee ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.rcr_adj_asbfee ? formatCurrency(data.rcr_adj_asbfee) : '\u2014'}
                      </span>
                    </div>

                    {/* 50% MD Prize Shop Fee */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">50% MD Prize Shop Fee</span>
                      <span className={`text-sm ${data.rcr_adj_half_md_prize_fee ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.rcr_adj_half_md_prize_fee ? formatCurrency(data.rcr_adj_half_md_prize_fee) : '\u2014'}
                      </span>
                    </div>

                    {/* Small Fundraiser Adj */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">Small Fundraiser Adj</span>
                      <span className={`text-sm ${data.rcr_adj_smallfradj ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.rcr_adj_smallfradj ? formatCurrency(data.rcr_adj_smallfradj) : '\u2014'}
                      </span>
                    </div>

                    {/* Excess Printing Adj */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">Excess Printing Adj</span>
                      <span className={`text-sm ${data.rcr_adj_excessprint ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.rcr_adj_excessprint ? formatCurrency(data.rcr_adj_excessprint) : '\u2014'}
                      </span>
                    </div>

                    {/* Extra Cookie Dough Boxes — only for Cookie Dough products */}
                    {isCookieDough && (
                      <>
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-sm text-slate-600">Extra boxes ordered</span>
                          {editMode ? (
                            <div className="w-20">
                              <input type="number" min="0" step="1" value={edits.extra_cd_boxes_ordered}
                                onChange={e => setEdits(prev => ({...prev, extra_cd_boxes_ordered: e.target.value}))}
                                className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000] ${cdBoxesInvalid ? 'border-red-400' : 'border-slate-300'}`} />
                              {cdBoxesInvalid && <p className="text-xs text-red-500 mt-0.5">Must be 0 or more</p>}
                            </div>
                          ) : (
                            <span className={`text-sm ${data.extra_cd_boxes_ordered ? 'text-slate-700' : 'text-slate-400'}`}>
                              {data.extra_cd_boxes_ordered ?? '\u2014'}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-sm text-slate-600">Extra cookie dough boxes (&times;$7)</span>
                          <span className={`text-sm ${data.rcr_adj_extra_cd_boxes ? 'text-slate-700' : 'text-slate-400'}`}>
                            {data.rcr_adj_extra_cd_boxes ? formatCurrency(data.rcr_adj_extra_cd_boxes) : '\u2014'}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Misc Adjustment */}
                    <div className="py-1.5">
                      {editMode ? (
                        <div className="flex justify-between items-start gap-3 max-lg:flex-wrap">
                          <span className="text-sm text-slate-600 pt-1 shrink-0">Misc Adjustment</span>
                          <div className="flex items-start gap-2">
                            <div className="flex items-center gap-1 w-28">
                              <span className="text-sm text-slate-400">$</span>
                              <input type="number" step="0.01" placeholder="+/−" value={edits.rcr_adj_misc}
                                title="Positive = extra commission, negative = deduction"
                                onChange={e => setEdits(prev => ({...prev, rcr_adj_misc: e.target.value}))}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                            </div>
                            <input type="text" placeholder="Comment" value={edits.rcr_comment}
                              onChange={e => setEdits(prev => ({...prev, rcr_comment: e.target.value}))}
                              maxLength={500}
                              className="w-40 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <div>
                            <span className="text-sm text-slate-600">Misc Adjustment</span>
                            {data.rcr_comment && <p className="text-xs text-slate-400 mt-0.5">{data.rcr_comment}</p>}
                          </div>
                          <span className={`text-sm ${data.rcr_adj_misc ? 'text-slate-700' : 'text-slate-400'}`}>
                            {data.rcr_adj_misc ? formatCurrency(data.rcr_adj_misc) : '\u2014'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Final Rep Commission */}
                    <div className="flex justify-between py-2 border-t border-slate-200 mt-1">
                      <span className="text-sm font-bold text-slate-800">Final Rep Commission</span>
                      <span className="text-base font-bold text-slate-800">{formatCurrency(data.rep_commission) || '\u2014'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Part C: Team Profit Breakdown */}
              <div className="mt-3 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFprOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    {fprOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Team Profit Breakdown
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    Final: {formatCurrency(data.final_team_profit) || '\u2014'}
                  </span>
                </button>

                {fprOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {/* Subtotal */}
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-700">Subtotal</span>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(data.team_profit_before_adj) || '\u2014'}</span>
                    </div>

                    {/* 50% Prize Share */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">50% Prize Share</span>
                      <span className={`text-sm ${data.fpr_adj_md_prize_share ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.fpr_adj_md_prize_share ? formatCurrency(data.fpr_adj_md_prize_share) : '\u2014'}
                      </span>
                    </div>

                    {/* Adjustment between Team & Rep (read-only mirror) */}
                    <div className="flex justify-between items-start py-1.5">
                      <div>
                        <span className="text-sm text-slate-600">Adjustment between Team & Rep</span>
                        {editMode ? (
                          <p className="text-xs text-slate-400 mt-0.5">
                            <button type="button" onClick={() => { setRcrOpen(true); setFprOpen(false); }} className="text-[#ff5000] hover:underline">
                              Edit in Rep Commission Breakdown &uarr;
                            </button>
                          </p>
                        ) : (
                          data.fpr_adj_team_to_rep_label && <p className="text-xs text-slate-400 mt-0.5">{data.fpr_adj_team_to_rep_label}</p>
                        )}
                      </div>
                      <span className={`text-sm ${data.fpr_adj_team_to_rep ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.fpr_adj_team_to_rep ? formatCurrency(data.fpr_adj_team_to_rep) : '\u2014'}
                      </span>
                    </div>

                    {/* ASB Fee */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">ASB Fee</span>
                      <span className={`text-sm ${data.fpr_adj_asbfee ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.fpr_adj_asbfee ? formatCurrency(data.fpr_adj_asbfee) : '\u2014'}
                      </span>
                    </div>

                    {/* Final Team Profit */}
                    <div className="flex justify-between py-2 border-t border-slate-200 mt-1">
                      <span className="text-sm font-bold text-slate-800">Final Team Profit</span>
                      <span className="text-base font-bold text-slate-800">{formatCurrency(data.final_team_profit) || '\u2014'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Part D: SMASH Profit Breakdown */}
              <div className="mt-3 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSmashOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    {smashOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    SMASH Profit Breakdown
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    Final: {formatCurrency(data.smash_profit) || '\u2014'}
                  </span>
                </button>

                {smashOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {/* Gross Sales */}
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-700">Gross Sales</span>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(data.gross_sales_calc) || '\u2014'}</span>
                    </div>

                    {/* Team Profit (deduction) */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">Team Profit</span>
                      <span className={`text-sm ${data.final_team_profit ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.final_team_profit ? formatCurrency(-Math.abs(data.final_team_profit)) : '\u2014'}
                      </span>
                    </div>

                    {/* Rep Commission (deduction) */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">Rep Commission</span>
                      <span className={`text-sm ${data.rep_commission ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.rep_commission ? formatCurrency(-Math.abs(data.rep_commission)) : '\u2014'}
                      </span>
                    </div>

                    {/* MD Cut (deduction) */}
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-slate-600">MD Cut</span>
                      <span className={`text-sm ${data.md_cut ? 'text-slate-700' : 'text-slate-400'}`}>
                        {data.md_cut ? formatCurrency(-Math.abs(data.md_cut)) : '\u2014'}
                      </span>
                    </div>

                    {/* Product Cost (editable) */}
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm text-slate-600">Product Cost</span>
                      {editMode ? (
                        <div className="w-28">
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-slate-400">$</span>
                            <input type="number" step="0.01" min="0" value={edits.cost_product}
                              onChange={e => setEdits(prev => ({...prev, cost_product: e.target.value}))}
                              className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000] ${costProductInvalid ? 'border-red-400' : 'border-slate-300'}`} />
                          </div>
                          {costProductInvalid && <p className="text-xs text-red-500 mt-0.5">Must be 0 or more</p>}
                        </div>
                      ) : (
                        <span className={`text-sm ${data.cost_product ? 'text-slate-700' : 'text-slate-400'}`}>
                          {data.cost_product ? formatCurrency(-Math.abs(data.cost_product)) : '\u2014'}
                        </span>
                      )}
                    </div>

                    {/* Final SMASH Profit */}
                    <div className="flex justify-between py-2 border-t border-slate-200 mt-1">
                      <span className="text-sm font-bold text-slate-800">Final SMASH Profit</span>
                      <span className="text-base font-bold text-slate-800">{formatCurrency(data.smash_profit) || '\u2014'}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

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
              {/* Row 1: MD Payout Report (half-width, only for MD fundraisers) */}
              {isMdFundraiser && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    {data.md_payout_report && data.md_payout_report.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-400 mb-1">MD Payout Report</p>
                          <a
                            href={data.md_payout_report[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-[#ff5000] hover:underline min-w-0"
                          >
                            <FileText size={14} className="shrink-0" />
                            <span className="break-all">{data.md_payout_report[0].filename}</span>
                          </a>
                        </div>
                        <button
                          onClick={() => mdPayoutFileInputRef.current?.click()}
                          disabled={uploadingMdPayout}
                          className="text-xs font-medium px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 shrink-0"
                        >
                          {uploadingMdPayout ? 'Reading report...' : 'Replace'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => mdPayoutFileInputRef.current?.click()}
                        disabled={uploadingMdPayout}
                        className="w-full h-full bg-[#ff5000] hover:bg-[#e64600] active:bg-[#cc3f00] text-white font-semibold py-4 px-4 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Upload size={18} />
                        {uploadingMdPayout ? 'Reading report and generating documents\u2026' : 'Attach MD Payout Report'}
                      </button>
                    )}

                    {mdPayoutError && (
                      <p className="text-xs text-red-500 mt-2">{mdPayoutError}</p>
                    )}

                    <input
                      ref={mdPayoutFileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleMdPayoutFileChange}
                    />
                  </div>
                </div>
              )}

              {/* Manual product split for two-product MD fundraisers */}
              {isTwoProduct && (
                <ManualProductSplitCallout
                  data={data}
                  onSaved={fetchDetail}
                  mode={needsManualProductSplit ? 'needed' : 'entered'}
                />
              )}

              {/* Row 2: FPR and RCR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <ReportDocSlot
                  label="Fundraiser Profit Report"
                  files={data.fundraiser_profit_report}
                  generating={generatingFpr}
                  error={reportError.fpr}
                  isDataReady={isReportDataReady}
                  onGenerate={() => handleGenerateReport('fpr')}
                  awaitingMdPayout={isMdFundraiser && !data.md_payout_report?.length}
                  isStale={fprStale}
                  isMdFundraiser={isMdFundraiser}
                  blocked={needsManualProductSplit}
                  blockedReason="Enter the product split above first."
                />
                <ReportDocSlot
                  label="Rep Commission Report"
                  files={data.rep_commission_report}
                  generating={generatingRcr}
                  error={reportError.rcr}
                  isDataReady={isReportDataReady}
                  onGenerate={() => handleGenerateReport('rcr')}
                  awaitingMdPayout={isMdFundraiser && !data.md_payout_report?.length}
                  isStale={rcrStale}
                  isMdFundraiser={isMdFundraiser}
                  blocked={needsManualProductSplit}
                  blockedReason="Enter the product split above first."
                />
              </div>

              {/* Row 3: Unsigned Agreement + Signed Agreement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <ReportDocSlot
                  label="Fundraiser Agreement (Unsigned)"
                  files={data.fundraiser_agreement_unsigned}
                  generating={generatingAgreement}
                  error={reportError.agreement}
                  isDataReady={true}
                  onGenerate={() => handleGenerateReport('agreement')}
                />
                <div>
                  {data.fundraiser_agreement_final && data.fundraiser_agreement_final.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Fundraiser Agreement (Signed)</p>
                      {data.fundraiser_agreement_final.map((file, i) => (
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
                      <p className="text-xs text-slate-400 mb-1">Fundraiser Agreement (Signed)</p>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300">
                        <FileText size={14} /> No file uploaded
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4: Invoice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  {data.invoice_attachment && data.invoice_attachment.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Invoice</p>
                      {data.invoice_attachment.map((file, i) => (
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
                      <p className="text-xs text-slate-400 mb-1">Invoice</p>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300">
                        <FileText size={14} /> No file uploaded
                      </div>
                    </div>
                  )}
                </div>
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
                  <table className="w-full text-sm max-lg:min-w-[480px]">
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
            {(data.admin_notes || data.rep_notes || data.agreement_notes || editMode) && (
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
                  {/* Agreement Notes */}
                  {(editMode || data.agreement_notes) && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Agreement Notes
                        {editMode && <span className="ml-1 text-slate-300 font-normal">(included in Fundraiser Agreement under "Additional Notes" — leave blank to auto-fill tiered pricing notes for card products)</span>}
                      </p>
                      {editMode ? (
                        <textarea
                          value={edits.agreement_notes}
                          onChange={e => setEdits(prev => ({ ...prev, agreement_notes: e.target.value }))}
                          rows={3}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                          placeholder="Leave blank for default behavior, or type custom notes here..."
                        />
                      ) : (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{data.agreement_notes}</p>
                      )}
                    </div>
                  )}
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
            <div className="sticky bottom-0 bg-white border-t border-slate-100 rounded-b-xl px-6 py-3 flex justify-end gap-2 z-10 max-lg:px-4 max-lg:rounded-none shrink-0">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors max-lg:py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving || cdBoxesInvalid || costProductInvalid}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors max-lg:py-2.5 ${
                  hasChanges && !cdBoxesInvalid && !costProductInvalid ? 'bg-[#ff5000] hover:bg-[#e04800]' : 'bg-slate-300 cursor-not-allowed'
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] max-lg:p-3" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto max-lg:max-h-full max-lg:p-4" onClick={e => e.stopPropagation()}>
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg max-lg:py-2.5">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-[#ff5000] text-white rounded-lg hover:bg-[#e04800] disabled:opacity-50 max-lg:py-2.5">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
