export interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalThreads: number;
  totalMessages: number;
  planDistribution: Record<string, number>;
  newUsersLast30Days: number;
  messagesLast30Days: number;
}

export interface UsageDataPoint {
  date: string;
  messages: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AdminUsageResponse {
  usage: UsageDataPoint[];
  period: 'day' | 'week' | 'month';
}

export interface FeedbackStats {
  totalUp: number;
  totalDown: number;
  recentFeedback: FeedbackItem[];
}

export interface FeedbackItem {
  id: string;
  type: 'up' | 'down';
  comment?: string | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  message: {
    id: string;
    content: string;
    threadId: string;
  };
}

export interface AdminUserTeam {
  id: string;
  name: string;
  role: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
  plan: string;
  messagesThisMonth: number;
  credits: number;
  emailVerified: boolean;
  oauthProvider?: string | null;
  createdAt: Date;
  threadCount: number;
  teamCount: number;
  teams: AdminUserTeam[];
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateAdminUserRequest {
  isAdmin?: boolean;
  plan?: string;
}

export interface AdminTeamMember {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: string;
  joinedAt: Date;
}

export interface AdminTeam {
  id: string;
  name: string;
  memberCount: number;
  threadCount: number;
  createdAt: Date;
  archivedAt?: Date | null;
}

export interface AdminTeamDetails extends AdminTeam {
  context?: string | null;
  members: AdminTeamMember[];
}

export interface AdminTeamsResponse {
  teams: AdminTeam[];
  total: number;
  page: number;
  pageSize: number;
}

export type WaitlistStatus = 'pending' | 'invited' | 'removed';

export interface AdminWaitlistEntry {
  id: string;
  email: string;
  name?: string | null;
  status: WaitlistStatus;
  createdAt: Date;
  invitedAt?: Date | null;
  invitedByUserId?: string | null;
}

export interface AdminWaitlistResponse {
  entries: AdminWaitlistEntry[];
  total: number;
}

export interface AdminWaitlistInviteResponse {
  inviteToken: string;
  inviteUrl: string;
}

export interface AdminPromoCode {
  id: string;
  code: string;
  credits: number;
  maxUses: number;
  redeemedCount: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  creditsExpiresAt?: Date | null;
  createdAt: Date;
}

export interface AdminPromoCodesResponse {
  promoCodes: AdminPromoCode[];
}

export interface AdminCreatePromoCodeRequest {
  code: string;
  credits: number;
  maxUses: number;
  startsAt?: string;
  endsAt?: string;
  creditsExpiresAt?: string;
}

export interface AdminCreatePromoCodeResponse {
  promoCode: AdminPromoCode;
}

export interface AdminUpdatePromoCodeRequest {
  credits?: number;
  maxUses?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  creditsExpiresAt?: string | null;
}

export interface AdminUpdatePromoCodeResponse {
  promoCode: AdminPromoCode;
}

export interface AdminPromoCode {
  id: string;
  code: string;
  credits: number;
  maxUses: number;
  redeemedCount: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  creditsExpiresAt?: Date | null;
  createdAt: Date;
}

export interface AdminPromoCodesResponse {
  promoCodes: AdminPromoCode[];
}

export interface AdminCreatePromoCodeRequest {
  code: string;
  credits: number;
  maxUses: number;
  startsAt?: string;
  endsAt?: string;
  creditsExpiresAt?: string;
}

export interface AdminCreatePromoCodeResponse {
  promoCode: AdminPromoCode;
}
