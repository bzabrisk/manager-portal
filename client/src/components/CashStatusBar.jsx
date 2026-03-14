import { Sparkles } from 'lucide-react';

export default function CashStatusBar({ tasks }) {
  const today = new Date().toISOString().split('T')[0];

  const cashTasks = tasks.filter(t => t.assignee === 'Cash');
  const cashTodayTodo = cashTasks.filter(t => t.status === 'To do' && t.deadline === today);
  const cashDone = cashTasks
    .filter(t => t.status === 'Done')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const lastDone = cashDone[0];

  let message = 'Cash has no tasks scheduled today.';
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

  message = parts.join(' ');

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-blue-800">
      <Sparkles size={16} className="text-blue-500 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
