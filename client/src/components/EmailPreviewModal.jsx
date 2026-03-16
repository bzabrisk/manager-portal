import { useState, useEffect, useRef } from 'react';
import { Mail, Send, X, AlertTriangle, Paperclip } from 'lucide-react';
import { api } from '../api/client';

export default function EmailPreviewModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [agreementUrl, setAgreementUrl] = useState(null);
  const [agreementFilename, setAgreementFilename] = useState(null);
  const [hasAgreement, setHasAgreement] = useState(false);
  const [signature, setSignature] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    api.email.preview(task.id)
      .then(data => {
        setTo(data.to || '');
        setSubject(data.subject || '');
        setBody(data.body || '');
        setAgreementUrl(data.agreementUrl || null);
        setAgreementFilename(data.agreementFilename || null);
        setHasAgreement(!!data.hasAgreement);
        setSignature(data.signature || '');
      })
      .catch(err => setError(err.message || 'Failed to load email preview'))
      .finally(() => setLoading(false));
  }, [task.id]);

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    try {
      const currentBody = bodyRef.current ? bodyRef.current.innerHTML : body;
      await api.email.send({ to, subject, body: currentBody, taskId: task.id, agreementUrl, agreementFilename });
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
              <style>{`.email-body-editor p { margin-bottom: 12px; } .email-body-editor strong { font-weight: 700; } .email-body-editor em { font-style: italic; }`}</style>
              <div
                ref={bodyRef}
                contentEditable
                suppressContentEditableWarning={true}
                className="email-body-editor w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000] min-h-[300px] overflow-y-auto"
                style={{ lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: body }}
                onBlur={(e) => setBody(e.currentTarget.innerHTML)}
              />
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Signature</p>
                <div className="text-sm text-slate-500 pointer-events-none px-4" dangerouslySetInnerHTML={{ __html: signature }} />
              </div>
            </div>

            {/* Attachment section — always visible */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Attachment</label>
              {hasAgreement ? (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Paperclip size={14} className="text-slate-400" />
                  <span>{agreementFilename || 'Fundraiser-Agreement.pdf'}</span>
                  <span className="text-xs text-green-600 font-medium ml-auto">✓ Will be attached</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="text-amber-700">Fundraiser Agreement not uploaded in Airtable — email will send without attachment</span>
                </div>
              )}
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
