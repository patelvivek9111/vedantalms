import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import logger from '../utils/logger';

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
          } else {
            // Invalid response, clear auth
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No token, clear user state
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Check if response has success field and it's false
      if (response.data && response.data.success === false) {
        throw new Error(response.data.message || 'Login failed');
      }
      
      // Check if response has required data
      if (!response.data || !response.data.token || !response.data.user) {
        logger.error('Invalid login response format', { data: response.data });
        throw new Error('Invalid response from server');
      }
      
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
    
    // Save to stored users for quick switching
    try {
      const storedUsersKey = 'storedUsers';
      const stored = localStorage.getItem(storedUsersKey);
      let users: any[] = stored ? JSON.parse(stored) : [];
      
      // Remove existing user with same email
      users = users.filter((u: any) => u.email !== user.email);
      
      // Add new user
      users.push({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        token: token,
        lastUsed: Date.now()
      });
      
      // Keep only last 5 users
      if (users.length > 5) {
        users = users
          .sort((a: any, b: any) => b.lastUsed - a.lastUsed)
          .slice(0, 5);
      }
      
      localStorage.setItem(storedUsersKey, JSON.stringify(users));
    } catch (error) {
      logger.error('Error saving user to stored users', error instanceof Error ? error : new Error(String(error)));
    }
    
      setToken(token);
      setUser(user);
    } catch (error: any) {
      // Log the error for debugging
      logger.error('Login error', error instanceof Error ? error : new Error(String(error)), {
        email,
        status: error?.response?.status,
        responseData: error?.response?.data,
      });
      
      // Re-throw with a user-friendly message
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          'Failed to login. Please check your credentials.';
      throw new Error(errorMessage);
    }
  };

  const signup = async (firstName: string, lastName: string, email: string, password: string, role: string) => {
    try {
      const response = await api.post('/auth/register', { firstName, lastName, email, password, role });
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
      
      // Save to stored users for quick switching
      try {
        const storedUsersKey = 'storedUsers';
        const stored = localStorage.getItem(storedUsersKey);
        let users: any[] = stored ? JSON.parse(stored) : [];
        
        // Remove existing user with same email
        users = users.filter((u: any) => u.email !== user.email);
        
        // Add new user
        users.push({
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
          token: token,
          lastUsed: Date.now()
        });
        
        // Keep only last 5 users
        if (users.length > 5) {
          users = users
            .sort((a: any, b: any) => b.lastUsed - a.lastUsed)
            .slice(0, 5);
        }
        
        localStorage.setItem(storedUsersKey, JSON.stringify(users));
      } catch (error) {
        logger.error('Error saving user to stored users', error instanceof Error ? error : new Error(String(error)));
      }
      
      setToken(token);
      setUser(user);
    } catch (error: any) {
      logger.error('Signup error', error.response?.data || error);
      throw error;
    }
  };

  const logout = () => {
    // Clear all localStorage items related to auth
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear any course-related cached data
    localStorage.removeItem('courseColors');
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