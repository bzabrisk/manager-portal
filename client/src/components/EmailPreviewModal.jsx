import { useState, useEffect, useRef } from 'react';
import { Mail, Send, X, AlertTriangle, Paperclip, ArrowRight } from 'lucide-react';
import { api } from '../api/client';

function RecipientChip({ contact, status, onToggle, onRemove }) {
  const isCc = status === 'cc';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
        isCc
          ? 'bg-slate-100 text-slate-700'
          : 'bg-orange-50 text-orange-800 border border-orange-200'
      }`}
    >
      <span className="font-medium">{contact.name}</span>
      <span className="text-xs opacity-60">• {contact.email}</span>
      <button
        type="button"
        onClick={onToggle}
        className="ml-1 text-xs opacity-50 hover:opacity-100 whitespace-nowrap"
      >
        <ArrowRight size={10} className="inline -mt-px mr-0.5" />
        {isCc ? 'To' : 'CC'}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 opacity-40 hover:opacity-100"
      >
        <X size={12} />
      </button>
    </span>
  );
}

export default function EmailPreviewModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [recipientStatus, setRecipientStatus] = useState({});
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
        setContacts(data.contacts || []);
        const status = {};
        (data.defaultTo || []).forEach(id => { status[id] = 'to'; });
        (data.defaultCc || []).forEach(id => { status[id] = 'cc'; });
        (data.defaultSkip || []).forEach(id => { status[id] = 'skip'; });
        setRecipientStatus(status);
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

  const setStatus = (id, status) => {
    setRecipientStatus(prev => ({ ...prev, [id]: status }));
  };

  const toContacts = contacts.filter(c => recipientStatus[c.id] === 'to');
  const ccContacts = contacts.filter(c => recipientStatus[c.id] === 'cc');
  const skippedContacts = contacts.filter(c => recipientStatus[c.id] === 'skip');
  const hasToRecipients = toContacts.length > 0;

  const handleSend = async () => {
    setSending(true);
    setSendError('');
    try {
      const currentBody = bodyRef.current ? bodyRef.current.innerHTML : body;
      const to = toContacts.map(c => c.email);
      const cc = ccContacts.map(c => c.email);
      await api.email.send({ to, cc, subject, body: currentBody, taskId: task.id, agreementUrl, agreementFilename });
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
            {/* To group */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">To</label>
              {toContacts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {toContacts.map(c => (
                    <RecipientChip
                      key={c.id}
                      contact={c}
                      status="to"
                      onToggle={() => setStatus(c.id, 'cc')}
                      onRemove={() => setStatus(c.id, 'skip')}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No recipients selected — email cannot be sent.</p>
              )}
            </div>

            {/* CC group */}
            {ccContacts.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">CC</label>
                <div className="flex flex-wrap gap-2">
                  {ccContacts.map(c => (
                    <RecipientChip
                      key={c.id}
                      contact={c}
                      status="cc"
                      onToggle={() => setStatus(c.id, 'to')}
                      onRemove={() => setStatus(c.id, 'skip')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Excluded group */}
            {skippedContacts.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Excluded</label>
                <div className="space-y-1.5">
                  {skippedContacts.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-sm text-slate-500">
                      {c.hasEmail ? (
                        <>
                          <span>{c.name} • {c.email}</span>
                          <button
                            type="button"
                            onClick={() => setStatus(c.id, 'to')}
                            className="text-xs text-[#ff5000] hover:underline"
                          >
                            Add back to To
                          </button>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                          <span>{c.name}</span>
                          <span className="text-xs text-slate-400">— no email on file</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                disabled={!hasToRecipients || sending || sent}
                title={!hasToRecipients ? 'Add at least one recipient to To' : undefined}
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
