import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getGuestbookMessages, createGuestbookMessage, deleteGuestbookMessage } from '../api/forum';
import type { GuestbookMessage } from '../api/forum';
import { toast } from '../components/Toast';
import { ApiError } from '../api/client';

const PAGE_LIMIT = 20;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffH < 24) return `${diffH} 小时前`;
  if (diffD < 7) return `${diffD} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function Guestbook() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await getGuestbookMessages({ page: targetPage, limit: PAGE_LIMIT });
      setMessages((prev) => (targetPage === 1 ? res.messages : [...prev, ...res.messages]));
      setTotal(res.total);
      setPage(targetPage);
    } catch {
      toast.error('加载留言失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages(1);
  }, [fetchMessages]);

  // Silent poll every 30s — refresh page 1 while preserving any manually loaded pages
  const silentRefresh = useCallback(async () => {
    try {
      const res = await getGuestbookMessages({ page: 1, limit: PAGE_LIMIT });
      setMessages((prev) => {
        const extraPages = prev.slice(PAGE_LIMIT);
        return [...res.messages, ...extraPages];
      });
      setTotal(res.total);
    } catch {
      // silently ignore poll errors
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(silentRefresh, 30_000);
    return () => clearInterval(timer);
  }, [silentRefresh]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > 200) {
      toast.error('留言不能超过 200 字');
      return;
    }
    setSending(true);
    try {
      await createGuestbookMessage(trimmed);
      toast.success('留言成功');
      setContent('');
      await fetchMessages(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '留言失败');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!window.confirm('确定删除这条留言吗？')) return;
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await deleteGuestbookMessage(messageId);
    } catch (err) {
      setMessages(snapshot);
      toast.error(err instanceof ApiError ? err.message : '删除失败');
    }
  };

  const handleAuthorClick = (userId?: string | null) => {
    if (!userId) return;
    navigate(`/user/${userId}`);
  };

  const hasMore = messages.length < total;

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans selection:bg-[#420047] selection:text-white px-4 md:px-6 py-12">
      <div className="max-w-xl mx-auto">
        {/* Back navigation */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-[#8B7355] hover:text-[#2C2825] transition-colors mb-8"
        >
          <span className="text-lg leading-none">←</span>
          <span>返回论坛</span>
        </motion.button>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-serif text-[#2C2825] tracking-wide">
            留 言 板
          </h1>
          <p className="text-sm text-[#8B7355] mt-2">留下你的足迹，墨痕即是相逢</p>
          <div className="w-16 h-[1px] bg-[#420047]/30 mt-3" />
        </motion.div>

        {/* Input area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] mb-8"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在此留下你想说的话..."
            maxLength={200}
            rows={3}
            className="w-full bg-transparent text-sm text-[#2C2825] placeholder:text-[#8B7355]/50 outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3">
            <span className={`text-[10px] ${content.length > 180 ? 'text-red-400' : 'text-[#8B7355]/50'}`}>
              {content.length}/200
            </span>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || sending}
              className="px-5 py-2 rounded-full bg-[#420047] text-[#FCFBF8] text-xs tracking-widest hover:bg-[#2A002D] transition-colors disabled:bg-[#EAE7E1] disabled:text-[#8B7355]/50 disabled:cursor-not-allowed shadow-md"
            >
              {sending ? '发送中...' : '留下墨痕'}
            </button>
          </div>
        </motion.div>

        {/* Message list */}
        {loading ? (
          <div className="text-center text-[#8B7355] mt-16 animate-pulse font-serif">
            卷轴正在展开...
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-[#8B7355] font-serif text-lg">尚无留言</p>
            <p className="text-[#8B7355]/60 text-sm mt-2">不妨做第一位留墨人</p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                variants={itemVariants}
                className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] relative group"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <button
                    type="button"
                    onClick={() => handleAuthorClick(msg.author.userId)}
                    className="w-9 h-9 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center text-xs font-serif shrink-0 overflow-hidden hover:opacity-85 transition-opacity"
                    aria-label={`查看 ${msg.author.nickname || '访客'} 的主页`}
                  >
                    {msg.author.avatarUrl ? (
                      <img src={msg.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (msg.author.nickname || '?')[0]
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => handleAuthorClick(msg.author.userId)}
                        className="text-sm font-medium text-[#2C2825] hover:text-[#420047] transition-colors"
                      >
                        {msg.author.nickname || '访客'}
                      </button>
                      <span className="text-[11px] text-[#8B7355]/50">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#2C2825] leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
                {currentUserId && msg.author.userId === currentUserId && (
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="absolute top-2 right-3 w-6 h-6 flex items-center justify-center rounded-full text-[#8B7355]/40 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    title="删除留言"
                  >
                    <span className="text-sm leading-none">×</span>
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-6"
          >
            <button
              onClick={() => fetchMessages(page + 1)}
              className="px-6 py-2.5 rounded-full border border-[#8B7355]/30 text-sm text-[#8B7355] hover:border-[#420047]/40 hover:text-[#420047] transition-all duration-300"
            >
              加载更多
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
