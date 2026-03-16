import { useState, useEffect } from 'react';
import { DollarSign, Send, X, AlertTriangle, Paperclip } from 'lucide-react';
import { api } from '../api/client';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function ECheckPreviewModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    api.echeck.preview(task.id)
      .then(data => setPreview(data))
      .catch(err => setError(err.message || 'Failed to load e-check preview'))
      .finally(() => setLoading(false));
  }, [task.id]);

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    try {
      await api.echeck.send({
        taskId: preview.taskId,
        fundraiserId: preview.fundraiserId,
        type: preview.type,
        recipientName: preview.recipientName,
        recipientEmail: preview.recipientEmail,
        amount: preview.amount,
        description: preview.description,
        pdfUrl: preview.pdfUrl,
        pdfFilename: preview.pdfFilename,
      });
      setSent(true);
      setTimeout(() => {
        onClose();
        if (onRefresh) onRefresh();
      }, 1500);
    } catch (err) {
      setSendError(err.message || 'Failed to send e-check');
      setSending(false);
    }
  };

  const title = preview?.type === 'team_profit'
    ? 'Send team profit e-check'
    : 'Send rep commission e-check';

  const canSend = preview && preview.recipientEmail && preview.amount > 0 && !sending && !sent;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <DollarSign size={18} />
            {loading ? 'E-Check Preview' : title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-smash border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
        )}

        {!loading && !error && preview && (
          <div className="space-y-4">
            {/* Recipient */}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Recipient</p>
              <p className="text-sm font-medium text-slate-800">{preview.recipientName || '—'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{preview.recipientEmail || '—'}</p>
              {!preview.recipientEmail && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  <AlertTriangle size={13} />
                  No email found — cannot send
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Amount</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(preview.amount || 0)}</p>
              {(!preview.amount || preview.amount <= 0) && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  <AlertTriangle size={13} />
                  Amount is $0.00 — please verify in Airtable before sending
                </div>
              )}
            </div>

            {/* Memo */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Check memo</p>
              <p className="text-sm text-slate-700">{preview.description}</p>
            </div>

            {/* Attachment */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Attachment</p>
              {preview.hasPdf ? (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Paperclip size={14} className="text-slate-400" />
                  <a href={preview.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{preview.pdfFilename}</a>
                  <span className="text-xs text-green-600 font-medium ml-auto">✓ Will be attached</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="text-amber-700">No report uploaded in Airtable — check will send without attachment</span>
                </div>
              )}
            </div>

            {/* Summary */}
            {preview.recipientEmail && preview.amount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                Sending {formatCurrency(preview.amount)} to {preview.recipientName} ({preview.recipientEmail})
              </div>
            )}

            {/* Send error */}
            {sendError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{sendError}</div>
            )}

            {/* Sent success */}
            {sent && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3 font-medium">
                E-check sent!
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
                style={{ backgroundColor: '#ff5000' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e04800'; }}
                onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff5000'; }}
              >
                <Send size={14} />
                {sending ? 'Sending...' : 'Send E-Check'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
