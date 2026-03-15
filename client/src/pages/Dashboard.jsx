import { useState, useEffect } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CashStatusBar from '../components/CashStatusBar';
import TaskCard, { StatusChip, getFundraiserColor, formatDate } from '../components/TaskCard';
import NewTaskModal from '../components/NewTaskModal';
import { api } from '../api/client';

const COLUMNS = [
  { id: 'To do', label: 'To Do' },
  { id: 'Doing', label: 'Doing' },
  { id: 'Done', label: 'Done' },
];

export default function Dashboard({ tasks, loading, error, refresh }) {
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState('To do');
  const [localTasks, setLocalTasks] = useState(tasks);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const openNewTask = (status = 'To do') => {
    setNewTaskStatus(status);
    setShowNewTask(true);
  };

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

  const oneMonthFromNow = new Date(today);
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  const oneMonthStr = oneMonthFromNow.toISOString().split('T')[0];

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

  // Krista's tasks: Assignee = "Office Manager"
  const kristaTasks = localTasks.filter(t => {
    if (t.assignee !== 'Office Manager') return false;
    if (t.status === 'On deck') return false;

    // Done tasks: only show if completed within last 2 days
    if (t.status === 'Done') {
      if (!t.completed_at) return false;
      return t.completed_at >= twoDaysAgoStr;
    }

    // Non-done tasks: check visibility based on show_date or deadline
    if (t.show_date) {
      return t.show_date <= todayStr;
    }

    // No show_date: show if deadline is within 1 month from now, or in the past, or empty
    if (!t.deadline) return true;
    return t.deadline <= oneMonthStr;
  });

  // Cash's tasks for the separate section below
  const allCashTasks = localTasks.filter(t => t.assignee === 'Cash');

  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const filteredCashTasks = allCashTasks.filter(t => {
    if (t.status === 'To do' && t.deadline && t.deadline >= todayStr && t.deadline <= threeDaysStr) return true;
    if (t.status === 'Doing') return true;
    if (t.status === 'Done' && t.deadline === yesterdayStr) return true;
    if (t.status === 'On deck' && t.deadline && t.deadline >= todayStr && t.deadline <= threeDaysStr) return true;
    return false;
  });

  const statusPriority = { 'Doing': 0, 'To do': 1, 'On deck': 2, 'Done': 3 };
  filteredCashTasks.sort((a, b) => {
    const dateA = a.deadline || '9999-99-99';
    const dateB = b.deadline || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
  });

  function getKristaColumnTasks(columnStatus) {
    return kristaTasks
      .filter(t => t.status === columnStatus)
      .sort((a, b) => {
        const dateA = a.deadline || '9999-12-31';
        const dateB = b.deadline || '9999-12-31';
        return dateA.localeCompare(dateB);
      });
  }

  const totalKristaDone = localTasks.filter(
    t => t.assignee === 'Office Manager' && t.status === 'Done'
  ).length;

  const handleDragEnd = async (result) => {
    const { draggableId, destination, source } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId.replace('krista-', '');
    const destStatus = destination.droppableId.replace('krista-', '');
    if (sourceStatus === destStatus) return;

    const task = localTasks.find(t => t.id === draggableId);
    if (!task) return;

    setLocalTasks(prev =>
      prev.map(t => t.id === draggableId ? { ...t, status: destStatus } : t)
    );
    setSavingTaskId(draggableId);

    try {
      await api.tasks.update(draggableId, { status: destStatus });
      refresh();
    } catch (err) {
      setLocalTasks(prev =>
        prev.map(t => t.id === draggableId ? { ...t, status: sourceStatus } : t)
      );
      setToast({ type: 'error', message: `Failed to update "${task.name}" status` });
    } finally {
      setSavingTaskId(null);
    }
  };

  return (
    <div className="p-4">
      {/* Cash Status Bar */}
      <div className="mb-4">
        <CashStatusBar tasks={localTasks} onNewTask={() => openNewTask('To do')} />
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 w-full pb-4">
          {COLUMNS.map(col => {
            const kristaColTasks = getKristaColumnTasks(col.id);
            const isDoneColumn = col.id === 'Done';
            const count = kristaColTasks.length;

            return (
              <div
                key={col.id}
                className={`flex-1 min-w-0 flex flex-col rounded-xl ${isDoneColumn ? 'bg-slate-50/70' : 'bg-slate-100'}`}
              >
                {/* Column header */}
                <div className={`px-3 py-2.5 flex items-center justify-between shrink-0 ${isDoneColumn ? 'opacity-70' : ''}`}>
                  <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${isDoneColumn ? 'bg-slate-200 text-slate-500' : 'bg-white text-slate-600'}`}>
                      {isDoneColumn ? totalKristaDone : count}
                    </span>
                    <button
                      onClick={() => openNewTask(col.id)}
                      className="p-0.5 text-slate-400 hover:text-smash rounded transition-colors"
                      title={`New ${col.label} task`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Droppable task area */}
                <div className={`flex-1 px-2 pb-2 ${isDoneColumn ? 'opacity-75' : ''}`}>
                  <Droppable droppableId={`krista-${col.id}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[40px] rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-orange-50 ring-2 ring-orange-200' : ''}`}
                      >
                        {kristaColTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="text-xs text-slate-400 text-center py-3">No tasks</div>
                        )}
                        {kristaColTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`mb-2 ${snapshot.isDragging ? 'rotate-2 shadow-lg' : ''}`}
                              >
                                <TaskCard
                                  task={task}
                                  onRefresh={refresh}
                                  saving={savingTaskId === task.id}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Cash's Tasks Section */}
      <div className="bg-gray-50 border-t border-gray-200 mt-2 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-slate-400" />
          <h3 className="text-sm font-medium text-slate-500">Cash's Tasks</h3>
        </div>

        {filteredCashTasks.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No upcoming Cash tasks</p>
        ) : (
          <div>
            {/* Header row */}
            <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <span style={{ width: '27%', flexShrink: 0 }}>Task</span>
              <span style={{ width: '43%', flexShrink: 0 }}>Fundraiser</span>
              <span style={{ width: '15%', flexShrink: 0 }}>Run Date</span>
              <span style={{ width: '15%', flexShrink: 0 }}>Status</span>
            </div>

            {/* Task rows */}
            <div className="space-y-1">
              {filteredCashTasks.map(task => {
                const taskFundraisers = task.fundraisers || (task.fundraiser ? [task.fundraiser] : []);
                return (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded border border-gray-100">
                    <span style={{ width: '27%', flexShrink: 0 }} className="text-sm font-medium text-slate-700 truncate">{task.name}</span>
                    <span style={{ width: '43%', flexShrink: 0 }} className="flex flex-wrap gap-1">
                      {taskFundraisers.length > 0 ? (
                        taskFundraisers.map((fr, i) => {
                          const label = `${fr.organization} — ${fr.team}`;
                          return (
                            <span key={i} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border truncate ${getFundraiserColor(label)}`}>
                              {label}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-300">&mdash;</span>
                      )}
                    </span>
                    <span style={{ width: '15%', flexShrink: 0 }} className="text-xs text-slate-500">{formatDate(task.deadline)}</span>
                    <span style={{ width: '15%', flexShrink: 0 }}>
                      <StatusChip status={task.status} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onRefresh={refresh}
          initialStatus={newTaskStatus}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
