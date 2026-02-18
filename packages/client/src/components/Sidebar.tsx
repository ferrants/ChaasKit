import { useEffect, useState } from 'react';
import { useNavigate, useMatch, useSearchParams, Link } from 'react-router';
import {
  Plus,
  MessageSquare,
  Settings,
  Trash2,
  X,
  Sun,
  Moon,
  LogOut,
  Search,
  Download,
  Share2,
  GitBranch,
  Shield,
  Users,
  Lock,
  FolderPlus,
  LayoutDashboard,
  Puzzle,
  FileText,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { Project } from '@chaaskit/shared';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../contexts/ConfigContext';
import { useTeam } from '../contexts/TeamContext';
import { useProject } from '../contexts/ProjectContext';
import { useChatStore } from '../stores/chatStore';
import { useSidebarPages } from '../extensions/useExtensions';
import { useAppPath } from '../hooks/useAppPath';
import { useBasePath } from '../hooks/useBasePath';
import SettingsModal from './SettingsModal';
import ExportMenu from './ExportMenu';
import ShareModal from './ShareModal';
import ProjectModal from './ProjectModal';
import ProjectFolder from './ProjectFolder';
import { TeamSwitcher } from './TeamSwitcher';
import { formatShortcut } from '../hooks/useKeyboardShortcuts';

// Helper to get icon component from string name
function getIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return Puzzle;
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const Icon = icons[iconName];
  return Icon || Puzzle;
}

interface SidebarProps {
  onClose: () => void;
  onOpenSearch?: () => void;
}

