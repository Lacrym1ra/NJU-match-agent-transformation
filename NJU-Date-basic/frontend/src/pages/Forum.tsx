import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  getPosts,
  getAnnouncements,
  submitForumReport,
  likePost,
  unlikePost,
  favoritePost,
  unfavoritePost,
} from '../api/forum';
import { ApiError } from '../api/client';
import type { PostListItem, ForumPostType, ForumSort, AnnouncementItem } from '../api/forum';
import { toast } from '../components/Toast';
import PostCard from '../components/forum/PostCard';
import PostTypeFilter from '../components/forum/PostTypeFilter';
import PostForm from '../components/forum/PostForm';
import HotRankingSidebar from '../components/forum/HotRankingSidebar';
import GuestbookMarquee from '../components/forum/GuestbookMarquee';
import AnnouncementModal from '../components/forum/AnnouncementModal';
import ReportDialog from '../components/forum/ReportDialog';
import MaterialIcon from '../components/MaterialIcon';
import { getCreditStatus, type CreditStatus } from '../api/user';

const PAGE_LIMIT = 20;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function Forum() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const typeParam = searchParams.get('type') as ForumPostType | null;
  const sortParam = searchParams.get('sort') as ForumSort | null;
  const openCreate = searchParams.get('openCreate') === 'true';

  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<ForumPostType | null>(
    ['general', 'squad', 'help', 'trade', 'activity'].includes(typeParam || '') ? typeParam : null,
  );
  const [sort, setSort] = useState<ForumSort>(
    () => (['latest', 'hot', 'recommended'].includes(sortParam || '') ? sortParam : 'latest') as ForumSort,
  );
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(openCreate);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [creditCardExpanded, setCreditCardExpanded] = useState(false);

  // Clear openCreate param after reading it
  useEffect(() => {
    if (openCreate) {
      const next = new URLSearchParams(searchParams);
      next.delete('openCreate');
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Fetch announcements
  useEffect(() => {
    getAnnouncements()
      .then((anns) => setAnnouncements(anns))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getCreditStatus()
      .then((res) => setCreditStatus(res))
      .catch(() => {});
  }, []);

  // Persist sort preference to both sessionStorage and URL params
  useEffect(() => {
    sessionStorage.setItem('forumSort', sort);
    const next = new URLSearchParams(searchParams);
    if (sort !== 'latest') {
      next.set('sort', sort);
    } else {
      next.delete('sort');
    }
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const fetchPosts = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await getPosts({
          type: typeFilter || undefined,
          page: targetPage,
          limit: PAGE_LIMIT,
          sort,
          keyword: searchKeyword.trim() || undefined,
        });
        setPosts((prev) => (append ? [...prev, ...res.posts] : res.posts));
        setTotal(res.total);
        setPage(targetPage);
      } catch {
        toast.error('加载帖子失败，请稍后重试');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [typeFilter, sort, searchKeyword],
  );

  // Initial fetch / re-fetch on filter change
  useEffect(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  const handleTypeChange = (t: ForumPostType | null) => {
    setTypeFilter(t);
    const next = new URLSearchParams(searchParams);
    if (t) next.set('type', t);
    else next.delete('type');
    setSearchParams(next, { replace: true });
  };

  const handleLoadMore = () => {
    fetchPosts(page + 1, true);
  };

  const handlePostClick = (postId: string) => {
    sessionStorage.setItem('forumSort', sort);
    navigate(`/forum/${postId}`);
  };

  const handlePreviewLike = async (postId: string) => {
    const target = posts.find((p) => p.postId === postId);
    if (!target) return;
    const willLike = !target.likedByMe;

    setPosts((prev) => prev.map((p) => (p.postId === postId
      ? { ...p, likedByMe: willLike, likeCount: Math.max(0, p.likeCount + (willLike ? 1 : -1)) }
      : p)));
    try {
      if (willLike) await likePost(postId);
      else await unlikePost(postId);
    } catch {
      setPosts((prev) => prev.map((p) => (p.postId === postId ? target : p)));
      toast.error('点赞失败，请稍后重试');
    }
  };

  const handlePreviewFavorite = async (postId: string) => {
    const target = posts.find((p) => p.postId === postId);
    if (!target) return;
    const willFavorite = !target.favoritedByMe;

    setPosts((prev) => prev.map((p) => (p.postId === postId
      ? { ...p, favoritedByMe: willFavorite, favoriteCount: Math.max(0, p.favoriteCount + (willFavorite ? 1 : -1)) }
      : p)));
    try {
      if (willFavorite) await favoritePost(postId);
      else await unfavoritePost(postId);
    } catch {
      setPosts((prev) => prev.map((p) => (p.postId === postId ? target : p)));
      toast.error('收藏失败，请稍后重试');
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchPosts(1, false);
  };

  const hasMore = posts.length < total;
  const reportTargetPost = reportPostId ? posts.find((p) => p.postId === reportPostId) ?? null : null;

  const showRightSidebar = true;

  const sidebarRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [leftMaxH, setLeftMaxH] = useState<number | undefined>();

  // ─── Sync left panel height to sidebar height ────────────────
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setLeftMaxH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Right Sidebar content (shared) ─────────────────────────────
  const creditStatusTitle = creditStatus?.status === 'cooldown'
    ? `还有 ${creditStatus.daysToRecoveryStart} 天开始恢复信用分`
    : creditStatus?.status === 'recovering'
      ? '信用分恢复中'
      : '你好，满分用户';

  const creditRules = [
    '信用分初始为 100 分，最低为 0 分。',
    '举报审核通过后会扣分，分为 1 / 3 / 5 三档。',
    '信用分 <= 90：暂停一周匹配。',
    '信用分 <= 85：禁止论坛发帖和评论。',
    '恢复规则：冷却期结束后，每 2 天恢复 1 分，最高恢复到 100 分。',
    '冷却期：L1/L2/L3 分别为 7/7/14 天；若出现新的举报通过，冷却期重新计算。',
  ];

  const rightSidebar = showRightSidebar ? (
    <div ref={sidebarRef} className="space-y-5">
      <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <button
          onClick={() => setCreditCardExpanded((prev) => !prev)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-serif text-[#2C2825] tracking-wide">信用分中心</div>
              <div className="mt-1 text-xs text-[#8B7355]">{creditStatusTitle}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-serif text-[#420047] tabular-nums">
                {creditStatus?.creditScore ?? user?.creditScore ?? 100}
              </span>
              <MaterialIcon name={creditCardExpanded ? 'expand_less' : 'expand_more'} className="text-[#8B7355]" />
            </div>
          </div>
        </button>
        {creditCardExpanded && (
          <div className="mt-3 border-t border-[#EAE7E1] pt-3 space-y-1.5">
            {creditRules.map((rule) => (
              <p key={rule} className="text-[12px] leading-5 text-[#5E5855]">
                {rule}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Announcements */}
      {showAnnouncements && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="campaign" className="text-[18px] text-[#420047]" />
            <span className="text-sm font-serif text-[#2C2825] tracking-wide">公 告</span>
          </div>
          {announcements.length === 0 ? (
            <p className="text-center text-xs text-[#8B7355]/60 py-2">暂无公告</p>
          ) : (
            <div className="space-y-0.5">
              {announcements.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAnnId(a.id)}
                  className="w-full flex items-center justify-between gap-2 py-1.5 px-1 rounded-md hover:bg-[#EAE7E1]/40 transition-colors text-left"
                >
                  <span className="text-xs text-[#5E5855] truncate flex-1 min-w-0">
                    {a.title}
                  </span>
                  <span className="text-[10px] text-[#8B7355]/50 shrink-0 tabular-nums">
                    {new Date(a.createdAt).toLocaleDateString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                    }).replace('/', '-')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hot ranking sidebar */}
      <HotRankingSidebar />

      {/* Guestbook marquee */}
      <GuestbookMarquee />
    </div>
  ) : null;

  return (
    <>
    <style>{`
      .forum-scrollbar::-webkit-scrollbar { width: 4px; }
      .forum-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .forum-scrollbar::-webkit-scrollbar-thumb { background: rgba(139,115,85,0.2); border-radius: 2px; }
      .forum-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(139,115,85,0.4); }
      .forum-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(139,115,85,0.2) transparent; }
    `}</style>
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans selection:bg-[#420047] selection:text-white px-4 md:px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-sm text-[#8B7355] hover:text-[#2C2825] transition-colors"
          >
            <span className="text-lg leading-none">←</span>
            <span>返回档案</span>
          </button>
        </motion.div>

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-5xl font-serif text-[#2C2825] tracking-wide">
            论 坛
          </h1>
          <div className="w-16 h-[1px] bg-[#420047]/30 mt-3" />

          {/* Quick links (full site only) */}
          {showRightSidebar && (
            <div className="flex items-center gap-4 mt-4 lg:hidden">
              <button
                onClick={() => navigate('/forum/ranking')}
                className="inline-flex items-center gap-1 text-xs text-[#8B7355] hover:text-[#420047] transition-colors"
              >
                <MaterialIcon name="local_fire_department" className="text-[14px] leading-none" />
                热榜
              </button>
              <button
                onClick={() => navigate('/forum/guestbook')}
                className="inline-flex items-center gap-1 text-xs text-[#8B7355] hover:text-[#420047] transition-colors"
              >
                <MaterialIcon name="book" className="text-[14px] leading-none" />
                留言板
              </button>
            </div>
          )}
        </motion.div>

        {/* ─── Dual-column layout ────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: main content */}
          <div
            ref={leftPanelRef}
            className="flex-1 min-w-0 lg:flex lg:flex-col"
            style={leftMaxH ? { maxHeight: `${leftMaxH}px` } : undefined}
          >
            {/* Top bar: sort + filter + create CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-3 mb-8"
            >
              {/* Row 1: sort + create */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-[#EAE7E1]/50 rounded-full p-0.5">
                  <button
                    onClick={() => setSort('recommended')}
                    className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                      sort === 'recommended'
                        ? 'bg-white text-[#2C2825] shadow-sm'
                        : 'text-[#8B7355] hover:text-[#2C2825]'
                    }`}
                  >
                    推荐
                  </button>
                  <button
                    onClick={() => setSort('latest')}
                    className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                      sort === 'latest'
                        ? 'bg-white text-[#2C2825] shadow-sm'
                        : 'text-[#8B7355] hover:text-[#2C2825]'
                    }`}
                  >
                    最新
                  </button>
                  <button
                    onClick={() => setSort('hot')}
                    className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                      sort === 'hot'
                        ? 'bg-white text-[#2C2825] shadow-sm'
                        : 'text-[#8B7355] hover:text-[#2C2825]'
                    }`}
                  >
                    最热
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-sm">
                  <div className="relative flex-1">
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSearchKeyword(keyword);
                        }
                      }}
                      placeholder="搜索帖子标题和正文"
                      className="w-full px-3 pr-8 py-2 rounded-full border border-[#EAE7E1] bg-white text-sm text-[#2C2825] placeholder:text-[#8B7355]/60 outline-none focus:border-[#420047]"
                    />
                    {(keyword.length > 0 || searchKeyword.length > 0) && (
                      <button
                        onClick={() => {
                          setKeyword('');
                          setSearchKeyword('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 text-[#8B7355]/60 hover:text-[#420047] transition-colors"
                        aria-label="清空搜索"
                        title="清空"
                      >
                        <MaterialIcon name="close" className="text-[14px] leading-none block" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSearchKeyword(keyword);
                    }}
                    className="shrink-0 px-3 py-2 rounded-full border border-[#EAE7E1] text-xs text-[#8B7355] hover:text-[#420047] hover:border-[#420047]/30 transition-colors"
                  >
                    搜索
                  </button>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="shrink-0 ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#420047] text-[#FCFBF8] text-sm tracking-widest hover:bg-[#2A002D] transition-colors shadow-md"
                >
                  <span className="text-lg leading-none">+</span>
                  新建帖子
                </button>
              </div>

              {/* Row 2: type filter */}
              <div className="flex items-center gap-4">
                <PostTypeFilter active={typeFilter} onChange={handleTypeChange} />
              </div>
            </motion.div>

            <div ref={scrollContainerRef} className="lg:flex-1 lg:overflow-y-auto forum-scrollbar lg:pr-3 lg:-mr-2 pb-4">
              {/* Post list */}
              {loading ? (
                <div className="text-center text-[#8B7355] mt-20 animate-pulse font-serif">
                  墨迹未干，卷轴正在展开...
                </div>
              ) : posts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <p className="text-[#8B7355] font-serif text-lg">此处尚无帖子</p>
                  <p className="text-[#8B7355]/60 text-sm mt-2">不妨留下第一笔墨痕</p>
                </motion.div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {posts.map((post) => (
                    <PostCard
                      key={post.postId}
                      post={post}
                      onClick={() => handlePostClick(post.postId)}
                      onReport={(pid) => setReportPostId(pid)}
                      onLike={handlePreviewLike}
                      onFavorite={handlePreviewFavorite}
                      variants={itemVariants}
                    />
                  ))}
                </motion.div>
              )}

              {/* Load more */}
              {hasMore && !loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mt-8"
                >
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-full border border-[#8B7355]/30 text-sm text-[#8B7355] hover:border-[#420047]/40 hover:text-[#420047] transition-all duration-300 disabled:opacity-50"
                  >
                    {loadingMore ? '加载中...' : '加载更多'}
                  </button>
                </motion.div>
              )}

              {/* Total count */}
              {total > 0 && (
                <p className="text-center text-xs text-[#8B7355]/50 mt-6">
                  共 {total} 篇帖子
                </p>
              )}

              {/* Mobile: right sidebar content below posts */}
              {showRightSidebar && (
                <div className="lg:hidden mt-8">{rightSidebar}</div>
              )}
            </div>
          </div>

          {/* Right: sidebar (desktop only) */}
          {showRightSidebar && (
            <aside className="hidden lg:block w-80 shrink-0">{rightSidebar}</aside>
          )}
        </div>
      </div>

      {/* Create post modal */}
        <PostForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
          circleId={null}
          circleName=""
          defaultType="general"
          profileComplete={user?.profileComplete ?? false}
        />

      {/* Announcement detail modal */}
      <AnnouncementModal
        announcementId={selectedAnnId}
        onClose={() => setSelectedAnnId(null)}
      />

      <ReportDialog
        open={!!reportPostId}
        targetLabel={reportTargetPost ? `帖子《${reportTargetPost.title}》` : '帖子'}
        submitting={submittingReport}
        onClose={() => {
          if (!submittingReport) setReportPostId(null);
        }}
        onSubmit={async ({ reasons, detail }) => {
          if (!reportPostId) return;
          if (reasons.length === 0) {
            toast.error('请至少选择一个举报原因');
            return;
          }
          setSubmittingReport(true);
          try {
            const res = await submitForumReport({
              targetType: 'post',
              postId: reportPostId,
              reasons,
              detail,
            });
            toast.success(res.message || '举报已提交，等待管理员审核');
            setReportPostId(null);
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : '举报提交失败，请稍后重试');
          } finally {
            setSubmittingReport(false);
          }
        }}
      />
    </div>
    </>
  );
}
