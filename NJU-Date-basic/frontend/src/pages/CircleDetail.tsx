import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChannelMembersOptions,
  Circle,
  CircleLocationStatus,
  ChannelMember,
  JoinCirclePayload,
  SentCircleJoinRequest,
  disableCircleLocation,
  getChannelMembers,
  getCircleDetail,
  getCircleLocationStatus,
  getSentCircleJoinRequests,
  joinCircle,
  leaveCircle,
  updateCircleLocation,
  withdrawCircleJoinRequest,
} from '../api/circles';
import MemberChannelItem from '../components/MemberChannelItem';
import PublicCardModal from '../components/PublicCardModal';
import CircleJoinModal from '../components/CircleJoinModal';
import { getFriendCard, getPublicCard, PublicCard } from '../api/card';
import { sendFriendRequest, deleteFriendInCircle } from '../api/friends';
import { ApiError } from '../api/client';
import { toast } from '../components/Toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import MaterialIcon from '../components/MaterialIcon';

import CircleCardOverrideModal from '../components/CircleCardOverrideModal';
import CircleContactsSettingsModal from '../components/CircleContactsSettingsModal';

// 大类英文转中文字典
const CATEGORY_MAP: Record<string, string> = {
  'game': '游戏',
  'sports': '运动',
  'study': '学习',
  'life': '生活',
  'music': '音乐',
  'art': '艺术',
  'tech': '科技',
  'career': '职场',
  'academic': '学业',
  'arts': '文艺',
  'professional': '职场',
  'lifestyle': '生活',
};
export const displayCategory = (cat?: string) => {
  if (!cat) return '圈子频道';
  return CATEGORY_MAP[cat.toLowerCase()] || cat;
};

export function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 12_000,
    });
  });
}

