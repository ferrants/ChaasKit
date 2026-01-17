import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderPlus, Loader2, Trash2 } from 'lucide-react';
import type { Project, ProjectSharing } from '@chaaskit/shared';
import { useProject } from '../contexts/ProjectContext';
import { useTeam } from '../contexts/TeamContext';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null; // If provided, we're editing; otherwise creating
}

export default function ProjectModal({ isOpen, onClose, project }: ProjectModalProps) {
  const { createProject, updateProject, archiveProject, projectColors } = useProject();
  const { currentTeamId, getCurrentTeamRole } = useTeam();
  const [name, setName] = useState('');
  const [color, setColor] = useState(projectColors[0] || '#3b82f6');
  const [context, setContext] = useState('');
  const [sharing, setSharing] = useState<ProjectSharing>('private');
  const [isLoading, setIsLoading] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const isEditing = !!project;
  const teamRole = getCurrentTeamRole();
  const canEdit = !project || project.userId === undefined ||
    (currentTeamId && (teamRole === 'owner' || teamRole === 'admin'));

  // Reset form when modal opens/closes or project changes
  useEffect(() => {
    if (isOpen) {
      if (project) {
        setName(project.name);
        setColor(project.color);
        setContext(project.context || '');
        setSharing(project.sharing);
      } else {
        setName('');
        setColor(projectColors[0] || '#3b82f6');
        setContext('');
        setSharing('private');
      }
      setShowArchiveConfirm(false);
    }
  }, [isOpen, project, projectColors]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      if (isEditing && project) {
        await updateProject(project.id, {
          name: name.trim(),
          color,
          context: context.trim() || null,
          sharing: currentTeamId ? sharing : 'private',
        });
      } else {
        await createProject({
          name: name.trim(),
          color,
          context: context.trim() || undefined,
          sharing: currentTeamId ? sharing : 'private',
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleArchive() {
    if (!project) return;

    setIsLoading(true);
    try {
      await archiveProject(project.id);
      onClose();
    } catch (error) {
      console.error('Failed to archive project:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-background border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <FolderPlus size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              {isEditing ? 'Edit Project' : 'Create Project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-background-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full rounded-lg border border-border bg-background p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
              autoFocus
              required
              maxLength={100}
              disabled={!canEdit}
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {projectColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => canEdit && setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-text-primary scale-110'
                      : 'border-transparent hover:scale-105'
                  } ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                  style={{ backgroundColor: c }}
                  disabled={!canEdit}
                />
              ))}
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Project Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add context that the AI will use for all conversations in this project..."
              className="w-full rounded-lg border border-border bg-background p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none resize-none"
              rows={4}
              maxLength={10000}
              disabled={!canEdit}
            />
            <p className="mt-1 text-xs text-text-muted">
              This context is included in all AI conversations within this project.
            </p>
          </div>

          {/* Sharing (only show for team projects) */}
          {currentTeamId && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Sharing
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="sharing"
                    value="private"
                    checked={sharing === 'private'}
                    onChange={() => setSharing('private')}
                    className="mt-1"
                    disabled={!canEdit}
                  />
                  <div>
                    <div className="text-sm font-medium text-text-primary">Private</div>
                    <div className="text-xs text-text-muted">
                      Only you can see this project and its threads
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="sharing"
                    value="team"
                    checked={sharing === 'team'}
                    onChange={() => setSharing('team')}
                    className="mt-1"
                    disabled={!canEdit}
                  />
                  <div>
                    <div className="text-sm font-medium text-text-primary">Team</div>
                    <div className="text-xs text-text-muted">
                      All team members can see and contribute to this project
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Archive section (only for editing) */}
          {isEditing && canEdit && (
            <div className="pt-4 border-t border-border">
              {!showArchiveConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="flex items-center gap-2 text-sm text-error hover:text-error/80"
                >
                  <Trash2 size={16} />
                  Archive Project
                </button>
              ) : (
                <div className="p-3 bg-error/10 rounded-lg border border-error/20">
                  <p className="text-sm text-text-primary mb-3">
                    Are you sure you want to archive this project? All threads in this project will also be archived.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={isLoading}
                      className="flex items-center gap-2 rounded-lg bg-error px-3 py-1.5 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowArchiveConfirm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-background-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isEditing ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <FolderPlus size={16} />
                    {isEditing ? 'Save Changes' : 'Create Project'}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
