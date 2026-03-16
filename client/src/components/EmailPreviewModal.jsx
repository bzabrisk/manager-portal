import { useState, useEffect } from 'react';
import { Mail, Send, X, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';

function htmlToPlainText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function plainTextToHtml(text) {
  if (!text) return '';
  return text
    .split(/\n\n+/)
    .map(para => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

export default function EmailPreviewModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    api.email.preview(task.id)
      .then(data => {
        setTo(data.to || '');
        setSubject(data.subject || '');
        setBody(htmlToPlainText(data.body));
      })
      .catch(err => setError(err.message || 'Failed to load email preview'))
      .finally(() => setLoading(false));
  }, [task.id]);

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    try {
      const htmlBody = plainTextToHtml(body);
      await api.email.send({ to, subject, body: htmlBody, taskId: task.id });
      setSent(true);
      setTimeout(() => {
        onClose();
        if (onRefresh) onRefresh();
      }, 1500);
    } catch (err) {
      setSendError(err.message || 'Failed to send email');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Mail size={18} />
            Email Preview
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

        {!loading && !error && (
          <div className="space-y-4">
            {/* To field */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
              />
              {!to && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  <AlertTriangle size={13} />
                  No accounting contact email found — please add one in Airtable before sending.
                </div>
              )}
            </div>

            {/* Subject field */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
              />
            </div>

            {/* Body field */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={14}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
                style={{ minHeight: '300px' }}
              />
            </div>

            {/* Send error */}
            {sendError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{sendError}</div>
            )}

            {/* Sent success */}
            {sent && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3 font-medium">
                Email sent!
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
                disabled={!to || sending || sent}
                className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
                style={{ backgroundColor: '#ff5000' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e04800'; }}
                onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff5000'; }}
              >
                <Send size={14} />
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
