import React, { createContext, useContext, useState, useEffect, ReactNode, type Context } from 'react';
import api from '../services/api';
import { disconnectMessagingSocket } from '../utils/messagingSocket';
import { clearDownloadTokenCache } from '../services/fileUploadApi';
import { setMemoryAuthToken } from '../utils/authToken';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  bio?: string;
  profilePicture?: string;
  rootAccountId?: string | null;
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithToken: (token: string) => Promise<User>;
  signup: (firstName: string, lastName: string, email: string, password: string, termsAccepted: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

function createAuthContext(): Context<AuthContextType | undefined> {
  return createContext<AuthContextType | undefined>(undefined);
}

// Preserve context identity across Vite HMR so useAuth and AuthProvider stay in sync.
const hotData = import.meta.hot?.data as { authContext?: Context<AuthContextType | undefined> } | undefined;
const AuthContext = hotData?.authContext ?? createAuthContext();

if (import.meta.hot && hotData) {
  hotData.authContext = AuthContext;
}

function mapUser(userData: Record<string, unknown>): User {
  return {
    _id: String(userData.id || userData._id),
    firstName: String(userData.firstName),
    lastName: String(userData.lastName),
    email: String(userData.email),
    role: String(userData.role),
    bio: String(userData.bio || ''),
    profilePicture: String(userData.profilePicture || ''),
    rootAccountId: userData.rootAccountId ? String(userData.rootAccountId) : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/auth/me')
      .then((response) => {
        if (cancelled) return;
        if (response.data.success) {
          setUser(mapUser(response.data.user));
        } else {
          setUser(null);
          setToken(null);
          setMemoryAuthToken(null);
        }
      })
      .catch((err: { response?: { status?: number } }) => {
        if (cancelled) return;
        if (err.response?.status === 401) {
          // Do not call /auth/logout here — a stale /auth/me can race with login and wipe a fresh cookie.
          setUser(null);
          setToken(null);
          setMemoryAuthToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: authToken, user: userData } = response.data;
    const mapped = mapUser(userData);
    setMemoryAuthToken(authToken);
    setToken(authToken);
    setUser(mapped);
    return mapped;
  };

  const loginWithToken = async (authToken: string) => {
    setMemoryAuthToken(authToken);
    setToken(authToken);
    const me = await api.get('/auth/me');
    const userData = me.data?.data || me.data?.user || me.data;
    const mapped = mapUser(userData);
    setUser(mapped);
    return mapped;
  };

  const signup = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    termsAccepted: boolean
  ) => {
    const response = await api.post('/auth/register', {
      firstName,
      lastName,
      email,
      password,
      termsAccepted,
    });
    const { token: authToken, user: userData } = response.data;
    const mapped = mapUser(userData);
    setMemoryAuthToken(authToken);
    setToken(authToken);
    setUser(mapped);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* cookie may already be cleared */
    }
    disconnectMessagingSocket();
    clearDownloadTokenCache();
    localStorage.removeItem('courseColors');
    setMemoryAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, setToken, loading, login, loginWithToken, signup, logout }}>
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
