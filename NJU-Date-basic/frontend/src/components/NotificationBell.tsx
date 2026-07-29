import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  NotificationItem,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/user';
import { toast } from './Toast';
import MaterialIcon from './MaterialIcon';

function readMetaString(meta: NotificationItem['meta'], key: string) {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function getNotificationIcon(type: string) {
  if (type.startsWith('teamup_')) return 'groups';
  if (type.startsWith('friend_')) return 'person_add';
  if (type.startsWith('contact_')) return 'contact_mail';
  if (type.startsWith('circle_')) return 'diversity_3';
  if (type.startsWith('post_') || type.startsWith('comment_')) return 'forum';
  return 'notifications';
}

function getNotificationTarget(notification: NotificationItem) {
  const actionUrl = readMetaString(notification.meta, 'actionUrl');
  if (actionUrl?.startsWith('/')) return actionUrl;

  const postId = readMetaString(notification.meta, 'postId');
  if (postId) return `/forum/${postId}`;

  const circleId = readMetaString(notification.meta, 'circleId');
  const teamupId = readMetaString(notification.meta, 'teamupId');
  if (circleId && teamupId) return `/circles/${circleId}/teamups/${teamupId}`;
  if (circleId) return `/circles/${circleId}`;

  return '/dashboard';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationBell() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const shouldRender = isAuthenticated && !isLoading && location.pathname !== '/login';
  const displayCount = useMemo(() => (unreadCount > 99 ? '99+' : String(unreadCount)), [unreadCount]);

  const refreshUnreadCount = async () => {
    if (!shouldRender) return;
    try {
      const res = await getUnreadNotificationCount();
      setUnreadCount(res.unreadCount);
    } catch {
      setUnreadCount(0);
    }
  };

  const loadNotifications = async () => {
    if (!shouldRender) return;
    setLoadingList(true);
    try {
      const res = await getNotifications({ page: 1, limit: 12 });
      setNotifications(res.notifications || []);
    } catch (err: any) {
      toast.error(err.message || '通知加载失败');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!shouldRender) return;
    void refreshUnreadCount();
    const timer = window.setInterval(() => {
      void refreshUnreadCount();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [shouldRender]);

  useEffect(() => {
    if (open) void loadNotifications();
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!shouldRender) return null;

  const handleOpen = () => {
    setOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    try {
      if (!notification.isRead) {
        await markNotificationRead(notification.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Navigation is still useful even if marking read fails.
    }
    navigate(getNotificationTarget(notification));
  };

  const handleMarkAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      toast.success('已全部标为已读');
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 md:right-6">
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#EAE7E1]/80 bg-[#FCFBF8]/95 text-[#420047] shadow-[0_10px_30px_rgba(66,0,71,0.16)] backdrop-blur transition-transform hover:-translate-y-0.5"
        aria-label="站内通知"
        title="站内通知"
      >
        <MaterialIcon name={open ? 'notifications_active' : 'notifications'} className="text-[23px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B94A48] px-1 text-[10px] font-semibold text-white">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-14 right-0 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] shadow-[0_18px_55px_rgba(44,40,37,0.16)]">
          <div className="flex items-center justify-between border-b border-[#EAE7E1] px-4 py-3">
            <div>
              <div className="font-serif text-sm tracking-widest text-[#2C2825]">站内通知</div>
              <div className="mt-0.5 text-[11px] text-[#8B7355]">{unreadCount > 0 ? `${unreadCount} 条未读` : '暂无未读'}</div>
            </div>
            <button
              type="button"
              disabled={markingAll || unreadCount === 0}
              onClick={handleMarkAll}
              className="rounded-full border border-[#EAE7E1] px-3 py-1.5 text-[11px] text-[#8B7355] transition-colors hover:border-[#420047]/30 hover:text-[#420047] disabled:cursor-not-allowed disabled:opacity-45"
            >
              全部已读
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loadingList ? (
              <div className="px-6 py-12 text-center text-sm font-serif text-[#8B7355]">正在翻检通知...</div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <MaterialIcon name="notifications_off" className="mb-2 text-[28px] text-[#8B7355]/60" />
                <p className="font-serif text-sm text-[#8B7355]">暂时没有通知</p>
              </div>
            ) : (
              <div className="divide-y divide-[#EAE7E1]">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F3F1ED]"
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      notification.isRead ? 'bg-[#EAE7E1]/70 text-[#8B7355]' : 'bg-[#420047]/10 text-[#420047]'
                    }`}>
                      <MaterialIcon name={getNotificationIcon(notification.type)} className="text-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`truncate text-sm ${notification.isRead ? 'text-[#5E5855]' : 'font-semibold text-[#2C2825]'}`}>
                          {notification.title}
                        </span>
                        {!notification.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#B94A48]" />}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-[#8B7355]">{notification.content}</span>
                      <span className="mt-1 block text-[10px] text-[#8B7355]/55">{formatTime(notification.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
