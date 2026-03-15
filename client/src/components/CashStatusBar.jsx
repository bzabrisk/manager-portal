import { Sparkles, Plus } from 'lucide-react';

export default function CashStatusBar({ tasks, onNewTask }) {
  const today = new Date().toISOString().split('T')[0];

  const cashTasks = tasks.filter(t => t.assignee === 'Cash');
  const cashTodayTodo = cashTasks.filter(t => t.status === 'To do' && t.deadline === today);
  const cashDone = cashTasks
    .filter(t => t.status === 'Done')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const lastDone = cashDone[0];

  const parts = [];

  if (cashTodayTodo.length > 0) {
    parts.push(`Cash has ${cashTodayTodo.length} task${cashTodayTodo.length > 1 ? 's' : ''} scheduled today.`);
  } else {
    parts.push('Cash has no tasks scheduled today.');
  }

  if (lastDone) {
    const dateStr = lastDone.deadline
      ? new Date(lastDone.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
    const fundraiserLabel = lastDone.fundraiser
      ? ` for ${lastDone.fundraiser.organization} ${lastDone.fundraiser.team}`
      : '';
    parts.push(`Last completed: ${lastDone.name}${fundraiserLabel}${dateStr ? ` (${dateStr})` : ''}.`);
  }

  const message = parts.join(' ');

  return (
    <div className="flex items-center gap-4">
      {/* Slim status strip */}
      <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm text-blue-800">
        <Sparkles size={14} className="text-blue-500 shrink-0" />
        <span>{message}</span>
      </div>

      {/* Prominent + Task button — outside the status bar */}
      <button
        onClick={onNewTask}
        className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-1.5 rounded-lg transition-colors shrink-0 shadow-md hover:shadow-lg"
        style={{ backgroundColor: '#ff5000' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e04800'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ff5000'}
      >
        <Plus size={20} strokeWidth={3} />
        Task
      </button>
    </div>
  );
}
