import { useState, useEffect } from 'react';
import { ExternalLink, Pencil, Calendar } from 'lucide-react';
import { api } from '../api/client';

function deadlineColor(deadline) {
  if (!deadline) return 'text-slate-400';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'text-red-600 bg-red-50 px-2 py-0.5 rounded';
  if (diff === 1) return 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded';
  return 'text-slate-500';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_OPTIONS = ['To do', 'Doing', 'Done'];

export default function TaskCard({ task, onRefresh, readOnly = false, deadlineOnly = false, muted = false }) {
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);

  const handleStatusChange = async (newStatus) => {
    if (updating) return;
    setUpdating(true);
    try {
      await api.tasks.update(task.id, { status: newStatus });
      onRefresh();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className={`bg-white rounded-lg border border-slate-200 p-4 ${muted ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm">{task.name}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {task.fundraiser && (
                <span className="inline-flex items-center text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full cursor-pointer hover:bg-indigo-100">
                  {task.fundraiser.organization} {task.fundraiser.team}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${deadlineColor(task.deadline)}`}>
                <Calendar size={12} />
                {formatDate(task.deadline)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status toggle or read-only chip */}
            {readOnly ? (
              <StatusChip status={task.status} />
            ) : task.status !== 'Done' ? (
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <StatusChip status="Done" />
            )}

            {task.action_url && (
              <a
                href={task.action_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                title="Open action"
              >
                <ExternalLink size={14} />
              </a>
            )}

            {deadlineOnly ? (
              <button
                onClick={() => setEditingDeadline(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Edit deadline"
              >
                <Pencil size={14} />
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Edit task"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditTaskModal task={task} onClose={() => setEditing(false)} onRefresh={onRefresh} />
      )}
      {editingDeadline && (
        <EditDeadlineModal task={task} onClose={() => setEditingDeadline(false)} onRefresh={onRefresh} />
      )}
    </>
  );
}

function StatusChip({ status }) {
  const colors = {
    'On deck': 'bg-slate-100 text-slate-600',
    'To do': 'bg-blue-50 text-blue-700',
    'Doing': 'bg-amber-50 text-amber-700',
    'Done': 'bg-green-50 text-green-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function EditDeadlineModal({ task, onClose, onRefresh }) {
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tasks.update(task.id, { deadline });
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to update deadline:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 mb-4">Edit Deadline</h3>
        <p className="text-sm text-slate-600 mb-3">{task.name}</p>
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({ task, onClose, onRefresh }) {
  const [form, setForm] = useState({
    name: task.name,
    description: task.description || '',
    deadline: task.deadline || '',
    action_url: task.action_url || '',
    status: task.status,
    fundraiserIds: task.fundraiserIds || [],
  });
  const [fundraisers, setFundraisers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.fundraisers.list().then(setFundraisers).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tasks.update(task.id, form);
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 mb-4">Edit Task</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Task Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['On deck', 'To do', 'Doing', 'Done'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
