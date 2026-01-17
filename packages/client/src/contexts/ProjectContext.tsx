import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Project, ProjectWithThreadCount, ProjectSharing, CreateProjectInput, UpdateProjectInput } from '@chaaskit/shared';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';
import { useTeam } from './TeamContext';
import { useConfig } from './ConfigContext';

interface ProjectContextType {
  projects: ProjectWithThreadCount[];
  currentProject: Project | null;
  currentProjectId: string | null;
  isLoadingProjects: boolean;
  projectsEnabled: boolean;
  projectColors: string[];
  loadProjects: () => Promise<void>;
  setCurrentProjectId: (projectId: string | null) => void;
  createProject: (data: CreateProjectInput) => Promise<Project>;
  updateProject: (projectId: string, updates: UpdateProjectInput) => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTeamId } = useTeam();
  const config = useConfig();
  const [projects, setProjects] = useState<ProjectWithThreadCount[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const projectsEnabled = config?.projects?.enabled ?? false;
  const projectColors = config?.projects?.colors ?? [];

  const loadProjects = useCallback(async () => {
    if (!user || !projectsEnabled) {
      setProjects([]);
      return;
    }

    setIsLoadingProjects(true);
    try {
      const params = new URLSearchParams();
      if (currentTeamId) {
        params.set('teamId', currentTeamId);
      }
      const url = `/api/projects${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<{ projects: ProjectWithThreadCount[] }>(url);
      setProjects(response.projects);

      // If current project is no longer available, clear it
      if (currentProjectId && !response.projects.some((p) => p.id === currentProjectId)) {
        setCurrentProjectId(null);
        setCurrentProject(null);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [user, projectsEnabled, currentTeamId, currentProjectId]);

  const loadProjectDetails = useCallback(async (projectId: string) => {
    try {
      const response = await api.get<{ project: Project }>(`/api/projects/${projectId}`);
      setCurrentProject(response.project);
    } catch (error) {
      console.error('Failed to load project details:', error);
      setCurrentProject(null);
    }
  }, []);

  const handleSetCurrentProjectId = useCallback((projectId: string | null) => {
    setCurrentProjectId(projectId);
    if (!projectId) {
      setCurrentProject(null);
    }
  }, []);

  const createProject = useCallback(async (data: CreateProjectInput): Promise<Project> => {
    // If we're in a team context, add the teamId
    const projectData = {
      ...data,
      teamId: currentTeamId || undefined,
    };
    const response = await api.post<{ project: Project }>('/api/projects', projectData);
    await loadProjects();
    return response.project;
  }, [loadProjects, currentTeamId]);

  const updateProject = useCallback(async (projectId: string, updates: UpdateProjectInput) => {
    await api.patch(`/api/projects/${projectId}`, updates);
    await loadProjects();
    if (currentProjectId === projectId) {
      await loadProjectDetails(projectId);
    }
  }, [loadProjects, loadProjectDetails, currentProjectId]);

  const archiveProject = useCallback(async (projectId: string) => {
    await api.post(`/api/projects/${projectId}/archive`, {});
    if (currentProjectId === projectId) {
      handleSetCurrentProjectId(null);
    }
    await loadProjects();
  }, [loadProjects, currentProjectId, handleSetCurrentProjectId]);

  // Load projects when user or team changes
  useEffect(() => {
    if (user && projectsEnabled) {
      loadProjects();
    } else {
      setProjects([]);
      setCurrentProject(null);
      setCurrentProjectId(null);
    }
  }, [user, projectsEnabled, currentTeamId, loadProjects]);

  // Load project details when current project changes
  useEffect(() => {
    if (currentProjectId) {
      loadProjectDetails(currentProjectId);
    }
  }, [currentProjectId, loadProjectDetails]);

  // Clear project selection when team changes
  useEffect(() => {
    setCurrentProjectId(null);
    setCurrentProject(null);
  }, [currentTeamId]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        currentProjectId,
        isLoadingProjects,
        projectsEnabled,
        projectColors,
        loadProjects,
        setCurrentProjectId: handleSetCurrentProjectId,
        createProject,
        updateProject,
        archiveProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
