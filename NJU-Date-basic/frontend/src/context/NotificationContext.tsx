import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  clearNotificationCache,
  getUnreadCount,
  primeUnreadCountCache,
} from '../api/notifications';
import { useAuth } from './AuthContext';

interface FetchUnreadOptions {
  force?: boolean;
}

interface NotificationContextType {
  unreadCount: number;
  fetchUnreadCount: (options?: FetchUnreadOptions) => Promise<void>;
  decrementUnread: (count?: number) => void;
  setUnread: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async (options: FetchUnreadOptions = {}) => {
    if (!isAuthenticated) return;

    const res = await getUnreadCount({ force: options.force });
    setUnreadCount(res.unreadCount ?? 0);
  }, [isAuthenticated]);

  const setUnread = useCallback((count: number) => {
    const next = Math.max(0, count);
    primeUnreadCountCache(next);
    setUnreadCount(next);
  }, []);

  const decrementUnread = useCallback((count = 1) => {
    setUnreadCount((current) => {
      const next = Math.max(0, current - count);
      primeUnreadCountCache(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchUnreadCount();
      return;
    }

    clearNotificationCache();
    setUnreadCount(0);
  }, [isAuthenticated, fetchUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, fetchUnreadCount, decrementUnread, setUnread }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return ctx;
};
