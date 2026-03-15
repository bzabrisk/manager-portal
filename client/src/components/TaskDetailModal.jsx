import { useState } from 'react';
import { X, Pencil, Calendar, User, CheckCircle } from 'lucide-react';
import { StatusChip, getFundraiserColor, formatDate } from './TaskCard';
import { api } from '../api/client';

const ASB_COLORS = {
  'WA State ASB': 'bg-blue-100 text-blue-700',
  'School - other than WA State ASB': 'bg-green-100 text-green-700',
  'Booster Club': 'bg-purple-100 text-purple-700',
};

function asbLabel(val) {
  if (val === 'WA State ASB') return 'ASB';
  if (val === 'Booster Club') return 'Boosters';
  return 'School';
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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

export default function TaskDetailModal({ task, onClose, onEdit, onRefresh }) {
  const [marking, setMarking] = useState(false);

  const handleMarkDone = async () => {
    setMarking(true);
    try {
      await api.tasks.update(task.id, { status: 'Done' });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to mark task as done:', err);
      setMarking(false);
    }
  };
  const hasActionButton = task.button_words && task.action_url;
  const fundraisers = task.fundraisers || (task.fundraiser ? [task.fundraiser] : []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Edit button - top right */}
        <button
          onClick={() => { onClose(); onEdit(); }}
          className="absolute top-4 right-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-2 py-1 transition-colors"
        >
          <Pencil size={14} />
          Edit
        </button>

        {/* Task name */}
        <h2 className="text-lg font-bold text-slate-800 pr-16">{task.name}</h2>

        {/* Status + Deadline row */}
        <div className="flex items-center gap-3 mt-3">
          <StatusChip status={task.status} />
          {task.deadline && (
            <span className={`inline-flex items-center gap-1 text-sm ${deadlineColor(task.deadline, task.status)}`}>
              <Calendar size={13} />
              Deadline: {formatDate(task.deadline)}
            </span>
          )}
        </div>

        {/* Fundraiser section */}
        {fundraisers.length > 0 && (
          <div className="mt-4 space-y-2">
            {fundraisers.map((fr, i) => {
              const label = `${fr.organization} — ${fr.team}`;
              return (
                <div key={i} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${getFundraiserColor(label)}`}>
                      {label}
                    </span>
                    {fr.asb_boosters && ASB_COLORS[fr.asb_boosters] && (
                      <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${ASB_COLORS[fr.asb_boosters]}`}>
                        {asbLabel(fr.asb_boosters)}
                      </span>
                    )}
                  </div>
                  {fr.rep_photo && (
                    <div className="flex items-center gap-2 mt-2">
                      <img
                        src={fr.rep_photo}
                        alt="Rep"
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      {fr.rep_name && <span className="text-sm text-slate-600">{fr.rep_name}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Description</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{stripHtml(task.description)}</p>
          </div>
        )}

        {/* Action button */}
        {hasActionButton && (
          <div className="mt-4">
            <button
              onClick={() => window.open(task.action_url, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center text-sm font-bold text-white px-4 py-1.5 rounded-lg transition-colors shadow-md hover:shadow-lg"
              style={{ backgroundColor: '#ff5000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e04800'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ff5000'}
            >
              {task.button_words}
            </button>
          </div>
        )}

        {/* Footer dates */}
        <div className="flex items-center gap-4 mt-5 pt-3 border-t border-slate-100">
          {task.show_date && (
            <span className="text-xs text-slate-400">Show Date: {formatDate(task.show_date)}</span>
          )}
          {task.created_at && (
            <span className="text-xs text-slate-400">Created: {formatDate(task.created_at)}</span>
          )}
        </div>

        {/* Mark as Done / Completed badge */}
        <div className="mt-4">
          {task.status === 'Done' ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
              ✓ Completed
            </span>
          ) : (
            <button
              onClick={handleMarkDone}
              disabled={marking}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
            >
              {marking ? (
                'Marking...'
              ) : (
                <>
                  <CheckCircle size={16} />
                  Mark as Done
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
