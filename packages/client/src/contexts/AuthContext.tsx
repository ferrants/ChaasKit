import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { UserSession } from '@chaaskit/shared';
import { api } from '../utils/api';

interface RegisterResult {
  requiresVerification: boolean;
}

interface LoginResult {
  requiresVerification: boolean;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string, name?: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await api.get<{ user: UserSession }>('/api/auth/me');
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    const response = await api.post<{
      user: UserSession;
      token: string;
      requiresVerification?: boolean;
    }>('/api/auth/login', { email, password });
    setUser(response.user);
    return { requiresVerification: response.requiresVerification ?? false };
  }

  async function register(email: string, password: string, name?: string): Promise<RegisterResult> {
    const response = await api.post<{
      user: UserSession;
      token: string;
      requiresVerification?: boolean;
    }>('/api/auth/register', { email, password, name });
    setUser(response.user);
    return { requiresVerification: response.requiresVerification ?? false };
  }

  async function logout() {
    await api.post('/api/auth/logout', {});
    setUser(null);
  }

  async function sendMagicLink(email: string) {
    await api.post('/api/auth/magic-link', { email });
  }

  async function verifyEmail(code: string) {
    await api.post<{ verified: boolean; message: string }>(
      '/api/auth/verify-email',
      { code }
    );
    // Refresh user data after verification
    const response = await api.get<{ user: UserSession }>('/api/auth/me');
    setUser(response.user);
  }

  async function resendVerification() {
    await api.post<{ message: string }>('/api/auth/resend-verification', {});
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        sendMagicLink,
        verifyEmail,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
