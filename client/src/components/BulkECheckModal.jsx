import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Send, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../api/client';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

function formatEndDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getQuarterLabel(date = new Date()) {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

export default function BulkECheckModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);

  // Extract repKey from action_url: echeck:bulk_rep_commission:dravin → "dravin"
  const repKey = useMemo(() => {
    const url = task.action_url || '';
    const parts = url.split(':');
    return parts[2] || '';
  }, [task.action_url]);

  const memo = useMemo(() => `SMASH Fundraising — ${getQuarterLabel()} Rep Commissions`, []);

  useEffect(() => {
    if (!repKey) {
      setError('No rep key found in task action URL');
      setLoading(false);
      return;
    }
    api.echeck.bulkPreview(repKey)
      .then(d => {
        setData(d);
        // All checked by default
        setSelectedIds(new Set(d.fundraisers.map(f => f.id)));
      })
      .catch(err => setError(err.message || 'Failed to load bulk preview'))
      .finally(() => setLoading(false));
  }, [repKey]);

  const fundraisers = data?.fundraisers || [];
  const rep = data?.rep;

  const totalAmount = useMemo(() => {
    return fundraisers
      .filter(f => selectedIds.has(f.id))
      .reduce((sum, f) => sum + (f.commission || 0), 0);
  }, [fundraisers, selectedIds]);

  const allSelected = fundraisers.length > 0 && selectedIds.size === fundraisers.length;

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(fundraisers.map(f => f.id)));
    }
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
      const fundraiserIds = Array.from(selectedIds);
      await api.echeck.bulkSend({
        repKey,
        fundraiserIds,
        totalAmount,
        description: memo,
      });
      setSent(true);
      await markTaskDone();
      setTimeout(() => {
        onClose();
        if (onRefresh) onRefresh();
      }, 2000);
    } catch (err) {
      setSendError(err.message || 'Failed to send bulk e-check');
      setSending(false);
    }
  };

  const canSend = !loading && !error && selectedIds.size > 0 && totalAmount > 0 && !sending && !sent;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <DollarSign size={18} />
            {loading ? 'Bulk Rep Commission' : `Bulk Rep Commission — ${rep?.name || ''}`}
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

        {!loading && !error && data && (
          <div className="space-y-4">
            {/* Rep info */}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Recipient</p>
              <p className="text-sm font-medium text-slate-800">{rep.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{rep.email}</p>
            </div>

            {fundraisers.length === 0 ? (
              <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">No unpaid fundraisers</p>
                  <p className="text-amber-700 mt-1">There are no fundraisers in the {rep.name} view that need a rep commission payout right now.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Select all toggle */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={toggleAll}
                    className="text-xs font-medium text-[#ff5000] hover:text-[#e04800]"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-slate-500">{fundraisers.length} fundraiser{fundraisers.length === 1 ? '' : 's'} found</span>
                </div>

                {/* Fundraiser table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left w-8"></th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Fundraiser</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">End Date</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Commission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fundraisers.map(f => {
                          const checked = selectedIds.has(f.id);
                          return (
                            <tr
                              key={f.id}
                              className={`${checked ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-50 cursor-pointer`}
                              onClick={() => toggleOne(f.id)}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOne(f.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="h-4 w-4 text-[#ff5000] rounded border-slate-300 focus:ring-[#ff5000]"
                                />
                              </td>
                              <td className="px-3 py-2 text-slate-800">
                                {f.organization}{f.team ? ` — ${f.team}` : ''}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{formatEndDate(f.endDate)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-800">
                                {formatCurrency(f.commission)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">Selected</p>
                    <p className="text-sm text-slate-700">{selectedIds.size} of {fundraisers.length} fundraisers</p>
                  </div>
                </div>

                {/* Memo */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Check memo</p>
                  <p className="text-sm text-slate-500">{memo}</p>
                </div>
              </>
            )}

            {/* Send error */}
            {sendError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{sendError}</div>
            )}

            {/* Sent success */}
            {sent && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-800">
                  E-check for {formatCurrency(totalAmount)} sent to {rep.name}!
                </p>
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
                {sending ? 'Sending...' : `Send E-Check — ${formatCurrency(totalAmount)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
