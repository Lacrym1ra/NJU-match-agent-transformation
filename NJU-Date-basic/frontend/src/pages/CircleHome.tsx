import React, { useDeferredValue, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Circle,
  JoinCirclePayload,
  SentCircleJoinRequest,
  createCircle,
  devApproveCreatedCircle,
  devApproveOwnCircleJoinRequest,
  getCircles,
  getLocalTestCapabilities,
  getMyCircles,
  getMyCreatedCircles,
  getSentCircleJoinRequests,
  joinCircle,
  leaveCircle,
  withdrawCircleJoinRequest,
} from '../api/circles';
import CircleCardOverrideModal  from '../components/CircleCardOverrideModal';
import CircleJoinModal from '../components/CircleJoinModal';
import { toast } from '../components/Toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import MaterialIcon from '../components/MaterialIcon';
import {
  EMPTY_CIRCLE_CREATE_FORM,
  displayCircleCategory,
  getAvailableCircleCategories,
  getCircleStatusLabel,
  matchesCircleFilters,
  normalizeCircleSearchQuery,
  normalizeCreateCirclePayload,
  splitJoinedCircles,
} from '../modules/circles/discovery';

export const CircleHome: React.FC = () => {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [createdCircles, setCreatedCircles] = useState<Circle[]>([]);
  const [sentJoinRequests, setSentJoinRequests] = useState<SentCircleJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUnjoinedExpanded, setIsUnjoinedExpanded] = useState(false);
  const [editingCardCircle, setEditingCardCircle] = useState<Circle | null>(null);
  const [joiningCircle, setJoiningCircle] = useState<Circle | null>(null);
  const [joiningCircleId, setJoiningCircleId] = useState<string | null>(null);
  const [withdrawingJoinRequestId, setWithdrawingJoinRequestId] = useState<string | null>(null);
  const [devApprovingJoinRequestId, setDevApprovingJoinRequestId] = useState<string | null>(null);
  const [devApprovingCreatedCircleId, setDevApprovingCreatedCircleId] = useState<string | null>(null);
  const [localTestEnabled, setLocalTestEnabled] = useState(false);
  const [leavingCircleId, setLeavingCircleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CIRCLE_CREATE_FORM);

  // 当前选中的 Category
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    fetchCircles();
    void getLocalTestCapabilities().then((result) => setLocalTestEnabled(result.enabled));
  }, []);

  const fetchCircles = async () => {
    setLoading(true);
    try {
      // 并发请求：未加入列表 和 已加入列表
      const [unjoinedRes, joinedRes, createdRes, sentJoinRes] = await Promise.all([
        getCircles(), 
        getMyCircles(),
        getMyCreatedCircles(),
        getSentCircleJoinRequests({ limit: 20 }),
      ]);
      
      // 合并数据，并强制打上 isJoined 标识以供前端使用
      const joinedIds = new Set((joinedRes.circles || []).map((circle) => circle.id));
      const unjoined = (unjoinedRes.circles || [])
        .filter((circle) => !joinedIds.has(circle.id))
        .map(c => ({ ...c, isJoined: false }));
      const joined = (joinedRes.circles || []).map(c => ({ ...c, isJoined: true }));
      
      setCircles([...joined, ...unjoined]);
      setCreatedCircles(
        (createdRes.circles || [])
          .filter((circle) => !joinedIds.has(circle.id) && (circle.status !== 'active' || circle.isActive === false))
          .map((circle) => ({ ...circle, isJoined: false })),
      );
      setSentJoinRequests(sentJoinRes.requests || []);
    } catch (error) {
      toast.error("无法加载圈子列表，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAndEditCard = async (circle: Circle) => {
    if (circle.membershipStatus === 'pending') {
      toast.warning('入圈申请正在审核，可在“我发出的入圈申请”中撤回');
      return;
    }
    setJoiningCircle(circle);
  };

  const handleJoinSubmit = async (payload: JoinCirclePayload) => {
    if (!joiningCircle || joiningCircleId) return;

    setJoiningCircleId(joiningCircle.id);
    try {
      const result = await joinCircle(joiningCircle.id, payload);
      if (result.membershipStatus === 'pending') {
        toast.success('入圈申请已提交，等待圈主审核');
        setJoiningCircle(null);
        await fetchCircles();
        return;
      }

      toast.success('已加入圈子');
      setEditingCardCircle(joiningCircle);
      setJoiningCircle(null);
      await fetchCircles();
    } catch (error: any) {
      toast.error(error?.message || '加入圈子失败，请稍后重试');
    } finally {
      setJoiningCircleId(null);
    }
  };

  const handleCreateCircle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingCircle) return;
    const payload = normalizeCreateCirclePayload(createForm);
    if (!payload.name || !payload.description || !payload.category) {
      toast.error('请完整填写圈子名称、简介和分类');
      return;
    }

    setCreatingCircle(true);
    try {
      const result = await createCircle(payload);
      toast.success(result.message || '圈子已提交审核');
      setCreateForm(EMPTY_CIRCLE_CREATE_FORM);
      setShowCreateCircle(false);
      await fetchCircles();
    } catch (error: any) {
      toast.error(error?.message || '提交圈子失败');
    } finally {
      setCreatingCircle(false);
    }
  };

  const handleLeaveCircle = async (circle: Circle) => {
    if (leavingCircleId) return;

    const confirmed = await confirm({
      title: '退出圈子',
      message: `确认退出「${circle.name}」吗？退出后会同步删除你在这个圈子里的好友关系，但不会影响全局好友关系和已保留的联系方式。`,
      confirmText: '退出',
      tone: 'danger',
      icon: 'logout',
    });
    if (!confirmed) {
      return;
    }

    setLeavingCircleId(circle.id);
    try {
      const result = await leaveCircle(circle.id);
      toast.success(
        result.removedFriendshipCount && result.removedFriendshipCount > 0
          ? `已退出圈子，并删除了该圈内 ${result.removedFriendshipCount} 条好友关系。`
          : '已退出圈子。',
      );
      await fetchCircles();
    } catch (error: any) {
      toast.error(error?.message || '退出圈子失败');
    } finally {
      setLeavingCircleId(null);
    }
  };

  const handleWithdrawJoinRequest = async (request: SentCircleJoinRequest) => {
    if (withdrawingJoinRequestId) return;
    const confirmed = await confirm({
      title: '撤回入圈申请',
      message: `确认撤回加入「${request.circleName}」的申请吗？撤回后如需加入，需要重新提交申请。`,
      confirmText: '撤回',
      tone: 'danger',
      icon: 'undo',
    });
    if (!confirmed) return;

    setWithdrawingJoinRequestId(request.id);
    try {
      const result = await withdrawCircleJoinRequest(request.id);
      toast.success(result.message || '入圈申请已撤回');
      await fetchCircles();
    } catch (error: any) {
      toast.error(error?.message || '撤回入圈申请失败');
    } finally {
      setWithdrawingJoinRequestId(null);
    }
  };

  const handleDevApproveOwnRequest = async (request: SentCircleJoinRequest) => {
    if (!localTestEnabled || devApprovingJoinRequestId) return;
    setDevApprovingJoinRequestId(request.id);
    try {
      const result = await devApproveOwnCircleJoinRequest(request.id);
      toast.success(result.message || '测试申请已通过');
      await fetchCircles();
    } catch (error: any) {
      toast.error(error?.message || '测试一键通过失败');
    } finally {
      setDevApprovingJoinRequestId(null);
    }
  };

  const handleDevApproveCreatedCircle = async (circle: Circle) => {
    if (!localTestEnabled || devApprovingCreatedCircleId) return;
    setDevApprovingCreatedCircleId(circle.id);
    try {
      const result = await devApproveCreatedCircle(circle.id);
      toast.success(result.message || '测试圈子已审核通过');
      await fetchCircles();
    } catch (error: any) {
      toast.error(error?.message || '圈子测试审核失败');
    } finally {
      setDevApprovingCreatedCircleId(null);
    }
  };

  // 提取当前存在的所有大类
  const allAvailableCategories = useMemo(() => {
    return getAvailableCircleCategories([...circles, ...createdCircles]);
  }, [circles, createdCircles]);

  // 前端丝滑过滤
  const normalizedCircleQuery = normalizeCircleSearchQuery(deferredSearchQuery);
  const filteredCircles = useMemo(() => {
    return circles.filter((circle) => matchesCircleFilters(circle, activeCategory, normalizedCircleQuery));
  }, [circles, activeCategory, normalizedCircleQuery]);

  const filteredCreatedCircles = useMemo(() => {
    return createdCircles
      .filter((circle) => (circle.status || (circle.isActive ? 'active' : 'inactive')) !== 'active')
      .filter((circle) => matchesCircleFilters(circle, activeCategory, normalizedCircleQuery));
  }, [createdCircles, activeCategory, normalizedCircleQuery]);

  const { joinedCircles, unjoinedCircles } = splitJoinedCircles(filteredCircles);
  const pendingSentJoinRequests = sentJoinRequests.filter((request) => request.status === 'pending_review');
  const shouldShowUnjoined = isUnjoinedExpanded || deferredSearchQuery.trim().length > 0;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans selection:bg-[#420047] selection:text-white px-6 md:px-20 py-12 relative">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="max-w-5xl mx-auto mb-10">
        <button onClick={handleBackToDashboard} className="flex items-center text-[#8B7355] hover:text-[#2C2825] transition-colors mb-8 text-sm tracking-wide">
          <span className="mr-2">←</span> 返回档案
        </button>
        <h1 className="text-4xl md:text-5xl font-serif text-[#2C2825] mb-4 tracking-wide">破冰频道</h1>
        <p className="text-[#8B7355] leading-relaxed max-w-2xl text-sm md:text-base">
          不同的圈子，不同维度的你。 在这里，没有喧嚣的群聊，只有共同爱好的灵魂与公开的名片。 发现适合你的圈子，结识新的朋友。
        </p>
        <button
          type="button"
          onClick={() => setShowCreateCircle(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#420047]/20 bg-white px-5 py-2 text-sm font-serif tracking-widest text-[#420047] shadow-sm transition-colors hover:bg-[#420047]/5"
        >
          <MaterialIcon name="add_circle" className="text-[18px]" />
          申请创建圈子
        </button>
        <div className="mt-6 max-w-xl">
          <label htmlFor="circle-search" className="mb-2 block text-xs uppercase tracking-[0.25em] text-[#8B7355]/80">
            搜索圈子
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7355]/45">
              <MaterialIcon name="search" className="text-[20px]" />
            </span>
            <input
              id="circle-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="按圈子名、描述、分类或标签搜索"
              className="w-full rounded-2xl border border-[#8B7355]/15 bg-white/90 py-3 pl-12 pr-24 text-sm text-[#2C2825] shadow-[0_8px_30px_rgb(0,0,0,0.03)] outline-none transition-all placeholder:text-[#8B7355]/45 focus:border-[#420047]/30 focus:shadow-[0_10px_35px_rgb(66,0,71,0.08)]"
            />
            {hasSearchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs text-[#8B7355] transition-colors hover:bg-[#8B7355]/8 hover:text-[#2C2825]"
              >
                清空
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* 大类过滤器 (Category Filter) */}
      {!loading && allAvailableCategories.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto mb-10 flex flex-wrap gap-3">
          <button 
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-serif transition-all duration-300 ${!activeCategory ? 'bg-[#420047] text-white shadow-md' : 'bg-white text-[#8B7355] hover:bg-[#8B7355]/10 border border-[#EAE7E1]'}`}
          >
            全部界域
          </button>
          {allAvailableCategories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-serif transition-all duration-300 ${activeCategory === cat ? 'bg-[#420047] text-white shadow-md' : 'bg-white text-[#8B7355] hover:bg-[#8B7355]/10 border border-[#EAE7E1]'}`}
            >
              {displayCircleCategory(cat)}
            </button>
          ))}
        </motion.div>
      )}
    
      {loading ? (
        <div className="text-center text-[#8B7355] mt-20 animate-pulse">正在整理卷宗...</div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-16">
          {pendingSentJoinRequests.length > 0 && (
            <section className="rounded-2xl border border-[#420047]/15 bg-[#420047]/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-lg tracking-widest text-[#2C2825]">我发出的入圈申请</h2>
                <span className="text-xs font-serif text-[#420047]">{pendingSentJoinRequests.length} 条待审核</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pendingSentJoinRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-[#420047]/10 bg-white/75 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-base text-[#2C2825]">{request.circleName}</h3>
                        <p className="mt-1 text-xs font-serif tracking-widest text-[#8B7355]">
                          {request.expiresAt ? `过期于 ${new Date(request.expiresAt).toLocaleString('zh-CN')}` : '等待圈主审核'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {localTestEnabled && (
                          <button
                            type="button"
                            onClick={() => void handleDevApproveOwnRequest(request)}
                            disabled={Boolean(devApprovingJoinRequestId || withdrawingJoinRequestId)}
                            title="仅本地 development 环境可用"
                            className="rounded-full bg-[#420047] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#5b155f] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {devApprovingJoinRequestId === request.id ? '通过中...' : '测试一键通过'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleWithdrawJoinRequest(request)}
                          disabled={Boolean(withdrawingJoinRequestId || devApprovingJoinRequestId)}
                          className="rounded-full border border-[#B94A48]/25 px-3 py-1.5 text-xs text-[#B94A48] transition-colors hover:bg-[#B94A48]/6 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {withdrawingJoinRequestId === request.id ? '撤回中...' : '撤回'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {filteredCreatedCircles.length > 0 && (
            <section className="rounded-2xl border border-dashed border-[#8B7355]/25 bg-white/55 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-lg tracking-widest text-[#2C2825]">我创建的圈子</h2>
                <span className="text-xs font-serif text-[#8B7355]">{filteredCreatedCircles.length} 个待处理</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredCreatedCircles.map((circle) => (
                  <div key={circle.id} className="rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-base text-[#2C2825]">{circle.name}</h3>
	                        <p className="mt-1 line-clamp-2 text-sm text-[#8B7355]">{circle.description}</p>
	                        {circle.status === 'rejected' && circle.reviewNote && (
	                          <p className="mt-2 rounded-lg bg-[#B94A48]/6 px-3 py-2 text-xs leading-5 text-[#B94A48]">未通过原因：{circle.reviewNote}</p>
	                        )}
	                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full border border-[#8B7355]/20 px-2.5 py-1 text-xs text-[#8B7355]">
                          {getCircleStatusLabel(circle)}
                        </span>
                        {localTestEnabled && circle.status === 'pending_review' && (
                          <button
                            type="button"
                            onClick={() => void handleDevApproveCreatedCircle(circle)}
                            disabled={Boolean(devApprovingCreatedCircleId)}
                            title="仅本地 development 环境可用"
                            className="rounded-full bg-[#420047] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#5b155f] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {devApprovingCreatedCircleId === circle.id ? '审核中...' : '测试一键通过圈子'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 我的圈子 */}
          {joinedCircles.length > 0 && (
            <motion.div variants={containerVariants} initial="hidden" animate="show">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {joinedCircles.map(circle => (
                  <motion.div key={circle.id} variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(66,0,71,0.08)] transition-all duration-300 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#FCFBF8] flex items-center justify-center text-2xl text-[#8B7355] shadow-inner overflow-hidden">
                          <MaterialIcon name={circle.image || circle.category} />
                        </div>
                        <div>
                          <h3 className="font-serif text-xl text-[#2C2825] mb-1">{circle.name}</h3>
                          <p className="text-xs text-[#8B7355] flex items-center gap-1"><span>👥</span> {circle.memberCount} 人已驻留</p>
                        </div>
                      </div>
                      <p className="text-sm text-[#5a544e] mb-4 line-clamp-2">{circle.description}</p>
                      
                      {/* 展示 Category */}
                      {circle.category && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="px-2.5 py-1 bg-[#8B7355]/5 text-[#8B7355] text-xs rounded-full font-serif tracking-wider">
                            {displayCircleCategory(circle.category)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#8B7355]/10 to-transparent mb-4" />
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-xs text-gray-400 italic font-serif">已解锁圈子名片</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLeaveCircle(circle)}
                            disabled={leavingCircleId === circle.id}
                            className="px-3 py-1.5 rounded-full border border-[#B94A48]/25 text-[#B94A48] text-xs hover:bg-[#B94A48]/6 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {leavingCircleId === circle.id ? '退出中...' : '退出圈子'}
                          </button>
                          <button onClick={() => navigate(`/circles/${circle.id}`)} className="text-[#420047] text-sm font-medium hover:tracking-widest transition-all duration-300 flex items-center gap-1">
                            踏入大厅 <span className="text-lg leading-none">→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
    
          {/* 未加入的圈子 */}
          {unjoinedCircles.length > 0 && (
            <div>
              <div className="flex items-center justify-center mb-8">
                <button onClick={() => setIsUnjoinedExpanded(!isUnjoinedExpanded)} className="px-6 py-2 rounded-full border border-[#8B7355]/20 text-[#8B7355] text-sm hover:bg-[#8B7355]/5 hover:text-[#420047] transition-all duration-300 flex items-center gap-2">
                  {isUnjoinedExpanded ? '收起尘封的档案' : '探索更多未知的领域'} 
                  <motion.span animate={{ rotate: isUnjoinedExpanded ? 180 : 0 }} className="inline-block text-xs">▼</motion.span>
                </button>
              </div>
    
              <AnimatePresence>
                {shouldShowUnjoined && (
                  <motion.div initial="hidden" animate="show" exit={{ opacity: 0, height: 0, overflow: 'hidden' }} variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {unjoinedCircles.map(circle => (
                      <motion.div key={circle.id} variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity duration-300">
                        <div>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#FCFBF8] flex items-center justify-center text-2xl text-[#8B7355] shadow-inner grayscale opacity-70 overflow-hidden">
                              <MaterialIcon name={circle.image || circle.category} />
                            </div>
                            <div>
                              <h3 className="font-serif text-xl text-[#2C2825] mb-1">{circle.name}</h3>
                              <p className="text-xs text-[#8B7355] flex items-center gap-1"><span>👥</span> {circle.memberCount} 人已驻留</p>
                            </div>
                          </div>
                          <p className="text-sm text-[#5a544e] mb-4 line-clamp-2">{circle.description}</p>
                          
                          {/* 展示 Category */}
                          {circle.category && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              <span className="px-2.5 py-1 bg-[#8B7355]/5 text-[#8B7355] text-xs rounded-full font-serif tracking-wider">
                                {displayCircleCategory(circle.category)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#8B7355]/10 to-transparent mb-4" />
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400 italic font-serif">名帖被封印</span>
                            <button 
                              onClick={() => handleJoinAndEditCard(circle)} 
                              disabled={circle.membershipStatus === 'pending'}
                              className="px-4 py-1.5 rounded-full border border-[#8B7355]/30 text-[#8B7355] text-sm hover:border-[#420047] hover:text-[#420047] hover:shadow-[0_2px_10px_rgb(66,0,71,0.1)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-55"
                            >
                              {circle.membershipStatus === 'pending' ? '审核中' : '加入并解印'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          {(activeCategory || hasSearchQuery) && filteredCreatedCircles.length === 0 && joinedCircles.length === 0 && unjoinedCircles.length === 0 && (
             <div className="text-center text-[#8B7355] py-20 italic">
               {hasSearchQuery ? '没有找到符合搜索条件的圈子。' : '此界域尚无匹配的圈子。'}
             </div>
          )}
        </div>
      )}
    
      {editingCardCircle && (
        <CircleCardOverrideModal
          circleId={editingCardCircle.id}
          circleName={editingCardCircle.name}
          isOpen={!!editingCardCircle}
          onClose={() => {
            setEditingCardCircle(null);
            fetchCircles(); // 刷新列表，重新拉取 my 和 all
          }}
        />
      )}
      <CircleJoinModal
        circle={joiningCircle}
        isOpen={Boolean(joiningCircle)}
        submitting={Boolean(joiningCircleId)}
        onClose={() => {
          if (!joiningCircleId) setJoiningCircle(null);
        }}
        onSubmit={handleJoinSubmit}
      />
      {showCreateCircle && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm">
          <form onSubmit={handleCreateCircle} className="w-full max-w-xl overflow-hidden rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#EAE7E1] bg-white px-5 py-4">
              <h2 className="font-serif text-lg tracking-widest text-[#2C2825]">申请创建圈子</h2>
              <button
                type="button"
                onClick={() => setShowCreateCircle(false)}
                className="rounded-full p-2 text-[#8B7355] transition-colors hover:bg-[#F3F1ED] hover:text-[#2C2825]"
                aria-label="关闭"
              >
                <MaterialIcon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">圈子名称</span>
                <input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={30}
                  className="w-full rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">分类</span>
                <input
                  value={createForm.category}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                  maxLength={40}
                  className="w-full rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]/40"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">简介</span>
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  maxLength={200}
                  className="min-h-24 w-full resize-none rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">标签</span>
                <input
                  value={createForm.tags}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tags: event.target.value }))}
                  maxLength={120}
                  className="w-full rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">入圈方式</span>
                <select
                  value={createForm.joinPolicy}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, joinPolicy: event.target.value as 'public' | 'review' }))}
                  className="w-full rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]/40"
                >
                  <option value="review">申请审核</option>
                  <option value="public">公开加入</option>
                </select>
              </label>
              {createForm.joinPolicy === 'review' && (
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">入圈问题</span>
                  <input
                    value={createForm.joinQuestion}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, joinQuestion: event.target.value }))}
                    maxLength={120}
                    className="w-full rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]/40"
                  />
                </label>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-[#EAE7E1] bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => setShowCreateCircle(false)}
                className="rounded-full border border-[#EAE7E1] px-4 py-2 text-sm text-[#8B7355] transition-colors hover:bg-[#F3F1ED]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={creatingCircle}
                className="inline-flex items-center gap-2 rounded-full bg-[#420047] px-5 py-2 text-sm text-[#FCFBF8] transition-colors hover:bg-[#2A002D] disabled:opacity-60"
              >
                <MaterialIcon name={creatingCircle ? 'progress_activity' : 'send'} className={`text-[16px] ${creatingCircle ? 'animate-spin' : ''}`} />
                {creatingCircle ? '提交中...' : '提交审核'}
              </button>
            </div>
          </form>
        </div>
      )}
      {confirmDialog}
    </div>
  );
};
