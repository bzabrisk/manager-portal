import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { api } from '../api/client';

// The one shared "Mark as Done" control. Marks the task Done in Airtable, refreshes
// the board so the card moves to the Done column, then calls onDone (typically to
// close whatever modal it lives in). Shows the green "Completed" badge instead when
// the task is already Done.
export default function MarkDoneButton({ task, onRefresh, onDone }) {
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const handleMarkDone = async () => {
    setMarking(true);
    setError('');
    try {
      await api.tasks.update(task.id, { status: 'Done' });
      if (onRefresh) onRefresh();
      if (onDone) onDone();
    } catch (err) {
      console.error('Failed to mark task as done:', err);
      setError(err.message || 'Failed to mark task as done');
      setMarking(false);
    }
  };

  return (
    <div>
      {task.status === 'Done' ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
          ✓ Completed
        </span>
      ) : (
        <button
          onClick={handleMarkDone}
          disabled={marking}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors max-lg:py-2.5"
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
      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
