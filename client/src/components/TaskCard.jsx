import { useState, useEffect } from 'react';
import { Pencil, Calendar, User } from 'lucide-react';
import { api } from '../api/client';
import TaskDetailModal from './TaskDetailModal';

const TAG_COLORS = [
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-lime-100 text-lime-700 border-lime-200',
];

const ASB_COLORS = {
  'WA State ASB': 'bg-blue-100 text-blue-700',
  'School - other than WA State ASB': 'bg-green-100 text-green-700',
  'Booster Club': 'bg-purple-100 text-purple-700',
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getFundraiserColor(name) {
  return TAG_COLORS[hashString(name) % TAG_COLORS.length];
}

function deadlineColor(deadline, status) {
  if (status === 'Done') return 'text-green-500';
  if (!deadline) return 'text-slate-400';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'text-[#ff5000] font-semibold';
  if (diff === 1) return 'text-orange-400';
  return 'text-gray-400';
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function TaskCard({ task, onRefresh, saving = false }) {
  const [editing, setEditing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const fundraiserLabel = task.fundraiser
    ? `${task.fundraiser.organization} — ${task.fundraiser.team}`
    : null;

  const hasActionButton = task.button_words && task.action_url;

  const handleCardClick = () => {
    setShowDetail(true);
  };

  return (
    <>
      <div
        className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm group relative transition-opacity cursor-pointer ${saving ? 'opacity-60' : ''}`}
        onClick={handleCardClick}
      >
        {/* Edit button - top right, visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit task"
        >
          <Pencil size={13} />
        </button>

        {/* Row 1: Task name */}
        <h4 className="font-semibold text-slate-800 text-sm leading-snug pr-6">{task.name}</h4>

        {/* Row 2: Fundraiser tag */}
        {fundraiserLabel && (
          <div className="mt-1.5">
            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${getFundraiserColor(fundraiserLabel)}`}>
              {fundraiserLabel}
            </span>
          </div>
        )}

        {/* Row 3: Description */}
        {task.description && (
          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{stripHtml(task.description)}</p>
        )}

        {/* Row 4: Info row */}
        <div className="flex items-center mt-2.5">
          {/* Left side: deadline */}
          {task.deadline && (
            <span className={`inline-flex items-center gap-1 text-xs ${deadlineColor(task.deadline, task.status)}`}>
              <Calendar size={11} />
              {formatDate(task.deadline)}
            </span>
          )}

          <div className="flex-1" />

          {/* Right side: ASB tag + rep photo (only if fundraiser linked) */}
          {task.fundraiser && (
            <div className="flex items-center gap-1.5">
              {task.fundraiser.asb_boosters && ASB_COLORS[task.fundraiser.asb_boosters] && (
                <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${ASB_COLORS[task.fundraiser.asb_boosters]}`}>
                  {task.fundraiser.asb_boosters === 'WA State ASB' ? 'ASB' :
                   task.fundraiser.asb_boosters === 'Booster Club' ? 'Boosters' : 'School'}
                </span>
              )}
              {task.fundraiser.rep_photo ? (
                <img
                  src={task.fundraiser.rep_photo}
                  alt="Rep"
                  className="w-6 h-6 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <User size={12} className="text-slate-400" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider + Action button */}
        {hasActionButton && (
          <div className="border-t border-gray-100 mt-2.5 pt-2 flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); window.open(task.action_url, '_blank', 'noopener,noreferrer'); }}
              className="inline-flex items-center text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-colors shadow-md hover:shadow-lg"
              style={{ backgroundColor: '#ff5000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e04800'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ff5000'}
            >
              {task.button_words}
            </button>
          </div>
        )}

        {/* Saving indicator */}
        {saving && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
            <div className="w-4 h-4 border-2 border-smash border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showDetail && (
        <TaskDetailModal
          task={task}
          onClose={() => setShowDetail(false)}
          onEdit={() => setEditing(true)}
        />
      )}

      {editing && (
        <EditTaskModal task={task} onClose={() => setEditing(false)} onRefresh={onRefresh} />
      )}
    </>
  );
}

export function StatusChip({ status }) {
  const colors = {
    'On deck': 'bg-slate-100 text-slate-600',
    'To do': 'bg-amber-50 text-amber-700',
    'Doing': 'bg-blue-50 text-blue-700',
    'Done': 'bg-green-50 text-green-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function EditTaskModal({ task, onClose, onRefresh }) {
  const [form, setForm] = useState({
    name: task.name,
    description: task.description || '',
    deadline: task.deadline || '',
    show_date: task.show_date || '',
    action_url: task.action_url || '',
    button_words: task.button_words || '',
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
      const payload = { ...form };
      if (payload.action_url && payload.action_url.trim()) {
        const url = payload.action_url.trim();
        payload.action_url = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
      }
      await api.tasks.update(task.id, payload);
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Show Date</label>
            <input
              type="date"
              value={form.show_date}
              onChange={e => setForm(f => ({ ...f, show_date: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
            />
            <p className="text-xs text-slate-400 mt-0.5">When this task becomes visible on the board. If empty, this task will show 1 month before deadline.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fundraiser</label>
            <select
              value={form.fundraiserIds[0] || ''}
              onChange={e => setForm(f => ({ ...f, fundraiserIds: e.target.value ? [e.target.value] : [] }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
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
              type="text"
              value={form.action_url}
              onChange={e => setForm(f => ({ ...f, action_url: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action Button Label</label>
            <input
              type="text"
              value={form.button_words}
              onChange={e => setForm(f => ({ ...f, button_words: e.target.value }))}
              placeholder="e.g. Send Email, Open Portal"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-smash"
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
            className="px-4 py-2 text-sm bg-smash text-white rounded-lg hover:bg-smash-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
