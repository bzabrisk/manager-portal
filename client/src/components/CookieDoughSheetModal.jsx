import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Upload, FileText, AlertTriangle, ShoppingCart, Copy, Check } from 'lucide-react';
import { api } from '../api/client';
import { CDS_TEMPLATE_URL, FRMGR_URL } from '../utils/cookieDough';

function StepNumber({ n }) {
  return (
    <span className="w-6 h-6 rounded bg-[#ff5000] text-white text-xs font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

// Panel for the cookiedough:sheet task action. Deliberately never marks the task
// Done — the task is "order the cookie dough" and the terminal action happens on
// frmgr.com, outside the portal's view. Krista marks it Done herself.
export default function CookieDoughSheetModal({ task, onClose, onRefresh }) {
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
          {/* Step 1 — Fill out the sheet */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={1} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-1">Fill out the sheet</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-1">
                  Open the blank template. Google will ask you to make your own copy — that keeps the master template clean. Fill it out, then print it to PDF with File → Download → PDF.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  The pick ticket report is found at: Fundraiser &gt; View Reports &gt; Pick Ticket Report.
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

          {/* Step 2 — Upload it here */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={2} />
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
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step 3 — Place the order */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <StepNumber n={3} />
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
                  Once the order is actually placed, come back and mark this task Done.
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
