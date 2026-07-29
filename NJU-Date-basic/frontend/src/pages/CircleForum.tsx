import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getCircleDetail, type Circle } from '../api/circles';
import {
  favoritePost,
  getPosts,
  likePost,
  submitForumReport,
  unfavoritePost,
  unlikePost,
} from '../api/forum';
import type { ForumPostType, ForumSort, PostListItem } from '../api/forum';
import { ApiError } from '../api/client';
import { toast } from '../components/Toast';
import MaterialIcon from '../components/MaterialIcon';
import PostCard from '../components/forum/PostCard';
import PostForm from '../components/forum/PostForm';
import PostTypeFilter from '../components/forum/PostTypeFilter';
import ReportDialog from '../components/forum/ReportDialog';

const PAGE_LIMIT = 20;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};

export default function CircleForum() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<ForumPostType | null>(null);
  const [sort, setSort] = useState<ForumSort>('latest');
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCircleDetail(id)
      .then((res) => {
        const circleData = res.circle || (res as any);
        setCircle(circleData);
        if (!circleData.isJoined) {
          toast.warning('请先加入圈子后再查看圈内论坛');
          navigate(`/circles/${id}`, { replace: true });
        }
      })
      .catch((err) => {
        toast.error(err.message || '圈子信息加载失败');
        navigate('/circles', { replace: true });
      });
  }, [id, navigate]);

  const fetchPosts = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!id) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await getPosts({
          circleId: id,
          type: typeFilter || undefined,
          page: targetPage,
          limit: PAGE_LIMIT,
          sort,
          keyword: searchKeyword.trim() || undefined,
        });
        setPosts((prev) => (append ? [...prev, ...res.posts] : res.posts));
        setTotal(res.total);
        setPage(targetPage);
      } catch (err: any) {
        toast.error(err.message || '圈内帖子加载失败');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [id, typeFilter, sort, searchKeyword],
  );

  useEffect(() => {
    void fetchPosts(1, false);
  }, [fetchPosts]);

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    void fetchPosts(1, false);
  };

  const handlePreviewLike = async (postId: string) => {
    const target = posts.find((post) => post.postId === postId);
    if (!target) return;
    const willLike = !target.likedByMe;
    setPosts((prev) => prev.map((post) => (post.postId === postId
      ? { ...post, likedByMe: willLike, likeCount: Math.max(0, post.likeCount + (willLike ? 1 : -1)) }
      : post)));
    try {
      if (willLike) await likePost(postId);
      else await unlikePost(postId);
    } catch {
      setPosts((prev) => prev.map((post) => (post.postId === postId ? target : post)));
      toast.error('点赞失败，请稍后重试');
    }
  };

  const handlePreviewFavorite = async (postId: string) => {
    const target = posts.find((post) => post.postId === postId);
    if (!target) return;
    const willFavorite = !target.favoritedByMe;
    setPosts((prev) => prev.map((post) => (post.postId === postId
      ? { ...post, favoritedByMe: willFavorite, favoriteCount: Math.max(0, post.favoriteCount + (willFavorite ? 1 : -1)) }
      : post)));
    try {
      if (willFavorite) await favoritePost(postId);
      else await unfavoritePost(postId);
    } catch {
      setPosts((prev) => prev.map((post) => (post.postId === postId ? target : post)));
      toast.error('收藏失败，请稍后重试');
    }
  };

  const hasMore = posts.length < total;
  const reportTargetPost = reportPostId ? posts.find((post) => post.postId === reportPostId) ?? null : null;

  return (
    <div className="min-h-screen bg-[#FCFBF8] px-4 py-12 text-[#2C2825] selection:bg-[#420047] selection:text-white md:px-8">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigate(`/circles/${id}`)}
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#8B7355] transition-colors hover:text-[#2C2825]"
        >
          <MaterialIcon name="west" className="text-[18px]" />
          返回圈子大厅
        </button>

        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 border-b border-[#EAE7E1] pb-8"
        >
          <p className="mb-3 text-xs font-serif tracking-[0.3em] text-[#8B7355]">INTRA-CIRCLE FORUM</p>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-serif text-3xl tracking-widest text-[#2C2825] md:text-5xl">
                {circle?.name || '圈内'}论坛
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#8B7355]">
                只向本圈成员开放。发布时可选择是否同步一份公开副本到总论坛。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#420047] px-5 py-2.5 text-sm tracking-widest text-[#FCFBF8] shadow-md transition-colors hover:bg-[#2A002D]"
            >
              <MaterialIcon name="edit" className="text-[17px]" />
              新建圈内帖
            </button>
          </div>
        </motion.header>

        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-1 rounded-full bg-[#EAE7E1]/50 p-0.5">
              {(['latest', 'hot'] as ForumSort[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSort(item)}
                  className={`rounded-full px-4 py-1.5 text-xs transition-all ${
                    sort === item ? 'bg-white text-[#2C2825] shadow-sm' : 'text-[#8B7355] hover:text-[#2C2825]'
                  }`}
                >
                  {item === 'latest' ? '最新' : '最热'}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 gap-2 md:w-80">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setSearchKeyword(keyword);
                }}
                placeholder="搜索圈内帖子"
                className="min-w-0 flex-1 rounded-full border border-[#EAE7E1] bg-white px-4 py-2 text-sm outline-none transition-colors placeholder:text-[#8B7355]/50 focus:border-[#420047]/40"
              />
              <button
                type="button"
                onClick={() => setSearchKeyword(keyword)}
                className="shrink-0 rounded-full border border-[#EAE7E1] px-4 py-2 text-xs text-[#8B7355] transition-colors hover:border-[#420047]/30 hover:text-[#420047]"
              >
                搜索
              </button>
            </div>
          </div>
          <PostTypeFilter active={typeFilter} onChange={setTypeFilter} />
        </div>

        {loading ? (
          <div className="py-24 text-center font-serif text-[#8B7355]">正在翻阅圈内帖...</div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#8B7355]/30 py-24 text-center">
            <MaterialIcon name="forum" className="mb-3 text-[30px] text-[#8B7355]/70" />
            <p className="font-serif text-[#8B7355]">圈内还没有帖子</p>
            <p className="mt-2 text-sm text-[#8B7355]/60">可以留下第一条只给本圈看的消息</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.postId}
                post={post}
                onClick={() => navigate(`/forum/${post.postId}`)}
                onReport={(postId) => setReportPostId(postId)}
                onLike={handlePreviewLike}
                onFavorite={handlePreviewFavorite}
                variants={itemVariants}
              />
            ))}
          </motion.div>
        )}

        {hasMore && !loading && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => fetchPosts(page + 1, true)}
              disabled={loadingMore}
              className="rounded-full border border-[#8B7355]/30 px-6 py-2.5 text-sm text-[#8B7355] transition-colors hover:border-[#420047]/40 hover:text-[#420047] disabled:opacity-50"
            >
              {loadingMore ? '加载中...' : '加载更多'}
            </button>
          </div>
        )}
      </div>

      <PostForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        circleId={id}
        circleName={circle?.name || '圈内'}
        defaultType="general"
        profileComplete={user?.profileComplete ?? false}
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
  );
}
