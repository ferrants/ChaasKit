export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    plan: string;
  };
  token?: string;
}

export interface OAuthProfile {
  provider: string;
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}
