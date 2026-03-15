import { useState, useEffect } from 'react';
import { Clock, User, CheckCircle, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import TaskDetailModal from '../components/TaskDetailModal';
import FundraiserDetailModal from '../components/FundraiserDetailModal';
import { formatAsbType, getAsbColor } from '../utils/asb';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function countdownClasses(days) {
  if (days >= 7) return 'bg-green-50 text-green-700 border-green-200';
  if (days >= 3) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

const PRODUCT_BADGE_COLORS = {
  primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  secondary: 'bg-violet-50 text-violet-700 border-violet-200',
  donations: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function ProductBadges({ products }) {
  if (!products || products.length === 0) return <span className="text-slate-400">{'\u2014'}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {products.map(p => (
        <span key={p.type} className={`text-xs font-medium px-2 py-0.5 rounded border ${PRODUCT_BADGE_COLORS[p.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {p.name}
        </span>
      ))}
    </div>
  );
}

function isReady(fundraiser) {
  const r = fundraiser.readiness;
  return r.accounting_contact_assigned
    && r.md_portal_url_set
    && r.asb_intro_email_sent !== false
    && r.cookie_dough_presale_submitted !== false;
}

function ReadinessCheck({ passed, label }) {
  if (passed) {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <CheckCircle size={16} className="text-green-500 shrink-0" />
        <span className="text-slate-700">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
      <span className="text-amber-700">{label}</span>
    </div>
  );
}

function TaskBadge({ task, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-sm border bg-orange-50 text-[#ff5000] border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
    >
      {task.name}
    </button>
  );
}

function FundraiserCard({ fundraiser, ready, onTaskClick, onFundraiserClick }) {
  const days = getDaysUntil(fundraiser.kickoff_date);
  const openTasks = fundraiser.open_tasks || [];

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm p-5 w-full ${ready ? 'border-l-4 border-l-green-400' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            onClick={() => onFundraiserClick(fundraiser.id)}
            className="text-lg font-bold text-slate-800 hover:text-[#ff5000] transition-colors text-left"
          >
            {fundraiser.organization} — {fundraiser.team}
          </button>
          <p className="text-sm text-slate-400 mt-0.5">
            Starts {formatDate(fundraiser.kickoff_date)} – Ends {formatDate(fundraiser.end_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ready && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">
              <CheckCircle size={12} /> Ready
            </span>
          )}
          {days !== null && (
            <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg border ${countdownClasses(days)}`}>
              <Clock size={14} />
              {days} {days === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>
      </div>

      {/* Key Info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Rep:</span>
          <span className="font-medium text-slate-700">{fundraiser.rep_name || '\u2014'}</span>
          {fundraiser.rep_photo ? (
            <img src={fundraiser.rep_photo} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-200" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
              <User size={12} className="text-slate-400" />
            </div>
          )}
        </div>
        <div>
          <ProductBadges products={fundraiser.products} />
        </div>
        {fundraiser.asb_boosters && getAsbColor(fundraiser.asb_boosters) && (
          <div>
            <span className="text-slate-400">ASB: </span>
            <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${getAsbColor(fundraiser.asb_boosters)}`}>
              {formatAsbType(fundraiser.asb_boosters)}
            </span>
          </div>
        )}
        <div>
          <span className="text-slate-400">Primary Contact: </span>
          <span className="font-medium text-slate-700">{fundraiser.primary_contact_name || '\u2014'}</span>
        </div>
        <div>
          <span className="text-slate-400">Accounting: </span>
          {fundraiser.accounting_contact_name ? (
            <span className="font-medium text-slate-700">{fundraiser.accounting_contact_name}</span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
              No accounting contact
            </span>
          )}
        </div>
      </div>

      {/* Readiness Checklist */}
      <div className={`mt-4 rounded-lg border p-3 ${ready ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Readiness</h4>
        <div className="grid grid-cols-2 gap-2">
          <ReadinessCheck passed={fundraiser.readiness.accounting_contact_assigned} label="Accounting contact" />
          <ReadinessCheck passed={fundraiser.readiness.md_portal_url_set} label="MD Portal URL" />
          {fundraiser.readiness.asb_intro_email_sent !== null && (
            <ReadinessCheck passed={fundraiser.readiness.asb_intro_email_sent} label="ASB intro email sent" />
          )}
          {fundraiser.readiness.cookie_dough_presale_submitted !== null && (
            <ReadinessCheck passed={fundraiser.readiness.cookie_dough_presale_submitted} label="Cookie dough presale submitted" />
          )}
        </div>
      </div>

      {/* Task badges */}
      {openTasks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {openTasks.map(task => (
            <TaskBadge
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task, fundraiser)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Upcoming() {
  const { data: fundraisers, loading, error, refresh } = usePolling(() => api.fundraisers.upcoming());
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [detailFundraiserId, setDetailFundraiserId] = useState(null);

  const handleTaskClick = (task, fundraiser) => {
    // Enrich task with fundraiser info for the modal
    setSelectedTask({
      ...task,
      fundraiser: {
        id: fundraiser.id,
        organization: fundraiser.organization,
        team: fundraiser.team,
        asb_boosters: fundraiser.asb_boosters,
        rep_photo: fundraiser.rep_photo,
        rep_name: fundraiser.rep_name,
      },
    });
  };

  const handleEditFromDetail = () => {
    setEditingTask(selectedTask);
    setSelectedTask(null);
  };

  const handleEditSave = async (taskId, updates) => {
    try {
      const payload = { ...updates };
      if (payload.action_url && payload.action_url.trim()) {
        const url = payload.action_url.trim();
        payload.action_url = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
      }
      await api.tasks.update(taskId, payload);
      setEditingTask(null);
      refresh();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  if (loading && !fundraisers) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Loading upcoming fundraisers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load fundraisers</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!fundraisers || fundraisers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Calendar size={48} className="text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-600">No upcoming fundraisers</h2>
        </div>
      </div>
    );
  }

  const needsAttention = fundraisers.filter(f => !isReady(f));
  const readyToLaunch = fundraisers.filter(f => isReady(f));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-5">Upcoming Fundraisers</h1>

      {/* Needs Attention Section */}
      {needsAttention.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-800">Needs Attention</h2>
            <span className="text-sm font-medium text-slate-500">({needsAttention.length})</span>
          </div>
          <p className="text-sm text-slate-400 mb-4 ml-7">These fundraisers have unresolved items before kickoff</p>
          <div className="space-y-4">
            {needsAttention.map(f => (
              <FundraiserCard key={f.id} fundraiser={f} ready={false} onTaskClick={handleTaskClick} onFundraiserClick={setDetailFundraiserId} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {needsAttention.length > 0 && readyToLaunch.length > 0 && (
        <div className="border-t border-gray-200 my-8" />
      )}

      {/* Ready to Launch Section */}
      {readyToLaunch.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={18} className="text-green-500" />
            <h2 className="text-lg font-semibold text-slate-800">Ready to Launch</h2>
            <span className="text-sm font-medium text-slate-500">({readyToLaunch.length})</span>
          </div>
          <p className="text-sm text-slate-400 mb-4 ml-7">All pre-flight checks passed</p>
          <div className="space-y-4">
            {readyToLaunch.map(f => (
              <FundraiserCard key={f.id} fundraiser={f} ready={true} onTaskClick={handleTaskClick} onFundraiserClick={setDetailFundraiserId} />
            ))}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={handleEditFromDetail}
          onRefresh={refresh}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModalInline
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Fundraiser Detail Modal */}
      {detailFundraiserId && (
        <FundraiserDetailModal
          recordId={detailFundraiserId}
          onClose={() => setDetailFundraiserId(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

function EditTaskModalInline({ task, onClose, onSave }) {
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
    await onSave(task.id, form);
    setSaving(false);
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
