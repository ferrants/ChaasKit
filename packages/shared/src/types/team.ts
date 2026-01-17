export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Team {
  id: string;
  name: string;
  context?: string | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  token: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
}

export interface TeamWithRole extends Team {
  role: TeamRole;
  memberCount: number;
  threadCount: number;
}

export interface TeamDetails extends Team {
  members: TeamMember[];
  invites: TeamInvite[];
}

export interface CreateTeamRequest {
  name: string;
}

export interface UpdateTeamRequest {
  name?: string;
  context?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface UpdateMemberRoleRequest {
  role: TeamRole;
}

export interface TeamsListResponse {
  teams: TeamWithRole[];
}

export interface TeamResponse {
  team: TeamDetails;
}

export interface TeamInviteResponse {
  invite: TeamInvite;
  inviteUrl: string;
}

export interface AcceptInviteResponse {
  team: Team;
  role: TeamRole;
}

export interface TeamStats {
  totalThreads: number;
  totalMessages: number;
  messagesThisMonth: number;
  memberCount: number;
  threadsThisMonth: number;
}

export interface TeamActivityItem {
  type: 'thread_created' | 'member_joined';
  timestamp: Date;
  user: {
    id: string;
    name?: string | null;
    email: string;
  };
  details?: string;
}

export interface TeamStatsResponse {
  stats: TeamStats;
  recentActivity: TeamActivityItem[];
}
