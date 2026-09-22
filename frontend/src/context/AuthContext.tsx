import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { api } from '../services/api';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('game_jwt_token'),
    isAuthenticated: false,
    isLoading: true
  });

  const refreshUserData = async () => {
    const token = localStorage.getItem('game_jwt_token');
    if (!token) return;
    try {
      const res = await api.verify(token);
      if (res && res.user) {
        setAuthState(prev => ({
          ...prev,
          user: res.user,
          token,
          isAuthenticated: true,
          isLoading: false
        }));
      }
    } catch {
      logout();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('game_jwt_token');
    if (token) {
      api.verify(token)
        .then(res => {
          setAuthState({
            user: res.user,
            token,
            isAuthenticated: true,
            isLoading: false
          });
        })
        .catch(() => {
          logout();
        });
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = (token: string, user: User) => {
    localStorage.setItem('game_jwt_token', token);
    setAuthState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false
    });
  };

  const logout = () => {
    localStorage.removeItem('game_jwt_token');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
