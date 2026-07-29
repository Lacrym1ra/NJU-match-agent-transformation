import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  getPostDetail,
  createComment,
  deletePost,
  deleteComment,
  cancelAnonymous,
  updatePostPrivacy,
  likePost,
  unlikePost,
  favoritePost,
  unfavoritePost,
  getCommentReplies,
  likeComment,
  unlikeComment,
  submitForumReport,
  pinComment,
  unpinComment,
  votePostPoll,
} from '../api/forum';
import type { PostDetail, CommentItem as CommentItemType, ReplyItem } from '../api/forum';
import { toast } from '../components/Toast';
import { ApiError } from '../api/client';
import CommentItemComponent, { ReplyItemComponent } from '../components/forum/CommentItem';
import CommentForm from '../components/forum/CommentForm';
import ReportDialog from '../components/forum/ReportDialog';
import PollBlock from '../components/forum/PollBlock';
import ImageLightbox from '../components/forum/ImageLightbox';
import { useConfirmDialog } from '../components/ConfirmDialog';
import MaterialIcon from '../components/MaterialIcon';
import type { ReportReasonValue } from '../lib/reportReasons';

const TYPE_LABELS: Record<string, string> = {
  general: '交流',
  squad: '组队',
  help: '互助',
  trade: '二手',
  activity: '活动',
};

