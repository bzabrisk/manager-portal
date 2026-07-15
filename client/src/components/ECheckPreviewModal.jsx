import { useState, useEffect, useRef } from 'react';
import { DollarSign, Send, X, AlertTriangle, Paperclip, Mail, CheckCircle, SkipForward, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const KRISTA_SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; padding-top: 15px;">
  <tr>
    <td style="padding-right: 15px; vertical-align: middle;">
      <img src="https://images.squarespace-cdn.com/content/v1/654db8b24e5e08109904da97/6df12bb7-98af-47dc-93f7-34e6a25eeaf2/blacklogo_1%403x.png" alt="SMASH" width="80" style="display: block;" />
    </td>
    <td style="padding-left: 15px; vertical-align: middle; font-family: Arial, sans-serif;">
      <strong style="font-size: 14px; color: #333;">Krista McGaughy</strong> <span style="font-size: 14px; color: #333;">• <em>Business Manager</em></span><br/>
      <a href="mailto:krista@smashfundraising.com" style="font-size: 13px; color: #1a73e8; text-decoration: none;">krista@smashfundraising.com</a><br/>
      <span style="font-size: 12px; color: #777;">A Washington School Fundraising Partner</span>
    </td>
  </tr>
</table>`;

function buildProfitReportHtml(preview) {
  const amount = formatCurrency(preview.amount || 0);
  const grossSales = formatCurrency(preview.grossSales || 0);
  const endDate = preview.endDate || '';
  const repName = preview.repName || '';

  return `<p>Hi ${preview.organization},</p>

<p>Great news, your ${preview.team} fundraiser is officially wrapped up!</p>

<p>Here's a summary of your fundraiser:</p>

<table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Team</td>
    <td style="padding: 6px 0; font-weight: 600;">${preview.organization} ${preview.team}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Fundraiser Ended</td>
    <td style="padding: 6px 0; font-weight: 600;">${endDate}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Total Sales</td>
    <td style="padding: 6px 0; font-weight: 600;">${grossSales}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Your Team Profit</td>
    <td style="padding: 6px 0; font-weight: 600; color: #16a34a;">${amount}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Your Rep</td>
    <td style="padding: 6px 0; font-weight: 600;">${repName}</td>
  </tr>
</table>

<p>You'll receive a separate email from Checkbook with deposit instructions for your e-check. Your detailed profit report is attached to this email for your records.</p>

<p>If a mailed paper check is preferred, please let us know before printing the check or selecting the ACH transfer option. Once the payment has been initiated, it cannot be modified or reversed.</p>

<p>Thank you for fundraising with SMASH — it was a pleasure working with your team!</p>`;
}

function buildPaperCheckReportHtml(preview, address) {
  const amount = formatCurrency(preview.amount || 0);
  const grossSales = formatCurrency(preview.grossSales || 0);
  const endDate = preview.endDate || '';
  const repName = preview.repName || '';
  const addressLines = [
    preview.organization,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.zip}`,
  ].filter(Boolean).join('\n');

  return `<p>Hi ${preview.organization},</p>

<p>Great news, your ${preview.team} fundraiser is officially wrapped up!</p>

<p>Here's a summary of your fundraiser:</p>

<table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Team</td>
    <td style="padding: 6px 0; font-weight: 600;">${preview.organization} ${preview.team}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Fundraiser Ended</td>
    <td style="padding: 6px 0; font-weight: 600;">${endDate}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Total Sales</td>
    <td style="padding: 6px 0; font-weight: 600;">${grossSales}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Your Team Profit</td>
    <td style="padding: 6px 0; font-weight: 600; color: #16a34a;">${amount}</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #64748b;">Your Rep</td>
    <td style="padding: 6px 0; font-weight: 600;">${repName}</td>
  </tr>
</table>

<p>Your team profit is on its way as a <strong>paper check mailed via USPS</strong>. Please allow about 1&ndash;5 business days for it to arrive. We mailed it to:</p>

<p style="white-space: pre-line;">${addressLines}</p>

<p>Your detailed profit report is attached to this email for your records.</p>

<p>Thank you for fundraising with SMASH — it was a pleasure working with your team!</p>`;
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 ml-3">
      <div className={`w-2 h-2 rounded-full ${current === 1 ? 'bg-[#ff5000]' : 'bg-slate-300'}`} />
      <div className={`w-2 h-2 rounded-full ${current === 2 ? 'bg-[#ff5000]' : 'bg-slate-300'}`} />
    </div>
  );
}

