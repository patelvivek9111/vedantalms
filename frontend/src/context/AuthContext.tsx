import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

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
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (firstName: string, lastName: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token and get user data
      api.get('/auth/me')
        .then(response => {
          if (response.data.success) {
            // Map the response data to match our User interface
            const userData = response.data.user;
            setUser({
              _id: userData.id || userData._id, // Handle both 'id' and '_id'
              firstName: userData.firstName,
              lastName: userData.lastName,
              email: userData.email,
              role: userData.role,
              bio: userData.bio,
              profilePicture: userData.profilePicture
            });
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data;
    // Map the user data to match our User interface
    const user = {
      _id: userData.id || userData._id, // Handle both 'id' and '_id'
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      role: userData.role,
      bio: userData.bio,
      profilePicture: userData.profilePicture
    };
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const signup = async (firstName: string, lastName: string, email: string, password: string, role: string) => {
    console.log('Signup request data:', { firstName, lastName, email, password, role });
    try {
      const response = await api.post('/auth/register', { firstName, lastName, email, password, role });
      console.log('Signup response:', response.data);
      const { token, user: userData } = response.data;
      // Map the user data to match our User interface
      const user = {
        _id: userData.id || userData._id, // Handle both 'id' and '_id'
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        role: userData.role,
        bio: userData.bio,
        profilePicture: userData.profilePicture
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
    } catch (error: any) {
      console.error('Signup error:', error.response?.data || error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, signup, logout }}>
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