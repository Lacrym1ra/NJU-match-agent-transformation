import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MaterialIcon from '../components/MaterialIcon';
import {
  followUser,
  getDirectMessageEligibility,
  getFollowList,
  unfollowUser,
  type FollowListUser,
  type FollowListResponse,
  type FollowListTab,
} from '../api/social';
import { ApiError } from '../api/client';
import { useToast } from '../components/Toast';

const TABS: Array<{ key: FollowListTab; label: string }> = [
  { key: 'mutual', label: '互相关注' },
  { key: 'following', label: '关注' },
  { key: 'followers', label: '粉丝' },
];

function normalizeTab(value: string | null): FollowListTab {
  if (value === 'following' || value === 'followers' || value === 'mutual') {
    return value;
  }
  return 'mutual';
}

interface FollowListProps {
  embedded?: boolean;
  onClose?: () => void;
}

export default function FollowList({ embedded = false, onClose }: FollowListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { error: toastError, success: toastSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<FollowListTab>(() => normalizeTab(searchParams.get('tab')));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FollowListResponse | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [confirmUnfollowUser, setConfirmUnfollowUser] = useState<FollowListUser | null>(null);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const result = await getFollowList(activeTab);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          toastError(err instanceof ApiError ? err.message : '加载关注列表失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, toastError]);

  const counts = useMemo(() => ({
    mutual: data?.mutualCount ?? 0,
    following: data?.followingCount ?? 0,
    followers: data?.followerCount ?? 0,
  }), [data]);

  const currentTabLabel = useMemo(
    () => TABS.find((tab) => tab.key === activeTab)?.label ?? '互相关注',
    [activeTab],
  );

  const handleTabChange = (tab: FollowListTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (embedded) {
      next.set('view', 'follows');
    }
    setSearchParams(next);
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigate('/dashboard');
  };

  const handleDirectMessage = async (userId: string) => {
    if (actionUserId) return;
    setActionUserId(userId);
    try {
      const eligibility = await getDirectMessageEligibility(userId);
      if (!eligibility.canMessage) {
        toastError(eligibility.message || '由于对方的隐私设置，您暂时无法发送私信');
        return;
      }
      navigate(`/messages/${userId}`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '暂时无法发起私信');
    } finally {
      setActionUserId(null);
    }
  };

  const handleFollowBack = async (userId: string) => {
    if (actionUserId) return;
    setActionUserId(userId);
    try {
      const relation = await followUser(userId);
      setData((prev) => {
        if (!prev) return prev;
        const previous = prev.users.find((user) => user.userId === userId);
        const followingDelta = previous && !previous.relation.isFollowing && relation.isFollowing ? 1 : 0;
        const mutualDelta = previous && !previous.relation.isMutual && relation.isMutual ? 1 : 0;
        return {
          ...prev,
          followingCount: prev.followingCount + followingDelta,
          mutualCount: prev.mutualCount + mutualDelta,
          users: prev.users.map((user) => (
            user.userId === userId ? { ...user, relation } : user
          )),
        };
      });
      toastSuccess(relation.isMutual ? '已互相关注' : '已关注');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '回关失败，请稍后重试');
    } finally {
      setActionUserId(null);
    }
  };

  const handleConfirmUnfollow = async () => {
    if (!confirmUnfollowUser || actionUserId) return;

    const userId = confirmUnfollowUser.userId;
    setActionUserId(userId);
    try {
      const relation = await unfollowUser(userId);
      setData((prev) => {
        if (!prev) return prev;
        const previous = prev.users.find((user) => user.userId === userId);
        const followingDelta = previous?.relation.isFollowing && !relation.isFollowing ? -1 : 0;
        const mutualDelta = previous?.relation.isMutual && !relation.isMutual ? -1 : 0;
        return {
          ...prev,
          followingCount: Math.max(0, prev.followingCount + followingDelta),
          mutualCount: Math.max(0, prev.mutualCount + mutualDelta),
          users: prev.users.map((user) => (
            user.userId === userId ? { ...user, relation } : user
          )),
        };
      });
      toastSuccess('已取消关注');
      setConfirmUnfollowUser(null);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '取消关注失败，请稍后重试');
    } finally {
      setActionUserId(null);
    }
  };

  const renderUserAction = (item: FollowListUser) => {
    if (item.relation.isFollowing) {
      return (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmUnfollowUser(item);
            }}
            disabled={actionUserId === item.userId}
            className="rounded-full bg-[#F3F1ED] px-4 py-2 text-sm text-[#8B7355] transition-colors hover:bg-[#E9E1DC] hover:text-[#420047] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item.relation.isMutual ? '互相关注' : '已关注'}
          </button>
          {activeTab === 'mutual' && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleDirectMessage(item.userId);
              }}
              disabled={actionUserId === item.userId}
              className="rounded-full bg-[#420047] px-4 py-2 text-sm text-white shadow-[0_8px_18px_rgba(66,0,71,0.16)] transition-colors hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:bg-[#C7BAC8]"
            >
              {actionUserId === item.userId ? '校验中...' : '发私信'}
            </button>
          )}
        </>
      );
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void handleFollowBack(item.userId);
        }}
        disabled={actionUserId === item.userId}
        className="rounded-full bg-[#420047]/10 px-4 py-2 text-sm text-[#420047] transition-colors hover:bg-[#420047]/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {actionUserId === item.userId ? '处理中...' : activeTab === 'followers' ? '回关' : '关注'}
      </button>
    );
  };

  return (
    <div className={embedded ? 'h-full min-h-0 bg-transparent' : 'min-h-screen bg-[#FCFBF8]'}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={embedded ? 'mx-auto h-full max-w-3xl overflow-y-auto px-1 py-2 sm:px-3' : 'mx-auto max-w-3xl px-4 py-8'}
      >
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mb-6 flex items-center justify-between"
        >
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-[#8B7355] transition-colors hover:text-[#2C2825]"
          >
            <span className="text-lg leading-none">←</span>
            <span>返回仪表盘</span>
          </button>
          <div className="text-xs tracking-[0.2em] text-[#8B7355]/70">FOLLOW LIST</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
          className="mb-6 px-4 py-2"
        >
          <div className="flex flex-wrap items-center justify-center gap-8">
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm transition-all ${
                    active
                      ? 'bg-[#420047] text-white shadow-[0_8px_18px_rgba(66,0,71,0.16)]'
                      : 'text-[#8B7355]/80 hover:bg-[#F7F2EC] hover:text-[#420047]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          className="mb-5 flex items-center justify-between"
        >
          <h1 className="font-serif text-2xl text-[#2C2825]">{currentTabLabel}</h1>
          <div className="text-sm text-[#8B7355]/70">
            {counts[activeTab]} 位用户
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: 'easeOut' }}
          className="space-y-3"
        >
          {loading ? (
            <div className="flex items-center justify-center rounded-[24px] border border-[#EAE7E1] bg-white px-6 py-12 text-[#8B7355]">
              <MaterialIcon name="sync" className="mr-2 animate-spin text-[18px]" />
              加载中...
            </div>
          ) : !data || data.users.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#EAE7E1] bg-white/70 px-6 py-12 text-center text-[#8B7355]">
              <MaterialIcon name="group_off" className="mb-3 text-4xl opacity-50" />
              <p className="font-serif text-lg text-[#2C2825]">这里还没有内容</p>
              <p className="mt-2 text-sm text-[#8B7355]/70">当前分组下还没有用户。</p>
            </div>
          ) : (
            data.users.map((item) => (
              <div
                key={item.userId}
                onClick={() => navigate(`/user/${item.userId}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/user/${item.userId}`);
                  }
                }}
                role="button"
                tabIndex={0}
                className="group flex w-full items-center gap-5 rounded-2xl bg-white p-6 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(66,0,71,0.08)]"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F3EEE8] font-serif text-xl text-[#420047]">
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt={item.nickname || '用户头像'} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    item.nickname?.[0] ?? '?'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-lg text-[#2C2825] transition-colors group-hover:text-[#420047]">{item.nickname || '未命名用户'}</div>
                  <div className="mt-1 truncate text-sm text-[#8B7355]">{item.signature || '这个人还没有留下个性签名。'}</div>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {renderUserAction(item)}
                </div>
              </div>
            ))
          )}
        </motion.div>
      </motion.div>
      {confirmUnfollowUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2825]/25 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!actionUserId) setConfirmUnfollowUser(null);
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
            <div className="mt-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setConfirmUnfollowUser(null)}
                disabled={!!actionUserId}
                className="rounded-full bg-[#F3F1ED] px-5 py-2.5 text-sm text-[#8B7355] transition-colors hover:bg-[#E9E1DC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmUnfollow()}
                disabled={!!actionUserId}
                className="rounded-full bg-[#420047] px-5 py-2.5 text-sm text-white transition-colors hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:bg-[#C7BAC8]"
              >
                {actionUserId === confirmUnfollowUser.userId ? '处理中...' : '确认'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
