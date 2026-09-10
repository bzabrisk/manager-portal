import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Upload, FileText, AlertTriangle, ShoppingCart, Copy, Check } from 'lucide-react';
import { api } from '../api/client';
import { CDS_TEMPLATE_URL, FRMGR_URL } from '../utils/cookieDough';
import MarkDoneButton from './MarkDoneButton';

// Numeric field that saves on blur / Enter, like the inline Check # cell on the
// Active page. Empty is a real value (clears the Airtable field, never writes 0).
function BlurSaveNumberField({ label, helper, initialValue, onSave, validate, step, prefix, placeholder }) {
  const toStr = (v) => (v == null ? '' : String(v));
  const [value, setValue] = useState(toStr(initialValue));
  const [committed, setCommitted] = useState(toStr(initialValue));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const next = value.trim();
    if (next === committed) return;
    const problem = next === '' ? '' : validate(next);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(next === '' ? null : Number(next));
      setCommitted(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(`Failed to save ${label}:`, err);
      setError(err.message || 'Save failed — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <label className="block text-xs font-semibold text-slate-700 mb-0.5">{label}</label>
      <p className="text-xs text-slate-500 leading-relaxed mb-1.5">{helper}</p>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          disabled={saving}
          className={`w-32 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000] disabled:opacity-60 ${error ? 'border-red-400' : 'border-slate-300'}`}
        />
        {saving && <span className="text-xs text-slate-400">Saving...</span>}
        {saved && !saving && <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check size={12} /> Saved</span>}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function StepNumber({ n }) {
  return (
    <span className="w-6 h-6 rounded bg-[#ff5000] text-white text-xs font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

// Panel for the cookiedough:sheet task action. Uploading the sheet never marks the
// task Done — the task is "order the cookie dough" and the terminal action happens
// on frmgr.com, outside the portal's view. The ONLY completion path is the
// "Mark as Done" button at the bottom, which Krista clicks once the order is placed.
// Marking it Done has no downstream automation — the cost is collected in step 4.
export default function CookieDoughSheetModal({ task, onClose, onDone, onRefresh }) {
  const fundraiserId = (task.fundraiserIds && task.fundraiserIds[0]) || task.fundraiser?.id || null;

  const [loading, setLoading] = useState(!!fundraiserId);
  const [loadError, setLoadError] = useState('');
  const [sheet, setSheet] = useState(null); // first attachment or null
  const [detail, setDetail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!fundraiserId) return;
    api.fundraisers.getDetail(fundraiserId)
      .then(d => {
        setDetail(d);
        setSheet(d.cookie_dough_sheet?.[0] || null);
      })
      .catch(err => setLoadError(err.message || 'Failed to load fundraiser'))
      .finally(() => setLoading(false));
  }, [fundraiserId]);

  // frmgr requires the presale name typed exactly, so build it from the real
  // fundraiser values. Season is a formula that can be blank — drop it rather
  // than printing an empty tail.
  // Collapse whitespace too — some Airtable org names carry stray trailing spaces.
  const buildPresale = (parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const mdPortalUrl = detail?.md_portal_url || '';

  // Both numeric fields write straight to the fundraiser record (same fields the
  // detail modal and the Product Cost modal write), never to the task.
  const validateBoxes = (v) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) return 'Must be 0 or more';
    if (!Number.isInteger(n)) return 'Whole boxes only';
    return '';
  };
  const validateCost = (v) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) return 'Must be 0 or more';
    return '';
  };
  const saveField = (key) => async (val) => {
    await api.fundraisers.update(fundraiserId, { [key]: val });
    setDetail(prev => (prev ? { ...prev, [key]: val } : prev));
    if (onRefresh) onRefresh();
  };

  const presaleName = detail
    ? buildPresale([detail.organization, detail.team, detail.season])
    : (task.fundraiser ? buildPresale([task.fundraiser.organization, task.fundraiser.team]) : '');

  const handleCopyPresale = async () => {
    try {
      await navigator.clipboard.writeText(presaleName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, permissions) — the text is still selectable
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await api.fundraisers.uploadCookieDoughSheet(fundraiserId, file);
      setSheet(result.attachment);
      setUploaded(true);
      if (onRefresh) onRefresh();
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] max-lg:p-3" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto max-lg:max-h-full max-lg:p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart size={18} />
            Order Cookie Dough
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded max-lg:p-2.5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Step 1 — Get the Pick Ticket Report */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={1} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-1">Get the Pick Ticket Report</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Open this fundraiser in the MoneyDolly portal. On the right side under Reports, click &quot;Pick Ticket Report (PDF)&quot; and download it — those are the numbers you'll type into the Cookie Dough Sheet in the next step.
                </p>
                {!fundraiserId ? (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    This task has no linked fundraiser, so there's no MD portal to open. Edit the task and link its fundraiser first.
                  </div>
                ) : loading ? (
                  <div className="w-5 h-5 border-2 border-smash border-t-transparent rounded-full animate-spin" />
                ) : loadError ? (
                  <p className="text-xs text-red-500">{loadError}</p>
                ) : mdPortalUrl ? (
                  <a
                    href={mdPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm hover:shadow-md bg-[#ff5000] hover:bg-[#e04800]"
                  >
                    <ExternalLink size={13} />
                    Open MoneyDolly portal
                  </a>
                ) : (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    The MD Portal URL is missing for this fundraiser. Add it in Airtable (the fundraiser's &quot;MD Portal URL&quot; field) before the report can be pulled — the rest of the steps still work.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2 — Fill out the sheet */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-1">Fill out the sheet</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Open the blank template. Google will ask you to make your own copy — that keeps the master template clean. Fill it out from the pick ticket report, then print it to PDF with File → Download → PDF.
                </p>
                <a
                  href={CDS_TEMPLATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm hover:shadow-md bg-[#ff5000] hover:bg-[#e04800]"
                >
                  <ExternalLink size={13} />
                  Open blank template
                </a>
              </div>
            </div>
          </div>

          {/* Step 3 — Upload it here */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={3} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-1">Upload it here</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Attach the finished sheet to this fundraiser so we have a record of what was ordered.
                </p>

                {!fundraiserId ? (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    This task has no linked fundraiser, so there's nowhere to attach the sheet. Edit the task and link its fundraiser first.
                  </div>
                ) : loading ? (
                  <div className="w-5 h-5 border-2 border-smash border-t-transparent rounded-full animate-spin" />
                ) : loadError ? (
                  <p className="text-xs text-red-500">{loadError}</p>
                ) : (
                  <>
                    {sheet && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2 min-w-0">
                        <FileText size={14} className="text-slate-400 shrink-0" />
                        <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="text-[#ff5000] hover:underline break-all">
                          {sheet.filename}
                        </a>
                        {uploaded && <span className="text-xs text-green-600 font-medium ml-auto shrink-0">Uploaded!</span>}
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                        sheet
                          ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          : 'text-white font-bold shadow-sm hover:shadow-md bg-[#ff5000] hover:bg-[#e04800]'
                      }`}
                    >
                      <Upload size={13} />
                      {uploading ? 'Uploading...' : sheet ? 'Replace file' : 'Upload PDF'}
                    </button>
                    {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <BlurSaveNumberField
                      label="Extra boxes ordered"
                      helper="From the Cookie Dough Sheet. These are billed back to the rep at $7 a box, so this number needs to be right."
                      initialValue={detail?.extra_cd_boxes_ordered}
                      onSave={saveField('extra_cd_boxes_ordered')}
                      validate={validateBoxes}
                      step="1"
                      placeholder="0"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step 4 — Place the order */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={4} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-2">Place the order</p>
                <ol className="text-xs text-slate-600 leading-relaxed space-y-1.5 list-decimal list-inside mb-2">
                  <li>Open Fundraising Manager: frmgr.com</li>
                  <li>Manage Orders &gt; Create Order &gt; Create</li>
                  <li>
                    Presale Name:{' '}
                    {presaleName ? (
                      <span className="inline-flex items-center gap-1.5 align-middle">
                        <code className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                          {presaleName}
                        </code>
                        <button
                          onClick={handleCopyPresale}
                          title="Copy presale name"
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
                            copied
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {copied ? <Check size={11} /> : <Copy size={11} />}
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </span>
                    ) : (
                      <span className="italic text-slate-400">organization + team + season</span>
                    )}
                  </li>
                  <li>Click &quot;Create&quot;</li>
                  <li>Enter the case amounts from the CDS bolded &quot;Total Cases to Order&quot; line</li>
                  <li>Submit</li>
                </ol>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Once the order is actually placed, come back and click Mark as Done below.
                </p>
                <a
                  href={FRMGR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm hover:shadow-md bg-[#ff5000] hover:bg-[#e04800]"
                >
                  <ExternalLink size={13} />
                  Open frmgr.com
                </a>
                {fundraiserId && detail && (
                  <BlurSaveNumberField
                    label="Cookie dough cost"
                    helper="After you submit the order, click 'View Order' on the same page, scroll down to Order entry, and copy the number listed as Retail Cost ($)."
                    initialValue={detail.cost_product}
                    onSave={saveField('cost_product')}
                    validate={validateCost}
                    step="0.01"
                    prefix="$"
                    placeholder="0.00"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mark as Done — the ONLY way this task completes. Uploading never does. */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {task.status === 'Done'
                ? 'This order task is complete.'
                : 'Only mark this Done once the order is actually placed at frmgr.com'}
            </p>
            <MarkDoneButton task={task} onRefresh={onRefresh} onDone={onDone || onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
