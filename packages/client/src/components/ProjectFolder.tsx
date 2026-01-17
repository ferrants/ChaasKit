import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronRight, Folder, MessageSquare, Settings, Plus, Trash2, GitBranch } from 'lucide-react';
import type { ProjectWithThreadCount, ThreadSummary } from '@chaaskit/shared';
import { useAppPath } from '../hooks/useAppPath';

interface ProjectFolderProps {
  project: ProjectWithThreadCount;
  threads: ThreadSummary[];
  selectedThreadId?: string;
  onEditProject: () => void;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string, e: React.MouseEvent) => void;
}

export default function ProjectFolder({
  project,
  threads,
  selectedThreadId,
  onEditProject,
  onNewThread,
  onSelectThread,
  onDeleteThread,
}: ProjectFolderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();
  const appPath = useAppPath();

  const projectThreads = threads.filter((t) => t.projectId === project.id);

  function handleToggle() {
    setIsExpanded(!isExpanded);
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    onEditProject();
  }

  function handleNewThreadClick(e: React.MouseEvent) {
    e.stopPropagation();
    onNewThread();
  }

  function handleThreadClick(threadId: string) {
    onSelectThread(threadId);
    navigate(appPath(`/thread/${threadId}`));
  }

  return (
    <div className="mb-1">
      {/* Project Header */}
      <div
        onClick={handleToggle}
        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors text-text-secondary hover:bg-background-secondary hover:text-text-primary"
      >
        {/* Expand/collapse chevron */}
        <span className="p-0.5">
          {isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>

        {/* Folder icon with project color */}
        <Folder
          size={16}
          className="flex-shrink-0"
          style={{ color: project.color }}
          fill={project.color}
        />

        {/* Project name */}
        <span className="flex-1 text-sm truncate">{project.name}</span>

        {/* Thread count badge */}
        <span className="text-xs text-text-muted px-1.5 py-0.5 bg-background-secondary rounded">
          {project.threadCount}
        </span>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleNewThreadClick}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            title="New thread in project"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={handleEditClick}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            title="Edit project"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Project Threads */}
      {isExpanded && (
        <div className="ml-6 pl-2 border-l border-border">
          {projectThreads.length === 0 ? (
            <div className="py-2 px-2 text-xs text-text-muted italic">
              No threads yet
            </div>
          ) : (
            projectThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => handleThreadClick(thread.id)}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  selectedThreadId === thread.id
                    ? 'bg-background-secondary text-text-primary'
                    : 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
                }`}
              >
                {thread.parentThreadId ? (
                  <span title="Branched conversation">
                    <GitBranch size={14} className="flex-shrink-0" />
                  </span>
                ) : (
                  <MessageSquare size={14} className="flex-shrink-0" />
                )}
                <span className="flex-1 text-xs truncate">{thread.title}</span>
                <button
                  onClick={(e) => onDeleteThread(thread.id, e)}
                  className="rounded p-1 text-text-muted opacity-0 hover:bg-error/10 hover:text-error group-hover:opacity-100 touch-device:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
