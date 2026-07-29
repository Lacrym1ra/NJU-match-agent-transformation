import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import MaterialIcon from '../components/MaterialIcon';
import PostCard from '../components/forum/PostCard';
import ReportDialog from '../components/forum/ReportDialog';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  getUserPublicProfile,
  getUserPublicPosts,
  submitForumReport,
  type PostListItem,
  type UserPublicProfile,
} from '../api/forum';
import type { ReportReasonValue } from '../lib/reportReasons';
import {
  blockUser,
  followUser,
  getDirectMessageEligibility,
  getFollowStatus,
  unfollowUser,
  unblockUser,
  type FollowStatus,
} from '../api/social';
import { ApiError } from '../api/client';

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [dmChecking, setDmChecking] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const isOwnProfile = !!userId && user?.id === userId;

  const loadData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [profileData, postsData] = await Promise.all([
        getUserPublicProfile(userId),
        getUserPublicPosts(userId, 1, 20),
      ]);
      setProfile(profileData);
      setPosts(postsData.posts);
      setHasMore(postsData.posts.length === 20);
      setPage(1);
    } catch {
      toastError('加载用户主页失败或用户不存在');
    } finally {
      setLoading(false);
    }
  }, [toastError, userId]);

  const loadFollowState = useCallback(async () => {
    if (!userId || isOwnProfile) {
      setFollowStatus(null);
      setBlockedByMe(false);
      return;
    }

    try {
      const [status, eligibility] = await Promise.all([
        getFollowStatus(userId),
        getDirectMessageEligibility(userId),
      ]);
      setFollowStatus(status);
      setBlockedByMe(eligibility.blockState.blockedByMe);
    } catch {
      setFollowStatus(null);
      setBlockedByMe(false);
    }
  }, [isOwnProfile, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadFollowState();
  }, [loadFollowState]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getUserPublicPosts(userId, nextPage, 20);
      setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(res.posts.length === 20);
      setPage(nextPage);
    } catch {
      toastError('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page, toastError, userId]);

  const bottomRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        void loadMore();
      }
    });

    if (node) {
      observerRef.current.observe(node);
    }
  }, [hasMore, loadMore, loading, loadingMore]);

  const handleToggleFollow = useCallback(async () => {
    if (!userId || isOwnProfile || followLoading) return;

    if (followStatus?.isFollowing) {
      setShowUnfollowConfirm(true);
      return;
    }

    setFollowLoading(true);
    try {
      const nextStatus = await followUser(userId);
      setFollowStatus(nextStatus);
      toastSuccess(nextStatus.isFollowing ? '关注成功' : '关注操作成功');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '关注操作失败');
    } finally {
      setFollowLoading(false);
    }
  }, [followLoading, followStatus?.isFollowing, isOwnProfile, toastError, toastSuccess, userId]);

  const handleConfirmUnfollow = useCallback(async () => {
    if (!userId || isOwnProfile || followLoading) return;

    setFollowLoading(true);
    try {
      const nextStatus = await unfollowUser(userId);
      setFollowStatus(nextStatus);
      setShowUnfollowConfirm(false);
      toastSuccess('已取消关注');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '取消关注失败');
    } finally {
      setFollowLoading(false);
    }
  }, [followLoading, isOwnProfile, toastError, toastSuccess, userId]);

  const handleDirectMessage = useCallback(async () => {
    if (!userId || isOwnProfile || dmChecking) return;

    setDmChecking(true);
    try {
      navigate(`/messages/${userId}`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '暂时无法发起私信');
    } finally {
      setDmChecking(false);
    }
  }, [dmChecking, isOwnProfile, navigate, toastError, userId]);

  const handleSubmitReport = useCallback(async (payload: { reasons: ReportReasonValue[]; detail?: string }) => {
    if (!userId || isOwnProfile || reportSubmitting) return;
    if (payload.reasons.length === 0) {
      toastError('请至少选择一个举报原因');
      return;
    }

    setReportSubmitting(true);
    try {
      const res = await submitForumReport({
        targetType: 'user',
        reportedUserId: userId,
        reasons: payload.reasons,
        detail: payload.detail,
      });
      setReportDialogOpen(false);
      toastSuccess(res.message || '举报已提交，等待管理员审核');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '举报提交失败，请稍后重试');
    } finally {
      setReportSubmitting(false);
    }
  }, [isOwnProfile, reportSubmitting, toastError, toastSuccess, userId]);

  const handleToggleBlockUser = useCallback(async () => {
    if (!userId || isOwnProfile || blockLoading) return;

    setBlockLoading(true);
    try {
      const res = blockedByMe ? await unblockUser(userId) : await blockUser(userId);
      setMoreMenuOpen(false);
      setBlockedByMe(!blockedByMe);
      toastSuccess(res.message || (blockedByMe ? '已解除拉黑' : '已拉黑该用户'));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : blockedByMe ? '解除拉黑失败，请稍后重试' : '拉黑失败，请稍后重试');
    } finally {
      setBlockLoading(false);
    }
  }, [blockLoading, blockedByMe, isOwnProfile, toastError, toastSuccess, userId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFBF8]">
        <MaterialIcon name="hourglass_empty" className="animate-spin text-4xl text-[#8B7355]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FCFBF8] text-[#8B7355]">
        <MaterialIcon name="person_off" className="mb-4 text-6xl opacity-50" />
        <p>用户不存在或已隐藏</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-4 flex items-center gap-1 text-sm text-[#8B7355] transition-colors hover:text-[#2C2825]"
        >
          <span className="text-lg leading-none">←</span>
          <span>返回仪表盘</span>
        </button>
      </div>
    );
  }

  const followButtonLabel = followStatus?.isMutual
    ? '互相关注'
    : followStatus?.isFollowing
      ? '已关注'
      : '关注';

  return (
    <div className="min-h-screen bg-[#FCFBF8] px-4 py-12 font-sans text-[#2C2825] selection:bg-[#420047] selection:text-white md:px-6">
      <div className="mx-auto max-w-3xl">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-1 text-sm text-[#8B7355] transition-colors hover:text-[#2C2825]"
        >
          <span className="text-lg leading-none">←</span>
          <span>返回上一页</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative mb-8 overflow-hidden rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:p-8">
            {!isOwnProfile && (
              <div className="absolute right-5 top-5 z-20">
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((open) => !open)}
                  className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] px-3 font-serif text-lg leading-none text-[#8B7355] transition-colors hover:border-[#8B7355]/40 hover:bg-white"
                  aria-label="更多操作"
                >
                  ..
                </button>
                {moreMenuOpen && (
                  <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] py-1 shadow-[0_16px_48px_rgba(44,40,37,0.14)]">
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setReportDialogOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#2C2825] transition-colors hover:bg-white"
                    >
                      <MaterialIcon name="flag" className="text-[16px] text-[#8B7355]" />
                      举报
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleBlockUser()}
                      disabled={blockLoading}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white disabled:opacity-60 ${
                        blockedByMe ? 'text-[#2C2825]' : 'text-[#B91C1C]'
                      }`}
                    >
                      <MaterialIcon name={blockedByMe ? 'lock_open' : 'block'} className="text-[16px]" />
                      {blockLoading ? '处理中...' : blockedByMe ? '解除拉黑' : '拉黑'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="relative z-10 flex items-start gap-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#420047] text-3xl font-serif text-[#FCFBF8] shadow-lg shadow-[#420047]/20">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                  profile.nickname[0]
                )}
              </div>

              <div className="min-w-0 flex-1 pt-2">
                <h2 className="mb-2 text-2xl font-serif text-[#2C2825]">{profile.nickname}</h2>
                {profile.signature && (
                  <p className="mb-4 text-sm leading-relaxed text-[#8B7355]">
                    {profile.signature}
                  </p>
                )}
                {profile.tags.length > 0 && (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {profile.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#EAE7E1]/50 px-3 py-1 text-[11px] tracking-wide text-[#5E5855]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {!isOwnProfile && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all disabled:opacity-60 ${
                        followStatus?.isFollowing
                          ? 'border border-[#420047]/20 bg-[#420047]/6 text-[#420047] hover:bg-[#420047]/10'
                          : 'bg-[#420047] text-white hover:bg-[#2A002D]'
                      }`}
                    >
                      <MaterialIcon
                        name={followStatus?.isFollowing ? 'favorite' : 'favorite_border'}
                        className="text-[16px]"
                      />
                      {followLoading ? '处理中...' : followButtonLabel}
                    </button>
                    <button
                      type="button"
                      onClick={handleDirectMessage}
                      disabled={dmChecking}
                      className="inline-flex items-center gap-2 rounded-full border border-[#EAE7E1] bg-[#FCFBF8] px-5 py-2.5 text-sm text-[#2C2825] transition-colors hover:border-[#8B7355]/40 hover:bg-white disabled:opacity-60"
                    >
                      <MaterialIcon name="chat_bubble" className="text-[16px] text-[#8B7355]" />
                      {dmChecking ? '校验中...' : '发私信'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 pt-6">
              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-1 text-xs tracking-widest text-[#8B7355]">
                  <MaterialIcon name="article" className="text-[14px]" />
                  公开帖子
                </div>
                <div className="text-2xl font-serif text-[#420047]">{profile.postCount}</div>
              </div>
              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-1 text-xs tracking-widest text-[#8B7355]">
                  <MaterialIcon name="favorite" className="text-[14px]" />
                  获得点赞
                </div>
                <div className="text-2xl font-serif text-[#420047]">{profile.likeCount}</div>
              </div>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-serif text-[#2C2825]">
              <MaterialIcon name="history_edu" className="text-[#8B7355]" />
              公开动态
            </h3>
          </div>

          {posts.length > 0 ? (
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <PostCard
                  key={post.postId}
                  post={post}
                  onClick={() => navigate(`/forum/${post.postId}`, { state: { from: 'profile' } })}
                />
              ))}

              <div ref={bottomRef} className="flex justify-center py-6">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-[#8B7355]">
                    <MaterialIcon name="sync" className="animate-spin text-[16px]" />
                    正在加载...
                  </div>
                ) : hasMore ? (
                  <div className="text-sm text-[#8B7355]/50">下拉加载更多</div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-[#8B7355]/50">
                    <MaterialIcon name="check" className="text-[14px]" />
                    已经到底啦
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#EAE7E1] bg-white/50 p-12 text-center">
              <MaterialIcon name="inbox" className="mb-4 text-4xl text-[#EAE7E1]" />
              <p className="text-sm text-[#8B7355]">该用户暂未发布公开动态</p>
            </div>
          )}
        </motion.div>
      </div>
      {showUnfollowConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2825]/25 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!followLoading) setShowUnfollowConfirm(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full max-w-xs rounded-[28px] bg-[#FCFBF8] px-6 py-7 shadow-[0_24px_70px_rgba(44,40,37,0.18)]"
            onClick={(event) => event.stopPropagation()}
	          >
	            <div className="text-center font-serif text-xl text-[#2C2825]">确认不再关注？</div>
	            <div className="mt-7 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setShowUnfollowConfirm(false)}
                disabled={followLoading}
                className="rounded-full bg-[#F3F1ED] px-5 py-2.5 text-sm text-[#8B7355] transition-colors hover:bg-[#E9E1DC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmUnfollow()}
                disabled={followLoading}
                className="rounded-full bg-[#420047] px-5 py-2.5 text-sm text-white transition-colors hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:bg-[#C7BAC8]"
              >
                {followLoading ? '处理中...' : '确认'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <ReportDialog
        open={reportDialogOpen}
        targetLabel={profile.nickname}
        submitting={reportSubmitting}
        onClose={() => {
          if (!reportSubmitting) setReportDialogOpen(false);
        }}
        onSubmit={handleSubmitReport}
      />
    </div>
  );
}