export default function CircleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm, confirmDialog } = useConfirmDialog();
  const redirectAfterJoin = getSafeRedirect(searchParams.get('redirect'));
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  const [leaveClearTrace, setLeaveClearTrace] = useState(false);
  const [leaveSilent, setLeaveSilent] = useState(false);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [canViewMembers, setCanViewMembers] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [includeUnknownDistance, setIncludeUnknownDistance] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(50000);
  const [locationStatus, setLocationStatus] = useState<CircleLocationStatus | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [cardData, setCardData] = useState<PublicCard | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<SentCircleJoinRequest | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showContactsSettingsModal, setShowContactsSettingsModal] = useState(false);
  const [isRemovingFriendInCircle, setIsRemovingFriendInCircle] = useState(false);
  const [isLeavingCircle, setIsLeavingCircle] = useState(false);
  const [isJoiningCircle, setIsJoiningCircle] = useState(false);
  const [isWithdrawingJoinRequest, setIsWithdrawingJoinRequest] = useState(false);

  const handleBackToCircles = () => {
    navigate('/circles', { replace: true });
  };

  const getMemberOptions = (
    useNearby: boolean = nearbyMode,
    overrides: Partial<ChannelMembersOptions> = {},
  ): ChannelMembersOptions => (
    useNearby
      ? {
        nearby: true,
        radiusMeters: overrides.radiusMeters ?? radiusMeters,
        includeUnknownDistance: overrides.includeUnknownDistance ?? includeUnknownDistance,
      }
      : {}
  );

  const loadMembers = async (
    targetPage: number = 1,
    append: boolean = false,
    useNearby: boolean = nearbyMode,
    optionOverrides: Partial<ChannelMembersOptions> = {},
  ) => {
    if (!id) return;
    const res = await getChannelMembers(id, targetPage, 20, getMemberOptions(useNearby, optionOverrides));
    setMembers((prev) => append ? [...prev, ...res.members] : res.members);
    setTotal(res.total);
    setPage(targetPage);
    setCanViewMembers(true);
  };

  useEffect(() => {
    if (!id) return;

    const loadPage = async () => {
      try {
        const circleRes = await getCircleDetail(id);
        const circleData = circleRes.circle || circleRes as any;
        setCircle(circleData);
        setPage(1);
    
        if (circleData?.isJoined) {
          const [locationRes] = await Promise.all([
            getCircleLocationStatus(id).catch(() => null),
            loadMembers(1, false, false),
          ]);
          setLocationStatus(locationRes);
          setNearbyMode(false);
        } else {
          if (circleData?.membershipStatus === 'pending') {
            const sentRequests = await getSentCircleJoinRequests({ limit: 50 }).catch(() => null);
            const matchedRequest = (sentRequests?.requests || []).find((request) => (
              request.circleId === id && request.status === 'pending_review'
            ));
            setPendingJoinRequest(matchedRequest || null);
          } else {
            setPendingJoinRequest(null);
          }
          setMembers([]);
          setTotal(circleData?.memberCount || 0);
          setCanViewMembers(false);
        }
      } catch (err: any) {
        toast.error(err.message || '加载圈子大厅失败');
        handleBackToCircles();
      } finally {
        setLoading(false);
      }
    };
    
    void loadPage();
  }, [id, navigate]);

  const loadMore = async () => {
    if (!id || !canViewMembers || loadingMore || members.length >= total) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      await loadMembers(nextPage, true);
    } catch (err: any) {
      toast.error(err.message || '加载失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleViewCard = async (userId: string) => {
    if (!id) return;
    setSelectedUserId(userId);
    try {
      const res = await getPublicCard(userId, id);
      if (res.isCircleFriend) {
        const friendCard = await getFriendCard(userId, id);
        setCardData(friendCard);
        return;
      }
      setCardData(res);
    } catch (err: any) {
      toast.error(err.message || '获取名片失败');
      setSelectedUserId(null); 
    }
  };

  const handleAddFriend = async (message?: string) => {
    const isCurrentCircleFriend = (cardData?.isCircleFriend ?? false) === true;
    if (!id || !selectedUserId || !cardData || isCurrentCircleFriend || cardData.pendingRequest) {
      return;
    }

    try {
      await sendFriendRequest({
        targetUserId: selectedUserId,
        circleId: id,
        message: message, // 【新增】：将前端用户选用或编写的破冰语传递给后端
      });
      setCardData((prev) => (prev ? { ...prev, pendingRequest: 'sent' } : prev));
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'REQUEST_EXISTS') {
          setCardData((prev) => (prev ? { ...prev, pendingRequest: 'sent' } : prev));
          toast.warning('本圈已有待处理的好友申请');
          return;
        }
    
        if (err.code === 'ALREADY_FRIENDS') {
          const friendCard = await getFriendCard(selectedUserId, id);
          setCardData(friendCard);
          toast.success('你们已在本圈成为好友');
          return;
        }
      }
    
      toast.error(err.message || '发送好友申请失败');
    }
  };

  const handleJoinCircle = async () => {
    setShowJoinModal(true);
  };

  const handleJoinSubmit = async (payload: JoinCirclePayload) => {
    if (!id || isJoiningCircle) return;

    setIsJoiningCircle(true);
    try {
      const result = await joinCircle(id, payload);
      if (result.membershipStatus === 'pending') {
        toast.success('入圈申请已提交，等待审核通过后即可查看组队');
        setCircle((prev) => prev ? { ...prev, membershipStatus: 'pending', isJoined: false } : prev);
        setPendingJoinRequest(result.requestId ? {
          id: result.requestId,
          circleId: id,
          circleName: circle?.name || '',
          status: result.requestStatus || 'pending_review',
          expiresAt: result.expiresAt || null,
          createdAt: new Date().toISOString(),
        } : null);
        setShowJoinModal(false);
        return;
      }

      toast.success('已加入圈子');
      setShowJoinModal(false);
      if (redirectAfterJoin) {
        navigate(redirectAfterJoin, { replace: true });
        return;
      }

      setCircle((prev) => prev ? { ...prev, isJoined: true, membershipStatus: 'active' } : prev);
      try {
        const [locationRes] = await Promise.all([
          getCircleLocationStatus(id).catch(() => null),
          loadMembers(1, false, false),
        ]);
        setLocationStatus(locationRes);
      } catch {
        setCanViewMembers(true);
      }
      setShowOverrideModal(true);
    } catch (err: any) {
      toast.error(err.message || '加入圈子失败，请稍后重试');
    } finally {
      setIsJoiningCircle(false);
    }
  };

  const handleWithdrawJoinRequest = async () => {
    if (!id || !circle || !pendingJoinRequest || isWithdrawingJoinRequest) return;

    const confirmed = await confirm({
      title: '撤回入圈申请',
      message: `确认撤回加入「${circle.name}」的申请吗？撤回后如需加入，需要重新提交申请。`,
      confirmText: '撤回',
      tone: 'danger',
      icon: 'undo',
    });
    if (!confirmed) return;

    setIsWithdrawingJoinRequest(true);
    try {
      const result = await withdrawCircleJoinRequest(pendingJoinRequest.id);
      toast.success(result.message || '入圈申请已撤回');
      setPendingJoinRequest(null);
      setCircle((prev) => prev ? { ...prev, membershipStatus: null, isJoined: false } : prev);
    } catch (err: any) {
      toast.error(err.message || '撤回入圈申请失败');
    } finally {
      setIsWithdrawingJoinRequest(false);
    }
  };

  const handleRefreshNearby = async () => {
    if (!id || locationBusy) return;
    setLocationBusy(true);
    try {
      const position = await getBrowserPosition();
      const updated = await updateCircleLocation(id, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      });
      setLocationStatus(updated);
      setNearbyMode(true);
      await loadMembers(1, false, true);
      toast.success(updated.message || '已刷新附近位置');
    } catch (err: any) {
      toast.error(err.message || '无法获取当前位置');
    } finally {
      setLocationBusy(false);
    }
  };

  const handleDisableNearby = async () => {
    if (!id || locationBusy) return;
    setLocationBusy(true);
    try {
      const result = await disableCircleLocation(id);
      setLocationStatus(result);
      setNearbyMode(false);
      await loadMembers(1, false, false);
      toast.success(result.message || '已关闭附近位置展示');
    } catch (err: any) {
      toast.error(err.message || '关闭位置展示失败');
    } finally {
      setLocationBusy(false);
    }
  };

  const handleToggleNearbyMode = async (enabled: boolean) => {
    if (!id || locationBusy) return;
    if (enabled && !locationStatus?.hasValidLocation) {
      await handleRefreshNearby();
      return;
    }
    setNearbyMode(enabled);
    setLoadingMore(true);
    try {
      await loadMembers(1, false, enabled);
    } catch (err: any) {
      toast.error(err.message || '加载附近成员失败');
      setNearbyMode(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRemoveFriendInCircle = async () => {
    if (!id || !selectedUserId || isRemovingFriendInCircle) {
      return;
    }

    const confirmed = await confirm({
      title: '解除本圈好友',
      message: '确认解除你们在这个圈子的好友关系吗？如果你们在其他圈子仍是好友，联系方式会继续保留；只有全部圈子的好友关系都解除后，联系方式才会自动消失。',
      confirmText: '解除',
      tone: 'danger',
      icon: 'person_remove',
    });
    if (!confirmed) {
      return;
    }
    
    setIsRemovingFriendInCircle(true);
    try {
      const result = await deleteFriendInCircle(selectedUserId, id);
      const remainingCircleCount = result.remainingCircleCount ?? result.remainingCircles?.length ?? 0;
      toast.success(
        remainingCircleCount > 0
          ? `已解除本圈好友关系。你们在另外 ${remainingCircleCount} 个圈子仍是好友，联系方式会继续保留。`
          : '已解除最后一层好友关系，联系方式将自动隐藏。',
      );
      setSelectedUserId(null);
      setCardData(null);
    } catch (err: any) {
      toast.error(err.message || '解除本圈好友关系失败');
    } finally {
      setIsRemovingFriendInCircle(false);
    }
  };

  const openLeaveCircleDialog = () => {
    if (!id || !circle || isLeavingCircle) {
      return;
    }
    setLeaveClearTrace(false);
    setLeaveSilent(false);
    setShowLeaveOptions(true);
  };

  const handleLeaveCircle = async () => {
    if (!id || !circle || isLeavingCircle) {
      return;
    }
    
    setIsLeavingCircle(true);
    try {
      const result = await leaveCircle(id!, { clearTrace: leaveClearTrace, silent: leaveSilent });
      
      const friendCleared = result.removedFriendshipCount && result.removedFriendshipCount > 0;
      const traceClearedCount = result.clearedTraceCount ?? 0;
      const summaryParts = [
        friendCleared ? `删除了该圈内 ${result.removedFriendshipCount} 条好友关系` : '',
        leaveClearTrace
          ? traceClearedCount > 0
            ? `清除了 ${traceClearedCount} 条圈内资料痕迹`
            : '已处理圈内资料清理'
          : '',
        result.silent || leaveSilent ? '已按静默方式处理' : '',
      ].filter(Boolean);
      const msg = summaryParts.length > 0
        ? `已退出圈子，${summaryParts.join('，')}。`
        : '已退出圈子。';
    
      toast.success(msg);
      setShowLeaveOptions(false);
      navigate('/circles', { replace: true });
    } catch (err: any) {
      toast.error(err.message || '退出圈子失败');
      setIsLeavingCircle(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex flex-col md:py-20 px-4 md:px-8 relative selection:bg-[#420047] selection:text-[#FCFBF8]"
      style={{
        backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)',
        backgroundSize: '100% 48px',
      }}
    >
      <header className="w-full max-w-4xl mx-auto flex flex-col mb-10 relative z-10 pt-10 md:pt-0">
        <button
          onClick={handleBackToCircles}
          className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors group mb-8 w-max"
        >
          <MaterialIcon name="west" className="text-[18px] group-hover:-translate-x-1 transition-transform" />
          <span className="font-serif tracking-widest text-sm">返回圈界大厅</span>
        </button>

        {circle ? (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#EAE7E1]/60 pb-8">
            <div className="flex items-center gap-6">
              {circle.image || circle.category ? (
                <div className="w-20 h-20 rounded-2xl shadow-sm border border-[#EAE7E1]/50 flex items-center justify-center text-[#420047] bg-[#420047]/5 shrink-0 overflow-hidden">
                  <MaterialIcon name={circle.image || circle.category} className="!text-4xl" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#8B7355]/10 to-[#8B7355]/5 text-[#8B7355] shrink-0 border border-[#EAE7E1] flex items-center justify-center text-4xl font-serif">
                  {circle.name?.charAt(0)}
                </div>
              )}
              <div className="flex flex-col justify-center">
                <h1 className="font-serif text-4xl text-[#2C2825] tracking-widest mb-2 flex items-center gap-3">
                  {circle.name}
                  {/* 使用 Category 作为大标题旁的徽章 */}
                  <span className="text-xs tracking-widest px-3 py-1 rounded-full border border-[#420047]/20 text-[#420047] bg-[#420047]/5 opacity-80 mt-1">
                    {displayCategory(circle.category)}
                  </span>
                </h1>
                <p className="text-[#8B7355] font-serif text-sm tracking-wide line-clamp-1 max-w-sm mt-1">
                  {circle.description}
                </p>
                
                <div className="mt-4 flex flex-wrap gap-3">
                  {circle.isJoined ? (
                    <>
                    <button
                      onClick={() => setShowOverrideModal(true)}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#8B7355]/30 text-[#8B7355] text-sm hover:border-[#420047] hover:text-[#420047] hover:shadow-[0_2px_10px_rgb(66,0,71,0.1)] transition-all duration-300 font-serif w-max"
                    >
                      <MaterialIcon name="draw" className="text-[16px]" />
                      定制同好名片
                    </button>
                    {circle.viewerPermissions?.canViewManage && (
                      <button
                        onClick={() => navigate(`/circles/${id}/manage`)}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#420047]/20 bg-[#420047]/5 text-[#420047] text-sm hover:border-[#420047] hover:bg-[#420047]/10 hover:shadow-[0_2px_10px_rgb(66,0,71,0.1)] transition-all duration-300 font-serif w-max"
                      >
                        <MaterialIcon name="admin_panel_settings" className="text-[16px]" />
                        圈主管理
                      </button>
                    )}
                    <div className="flex flex-col gap-2">
                      <button
                      onClick={() => setShowContactsSettingsModal(true)}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#420047]/20 text-[#420047] text-sm hover:border-[#420047] hover:bg-[#420047]/5 hover:shadow-[0_2px_10px_rgb(66,0,71,0.1)] transition-all duration-300 font-serif w-max"
                      >
                        <MaterialIcon name="contacts" className="text-[16px]" />
                        圈内联系方式
                      </button>
                      <button
                        onClick={openLeaveCircleDialog}
                        disabled={isLeavingCircle}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B94A48]/25 text-[#B94A48] text-sm hover:bg-[#B94A48]/6 transition-all duration-300 font-serif w-max disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <MaterialIcon name={isLeavingCircle ? 'progress_activity' : 'logout'} className={`text-[16px] ${isLeavingCircle ? 'animate-spin' : ''}`} />
                        {isLeavingCircle ? '退出中...' : '退出圈子'}
                      </button>
                    </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleJoinCircle}
                        disabled={isJoiningCircle || circle.membershipStatus === 'pending'}
                        className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#420047] text-[#FCFBF8] text-sm hover:bg-[#2A002D] transition-all duration-300 font-serif w-max disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <MaterialIcon name={isJoiningCircle ? 'progress_activity' : circle.membershipStatus === 'pending' ? 'hourglass_top' : 'login'} className={`text-[16px] ${isJoiningCircle ? 'animate-spin' : ''}`} />
                        {isJoiningCircle ? '加入中...' : circle.membershipStatus === 'pending' ? '入圈审核中' : redirectAfterJoin ? '加入圈子并查看组队' : '加入圈子'}
                      </button>
                      {circle.membershipStatus === 'pending' && pendingJoinRequest && (
                        <button
                          onClick={() => void handleWithdrawJoinRequest()}
                          disabled={isWithdrawingJoinRequest}
                          className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#B94A48]/25 bg-white text-[#B94A48] text-sm hover:bg-[#B94A48]/6 transition-all duration-300 font-serif w-max disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <MaterialIcon name={isWithdrawingJoinRequest ? 'progress_activity' : 'undo'} className={`text-[16px] ${isWithdrawingJoinRequest ? 'animate-spin' : ''}`} />
                          {isWithdrawingJoinRequest ? '撤回中...' : '撤回申请'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-start md:items-end font-serif">
              <div className="text-3xl text-[#2C2825] tracking-widest">{total}</div>
              <div className="text-xs text-[#8B7355]/60 mt-1 tracking-widest">人已解印名帖</div>
            </div>
          </div>
        ) : (
          <div className="h-32 animate-pulse bg-white/50 rounded-xl"></div>
        )}
      </header>
    
      <main className="w-full max-w-4xl mx-auto relative z-10 flex-1 flex flex-col mb-20">
        
        {circle?.isJoined && (
          <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate(`/circles/${id}/teamups`)}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#EAE7E1]/60 bg-gradient-to-r from-[#FCFBF8] to-[#f7f5f0] p-6 text-left shadow-[0_4px_20px_rgba(139,115,85,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(139,115,85,0.06)]"
            >
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#8B7355]/10">
                  <MaterialIcon name="diversity_3" className="text-2xl text-[#8B7355]" />
                </div>
                <div>
                  <h3 className="mb-1 flex flex-wrap items-center gap-2 font-serif text-lg tracking-widest text-[#2C2825]">
                    同游诏书 (组队)
                    <span className="rounded-full border border-[#8B7355]/20 bg-[#8B7355]/10 px-2 py-0.5 font-sans text-[10px] tracking-normal text-[#8B7355]">
                      圈内限定
                    </span>
                  </h3>
                  <p className="font-serif text-sm text-[#8B7355]/80">
                    寻觅同好，结伴而行。仅限本圈成员参与的专属组队空间。
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-5 flex items-center gap-2 font-serif text-sm tracking-widest text-[#420047] transition-colors group-hover:text-[#611066]">
                开启卷宗
                <MaterialIcon name="east" className="text-[18px] transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/circles/${id}/livechat`)}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#EAE7E1]/60 bg-gradient-to-r from-[#FCFBF8] to-[#f7f5f0] p-6 text-left shadow-[0_4px_20px_rgba(139,115,85,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(139,115,85,0.06)]"
            >
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#420047]/10">
                  <MaterialIcon name="forum" className="text-2xl text-[#420047]" />
                </div>
                <div>
                  <h3 className="mb-1 flex flex-wrap items-center gap-2 font-serif text-lg tracking-widest text-[#2C2825]">
                    圈内茶话 (LiveChat)
                    <span className="rounded-full border border-[#420047]/20 bg-[#420047]/5 px-2 py-0.5 font-sans text-[10px] tracking-normal text-[#420047]">
                      实时交流
                    </span>
                  </h3>
                  <p className="font-serif text-sm text-[#8B7355]/80">
                    进入独立茶话间，再与同圈成员实时闲谈。
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-5 flex items-center gap-2 font-serif text-sm tracking-widest text-[#420047] transition-colors group-hover:text-[#611066]">
                进入茶话间
                <MaterialIcon name="east" className="text-[18px] transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        )}
    
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-serif text-xl tracking-widest text-[#2C2825] flex items-center gap-2">
            <MaterialIcon name="public" className="text-[#8B7355]/60 text-lg" />
            {nearbyMode ? '附近的人' : '组队大厅成员'}
          </h2>
          {circle?.isJoined && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <select
                value={radiusMeters}
                onChange={async (event) => {
                  const nextRadius = Number(event.target.value);
                  setRadiusMeters(nextRadius);
                  if (nearbyMode) {
                    try {
                      await loadMembers(1, false, true, { radiusMeters: nextRadius });
                    } catch (err: any) {
                      toast.error(err.message || '加载附近成员失败');
                    }
                  }
                }}
                disabled={locationBusy || !nearbyMode}
                className="rounded-full border border-[#EAE7E1] bg-white px-3 py-1.5 text-xs text-[#8B7355] outline-none disabled:opacity-50"
              >
                <option value={1000}>1km</option>
                <option value={5000}>5km</option>
                <option value={10000}>10km</option>
                <option value={50000}>50km</option>
              </select>
              <label className="inline-flex select-none items-center gap-1.5 rounded-full border border-[#EAE7E1] bg-white px-3 py-1.5 text-xs text-[#8B7355]">
                <input
                  type="checkbox"
                  checked={includeUnknownDistance}
                  disabled={!nearbyMode || locationBusy}
                  onChange={async (event) => {
                    const nextIncludeUnknownDistance = event.target.checked;
                    setIncludeUnknownDistance(nextIncludeUnknownDistance);
                    if (nearbyMode) {
                      try {
                        await loadMembers(1, false, true, {
                          includeUnknownDistance: nextIncludeUnknownDistance,
                        });
                      } catch (err: any) {
                        toast.error(err.message || '加载附近成员失败');
                      }
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-[#8B7355]/30 text-[#420047] focus:ring-[#420047]"
                />
                含未共享
              </label>
              <button
                type="button"
                onClick={() => handleToggleNearbyMode(!nearbyMode)}
                disabled={locationBusy}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                  nearbyMode
                    ? 'border border-[#420047]/25 bg-[#420047]/5 text-[#420047]'
                    : 'border border-[#EAE7E1] bg-white text-[#8B7355] hover:text-[#420047]'
                }`}
              >
                <MaterialIcon name="near_me" className="text-[15px]" />
                {nearbyMode ? '查看全部' : '附近的人'}
              </button>
              <button
                type="button"
                onClick={handleRefreshNearby}
                disabled={locationBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#EAE7E1] bg-white px-3 py-1.5 text-xs text-[#8B7355] transition-colors hover:text-[#420047] disabled:opacity-60"
              >
                <MaterialIcon name={locationBusy ? 'progress_activity' : 'my_location'} className={`text-[15px] ${locationBusy ? 'animate-spin' : ''}`} />
                刷新位置
              </button>
              {locationStatus?.enabled && (
                <button
                  type="button"
                  onClick={handleDisableNearby}
                  disabled={locationBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#B94A48]/25 bg-white px-3 py-1.5 text-xs text-[#B94A48] transition-colors hover:bg-[#B94A48]/6 disabled:opacity-60"
                >
                  <MaterialIcon name="location_off" className="text-[15px]" />
                  关闭位置
                </button>
              )}
            </div>
          )}
        </div>
    
        {loading ? (
          <div className="flex justify-center py-20 text-[#8B7355]">
            <MaterialIcon name="refresh" className="animate-spin text-2xl" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-[#8B7355] font-serif text-center py-20 border border-dashed border-[#EAE7E1] rounded-2xl">
            此时大厅冷清，静待其他名帖落定。
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {members.map(member => (
                <MemberChannelItem 
                  key={member.userId} 
                  member={member} 
                  onViewCard={handleViewCard} 
                />
              ))}
            </AnimatePresence>
            
            {members.length < total && (
              <button 
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-6 flex items-center justify-center gap-2 py-4 border border-[#EAE7E1] bg-white/50 rounded-xl text-[#8B7355]/80 hover:text-[#2C2825] hover:bg-white transition-all font-serif group"
              >
                {loadingMore ? (
                  <MaterialIcon name="refresh" className="animate-spin text-[16px]" />
                ) : (
                  <MaterialIcon name="expand_more" className="text-[16px] group-hover:translate-y-0.5 transition-transform" />
                )}
                {loadingMore ? '翻阅中...' : '揭开更多名帖'}
              </button>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showLeaveOptions && circle && (
          <motion.div
            className="fixed inset-0 z-[135] flex items-center justify-center bg-[#2C2825]/35 px-4 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isLeavingCircle) setShowLeaveOptions(false);
            }}
          >
            <motion.div
              className="w-full max-w-md overflow-hidden rounded-[24px] bg-[#FCFBF8] shadow-[0_24px_80px_rgba(44,40,37,0.18),0_0_0_1px_rgba(234,231,225,0.72)]"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-4 px-6 pb-5 pt-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-900/20 bg-red-50 text-red-900">
                  <MaterialIcon name="logout" className="text-[21px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl tracking-widest text-[#2C2825]">退出圈子</h2>
                  <p className="mt-3 text-sm font-serif leading-relaxed text-[#8B7355]">
                    确认退出「{circle.name}」吗？退出后会同步删除你在这个圈子里的好友关系，但不会影响其他圈子的关系。
                  </p>
                  <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#EAE7E1] bg-white/70 px-4 py-3 transition-colors hover:border-[#420047]/25">
                      <input
                        type="checkbox"
                        checked={leaveClearTrace}
                        disabled={isLeavingCircle}
                        onChange={(event) => setLeaveClearTrace(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-[#8B7355]/30 text-[#420047] focus:ring-[#420047] disabled:opacity-50"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-serif text-[#2C2825]">清除圈内资料与申请记录</span>
                        <span className="mt-1 block text-xs leading-5 text-[#8B7355]">
                          同步清理圈内名片、联系方式、位置冷却和入圈申请记录。
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#EAE7E1] bg-white/70 px-4 py-3 transition-colors hover:border-[#420047]/25">
                      <input
                        type="checkbox"
                        checked={leaveSilent}
                        disabled={isLeavingCircle}
                        onChange={(event) => setLeaveSilent(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-[#8B7355]/30 text-[#420047] focus:ring-[#420047] disabled:opacity-50"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-serif text-[#2C2825]">静默处理关联通知</span>
                        <span className="mt-1 block text-xs leading-5 text-[#8B7355]">
                          尽量减少本次退圈触发的关联通知。
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[#EAE7E1]/65 bg-[#F7F4EF]/45 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowLeaveOptions(false)}
                  disabled={isLeavingCircle}
                  className="rounded-full border border-[#EAE7E1]/90 bg-[#FCFBF8] px-5 py-2 text-sm font-serif tracking-widest text-[#8B7355] transition hover:bg-white hover:text-[#2C2825] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleLeaveCircle}
                  disabled={isLeavingCircle}
                  className="inline-flex items-center gap-2 rounded-full bg-red-900 px-5 py-2 text-sm font-serif tracking-widest text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MaterialIcon name={isLeavingCircle ? 'progress_activity' : 'logout'} className={`text-[16px] ${isLeavingCircle ? 'animate-spin' : ''}`} />
                  {isLeavingCircle ? '退出中...' : '确认退出'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
      <AnimatePresence>
        {selectedUserId && cardData && (
          <PublicCardModal 
            onClose={() => {
              setSelectedUserId(null);
              setCardData(null);
            }} 
            circleId={id}
            cardData={cardData}
            onAddFriend={handleAddFriend}
            onRemoveFriendInCircle={cardData.isCircleFriend ? handleRemoveFriendInCircle : undefined}
            isRemovingFriendInCircle={isRemovingFriendInCircle}
          />
        )}
      </AnimatePresence>
      <CircleJoinModal
        circle={circle}
        isOpen={showJoinModal && Boolean(circle)}
        submitting={isJoiningCircle}
        submitLabel={redirectAfterJoin ? '加入并继续' : undefined}
        onClose={() => {
          if (!isJoiningCircle) setShowJoinModal(false);
        }}
        onSubmit={handleJoinSubmit}
      />
    
      <CircleCardOverrideModal
        circleId={id!}
        circleName={circle?.name || ''}
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
      />
      {id && (
        <CircleContactsSettingsModal
          circleId={id}
          circleName={circle?.name || ''}
          isOpen={showContactsSettingsModal}
          onClose={() => setShowContactsSettingsModal(false)}
        />
      )}
      {confirmDialog}
    </div>
  );
}
