import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useNotification } from '../context/NotificationContext';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getCategory,
  TYPE_TAG_MAP,
  TYPE_ICON_MAP,
  type NotificationItem,
  type NotificationType,
  type NotificationCategory,
} from '../api/notifications';
import { useToast } from '../components/Toast';

const PAGE_LIMIT = 20;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const LEVEL_LABEL: Record<string, string> = {
  info: '通知',
  success: '成功',
  warning: '提醒',
  critical: '紧急',
};

const CATEGORY_ICON_BG: Record<NotificationCategory, string> = {
  match: 'bg-[#420047]/8 text-[#420047]',
  survey: 'bg-blue-500/8 text-blue-600',
  system: 'bg-amber-500/8 text-amber-600',
  report: 'bg-red-500/8 text-red-500',
};

const CATEGORY_TAG_BG: Record<NotificationCategory, string> = {
  match: 'bg-[#420047]/8 text-[#420047]',
  survey: 'bg-blue-500/8 text-blue-600',
  system: 'bg-amber-500/8 text-amber-600',
  report: 'bg-red-500/8 text-red-500',
};

// ── Component ────────────────────────────────────────────────

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { unreadCount, fetchUnreadCount, decrementUnread, setUnread } = useNotification();
  const toast = useToast();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // ── Data Fetching ──

  const fetchData = useCallback(async (p: number, f: 'all' | 'unread', append = false) => {
    try {
      const listRes = await getNotifications({
        page: p,
        limit: PAGE_LIMIT,
        status: f === 'unread' ? 'unread' : undefined,
      });
      setItems((prev) => (append ? [...prev, ...(listRes.items ?? [])] : (listRes.items ?? [])));
      setTotal(listRes.total);
    } catch (err) {
      console.warn('加载消息列表失败', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchData(1, filter);
    void fetchUnreadCount();
  }, [filter, fetchData, fetchUnreadCount]);

  // ── Handlers ──

  const handleMarkRead = useCallback(async (item: NotificationItem) => {
    if (item.isRead) {
      // 已读消息直接跳转
      if (item.actionUrl) navigate(item.actionUrl);
      return;
    }
    try {
      await markAsRead(item.id);
      setItems((prev) => {
        if (filter === 'unread') {
          return prev.filter((n) => n.id !== item.id);
        }
        return prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n));
      });
      if (filter === 'unread') {
        setTotal((current) => Math.max(0, current - 1));
      }
      decrementUnread();
      if (item.actionUrl) navigate(item.actionUrl);
    } catch {
      toast.warning('标记已读失败');
    }
  }, [decrementUnread, filter, navigate, toast]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const res = await markAllAsRead();
      if (filter === 'unread') {
        setItems([]);
        setTotal(0);
      } else {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
      setUnread(0);
      toast.success(`已将 ${res.updated} 条消息标记为已读`);
    } catch {
      toast.warning('操作失败，请稍后重试');
    }
  }, [filter, setUnread, toast]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    void fetchData(nextPage, filter, true);
  }, [page, filter, fetchData]);

  // ── Skeleton ──

  const skeletonItems = Array.from({ length: 5 }, (_, i) => (
    <div key={`sk-${i}`} className="flex gap-3.5 rounded-[14px] border border-[#EAE7E1] bg-white p-4 sm:p-5">
      <div className="w-10 h-10 rounded-xl bg-[#F3F1ED] animate-pulse shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3.5 rounded bg-[#F3F1ED] animate-pulse w-3/5" />
        <div className="h-3 rounded bg-[#F3F1ED] animate-pulse w-4/5" />
        <div className="h-2.5 rounded bg-[#F3F1ED] animate-pulse w-1/3" />
      </div>
    </div>
  ));

  // ── Render ──

  return (
    <div className="min-h-screen bg-[#FCFBF8]">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-24 pb-20">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between mb-7"
        >
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-full border border-[#EAE7E1] bg-[#FCFBF8] flex items-center justify-center hover:border-[#420047] hover:bg-[#420047]/5 transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-[#8B7355]">arrow_back</span>
          </button>

          <div className="text-center">
            <h1 className="font-serif text-xl sm:text-[22px] text-[#2C2825] tracking-[0.05em]">消息中心</h1>
            <p className="text-[11px] text-[#8B7355] tracking-[0.15em] mt-0.5">MESSAGE CENTER</p>
          </div>

          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0}
            className="px-4 py-1.5 rounded-full border border-[#EAE7E1] bg-[#FCFBF8] text-[12px] text-[#8B7355] tracking-[0.04em] hover:border-[#420047] hover:text-[#420047] hover:bg-[#420047]/3 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#EAE7E1] disabled:hover:text-[#8B7355] disabled:hover:bg-[#FCFBF8]"
          >
            全部已读
          </button>
        </motion.div>

        {/* ── Filter Bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-between mb-5"
        >
          <div className="flex gap-1 bg-[#EAE7E1]/50 rounded-full p-[3px]">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-5 py-1.5 rounded-full text-[13px] transition-all ${
                  filter === f
                    ? 'bg-white text-[#2C2825] font-medium shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                    : 'text-[#8B7355] hover:text-[#2C2825]'
                }`}
              >
                {f === 'all' ? '全部' : '未读'}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-[#8B7355]">
            <strong className="text-[#420047] font-semibold">{unreadCount}</strong> 条未读
          </span>
        </motion.div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex flex-col gap-2.5">{skeletonItems}</div>
        ) : items.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-[#F3F1ED] mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-[#8B7355]/40">notifications_none</span>
            </div>
            <p className="font-serif text-base text-[#8B7355]">
              {filter === 'unread' ? '暂无未读消息' : '暂无消息'}
            </p>
            <p className="text-[13px] text-[#8B7355]/50 mt-1">
              {filter === 'unread' ? '所有消息均已阅读' : '安静的信箱，等待信笺到来'}
            </p>
          </motion.div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2.5"
              >
                {items.map((n) => {
                  const cat = getCategory(n.type);
                  return (
                    <motion.div
                      key={n.id}
                      variants={itemVariants}
                      onClick={() => void handleMarkRead(n)}
                      className={`flex gap-3.5 rounded-[14px] border p-4 sm:p-5 cursor-pointer transition-all relative overflow-hidden hover:border-[#420047]/20 hover:shadow-[0_6px_24px_rgba(66,0,71,0.06)] hover:-translate-y-px ${
                        n.isRead
                          ? 'border-[#EAE7E1] bg-white'
                          : 'border-[#420047]/12 bg-[#420047]/2'
                      }`}
                    >
                      {/* Unread indicator bar */}
                      {!n.isRead && (
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded bg-gradient-to-b from-[#420047] to-[#a03960]" />
                      )}

                      {/* Type Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${CATEGORY_ICON_BG[cat]}`}>
                        <span className="material-symbols-outlined text-[20px]">
                          {TYPE_ICON_MAP[n.type] || 'notifications'}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className={`text-[14px] leading-snug ${n.isRead ? 'text-[#2C2825] font-normal' : 'text-[#1e1b1a] font-medium'}`}>
                            {n.title}
                            {n.level && n.level !== 'info' && (
                              <span className={`inline-flex items-center ml-1.5 px-1.5 py-[1px] rounded text-[10px] font-medium ${
                                n.level === 'success' ? 'bg-green-500/8 text-green-700'
                                  : n.level === 'warning' ? 'bg-amber-500/10 text-amber-700'
                                    : n.level === 'critical' ? 'bg-red-500/8 text-red-600'
                                      : 'bg-[#420047]/6 text-[#611066]'
                              }`}>
                                {LEVEL_LABEL[n.level] || ''}
                              </span>
                            )}
                          </h3>
                        </div>
                        <p className="text-[13px] text-[#5E5855] leading-relaxed line-clamp-2 mb-2">
                          {n.body}
                        </p>
                        <div className="flex items-center gap-2.5">
                          <span className={`inline-flex items-center px-2.5 py-[2px] rounded-full text-[11px] font-medium tracking-[0.02em] ${CATEGORY_TAG_BG[cat]}`}>
                            {TYPE_TAG_MAP[n.type] || '系统'}
                          </span>
                          <span className="text-[11px] text-[#8B7355]/60">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center shrink-0 self-center">
                        <span className="material-symbols-outlined text-[16px] text-[#8B7355]/30">chevron_right</span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* Load More */}
            {items.length < total && (
              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-7 py-2 rounded-full border border-[#8B7355]/30 text-[13px] text-[#8B7355] hover:border-[#420047]/40 hover:text-[#420047] transition-all disabled:opacity-50"
                >
                  {loadingMore ? '加载中…' : '加载更多'}
                </button>
              </div>
            )}

            <p className="text-center text-[12px] text-[#8B7355]/40 mt-4">
              共 {total} 条消息
            </p>
          </>
        )}
      </div>
    </div>
  );
}
