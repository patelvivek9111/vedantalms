import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (firstName: string, lastName: string, email: string, password: string, termsAccepted: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(userData: Record<string, unknown>): User {
  return {
    _id: String(userData.id || userData._id),
    firstName: String(userData.firstName),
    lastName: String(userData.lastName),
    email: String(userData.email),
    role: String(userData.role),
    bio: String(userData.bio || ''),
    profilePicture: String(userData.profilePicture || ''),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((response) => {
        if (response.data.success) {
          setUser(mapUser(response.data.user));
        } else {
          setUser(null);
          setToken(null);
          setMemoryAuthToken(null);
        }
      })
      .catch(async (err: { response?: { status?: number } }) => {
        if (err.response?.status === 401) {
          try {
            await api.post('/auth/logout');
          } catch {
            /* clear stale cookie if possible */
          }
          setUser(null);
          setToken(null);
          setMemoryAuthToken(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: authToken, user: userData } = response.data;
    const mapped = mapUser(userData);
    setMemoryAuthToken(authToken);
    setToken(authToken);
    setUser(mapped);
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
    <AuthContext.Provider value={{ user, setUser, token, setToken, loading, login, signup, logout }}>
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
