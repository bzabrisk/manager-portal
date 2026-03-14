import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import CashStatusBar from '../components/CashStatusBar';
import TaskCard from '../components/TaskCard';
import NewTaskModal from '../components/NewTaskModal';

export default function Dashboard({ tasks, loading, error, refresh }) {
  const [showNewTask, setShowNewTask] = useState(false);
  const [onDeckExpanded, setOnDeckExpanded] = useState(false);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load tasks</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Krista's active tasks: assignee = Office Manager, status = To do / Doing, show_date <= today
  const kristaActive = tasks.filter(t => {
    if (t.assignee !== 'Office Manager') return false;
    if (t.status !== 'To do' && t.status !== 'Doing') return false;
    if (t.show_date && t.show_date > todayStr) return false;
    return true;
  });

  // Completed today: status = Done, assigned to Office Manager
  // Since we don't have a "completed_at" timestamp, we approximate with deadline = today or show all done tasks
  const kristaDoneRecently = tasks.filter(t => {
    if (t.assignee !== 'Office Manager') return false;
    if (t.status !== 'Done') return false;
    // Show tasks that were recently completed — use deadline as proxy
    return true;
  }).slice(0, 5); // Show last 5 completed tasks

  // On Deck: show_date in future (next 7 days) OR status = On deck
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const sevenDaysStr = sevenDaysOut.toISOString().split('T')[0];

  const onDeck = tasks.filter(t => {
    if (t.assignee !== 'Office Manager') return false;
    if (t.status === 'Done') return false;
    if (t.status === 'On deck') return true;
    if (t.show_date && t.show_date > todayStr && t.show_date <= sevenDaysStr) return true;
    return false;
  });

  // Cash's tasks: assignee = Cash, status != Done
  const cashTasks = tasks.filter(t => t.assignee === 'Cash' && t.status !== 'Done');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Cash Status Bar */}
      <CashStatusBar tasks={tasks} />

      {/* Krista's Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            My Tasks
            {kristaActive.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {kristaActive.length}
              </span>
            )}
          </h2>
        </div>

        {kristaActive.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-400">No active tasks. You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {kristaActive.map(task => (
              <TaskCard key={task.id} task={task} onRefresh={refresh} />
            ))}
          </div>
        )}
      </section>

      {/* Completed Today */}
      {kristaDoneRecently.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
            Completed
            <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {kristaDoneRecently.length}
            </span>
          </h3>
          <div className="space-y-1.5">
            {kristaDoneRecently.map(task => (
              <TaskCard key={task.id} task={task} onRefresh={refresh} muted />
            ))}
          </div>
        </section>
      )}

      {/* On Deck */}
      {onDeck.length > 0 && (
        <section>
          <button
            onClick={() => setOnDeckExpanded(!onDeckExpanded)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-2"
          >
            {onDeckExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            On Deck
            <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {onDeck.length}
            </span>
          </button>
          {onDeckExpanded && (
            <div className="space-y-1.5">
              {onDeck.map(task => (
                <TaskCard key={task.id} task={task} onRefresh={refresh} muted />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Cash's Tasks */}
      {cashTasks.length > 0 && (
        <section className="bg-purple-50/50 -mx-6 px-6 py-5 rounded-lg border border-purple-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-purple-500" />
            Cash's Tasks
          </h2>
          <div className="space-y-2">
            {cashTasks.map(task => (
              <TaskCard key={task.id} task={task} onRefresh={refresh} readOnly deadlineOnly />
            ))}
          </div>
        </section>
      )}

      {/* New Task FAB */}
      <button
        onClick={() => setShowNewTask(true)}
        className="fixed bottom-6 right-6 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors"
        title="New Task"
      >
        <Plus size={24} />
      </button>

      {showNewTask && (
        <NewTaskModal onClose={() => setShowNewTask(false)} onRefresh={refresh} />
      )}
    </div>
  );
}
