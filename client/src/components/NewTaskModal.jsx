import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function NewTaskModal({ onClose, onRefresh }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    deadline: '',
    action_url: '',
    fundraiserIds: [],
  });
  const [fundraisers, setFundraisers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.fundraisers.list().then(setFundraisers).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.deadline) {
      setError('Task name and deadline are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.tasks.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        deadline: form.deadline,
        action_url: form.action_url.trim() || undefined,
        fundraiserIds: form.fundraiserIds.length > 0 ? form.fundraiserIds : undefined,
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 text-lg mb-4">New Task</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Task Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deadline *</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fundraiser</label>
            <select
              value={form.fundraiserIds[0] || ''}
              onChange={e => setForm(f => ({ ...f, fundraiserIds: e.target.value ? [e.target.value] : [] }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {fundraisers.map(f => (
                <option key={f.id} value={f.id}>{f.organization} {f.team}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action URL</label>
            <input
              type="url"
              value={form.action_url}
              onChange={e => setForm(f => ({ ...f, action_url: e.target.value }))}
              placeholder="https://..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
