import { api } from './client';

// ─── Types ─────────────────────────────────────────────────────

/** 消息级别 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'critical';

/** 消息类型（对应 MESSAGE_CENTER_DESIGN.md §5） */
export type NotificationType =
  | 'match_revealed'
  | 'match_no_result'
  | 'match_mutual_success'
  | 'match_expiring'
  | 'survey_update_required'
  | 'survey_incomplete'
  | 'policy_update'
  | 'system_announcement'
  | 'report_result';

/** 消息分类（前端按 category 分组显示图标/颜色） */
export type NotificationCategory = 'match' | 'survey' | 'system' | 'report';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  level: NotificationLevel;
  actionUrl: string | null;
  meta: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface NotificationListResponse {
  total: number;
  page: number;
  limit: number;
  items: NotificationItem[];
}

export interface UnreadCountResponse {
  unreadCount: number;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const NOTIFICATION_LIST_TTL_MS = 15_000;
const UNREAD_COUNT_TTL_MS = 30_000;

const notificationListCache = new Map<string, CacheEntry<NotificationListResponse>>();
const pendingNotificationLists = new Map<string, Promise<NotificationListResponse>>();
let unreadCountCache: CacheEntry<UnreadCountResponse> | null = null;
let pendingUnreadCount: Promise<UnreadCountResponse> | null = null;

function isFresh(fetchedAt: number, ttlMs: number) {
  return Date.now() - fetchedAt < ttlMs;
}

function getNotificationListCacheKey(params?: {
  page?: number;
  limit?: number;
  status?: 'all' | 'unread' | 'read';
}) {
  return JSON.stringify({
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    status: params?.status ?? 'all',
  });
}

function clearNotificationListCache() {
  notificationListCache.clear();
  pendingNotificationLists.clear();
}

export function clearNotificationCache() {
  clearNotificationListCache();
  unreadCountCache = null;
  pendingUnreadCount = null;
}

export function primeUnreadCountCache(unreadCount: number) {
  unreadCountCache = {
    data: { unreadCount: Math.max(0, unreadCount) },
    fetchedAt: Date.now(),
  };
}

function decrementUnreadCountCache(count = 1) {
  if (!unreadCountCache) return;
  primeUnreadCountCache(unreadCountCache.data.unreadCount - count);
}

// ─── API Functions ─────────────────────────────────────────────

/** 获取消息列表（分页） */
export function getNotifications(params?: {
  page?: number;
  limit?: number;
  status?: 'all' | 'unread' | 'read';
}) {
  const cacheKey = getNotificationListCacheKey(params);
  const cached = notificationListCache.get(cacheKey);
  if (cached && isFresh(cached.fetchedAt, NOTIFICATION_LIST_TTL_MS)) {
    return Promise.resolve(cached.data);
  }

  const pending = pendingNotificationLists.get(cacheKey);
  if (pending) return pending;

  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.status) sp.set('status', params.status);
  const qs = sp.toString();
  const request = api.get<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ''}`)
    .then((res) => {
      notificationListCache.set(cacheKey, { data: res, fetchedAt: Date.now() });
      return res;
    })
    .finally(() => {
      pendingNotificationLists.delete(cacheKey);
    });

  pendingNotificationLists.set(cacheKey, request);
  return request;
}

/** 获取未读消息数量 */
export function getUnreadCount(options: { force?: boolean } = {}) {
  if (!options.force && unreadCountCache && isFresh(unreadCountCache.fetchedAt, UNREAD_COUNT_TTL_MS)) {
    return Promise.resolve(unreadCountCache.data);
  }

  if (!options.force && pendingUnreadCount) return pendingUnreadCount;

  const request = api.get<UnreadCountResponse>('/notifications/unread-count')
    .then((res) => {
      unreadCountCache = { data: res, fetchedAt: Date.now() };
      return res;
    })
    .finally(() => {
      pendingUnreadCount = null;
    });

  pendingUnreadCount = request;
  return request;
}

/** 标记单条消息为已读 */
export function markAsRead(notificationId: string) {
  return api.post<{ message: string }>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
  ).then((res) => {
    clearNotificationListCache();
    decrementUnreadCountCache(1);
    return res;
  });
}

/** 标记全部消息为已读 */
export function markAllAsRead() {
  return api.post<{ message: string; updated: number }>('/notifications/read-all', {})
    .then((res) => {
      clearNotificationListCache();
      primeUnreadCountCache(0);
      return res;
    });
}

// ─── Helpers ───────────────────────────────────────────────────

/** 根据 type 推断分类 */
export function getCategory(type: NotificationType): NotificationCategory {
  if (type.startsWith('match_')) return 'match';
  if (type.startsWith('survey_')) return 'survey';
  if (type === 'report_result') return 'report';
  return 'system';
}

/** 类型 → 显示标签 */
export const TYPE_TAG_MAP: Record<NotificationType, string> = {
  match_revealed: '匹配',
  match_no_result: '匹配',
  match_mutual_success: '匹配',
  match_expiring: '匹配',
  survey_update_required: '问卷',
  survey_incomplete: '问卷',
  policy_update: '系统',
  system_announcement: '系统',
  report_result: '举报',
};

/** 类型 → Material Symbol 图标名 */
export const TYPE_ICON_MAP: Record<NotificationType, string> = {
  match_revealed: 'mail',
  match_no_result: 'heart_broken',
  match_mutual_success: 'favorite',
  match_expiring: 'schedule',
  survey_update_required: 'edit_note',
  survey_incomplete: 'assignment_late',
  policy_update: 'policy',
  system_announcement: 'campaign',
  report_result: 'gavel',
};