const TYPE_COLORS: Record<string, string> = {
  general: 'bg-[#EAE7E1] text-[#5E5855]',
  squad: 'bg-[#420047]/10 text-[#420047]',
  help: 'bg-blue-50 text-blue-700',
  trade: 'bg-amber-50 text-amber-700',
  activity: 'bg-green-50 text-green-700',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ForumPostDetailProps {
  postId?: string;
  backLabel?: string;
  embedded?: boolean;
  onBack?: () => void;
  onMissing?: () => void;
}

export function ForumPostDetail({
  postId: explicitPostId,
  backLabel = '返回论坛',
  embedded = false,
  onBack,
  onMissing,
}: ForumPostDetailProps) {
  const { postId: routePostId } = useParams<{ postId: string }>();
  const postId = explicitPostId ?? routePostId;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
  const [replyTo, setReplyTo] = useState<{ commentId: string; nickname: string } | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [commentImageLightboxUrl, setCommentImageLightboxUrl] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, ReplyItem[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; label: string } | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  const handledMissingPostIds = useRef<Set<string>>(new Set());

  const fetchDetail = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await getPostDetail(postId);
      setPost(res.post);
      setComments(res.comments);
      setIsDeleted(false);
      handledMissingPostIds.current.delete(postId);
      setLiked(res.post.likedByMe);
      setFavorited(res.post.favoritedByMe);
      setLikeCount(res.post.likeCount);
      setFavoriteCount(res.post.favoriteCount);
      setExpandedReplies({});
      setLoadingReplies({});
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        if (handledMissingPostIds.current.has(postId)) return;
        handledMissingPostIds.current.add(postId);
        toast.error('帖子不存在或已被删除');
        if (onMissing) {
          onMissing();
        } else {
          navigate('/forum', { replace: true });
        }
      } else {
        toast.error('加载帖子失败');
      }
    } finally {
      setLoading(false);
    }
  }, [postId, navigate, onMissing]);

  useEffect(() => {
    fetchDetail();
    if (!embedded) {
      window.scrollTo(0, 0);
    }
  }, [fetchDetail, embedded]);

  useEffect(() => {
    if (!commentImageLightboxUrl) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseCommentImageLightbox();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [commentImageLightboxUrl]);

  const doAction = async (key: string, fn: () => Promise<unknown>) => {
    setActionLoading(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLike = () => {
    if (!postId) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(c - 1, 0));
      doAction('like', () => unlikePost(postId));
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      doAction('like', () => likePost(postId));
    }
  };

  const handleFavorite = () => {
    if (!postId) return;
    if (favorited) {
      setFavorited(false);
      setFavoriteCount((c) => Math.max(c - 1, 0));
      doAction('fav', () => unfavoritePost(postId));
    } else {
      setFavorited(true);
      setFavoriteCount((c) => c + 1);
      doAction('fav', () => favoritePost(postId));
    }
  };

  const handleCancelAnonymous = async () => {
    if (!postId) return;
    const ok = await confirm({
      title: '取消匿名',
      message: '取消匿名后作者信息将对所有人可见，且不可恢复。确认继续吗？',
      confirmText: '确认取消',
      tone: 'danger',
      icon: 'visibility',
    });
    if (!ok) return;
    doAction('anon', async () => {
      await cancelAnonymous(postId);
      await fetchDetail();
      toast.success('已取消匿名');
    });
  };

  const handleTogglePrivacy = () => {
    if (!postId || !post) return;
    const newVis = post.visibility === 'private' ? 'public' : 'private';
    doAction('privacy', async () => {
      await updatePostPrivacy(postId, newVis);
      await fetchDetail();
      toast.success(newVis === 'private' ? '已设为私密' : '已设为公开');
    });
  };

  const handleCommentSubmit = async (payload: {
    content?: string;
    parentCommentId?: string | null;
    voiceUrl?: string;
    voiceDurationSec?: number;
    imageUrl?: string;
  }) => {
    if (!postId) return;
    try {
      const result = await createComment(postId, payload);
      const now = new Date().toISOString();
      const me = { nickname: user?.nickname || '匿名', avatarUrl: null as string | null, isOwn: true };

      // Optimistic: increment post commentCount immediately
      setPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);

      if (payload.parentCommentId) {
        const isAnonymousOP = !!(post?.isAnonymous && post?.author.isOwn);
        const newReply: ReplyItem = {
          commentId: result.commentId,
          author: me,
          content: payload.content ?? null,
          commentType: payload.voiceUrl ? 'voice' : 'text',
          voiceUrl: payload.voiceUrl ?? null,
          voiceDurationSec: payload.voiceDurationSec ?? null,
          imageUrl: payload.imageUrl ?? null,
          transcript: null,
          transcriptStatus: 'none',
          parentCommentId: payload.parentCommentId,
          replyToNickname: replyTo?.nickname ?? null,
          likeCount: 0,
          likedByMe: false,
          isDeleted: false,
          isAnonymousOP,
          createdAt: now,
        };
        const rootId = result.rootCommentId!;
        setComments((prev) =>
          prev.map((c) => {
            if (c.commentId === rootId) {
              const updatedPreview =
                c.previewReplies.length < 2
                  ? [...c.previewReplies, newReply]
                  : c.previewReplies;
              return { ...c, replyCount: c.replyCount + 1, previewReplies: updatedPreview };
            }
            return c;
          }),
        );
        if (expandedReplies[rootId]) {
          setExpandedReplies((prev) => ({
            ...prev,
            [rootId]: [...(prev[rootId] || []), newReply],
          }));
        }
      } else {
        const isAnonymousOP = !!(post?.isAnonymous && post?.author.isOwn);
        const newComment: CommentItemType = {
          commentId: result.commentId,
          author: me,
          content: payload.content ?? null,
          commentType: payload.voiceUrl ? 'voice' : 'text',
          voiceUrl: payload.voiceUrl ?? null,
          voiceDurationSec: payload.voiceDurationSec ?? null,
          imageUrl: payload.imageUrl ?? null,
          transcript: null,
          transcriptStatus: 'none' as const,
          parentCommentId: null,
          createdAt: now,
          likeCount: 0,
          likedByMe: false,
          isDeleted: false,
          isAnonymousOP,
          isPinned: false,
          canPinByMe: !!post?.canPinComments,
          replyCount: 0,
          previewReplies: [],
        };
        setComments((prev) => [...prev, newComment]);
      }
      toast.success('评论成功');
      setReplyTo(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '评论发送失败');
    }
  };

  const handleDeletePost = async () => {
    if (!postId) return;
    const ok = await confirm({
      title: '删除帖子',
      message: '确认删除该帖子？删除后其他人将无法查看。',
      confirmText: '确认删除',
      tone: 'danger',
      icon: 'delete',
    });
    if (!ok) return;
    try {
      await deletePost(postId);
      setIsDeleted(true);
      toast.success('帖子已删除');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await confirm({
      title: '删除评论',
      message: '确认删除该评论？删除后将无法恢复。',
      confirmText: '确认删除',
      tone: 'danger',
      icon: 'delete',
    });
    if (!ok) return;

    // Capture current state for rollback
    const prevComments = comments;
    const prevExpanded = { ...expandedReplies };
    const prevPost = post;

    // Optimistic: update post commentCount immediately (delete only one comment each time)
    setPost((prev) => prev ? { ...prev, commentCount: Math.max(prev.commentCount - 1, 0) } : prev);

    // Optimistic: mark comment as deleted in-place (no disappearing animation)
    setComments((prev) =>
      prev.map((c) => ({
        ...c,
        isDeleted: c.commentId === commentId ? true : c.isDeleted,
        content: c.commentId === commentId ? '该评论已被删除' : c.content,
        likedByMe: c.commentId === commentId ? false : c.likedByMe,
        previewReplies: c.previewReplies.map((r) => ({
          ...r,
          isDeleted: r.commentId === commentId ? true : r.isDeleted,
          content: r.commentId === commentId ? '该评论已被删除' : r.content,
          likedByMe: r.commentId === commentId ? false : r.likedByMe,
        })),
      })),
    );
    setExpandedReplies((prev) => {
      const next: Record<string, ReplyItem[]> = {};
      for (const key of Object.keys(prev)) {
        next[key] = prev[key].map((r) => ({
          ...r,
          isDeleted: r.commentId === commentId ? true : r.isDeleted,
          content: r.commentId === commentId ? '该评论已被删除' : r.content,
          likedByMe: r.commentId === commentId ? false : r.likedByMe,
        }));
      }
      return next;
    });

    try {
      await deleteComment(commentId);
      setPost((prev) =>
        prev?.pinnedCommentId === commentId ? { ...prev, pinnedCommentId: null } : prev,
      );
      setComments((prev) =>
        prev.map((c) => (c.commentId === commentId ? { ...c, isPinned: false } : c)),
      );
      toast.success('评论已删除');
    } catch (err) {
      // Rollback on failure
      setComments(prevComments);
      setExpandedReplies(prevExpanded);
      if (prevPost) setPost(prevPost);
      toast.error(err instanceof ApiError ? err.message : '删除失败');
    }
  };

  const handleSubmitReport = async ({ reasons, detail }: { reasons: ReportReasonValue[]; detail?: string }) => {
    if (!reportTarget) return;
    setSubmittingReport(true);
    try {
      const res = await submitForumReport({
        targetType: reportTarget.type,
        postId: reportTarget.type === 'post' ? reportTarget.id : undefined,
        commentId: reportTarget.type === 'comment' ? reportTarget.id : undefined,
        reasons,
        detail,
      });
      toast.success(res.message || '举报已提交，等待管理员审核');
      setReportTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '举报提交失败');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleReportComment = (commentId: string, _type: 'comment', authorNickname: string) => {
    setReportTarget({ type: 'comment', id: commentId, label: `评论（作者：${authorNickname}）` });
  };

  const handleOpenCommentImage = (imageUrl: string) => {
    setCommentImageLightboxUrl(imageUrl);
  };

  const handleCloseCommentImageLightbox = () => {
    setCommentImageLightboxUrl(null);
  };

  const handleCommentLike = (commentId: string) => {
    const update = (items: any[]) =>
      items.map((item: any) => {
        if (item.commentId === commentId) {
          const nextLiked = !item.likedByMe;
          return {
            ...item,
            likedByMe: nextLiked,
            likeCount: item.likeCount + (nextLiked ? 1 : -1),
          };
        }
        return item;
      });

    setComments((prev) => update(prev));
    Object.keys(expandedReplies).forEach((rootId) => {
      if (expandedReplies[rootId].some((r: ReplyItem) => r.commentId === commentId)) {
        setExpandedReplies((prev) => ({
          ...prev,
          [rootId]: update(prev[rootId] || []),
        }));
      }
    });

    const cmt = comments.find((c) => c.commentId === commentId);
    if (cmt?.likedByMe) {
      unlikeComment(commentId).catch(() => {});
    } else {
      likeComment(commentId).catch(() => {});
    }
  };

  const handlePinComment = async (commentId: string) => {
    if (!postId || !post) return;
    const target = comments.find((comment) => comment.commentId === commentId);
    if (!target || !target.canPinByMe || target.isDeleted) return;

    try {
      if (target.isPinned) {
        await unpinComment(postId);
        toast.success('已取消置顶');
      } else {
        await pinComment(postId, commentId);
        toast.success('评论已置顶');
      }
      await fetchDetail();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '置顶操作失败');
      fetchDetail();
    }
  };

  const handlePollVote = async (optionId: string) => {
    if (!postId) return;
    try {
      const result = await votePostPoll(postId, optionId);
      setPost((prev) => prev ? {
        ...prev,
        poll: {
          totalVotes: result.totalVotes,
          myVoteOptionId: result.myVoteOptionId,
          votedByMe: result.votedByMe,
          options: result.options,
        },
      } : prev);
      toast.success('投票成功');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '投票失败');
      fetchDetail();
    }
  };

  const handleLoadMoreReplies = async (rootCommentId: string) => {
    if (loadingReplies[rootCommentId]) return;
    setLoadingReplies((prev) => ({ ...prev, [rootCommentId]: true }));
    try {
      const res = await getCommentReplies(rootCommentId, 1, 50);
      setExpandedReplies((prev) => ({ ...prev, [rootCommentId]: res.replies }));
    } catch {
      toast.error('加载回复失败');
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [rootCommentId]: false }));
    }
  };

  const isAuthor = post ? post.author.isOwn : false;
  const canCancelAnon = isAuthor && post?.isAnonymous && true; // isAnonymous && no anonymousCancelledAt check
  if (loading) {
    return (
      <div className={`${embedded ? 'min-h-[360px]' : 'min-h-screen'} bg-[#FCFBF8] flex items-center justify-center`}>
        <p className="text-[#8B7355] animate-pulse font-serif">正在展开卷轴...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className={`${embedded ? 'min-h-[360px]' : 'min-h-screen'} bg-[#FCFBF8] flex items-center justify-center`}>
        <p className="text-[#8B7355] font-serif">帖子不存在</p>
      </div>
    );
  }

  const isPrivate = post.visibility === 'private';
  const animatedInitial = embedded ? false : undefined;

  return (
    <div className={`${embedded ? 'flex h-full flex-col overflow-hidden rounded-[22px] bg-[#FCFBF8]' : 'min-h-screen bg-[#FCFBF8] px-4 py-12 md:px-6'} text-[#2C2825] font-sans selection:bg-[#420047] selection:text-white`}>
      {/* Embedded floating back button */}
      {embedded && (
        <button
          type="button"
          onClick={() => {
            if (onBack) {
              onBack();
            } else {
              navigate(-1);
            }
          }}
          className="absolute left-6 top-7 z-20 inline-flex items-center gap-1 text-sm font-sans text-[#8B7355] transition-colors hover:text-[#2C2825]"
        >
          <span className="text-lg leading-none">←</span>
          <span>{backLabel}</span>
        </button>
      )}
      <div className={embedded ? 'min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-16 md:px-6 md:pb-6' : 'pb-36'}>
      <div className={`${embedded ? 'max-w-3xl mx-auto pb-4' : 'max-w-3xl mx-auto'}`}>
        {/* Back navigation */}
        {!embedded && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-1 text-sm text-[#8B7355] hover:text-[#2C2825] transition-colors mb-8"
          >
            <span className="text-lg leading-none">←</span>
            <span>{backLabel}</span>
          </motion.button>
        )}

        {/* Private post banner */}
        {isPrivate && !isAuthor && (
          <motion.div
            initial={animatedInitial}
            animate={{ opacity: 1 }}
            className="bg-[#420047]/5 rounded-2xl p-8 text-center mb-8"
          >
            <MaterialIcon name="lock" className="text-4xl text-[#8B7355] mb-3" />
            <p className="text-[#8B7355] font-serif text-lg">该帖为私密内容</p>
          </motion.div>
        )}

        {/* Post content */}
        {(isAuthor || !isPrivate) && (
          <motion.article
            initial={embedded ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8"
          >
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[post.type] || TYPE_COLORS.general}`}>
                {TYPE_LABELS[post.type] || post.type}
              </span>
              {post.isPinned && (
                <span className="text-xs bg-[#420047]/10 text-[#420047] px-2 py-0.5 rounded-full">置顶</span>
              )}
              {post.isAnonymous && (
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                  <MaterialIcon name="visibility_off" className="text-[10px] leading-none" />
                  匿名
                </span>
              )}
              {isPrivate && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                  <MaterialIcon name="lock" className="text-[10px] leading-none" />
                  私密
                </span>
              )}
              {post.hotScore > 5 && (
                <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                  <MaterialIcon name="local_fire_department" className="text-[10px] leading-none" />
                  热帖
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-serif text-[#2C2825] mb-4 leading-snug break-words">
              {isDeleted ? '[该帖子已被作者删除]' : post.title}
            </h1>

            {/* Author info */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[#EAE7E1]">
              <div 
                className={`flex items-center gap-3 ${post.author.userId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                onClick={() => {
                  if (post.author.userId) {
                    navigate(`/user/${post.author.userId}`);
                  }
                }}
              >
                <div className="w-10 h-10 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center text-sm font-serif shrink-0">
                  {(post.author.nickname || '?')[0]}
                </div>
                <div>
                  <div className={`text-sm font-medium ${post.author.userId ? 'text-[#420047]' : 'text-[#2C2825]'}`}>
                    {post.author.nickname || '匿名'}
                  </div>
                  <div className="text-xs text-[#8B7355]">{formatTime(post.createdAt)}</div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4 text-xs text-[#8B7355]">
                {!isAuthor && (
                  <button
                    onClick={() =>
                      setReportTarget({
                        type: 'post',
                        id: post.postId,
                        label: `帖子《${post.title}》`,
                      })
                    }
                    className="text-[#8B7355]/70 hover:text-[#420047] transition-colors inline-flex items-center"
                    title="举报"
                    aria-label="举报"
                  >
                    <MaterialIcon name="flag" className="text-[16px] leading-none" />
                  </button>
                )}
                {isAuthor && (
                  <div className="relative">
                    <button
                      onClick={() => setShowPostMenu(!showPostMenu)}
                      className="text-[#8B7355]/60 hover:text-[#2C2825] transition-colors px-1 text-lg"
                    >
                      ···
                    </button>
                    {showPostMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowPostMenu(false)} />
                        <div className="absolute right-0 top-6 z-20 bg-white rounded-none shadow-lg border border-[#EAE7E1] py-1 min-w-[120px]">
                          {canCancelAnon && (
                            <button
                              onClick={() => { setShowPostMenu(false); handleCancelAnonymous(); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#2C2825] hover:bg-[#EAE7E1] transition-colors"
                            >
                              {actionLoading === 'anon' ? '处理中...' : '取消匿名'}
                            </button>
                          )}
                          <button
                            onClick={() => { setShowPostMenu(false); handleTogglePrivacy(); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-[#2C2825] hover:bg-[#EAE7E1] transition-colors"
                          >
                            {actionLoading === 'privacy' ? '处理中...' : isPrivate ? '设为公开' : '设为私密'}
                          </button>
                          <button
                            onClick={() => { setShowPostMenu(false); handleDeletePost(); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#EAE7E1] transition-colors"
                          >
                            删除帖子
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content body */}
            {isDeleted ? (
              <div className="text-center py-12 text-[#8B7355] font-serif">
                该帖子已被作者删除
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-[#2C2825] leading-relaxed whitespace-pre-wrap break-words">
                  {post.content}
                </div>

                {post.poll && (
                  <PollBlock poll={post.poll} onVote={handlePollVote} />
                )}

                {/* Image gallery */}
                {post.images && post.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {post.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setLightboxIndex(i)}
                        className="aspect-square rounded-md overflow-hidden bg-[#EAE7E1] hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={img.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action bar: likes + favorites */}
            {!isDeleted && (
              <div className="mt-6 pt-4 border-t border-[#EAE7E1] flex items-center gap-6">
                <button
                  onClick={handleLike}
                  disabled={actionLoading === 'like'}
                  className="inline-flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                  style={{ color: liked ? '#E53935' : '#8B7355' }}
                >
                  <MaterialIcon name={liked ? 'favorite' : 'favorite'} className="text-[18px] leading-none" />
                  <span>{likeCount}</span>
                </button>
                <button
                  onClick={handleFavorite}
                  disabled={actionLoading === 'fav'}
                  className="inline-flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                  style={{ color: favorited ? '#F59E0B' : '#8B7355' }}
                >
                  <MaterialIcon name="star" className="text-[18px] leading-none" />
                  <span>{favoriteCount}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#8B7355]">
                  <MaterialIcon name="chat_bubble" className="text-[16px] leading-none" />
                  <span>{post.commentCount}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#8B7355]">
                  <MaterialIcon name="visibility" className="text-[16px] leading-none" />
                  <span>{post.viewCount}</span>
                </span>
              </div>
            )}

            {/* Anonymous cancel CTA */}
            {isAuthor && post.isAnonymous && canCancelAnon && !isDeleted && (
              <div className="mt-3 p-3 rounded-xl bg-[#420047]/5 text-xs text-[#420047] flex items-center justify-between">
                <span>你正以匿名身份发帖。取消匿名后作者信息将对所有人可见，且不可恢复。</span>
                <button
                  onClick={handleCancelAnonymous}
                  disabled={actionLoading === 'anon'}
                  className="shrink-0 ml-3 px-3 py-1.5 rounded-full border border-[#420047]/30 text-[#420047] hover:bg-[#420047]/10 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'anon' ? '处理中' : '取消匿名'}
                </button>
              </div>
            )}
          </motion.article>
        )}

        {/* Comments section */}
        {!isDeleted && (isAuthor || !isPrivate) && (
          <motion.section
            initial={animatedInitial}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8"
          >
            <h2 className="font-serif text-[#8B7355] text-center mb-6">
              —— 回 响 ——
            </h2>

            {comments.length === 0 ? (
              <p className="text-center text-sm text-[#8B7355]/60 py-8">
                尚无回响，留下第一声问候
              </p>
            ) : (
              <div className="divide-y divide-[#EAE7E1]/60">
                  {comments.map((c) => (
                    <div key={c.commentId} className="overflow-hidden">
                      <CommentItemComponent
                        comment={c}
                        onReply={(commentId, nickname) => setReplyTo({ commentId, nickname })}
                        onDelete={handleDeleteComment}
                        onReport={handleReportComment}
                        onLoadMore={handleLoadMoreReplies}
                        loadingReplies={loadingReplies[c.commentId]}
                        isExpanded={!!expandedReplies[c.commentId]}
                        onLike={handleCommentLike}
                        onPin={handlePinComment}
                        onOpenImage={handleOpenCommentImage}
                      />
                      {expandedReplies[c.commentId] && (
                        <div className="ml-8 pl-4 border-l-2 border-[#EAE7E1] divide-y divide-[#EAE7E1]/40">
                          {expandedReplies[c.commentId].map((reply) => (
                            <ReplyItemComponent
                              key={reply.commentId}
                              reply={reply}
                              onReply={(commentId, nickname) => setReplyTo({ commentId, nickname })}
                              onDelete={handleDeleteComment}
                              onReport={handleReportComment}
                              onLike={handleCommentLike}
                              onOpenImage={handleOpenCommentImage}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </motion.section>
        )}

      </div>
        {/* Comment input — sticky frosted bar (non-embedded) */}
        {!embedded && !isDeleted && (isAuthor || !isPrivate) && (
          <div className="sticky bottom-0 z-10 px-4 pt-3 pb-0 md:px-6">
            <div className="mx-auto max-w-3xl rounded-2xl border border-[#EAE7E1]/60 bg-[#FCFBF8]/85 backdrop-blur-xl shadow-[0_-4px_16px_rgba(44,40,37,0.05)]">
              <CommentForm
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onSubmit={handleCommentSubmit}
              />
            </div>
          </div>
        )}
      </div>

      {embedded && !isDeleted && (isAuthor || !isPrivate) && (
        <div className="shrink-0 border-t border-[#EAE7E1] bg-[#FCFBF8]/95 px-4 py-3 md:px-6">
          <div className="mx-auto max-w-3xl">
            <CommentForm
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSubmit={handleCommentSubmit}
              docked
            />
          </div>
        </div>
      )}

      {/* Lightbox */}
      <ImageLightbox
        open={lightboxIndex !== null && !!post?.images?.[lightboxIndex]}
        imageUrl={post?.images?.[lightboxIndex]?.imageUrl ?? null}
        onClose={() => setLightboxIndex(null)}
        onPrev={lightboxIndex !== null && lightboxIndex > 0 ? () => setLightboxIndex(lightboxIndex - 1) : undefined}
        onNext={lightboxIndex !== null && post?.images && lightboxIndex < post.images.length - 1 ? () => setLightboxIndex(lightboxIndex + 1) : undefined}
        showNav={true}
      />

      <ImageLightbox
        open={!!commentImageLightboxUrl}
        imageUrl={commentImageLightboxUrl}
        onClose={handleCloseCommentImageLightbox}
      />

      <ReportDialog
        open={!!reportTarget}
        targetLabel={reportTarget?.label || '内容'}
        submitting={submittingReport}
        onClose={() => {
          if (!submittingReport) setReportTarget(null);
        }}
        onSubmit={handleSubmitReport}
      />
      {confirmDialog}
    </div>
  );
}

export default function ForumPost() {
  const { postId } = useParams<{ postId: string }>();
  const location = useLocation();
  const fromSource = (location.state as any)?.from;
  const backLabel = fromSource === 'ranking'
    ? '返回热榜'
    : (fromSource === 'dashboard' || fromSource === 'profile') ? '返回上一页' : '返回论坛';

  return <ForumPostDetail postId={postId} backLabel={backLabel} />;
}