export default function ECheckPreviewModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [step, setStep] = useState(1);
  const [checkWasSent, setCheckWasSent] = useState(false);
  const [zeroSending, setZeroSending] = useState(false);
  const [zeroSent, setZeroSent] = useState(false);
  const [zeroError, setZeroError] = useState('');
  // Paper check state (team_profit only)
  const [paperCheck, setPaperCheck] = useState(false);
  const [paperMode, setPaperMode] = useState(false);
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', zip: '' });
  // Step 2 state (team_profit only)
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSendError, setEmailSendError] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    api.echeck.preview(task.id)
      .then(data => {
        setPreview(data);
        if (data?.type === 'team_profit') {
          setPaperCheck(!!data.prefersPaperCheck);
          setAddress({
            line1: data.checkAddress?.line1 || '',
            line2: data.checkAddress?.line2 || '',
            city: data.checkAddress?.city || '',
            state: data.checkAddress?.state || '',
            zip: data.checkAddress?.zip || '',
          });
        }
      })
      .catch(err => setError(err.message || 'Failed to load e-check preview'))
      .finally(() => setLoading(false));
  }, [task.id]);

  const isTeamProfit = preview?.type === 'team_profit';

  const prepareStep2 = (p, isPaper = false) => {
    setEmailSubject(`Your Team Profit Report — ${p.organization} ${p.team}`);
    setEmailBody(isPaper ? buildPaperCheckReportHtml(p, address) : buildProfitReportHtml(p));
    setStep(2);
  };

  const markTaskDone = async () => {
    try {
      await api.tasks.update(task.id, { status: 'Done' });
    } catch (err) {
      console.error('Failed to mark task done:', err);
    }
  };

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
        organization: preview.organization,
        team: preview.team,
      });
      setSent(true);
      setCheckWasSent(true);
      if (isTeamProfit) {
        // Transition to step 2 after brief success message
        setTimeout(() => prepareStep2(preview), 800);
      } else {
        // rep_commission: close after brief success message
        setTimeout(() => {
          onClose();
          if (onRefresh) onRefresh();
        }, 1500);
      }
    } catch (err) {
      setSendError(err.message || 'Failed to send e-check');
      setSending(false);
    }
  };

  const handleSendPhysical = async () => {
    setSending(true);
    setSendError('');
    try {
      await api.echeck.sendPhysical({
        taskId: preview.taskId,
        fundraiserId: preview.fundraiserId,
        type: preview.type,
        payeeName: preview.organization,
        recipientAddress: address,
        amount: preview.amount,
        description: preview.description,
        pdfUrl: preview.pdfUrl,
        pdfFilename: preview.pdfFilename,
        organization: preview.organization,
        team: preview.team,
        accountingContactId: preview.accountingContactId,
        saveAddress: true,
        prefersPaperCheck: true,
      });
      setSent(true);
      setCheckWasSent(true);
      setPaperMode(true);
      setTimeout(() => prepareStep2(preview, true), 800);
    } catch (err) {
      setSendError(err.message || 'Failed to mail paper check');
      setSending(false);
    }
  };

  const handleSkipToEmail = () => {
    const isPaper = paperCheck && addressComplete;
    setPaperMode(isPaper);
    prepareStep2(preview, isPaper);
  };

  const handleZeroCommission = async () => {
    setZeroSending(true);
    setZeroError('');
    try {
      await api.echeck.zeroCommission({ taskId: preview.taskId });
      setZeroSent(true);
      setTimeout(() => {
        onClose();
        if (onRefresh) onRefresh();
      }, 1500);
    } catch (err) {
      setZeroError(err.message || 'Failed to zero out commission');
      setZeroSending(false);
    }
  };

  const finishAndClose = async () => {
    // Mark the team_profit task as Done now that step 2 is complete
    await markTaskDone();
    onClose();
    if (onRefresh) onRefresh();
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    setEmailSendError('');
    try {
      const currentBody = bodyRef.current ? bodyRef.current.innerHTML : emailBody;
      await api.echeck.sendReportEmail({
        recipientEmail: preview.recipientEmail,
        recipientName: preview.recipientName,
        subject: emailSubject,
        htmlBody: currentBody,
        pdfUrl: preview.pdfUrl,
        pdfFilename: preview.pdfFilename,
      });
      setEmailSent(true);
      setTimeout(() => finishAndClose(), 1500);
    } catch (err) {
      setEmailSendError(err.message || 'Failed to send report email');
      setEmailSending(false);
    }
  };

  const handleSkip = () => {
    finishAndClose();
  };

  const title = step === 1
    ? (isTeamProfit
        ? 'Step 1 of 2: Send E-Check'
        : (preview?.type === 'rep_commission' ? 'Send rep commission e-check' : 'E-Check Preview'))
    : 'Step 2 of 2: Send Profit Report';

  const addressComplete = !!(address.line1.trim() && address.city.trim() && address.state.trim() && address.zip.trim());
  const paperActive = isTeamProfit && paperCheck;
  const canSend = preview && preview.amount > 0 && !sending && !sent
    && (paperActive ? addressComplete : !!preview.recipientEmail);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto max-lg:h-full max-lg:max-h-full max-lg:rounded-none max-lg:overflow-hidden max-lg:flex max-lg:flex-col max-lg:p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 max-lg:shrink-0">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            {step === 1 ? <DollarSign size={18} /> : <Mail size={18} />}
            {loading ? 'E-Check Preview' : title}
            {isTeamProfit && !loading && <StepIndicator current={step} />}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded max-lg:p-2.5"
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

        {/* STEP 1 */}
        {!loading && !error && preview && step === 1 && (
          <>
          <div className="space-y-4 max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto">
            {/* Recipient */}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Recipient</p>
              <p className="text-sm font-medium text-slate-800">{preview.recipientName || '\u2014'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{preview.recipientEmail || '\u2014'}</p>
              {!preview.recipientEmail && !paperActive && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  <AlertTriangle size={13} />
                  No email found — cannot send
                </div>
              )}
            </div>

            {/* Paper check option (team_profit only) */}
            {isTeamProfit && (
              <div className="bg-slate-50 rounded-lg p-3">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={paperCheck}
                    onChange={e => setPaperCheck(e.target.checked)}
                    disabled={sending || sent}
                    className="mt-0.5 accent-[#ff5000]"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Send as a mailed paper check instead of a digital e-check
                  </span>
                </label>
                {paperCheck && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 1</label>
                      <input
                        type="text"
                        value={address.line1}
                        onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))}
                        disabled={sending || sent}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 2 <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={address.line2}
                        onChange={e => setAddress(a => ({ ...a, line2: e.target.value }))}
                        disabled={sending || sent}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                      />
                    </div>
                    <div className="flex gap-2 max-lg:flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                        <input
                          type="text"
                          value={address.city}
                          onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                          disabled={sending || sent}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                        <input
                          type="text"
                          value={address.state}
                          onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}
                          disabled={sending || sent}
                          maxLength={2}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-xs font-medium text-slate-600 mb-1">ZIP</label>
                        <input
                          type="text"
                          value={address.zip}
                          onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))}
                          disabled={sending || sent}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 pt-1">
                      Checkbook mails this via USPS (arrives ~1–5 business days). Submit before 1:00 PM PT to mail today. Physical checks cost more than e-checks.
                    </p>
                    {!addressComplete && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                        <AlertTriangle size={13} />
                        Line 1, City, State, and ZIP are required to mail a paper check
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Amount</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(preview.amount || 0)}</p>
              {preview.type === 'rep_commission' && preview.amount <= 0 ? (
                <p className="text-sm text-slate-600 mt-1">No commission payout this time.</p>
              ) : (!preview.amount || preview.amount <= 0) && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  <AlertTriangle size={13} />
                  Amount is $0.00 — please verify in Airtable before sending
                </div>
              )}
            </div>

            {/* Memo */}
            {!(preview.type === 'rep_commission' && preview.amount <= 0) && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Check memo</p>
              <p className="text-sm text-slate-700">{preview.description}</p>
            </div>
            )}

            {/* Zero commission info */}
            {preview.type === 'rep_commission' && preview.amount <= 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={16} className="text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">Zero out &amp; send report</p>
                </div>
                <p className="text-sm text-blue-700">
                  This will adjust the misc line to bring the commission to $0, regenerate the commission report, email it to {preview.recipientName}, and mark the rep as paid.
                </p>
              </div>
            )}

            {/* Companion email notice — rep_commission only (auto-sends), positive amount */}
            {!isTeamProfit && preview.amount > 0 && (
              preview.hasPdf ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail size={16} className="text-blue-600" />
                    <p className="text-sm font-semibold text-blue-800">Companion email will also be sent</p>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    When you send this e-check, an email will automatically be sent to {preview.recipientName} at {preview.recipientEmail} with the commission report PDF attached.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-white/60 border border-blue-100 rounded px-3 py-2">
                    <Paperclip size={14} className="text-blue-400" />
                    <a href={preview.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{preview.pdfFilename}</a>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={16} className="text-yellow-600" />
                    <p className="text-sm font-semibold text-yellow-800">No commission report PDF attached</p>
                  </div>
                  <p className="text-sm text-yellow-700">
                    No commission report PDF is attached to this fundraiser. The e-check will still be sent, but no companion email will go out.
                  </p>
                </div>
              )
            )}

            {/* PDF preview for team_profit step 1 */}
            {isTeamProfit && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Profit report</p>
                {preview.hasPdf ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <Paperclip size={14} className="text-slate-400" />
                    <a href={preview.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{preview.pdfFilename}</a>
                    <span className="text-xs text-green-600 font-medium ml-auto">Will be emailed in step 2</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-amber-700">No profit report uploaded in Airtable</span>
                  </div>
                )}
              </div>
            )}

            {/* Send error */}
            {sendError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{sendError}</div>
            )}

            {/* Zero commission error */}
            {zeroError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{zeroError}</div>
            )}

            {/* Sent success */}
            {sent && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3 font-medium">
                {paperMode ? 'Paper check mailed!' : 'E-check sent!'}{isTeamProfit && ' Loading email preview...'}
              </div>
            )}

            {/* Zero commission success */}
            {zeroSent && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3 font-medium">
                Report sent to the rep, marked paid.
              </div>
            )}

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 mt-4 max-lg:mt-3 max-lg:shrink-0 max-lg:border-t max-lg:border-slate-100 max-lg:pt-3 max-lg:flex-wrap">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg max-lg:py-2.5"
              >
                Cancel
              </button>
              {isTeamProfit && !sending && !sent && (
                <button
                  onClick={handleSkipToEmail}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors max-lg:py-2.5"
                >
                  <SkipForward size={14} />
                  Skip E-Check
                </button>
              )}
              {preview.type === 'rep_commission' && preview.amount <= 0 ? (
                <button
                  onClick={handleZeroCommission}
                  disabled={zeroSending || zeroSent}
                  className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 max-lg:py-2.5"
                  style={{ backgroundColor: '#ff5000' }}
                  onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e04800'; }}
                  onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff5000'; }}
                >
                  <Send size={14} />
                  {zeroSending ? 'Processing...' : 'Zero out & send report to rep'}
                </button>
              ) : (
                <button
                  onClick={paperActive ? handleSendPhysical : handleSend}
                  disabled={!canSend}
                  className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 max-lg:py-2.5"
                  style={{ backgroundColor: '#ff5000' }}
                  onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e04800'; }}
                  onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff5000'; }}
                >
                  <Send size={14} />
                  {sending
                    ? (paperActive ? 'Mailing...' : 'Sending...')
                    : (paperActive ? 'Mail Paper Check' : 'Send E-Check')}
                </button>
              )}
          </div>
          </>
        )}

        {/* STEP 2 — team_profit email editor */}
        {!loading && !error && preview && step === 2 && (
          <>
          <div className="space-y-4 max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto">
            {/* Success banner — only if check was actually sent */}
            {checkWasSent && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-800">
                  {paperMode
                    ? `Paper check mailed to ${preview.recipientName}!`
                    : `E-check sent successfully to ${preview.recipientName}!`}
                </p>
              </div>
            )}

            {/* To field (read-only) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                {preview.recipientName} ({preview.recipientEmail})
              </div>
            </div>

            {/* Subject field (editable) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
              />
            </div>

            {/* Body field (editable, same approach as EmailPreviewModal) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
              <style>{`.echeck-email-editor p { margin-bottom: 12px; } .echeck-email-editor strong { font-weight: 700; } .echeck-email-editor em { font-style: italic; } .echeck-email-editor table { margin: 12px 0; }`}</style>
              <div
                ref={bodyRef}
                contentEditable
                suppressContentEditableWarning={true}
                className="echeck-email-editor w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000] min-h-[300px] overflow-y-auto"
                style={{ lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: emailBody }}
                onBlur={(e) => setEmailBody(e.currentTarget.innerHTML)}
              />
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Signature</p>
                <div className="text-sm text-slate-500 pointer-events-none px-4" dangerouslySetInnerHTML={{ __html: KRISTA_SIGNATURE_HTML }} />
              </div>
            </div>

            {/* Attachment section */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Attachment</label>
              {preview.hasPdf ? (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Paperclip size={14} className="text-slate-400" />
                  <a href={preview.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{preview.pdfFilename}</a>
                  <span className="text-xs text-green-600 font-medium ml-auto">Will be attached</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="text-amber-700">No profit report PDF — email will send without attachment</span>
                </div>
              )}
            </div>

            {/* Email send error */}
            {emailSendError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{emailSendError}</div>
            )}

            {/* Email sent success */}
            {emailSent && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3 font-medium">
                Report email sent!
              </div>
            )}

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 mt-4 max-lg:mt-3 max-lg:shrink-0 max-lg:border-t max-lg:border-slate-100 max-lg:pt-3 max-lg:flex-wrap">
              {!checkWasSent && (
                <button
                  onClick={() => setStep(1)}
                  disabled={emailSending || emailSent}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 max-lg:py-2.5"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
              <button
                onClick={handleSkip}
                disabled={emailSending || emailSent}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 max-lg:py-2.5"
              >
                <SkipForward size={14} />
                Skip
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailSubject || emailSending || emailSent}
                className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 max-lg:py-2.5"
                style={{ backgroundColor: '#ff5000' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e04800'; }}
                onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff5000'; }}
              >
                <Send size={14} />
                {emailSending ? 'Sending...' : 'Send Email'}
              </button>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
