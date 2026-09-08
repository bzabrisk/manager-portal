import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Upload, FileText, AlertTriangle, ShoppingCart } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!fundraiserId) return;
    api.fundraisers.getDetail(fundraiserId)
      .then(detail => setSheet(detail.cookie_dough_sheet?.[0] || null))
      .catch(err => setLoadError(err.message || 'Failed to load fundraiser'))
      .finally(() => setLoading(false));
  }, [fundraiserId]);

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
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Open the blank template. Google will ask you to make your own copy — that keeps the master template clean. Fill it out, then print it to PDF with File → Download → PDF.
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
                <p className="text-sm font-semibold text-slate-800 mb-1">Place the order</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Order at frmgr.com. Once the order is actually placed, come back and mark this task Done.
                </p>
                <a
                  href={FRMGR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm hover:shadow-md bg-[#ff5000] hover:bg-[#e04800]"
                >
                  <ExternalLink size={13} />
                  Order at frmgr.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
