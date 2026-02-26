import { Bot, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAppPath } from '../hooks/useAppPath';

interface DelegationIndicatorProps {
  agentName: string;
  task: string;
  status: 'pending' | 'running' | 'done' | 'error';
  subThreadId?: string;
  error?: string;
}

export default function DelegationIndicator({
  agentName,
  task,
  status,
  subThreadId,
  error,
}: DelegationIndicatorProps) {
  const navigate = useNavigate();
  const appPath = useAppPath();

  const statusIcon =
    status === 'pending' || status === 'running' ? (
      <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
    ) : status === 'done' ? (
      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
    ) : (
      <AlertCircle size={14} className="text-error flex-shrink-0" />
    );

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2">
      <Bot size={14} className="text-primary flex-shrink-0" />
      <span className="text-xs font-medium text-text-primary truncate">
        {agentName}
      </span>
      {task && (
        <span className="text-xs text-text-muted truncate flex-1 min-w-0">
          {task}
        </span>
      )}
      {error && (
        <span className="text-xs text-error truncate flex-1 min-w-0">
          {error}
        </span>
      )}
      {statusIcon}
      {subThreadId && (
        <button
          onClick={() => navigate(appPath(`/thread/${subThreadId}`))}
          className="flex-shrink-0 p-0.5 text-text-muted hover:text-primary"
          title="Open sub-thread"
        >
          <ExternalLink size={12} />
        </button>
      )}
    </div>
  );
}
