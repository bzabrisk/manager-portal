import { useState, useEffect } from 'react';
import { DollarSign, ExternalLink, X } from 'lucide-react';
import { api } from '../api/client';

export default function ProductCostModal({ task, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    api.cost.preview(task.id)
      .then(result => {
        setData(result);
        if (result.currentCost != null) {
          setCost(String(result.currentCost));
        }
      })
      .catch(err => setError(err.message || 'Failed to load cost preview'))
      .finally(() => setLoading(false));
  }, [task.id]);

  const numVal = cost === '' ? NaN : Number(cost);
  const isValid = cost !== '' && !isNaN(numVal) && numVal >= 0;

  const handleBlur = () => {
    if (isValid) {
      setCost(numVal.toFixed(2));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.cost.save({ taskId: task.id, costProduct: numVal });
      setSaved(true);
      setTimeout(() => {
        onClose();
        if (onRefresh) onRefresh();
      }, 1500);
    } catch (err) {
      setSaveError(err.message || 'Failed to save product cost');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <DollarSign size={18} />
            Enter Product Cost
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
            {/* Context */}
            <div>
              <p className="text-sm font-medium text-slate-800">{data.organization} &mdash; {data.team}</p>
              <p className="text-sm text-slate-400">{data.productPrimary}</p>
            </div>

            <hr className="border-slate-100" />

            {/* Instructions + portal link */}
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Look up the total product cost on the invoice for this fundraiser.
              </p>
              <a
                href="https://frmgr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ExternalLink size={14} />
                Open frmgr.com
              </a>
            </div>

            {/* Cost input */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Product Cost</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  onBlur={handleBlur}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5000]"
                  placeholder="0.00"
                />
              </div>
              {cost !== '' && !isValid && (
                <p className="text-xs text-red-500 mt-1">Enter a valid non-negative number</p>
              )}
            </div>

            {/* Save error */}
            {saveError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{saveError}</div>
            )}

            {/* Success */}
            {saved && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3 font-medium">
                Cost saved!
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
                onClick={handleSave}
                disabled={!isValid || saving || saved}
                className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
                style={{ backgroundColor: '#ff5000' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e04800'; }}
                onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff5000'; }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
