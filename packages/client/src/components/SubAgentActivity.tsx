import { useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useChatStore, type SubThreadState } from '../stores/chatStore';
import { useAppPath } from '../hooks/useAppPath';
import ToolConfirmationModal from './ToolConfirmationModal';

export default function SubAgentActivity() {
  const navigate = useNavigate();
  const appPath = useAppPath();
  const { activeSubThreads, confirmSubThreadTool } = useChatStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const subThreads = Object.values(activeSubThreads);
  if (subThreads.length === 0) return null;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Find any sub-thread with a pending confirmation
  const subWithConfirmation = subThreads.find((s) => s.pendingConfirmation);

  return (
    <>
      <div className="mx-4 my-3 space-y-2">
        {subThreads.map((sub) => (
          <SubAgentCard
            key={sub.id}
            sub={sub}
            isExpanded={expandedIds.has(sub.id)}
            onToggle={() => toggleExpand(sub.id)}
            onNavigate={() => navigate(appPath(`/thread/${sub.id}`))}
          />
        ))}
      </div>

      {/* Tool Confirmation for sub-agent */}
      {subWithConfirmation?.pendingConfirmation && (
        <ToolConfirmationModal
          confirmation={subWithConfirmation.pendingConfirmation}
          onConfirm={(approved, scope) => {
            confirmSubThreadTool(
              subWithConfirmation.id,
              subWithConfirmation.pendingConfirmation!.confirmationId,
              approved,
              scope
            );
          }}
        />
      )}
    </>
  );
}

function SubAgentCard({
  sub,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  sub: SubThreadState;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const statusIcon = sub.status === 'running' ? (
    <Loader2 size={14} className="animate-spin text-primary" />
  ) : sub.status === 'done' ? (
    <CheckCircle size={14} className="text-green-500" />
  ) : (
    <AlertCircle size={14} className="text-error" />
  );

  const preview = sub.streamingContent.length > 150
    ? sub.streamingContent.slice(0, 150) + '...'
    : sub.streamingContent;

  return (
    <div className="rounded-lg border border-border bg-background-secondary overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-background"
        onClick={onToggle}
      >
        <button className="flex-shrink-0 p-0.5 text-text-muted">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Bot size={14} className="flex-shrink-0 text-primary" />
        <span className="text-xs font-medium text-text-primary truncate flex-1">
          {sub.agentName}
        </span>
        {statusIcon}
        {sub.status === 'done' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
            className="flex-shrink-0 p-0.5 text-text-muted hover:text-primary"
            title="Open sub-thread"
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border px-3 py-2">
          {/* Tool activity */}
          {(sub.pendingToolCalls.length > 0 || sub.completedToolCalls.length > 0) && (
            <div className="mb-2 space-y-1">
              {sub.completedToolCalls.map((tc) => (
                <div key={tc.id} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <CheckCircle size={10} className="text-green-500" />
                  <span className="truncate">{tc.name}</span>
                </div>
              ))}
              {sub.pendingToolCalls.map((tc) => (
                <div key={tc.id} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Loader2 size={10} className="animate-spin" />
                  <span className="truncate">{tc.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Content preview */}
          {preview && (
            <p className="text-xs text-text-secondary whitespace-pre-wrap line-clamp-4">
              {preview}
            </p>
          )}

          {/* Error */}
          {sub.error && (
            <p className="text-xs text-error mt-1">{sub.error}</p>
          )}

          {!preview && !sub.error && sub.status === 'running' && (
            <p className="text-xs text-text-muted italic">Processing...</p>
          )}
        </div>
      )}
    </div>
  );
}
