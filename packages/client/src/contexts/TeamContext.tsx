import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router';
import type { TeamWithRole, TeamDetails, TeamInvite, TeamRole } from '@chaaskit/shared';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';
import { useConfig, useConfigLoaded } from './ConfigContext';

interface TeamContextType {
  teams: TeamWithRole[];
  currentTeam: TeamDetails | null;
  currentTeamId: string | null;
  isLoadingTeams: boolean;
  isLoadingTeamDetails: boolean;
  loadTeams: () => Promise<void>;
  loadTeamDetails: (teamId: string) => Promise<void>;
  setCurrentTeamId: (teamId: string | null) => void;
  createTeam: (name: string) => Promise<TeamDetails>;
  updateTeam: (teamId: string, updates: { name?: string; context?: string | null }) => Promise<void>;
  archiveTeam: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role: 'admin' | 'member' | 'viewer') => Promise<{ invite: TeamInvite; inviteUrl: string }>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  updateMemberRole: (teamId: string, userId: string, role: TeamRole) => Promise<void>;
  leaveTeam: (teamId: string) => Promise<void>;
  cancelInvite: (teamId: string, inviteId: string) => Promise<void>;
  getCurrentTeamRole: () => TeamRole | null;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const config = useConfig();
  const configLoaded = useConfigLoaded();
  const teamsEnabled = configLoaded ? (config.teams?.enabled ?? true) : false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [currentTeam, setCurrentTeam] = useState<TeamDetails | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(() => {
    // URL takes priority over localStorage
    const urlTeam = searchParams.get('team');
    if (urlTeam) return urlTeam;
    return localStorage.getItem('currentTeamId');
  });
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingTeamDetails, setIsLoadingTeamDetails] = useState(false);

  const clearTeamSelection = useCallback(() => {
    setCurrentTeamId(null);
    setCurrentTeam(null);
    localStorage.removeItem('currentTeamId');
    setSearchParams((prev) => {
      prev.delete('team');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const loadTeams = useCallback(async () => {
    if (!user || !teamsEnabled) {
      setTeams([]);
      return;
    }

    setIsLoadingTeams(true);
    try {
      const response = await api.get<{ teams: TeamWithRole[] }>('/api/teams');
      setTeams(response.teams);

      // If current team is no longer available (invalid/archived or user not a member), clear it
      if (currentTeamId && !response.teams.some((t) => t.id === currentTeamId)) {
        clearTeamSelection();
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      setTeams([]);
    } finally {
      setIsLoadingTeams(false);
    }
  }, [user, teamsEnabled, currentTeamId, clearTeamSelection]);

  const loadTeamDetails = useCallback(async (teamId: string) => {
    if (!teamsEnabled) {
      setCurrentTeam(null);
      return;
    }

    setIsLoadingTeamDetails(true);
    try {
      const response = await api.get<{ team: TeamDetails }>(`/api/teams/${teamId}`);
      setCurrentTeam(response.team);
    } catch (error) {
      console.error('Failed to load team details:', error);
      setCurrentTeam(null);
    } finally {
      setIsLoadingTeamDetails(false);
    }
  }, [teamsEnabled]);

  const handleSetCurrentTeamId = useCallback((teamId: string | null) => {
    setCurrentTeamId(teamId);

    // Update URL and localStorage
    if (teamId) {
      localStorage.setItem('currentTeamId', teamId);
      setSearchParams((prev) => {
        prev.set('team', teamId);
        return prev;
      }, { replace: true });
    } else {
      localStorage.removeItem('currentTeamId');
      setCurrentTeam(null);
      setSearchParams((prev) => {
        prev.delete('team');
        return prev;
      }, { replace: true });
    }
  }, [setSearchParams]);

  const createTeam = useCallback(async (name: string): Promise<TeamDetails> => {
    const response = await api.post<{ team: TeamDetails }>('/api/teams', { name });
    await loadTeams();
    return response.team;
  }, [loadTeams]);

  const updateTeam = useCallback(async (teamId: string, updates: { name?: string; context?: string | null }) => {
    await api.patch(`/api/teams/${teamId}`, updates);
    await loadTeams();
    if (currentTeamId === teamId) {
      await loadTeamDetails(teamId);
    }
  }, [loadTeams, loadTeamDetails, currentTeamId]);

  const archiveTeam = useCallback(async (teamId: string) => {
    await api.post(`/api/teams/${teamId}/archive`, {});
    if (currentTeamId === teamId) {
      handleSetCurrentTeamId(null);
    }
    await loadTeams();
  }, [loadTeams, currentTeamId, handleSetCurrentTeamId]);

  const inviteMember = useCallback(async (
    teamId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer'
  ): Promise<{ invite: TeamInvite; inviteUrl: string }> => {
    const response = await api.post<{ invite: TeamInvite; inviteUrl: string }>(
      `/api/teams/${teamId}/invite`,
      { email, role }
    );
    if (currentTeamId === teamId) {
      await loadTeamDetails(teamId);
    }
    return response;
  }, [loadTeamDetails, currentTeamId]);

  const removeMember = useCallback(async (teamId: string, userId: string) => {
    await api.delete(`/api/teams/${teamId}/members/${userId}`);
    await loadTeams();
    if (currentTeamId === teamId) {
      await loadTeamDetails(teamId);
    }
  }, [loadTeams, loadTeamDetails, currentTeamId]);

  const updateMemberRole = useCallback(async (teamId: string, userId: string, role: TeamRole) => {
    await api.patch(`/api/teams/${teamId}/members/${userId}`, { role });
    if (currentTeamId === teamId) {
      await loadTeamDetails(teamId);
    }
  }, [loadTeamDetails, currentTeamId]);

  const leaveTeam = useCallback(async (teamId: string) => {
    await api.post(`/api/teams/${teamId}/leave`, {});
    if (currentTeamId === teamId) {
      handleSetCurrentTeamId(null);
    }
    await loadTeams();
  }, [loadTeams, currentTeamId, handleSetCurrentTeamId]);

  const cancelInvite = useCallback(async (teamId: string, inviteId: string) => {
    await api.delete(`/api/teams/${teamId}/invite/${inviteId}`);
    if (currentTeamId === teamId) {
      await loadTeamDetails(teamId);
    }
  }, [loadTeamDetails, currentTeamId]);

  const getCurrentTeamRole = useCallback((): TeamRole | null => {
    if (!currentTeamId) return null;
    const team = teams.find((t) => t.id === currentTeamId);
    return team?.role || null;
  }, [teams, currentTeamId]);

  // Track if user was ever logged in to distinguish logout from initial mount
  const wasLoggedIn = useRef(false);

  // Load teams when user changes and config is loaded
  useEffect(() => {
    if (user && configLoaded) {
      wasLoggedIn.current = true;
      loadTeams();
    } else if (wasLoggedIn.current && !user) {
      // Only clear on actual logout, not on initial mount
      setTeams([]);
      setCurrentTeam(null);
      handleSetCurrentTeamId(null);
    }
  }, [user, configLoaded, loadTeams, handleSetCurrentTeamId]);

  // Load team details when current team changes
  useEffect(() => {
    if (currentTeamId && configLoaded && teamsEnabled) {
      loadTeamDetails(currentTeamId);
    }
  }, [currentTeamId, configLoaded, teamsEnabled, loadTeamDetails]);

  return (
    <TeamContext.Provider
      value={{
        teams,
        currentTeam,
        currentTeamId,
        isLoadingTeams,
        isLoadingTeamDetails,
        loadTeams,
        loadTeamDetails,
        setCurrentTeamId: handleSetCurrentTeamId,
        createTeam,
        updateTeam,
        archiveTeam,
        inviteMember,
        removeMember,
        updateMemberRole,
        leaveTeam,
        cancelInvite,
        getCurrentTeamRole,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