export default function Sidebar({ onClose, onOpenSearch }: SidebarProps) {
  const navigate = useNavigate();
  const appPath = useAppPath();
  const basePath = useBasePath();
  // Match thread routes with and without basePath for flexibility
  const threadMatch = useMatch('/thread/:threadId') || useMatch(`${appPath('/thread/:threadId')}`);
  const threadId = threadMatch?.params.threadId;
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { theme, setTheme, availableThemes } = useTheme();
  const config = useConfig();
  const { currentTeamId } = useTeam();
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    projectsEnabled,
  } = useProject();
  const { threads, isLoadingThreads, loadThreads, deleteThread, currentThread, clearCurrentThread, setCurrentTeamId, setCurrentProjectId: setChatStoreProjectId } =
    useChatStore();
  const extensionPages = useSidebarPages();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Auto-open settings modal if redirected from OAuth callback
  useEffect(() => {
    if (searchParams.get('openSettings') === 'true') {
      setSettingsOpen(true);
      // Clean up URL params after opening
      searchParams.delete('openSettings');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Sync chat store with team context
  useEffect(() => {
    setCurrentTeamId(currentTeamId);
  }, [currentTeamId, setCurrentTeamId]);

  // Sync chat store with project context
  useEffect(() => {
    setChatStoreProjectId(currentProjectId);
  }, [currentProjectId, setChatStoreProjectId]);

  // Auto-select project when viewing a thread that belongs to a project
  // Clear project selection when viewing a thread outside any project
  useEffect(() => {
    if (currentThread) {
      const threadProjectId = currentThread.projectId || null;
      // Only update if different to avoid unnecessary re-renders
      if (threadProjectId !== currentProjectId) {
        setCurrentProjectId(threadProjectId);
      }
    }
  }, [currentThread?.id, currentThread?.projectId, currentProjectId, setCurrentProjectId]);

  useEffect(() => {
    if (user) {
      loadThreads(currentTeamId);
    }
  }, [user, currentTeamId]);

  function handleNewChat(projectId?: string | null) {
    // Clear current thread and navigate to welcome screen where user can select agent
    // Thread will be created when user sends first message with the selected agent
    clearCurrentThread();
    // Set project context: explicit projectId if provided, otherwise clear selection
    // This ensures main "New Chat" button clears project context
    setCurrentProjectId(projectId ?? null);
    navigate(appPath('/'));
    onClose();
  }

  function handleNewProject() {
    setEditingProject(null);
    setProjectModalOpen(true);
  }

  function handleEditProject(project: Project) {
    setEditingProject(project);
    setProjectModalOpen(true);
  }

  function handleCloseProjectModal() {
    setProjectModalOpen(false);
    setEditingProject(null);
  }

  async function handleDeleteThread(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      await deleteThread(id);
      if (threadId === id) {
        navigate(appPath('/'));
      }
    }
  }

  function handleThreadClick(id: string) {
    navigate(appPath(`/thread/${id}`));
    onClose();
  }

  function toggleTheme() {
    const currentIndex = availableThemes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % availableThemes.length;
    setTheme(availableThemes[nextIndex]!);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        {basePath !== '/' ? (
          <a href="/" className="flex items-center gap-2 hover:opacity-80">
            {config.ui.logo && (
              <img
                src={typeof config.ui.logo === 'string' ? config.ui.logo : (theme === 'dark' ? config.ui.logo.dark : config.ui.logo.light)}
                alt={config.app.name}
                className="h-6 w-6 rounded object-contain"
              />
            )}
            <h1 className="text-sm font-semibold text-text-primary">
              {config.app.name}
            </h1>
          </a>
        ) : (
          <div className="flex items-center gap-2">
            {config.ui.logo && (
              <img
                src={typeof config.ui.logo === 'string' ? config.ui.logo : (theme === 'dark' ? config.ui.logo.dark : config.ui.logo.light)}
                alt={config.app.name}
                className="h-6 w-6 rounded object-contain"
              />
            )}
            <h1 className="text-sm font-semibold text-text-primary">
              {config.app.name}
            </h1>
          </div>
        )}
        <button
          onClick={onClose}
          className="p-1 text-text-secondary hover:text-text-primary lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Team Switcher */}
      {user && config.teams?.enabled && (
        <div className="px-3 pt-3 pb-1">
          <TeamSwitcher />
        </div>
      )}

      {/* New Chat & New Project Buttons */}
      <div className="space-y-1 p-3">
        <button
          onClick={() => handleNewChat()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text-primary hover:bg-background-secondary active:bg-background-secondary"
        >
          <Plus size={14} />
          New Chat
          <span className="ml-auto text-[10px] text-text-muted">{formatShortcut('N')}</span>
        </button>

        {/* New Project Button */}
        {projectsEnabled && (
          <button
            onClick={handleNewProject}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            <FolderPlus size={14} />
            New Project
          </button>
        )}

        {/* Search Button */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            <Search size={14} />
            Search
            <span className="ml-auto text-[10px] text-text-muted">{formatShortcut('K')}</span>
          </button>
        )}
      </div>

      {/* Thread List with Projects */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoadingThreads ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Project Folders */}
            {projectsEnabled && projects.length > 0 && (
              <div className="mb-2">
                {projects.map((project) => (
                  <ProjectFolder
                    key={project.id}
                    project={project}
                    threads={threads}
                    selectedThreadId={threadId}
                    onEditProject={() => handleEditProject(project)}
                    onNewThread={() => handleNewChat(project.id)}
                    onSelectThread={handleThreadClick}
                    onDeleteThread={handleDeleteThread}
                  />
                ))}
              </div>
            )}

            {/* Unorganized Threads (no project) */}
            {(() => {
              const unorganizedThreads = threads.filter((t) => !t.projectId);
              if (unorganizedThreads.length === 0 && (!projectsEnabled || projects.length === 0)) {
                return (
                  <p className="px-2 py-4 text-sm text-text-muted">
                    No conversations yet
                  </p>
                );
              }
              if (unorganizedThreads.length === 0) {
                return null;
              }
              return (
                <div className="space-y-0.5">
                  {projectsEnabled && projects.length > 0 && (
                    <div className="px-2 py-1 text-xs font-medium text-text-muted uppercase tracking-wider">
                      Other Threads
                    </div>
                  )}
                  {unorganizedThreads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => handleThreadClick(thread.id)}
                      className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 ${
                        threadId === thread.id
                          ? 'bg-background-secondary text-text-primary'
                          : 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'
                      }`}
                    >
                      {thread.visibility === 'private' ? (
                        <span title="Private thread"><Lock size={14} className="flex-shrink-0 text-text-muted" /></span>
                      ) : thread.parentThreadId ? (
                        <span title="Branched conversation">
                          <GitBranch size={14} className="flex-shrink-0" />
                        </span>
                      ) : (
                        <MessageSquare size={14} className="flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate text-xs">{thread.title}</span>
                      <button
                        onClick={(e) => handleDeleteThread(thread.id, e)}
                        className="rounded p-1 text-text-muted opacity-0 hover:bg-error/10 hover:text-error group-hover:opacity-100 touch-device:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        {/* Theme Toggle */}
        {config.theming.allowUserThemeSwitch && (
          <button
            onClick={toggleTheme}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        )}

        {/* Share & Export (only show if there's a current thread) */}
        {currentThread && currentThread.id !== 'pending' && (
          <>
            {config.sharing?.enabled && (
              <button
                onClick={() => setShareOpen(true)}
                className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
              >
                <Share2 size={14} />
                Share
              </button>
            )}
            <button
              onClick={() => setExportOpen(true)}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
            >
              <Download size={14} />
              Export Chat
            </button>
          </>
        )}

        {/* Team Settings - only show when viewing a team */}
        {currentTeamId && (
          <Link
            to={appPath(`/team/${currentTeamId}/settings`)}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            <Users size={14} />
            Team Settings
          </Link>
        )}

        {/* Admin Dashboard - show for site admins (config or database flag) */}
        {(user?.isAdmin || config.auth?.isAdmin) && (
          <Link
            to={appPath('/admin')}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            <Shield size={14} />
            Admin
          </Link>
        )}

        {/* Extension Pages */}
        {extensionPages.map(page => {
          const IconComponent = getIconComponent(page.icon);
          return (
            <Link
              key={page.id}
              to={page.path}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
            >
              <IconComponent size={14} />
              {page.label}
            </Link>
          );
        })}

        {/* Documents - only show if enabled */}
        {config.documents?.enabled && (
          <Link
            to={appPath('/documents')}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            <FileText size={14} />
            Documents
          </Link>
        )}

        {/* Scheduled Prompts / Automations - only show if enabled */}
        {config.scheduledPrompts?.enabled && (
          <Link
            to={appPath('/automations')}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            <Clock size={14} />
            {config.scheduledPrompts.featureName || 'Automations'}
          </Link>
        )}

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
        >
          <Settings size={14} />
          Settings
        </button>

        {/* User info & logout */}
        {user && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-background-secondary px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">
                {user.name || user.email}
              </p>
              <p className="text-[10px] text-text-muted">{user.plan} plan</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 flex-shrink-0 rounded p-1 text-text-muted hover:bg-error/10 hover:text-error active:bg-error/10"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Export Menu */}
      {currentThread && (
        <ExportMenu
          threadId={currentThread.id}
          threadTitle={currentThread.title}
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Share Modal */}
      {currentThread && (
        <ShareModal
          threadId={currentThread.id}
          threadTitle={currentThread.title}
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Project Modal */}
      {projectsEnabled && (
        <ProjectModal
          isOpen={projectModalOpen}
          onClose={handleCloseProjectModal}
          project={editingProject}
        />
      )}
    </div>
  );
}
