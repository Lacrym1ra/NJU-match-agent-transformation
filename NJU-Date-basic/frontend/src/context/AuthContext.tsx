import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProfile, UserProfile } from '../api/user';
import { getToken, clearToken } from '../api/token';

/** Explicit state machine for the auth + onboarding flow */
export type AuthStatus =
  | 'loading'           // initial fetch in progress
  | 'unauthenticated'   // no token / token invalid
  | 'needs_profile'     // logged in but profileComplete = false
  | 'needs_survey'      // profileComplete but surveyComplete = false
  | 'ready';            // fully onboarded

function computeStatus(user: UserProfile | null, isLoading: boolean): AuthStatus {
  if (isLoading) return 'loading';
  if (!user) return 'unauthenticated';
  if (!user.profileComplete) return 'needs_profile';
  if (!user.surveyComplete) return 'needs_survey';
  return 'ready';
}

interface AuthContextType {
  user: UserProfile | null;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      setUser(null);
      clearToken();
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false);
      return;
    }
    refreshUser().finally(() => setIsLoading(false));
  }, []);

  const authStatus = computeStatus(user, isLoading);

  return (
    <AuthContext.Provider value={{ user, authStatus, isAuthenticated: !!user, isLoading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
