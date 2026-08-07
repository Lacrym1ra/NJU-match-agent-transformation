import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CircleJoinRequest,
  CircleJoinRequestStatus,
  CircleManageMember,
  CircleManageOverview,
  JoinPolicyMode,
  dissolveCircle,
  getCircleJoinRequests,
  getCircleManageOverview,
  getCircleManageMembers,
  getLocalTestCapabilities,
  reviewCircleJoinRequest,
  transferCircleOwner,
  updateJoinPolicy,
} from '../api/circles';
import { toast } from '../components/Toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import MaterialIcon from '../components/MaterialIcon';
import {
  JOIN_POLICY_OPTIONS,
  REQUEST_FILTERS,
  formatCircleManageDate,
  getCircleApplicantName,
  getCircleJoinRequestText,
  getCirclePolicyMode,
} from '../modules/circles/management';

function getCircleManageMemberName(member: CircleManageMember) {
  return member.profile.nickname?.trim() || '未命名同学';
}

function getCircleManageMemberMeta(member: CircleManageMember) {
  return [member.profile.department, member.profile.grade].filter(Boolean).join(' · ') || '资料未标注';
}

export default function CircleManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [overview, setOverview] = useState<CircleManageOverview | null>(null);
  const [requests, setRequests] = useState<CircleJoinRequest[]>([]);
  const [members, setMembers] = useState<CircleManageMember[]>([]);
  const [requestFilter, setRequestFilter] = useState<CircleJoinRequestStatus | 'all'>('pending_review');
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [localTestEnabled, setLocalTestEnabled] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [transferringOwner, setTransferringOwner] = useState(false);
  const [dissolvingCircle, setDissolvingCircle] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<JoinPolicyMode>('public');
  const [inviteCode, setInviteCode] = useState('');
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, { reason: string; silent: boolean }>>({});

  const pendingCount = overview?.counts.pendingJoinRequests ?? 0;
  const currentPolicy = overview ? getCirclePolicyMode(overview.circle.joinPolicy) : 'public';
  const policyChanged = selectedPolicy !== currentPolicy || (selectedPolicy === 'invite' && inviteCode.trim().length > 0);

  const selectedPolicyOption = useMemo(
    () => JOIN_POLICY_OPTIONS.find((option) => option.value === selectedPolicy) ?? JOIN_POLICY_OPTIONS[0],
    [selectedPolicy],
  );
  const transferCandidates = useMemo(
    () => members.filter((member) => member.role !== 'owner' && member.membershipStatus === 'active' && member.isActive),
    [members],
  );
  const transferTarget = useMemo(
    () => transferCandidates.find((member) => member.userId === transferTargetUserId) ?? null,
    [transferCandidates, transferTargetUserId],
  );

  const loadManageData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [overviewRes, requestsRes, membersRes] = await Promise.all([
        getCircleManageOverview(id),
        getCircleJoinRequests(id, { status: requestFilter, limit: 30 }),
        getCircleManageMembers(id, { limit: 50 }),
      ]);
      setOverview(overviewRes);
      setSelectedPolicy(getCirclePolicyMode(overviewRes.circle.joinPolicy));
      setRequests(requestsRes.requests || []);
      const nextMembers = membersRes.members || [];
      setMembers(nextMembers);
      setTransferTargetUserId((prev) => (
        nextMembers.some((member) => member.userId === prev && member.role !== 'owner')
          ? prev
          : nextMembers.find((member) => member.role !== 'owner' && member.membershipStatus === 'active' && member.isActive)?.userId || ''
      ));
    } catch (err: any) {
      toast.error(err.message || '圈主管理台加载失败');
      navigate(`/circles/${id}`, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadManageData();
  }, [id, requestFilter]);

  useEffect(() => {
    void getLocalTestCapabilities().then((result) => setLocalTestEnabled(result.enabled));
  }, []);

  const handleSavePolicy = async () => {
    if (!id || !overview || savingPolicy || !policyChanged) return;

    const confirmed = await confirm({
      title: '更新入圈门槛',
      message: `确认将「${overview.circle.name}」的入圈方式调整为「${selectedPolicyOption.label}」吗？`,
      confirmText: '更新',
      icon: selectedPolicyOption.icon,
    });
    if (!confirmed) return;

    setSavingPolicy(true);
    try {
      const result = await updateJoinPolicy(id, selectedPolicy, {
        inviteCode: selectedPolicy === 'invite' && inviteCode.trim() ? inviteCode.trim() : undefined,
      });
      setOverview((prev) => (prev ? { ...prev, circle: result.circle } : prev));
      setInviteCode('');
      toast.success(result.message || '入圈门槛已更新');
    } catch (err: any) {
      toast.error(err.message || '更新入圈门槛失败');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleReview = async (request: CircleJoinRequest, action: 'approve' | 'reject') => {
    if (!id || reviewingRequestId) return;
    const isApprove = action === 'approve';
    const draft = rejectDrafts[request.id] || { reason: '', silent: false };

    const confirmed = await confirm({
      title: isApprove ? '通过入圈申请' : '拒绝入圈申请',
      message: isApprove
        ? `确认允许「${getCircleApplicantName(request)}」加入该圈子吗？`
        : `确认拒绝「${getCircleApplicantName(request)}」的入圈申请吗？${draft.silent ? '本次将静默处理，不发送拒绝通知。' : ''}`,
      confirmText: isApprove ? '通过' : '拒绝',
      tone: isApprove ? 'default' : 'danger',
      icon: isApprove ? 'how_to_reg' : 'do_not_disturb_on',
    });
    if (!confirmed) return;

    setReviewingRequestId(request.id);
    try {
      const result = await reviewCircleJoinRequest(id, request.id, action, {
        reason: !isApprove && draft.reason.trim() ? draft.reason.trim() : undefined,
        silent: !isApprove ? draft.silent : undefined,
      });
      toast.success(result.message || (isApprove ? '已通过入圈申请' : '已拒绝入圈申请'));
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
      setRejectDrafts((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      const overviewRes = await getCircleManageOverview(id);
      setOverview(overviewRes);
    } catch (err: any) {
      toast.error(err.message || '审批失败');
    } finally {
      setReviewingRequestId(null);
    }
  };

  const handleDevApproveAll = async () => {
    if (!id || approvingAll || reviewingRequestId) return;
    const pendingRequests = requests.filter((request) => request.status === 'pending_review');
    if (pendingRequests.length === 0) return;

    setApprovingAll(true);
    try {
      for (const request of pendingRequests) {
        await reviewCircleJoinRequest(id, request.id, 'approve');
      }
      toast.success(`测试操作完成：已通过 ${pendingRequests.length} 条申请`);
      await loadManageData();
    } catch (err: any) {
      toast.error(err.message || '一键通过失败');
      await loadManageData();
    } finally {
      setApprovingAll(false);
    }
  };

  const handleTransferOwner = async () => {
    if (!id || !overview || !transferTarget || transferringOwner) return;

    const confirmed = await confirm({
      title: '转让圈主',
      message: `确认把「${overview.circle.name}」的圈主转让给「${getCircleManageMemberName(transferTarget)}」吗？转让后你将离开圈主管理台。`,
      confirmText: '转让',
      tone: 'danger',
      icon: 'swap_horiz',
    });
    if (!confirmed) return;

    setTransferringOwner(true);
    try {
      const result = await transferCircleOwner(id, transferTarget.userId);
      toast.success(result.message || '圈主已转让');
      navigate(`/circles/${id}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || '转让圈主失败');
    } finally {
      setTransferringOwner(false);
    }
  };

  const handleDissolveCircle = async () => {
    if (!id || !overview || dissolvingCircle) return;

    const confirmed = await confirm({
      title: '解散圈子',
      message: `确认解散「${overview.circle.name}」吗？解散后圈子会停止展示，成员将不能继续进入该圈子。`,
      confirmText: '解散',
      tone: 'danger',
      icon: 'delete_forever',
    });
    if (!confirmed) return;

    setDissolvingCircle(true);
    try {
      const result = await dissolveCircle(id);
      toast.success(result.message || '圈子已解散');
      navigate('/circles', { replace: true });
    } catch (err: any) {
      toast.error(err.message || '解散圈子失败');
    } finally {
      setDissolvingCircle(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] pt-32 text-center font-serif text-[#8B7355]">
        正在展开圈主管理台...
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] pt-32 text-center font-serif text-[#8B7355]">
        管理台暂不可用
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFBF8] px-4 py-12 text-[#2C2825] selection:bg-[#420047] selection:text-white md:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(`/circles/${id}`)}
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#8B7355] transition-colors hover:text-[#2C2825]"
        >
          <MaterialIcon name="west" className="text-[18px]" />
          返回圈子大厅
        </button>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 border-b border-[#EAE7E1] pb-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-xs font-serif tracking-[0.3em] text-[#8B7355]">CIRCLE OWNER CONSOLE</p>
              <h1 className="font-serif text-3xl tracking-widest text-[#2C2825] md:text-5xl">{overview.circle.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#8B7355]">{overview.circle.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="min-w-20 rounded-lg border border-[#EAE7E1] bg-white/60 px-4 py-3">
                <div className="text-xl font-serif text-[#420047]">{overview.counts.members}</div>
                <div className="mt-1 text-[10px] tracking-widest text-[#8B7355]">成员</div>
              </div>
              <div className="min-w-20 rounded-lg border border-[#EAE7E1] bg-white/60 px-4 py-3">
                <div className="text-xl font-serif text-[#420047]">{pendingCount}</div>
                <div className="mt-1 text-[10px] tracking-widest text-[#8B7355]">待审</div>
              </div>
            </div>
          </div>
        </motion.header>

        <main className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="space-y-5">
            <div>
              <h2 className="mb-3 font-serif text-xl tracking-widest">入圈门槛</h2>
              <div className="space-y-3">
                {JOIN_POLICY_OPTIONS.map((option) => {
                  const active = selectedPolicy === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedPolicy(option.value)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-[#420047]/35 bg-[#420047]/5 text-[#420047]'
                          : 'border-[#EAE7E1] bg-white/60 text-[#2C2825] hover:border-[#8B7355]/40'
                      }`}
                    >
                      <MaterialIcon name={option.icon} className="text-[20px]" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#8B7355]">{option.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPolicy === 'invite' && (
              <label className="block">
                <span className="mb-2 block text-xs font-serif tracking-widest text-[#8B7355]">刷新邀请码</span>
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="留空则保留当前邀请码"
                  className="w-full rounded-lg border border-[#EAE7E1] bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#8B7355]/45 focus:border-[#420047]/40"
                />
              </label>
            )}

            <button
              type="button"
              disabled={!policyChanged || savingPolicy}
              onClick={handleSavePolicy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#420047] px-5 py-3 text-sm tracking-widest text-[#FCFBF8] shadow-md transition-colors hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:bg-[#EAE7E1] disabled:text-[#8B7355]/55 disabled:shadow-none"
            >
              <MaterialIcon name={savingPolicy ? 'progress_activity' : 'save'} className={`text-[17px] ${savingPolicy ? 'animate-spin' : ''}`} />
              {savingPolicy ? '保存中...' : '保存入圈门槛'}
            </button>

            <div className="border-t border-[#EAE7E1] pt-6">
              <h2 className="mb-3 font-serif text-xl tracking-widest">圈主操作</h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-[#EAE7E1] bg-white/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <MaterialIcon name="swap_horiz" className="text-[18px] text-[#420047]" />
                    <span className="font-serif text-sm tracking-widest text-[#2C2825]">转让圈主</span>
                  </div>
                  {transferCandidates.length === 0 ? (
                    <p className="text-xs leading-5 text-[#8B7355]">当前没有可接任的活跃成员。</p>
                  ) : (
                    <>
                      <select
                        value={transferTargetUserId}
                        onChange={(event) => setTransferTargetUserId(event.target.value)}
                        disabled={transferringOwner}
                        className="w-full rounded-lg border border-[#EAE7E1] bg-[#FCFBF8] px-3 py-2 text-sm outline-none transition-colors focus:border-[#420047]/35 disabled:opacity-60"
                      >
                        {transferCandidates.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {getCircleManageMemberName(member)} · {getCircleManageMemberMeta(member)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleTransferOwner}
                        disabled={!transferTarget || transferringOwner}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#420047]/20 bg-white px-4 py-2 text-xs tracking-widest text-[#420047] transition-colors hover:bg-[#420047]/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MaterialIcon name={transferringOwner ? 'progress_activity' : 'person_add'} className={`text-[15px] ${transferringOwner ? 'animate-spin' : ''}`} />
                        {transferringOwner ? '转让中...' : '确认转让'}
                      </button>
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-[#B94A48]/20 bg-[#B94A48]/[0.03] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <MaterialIcon name="delete_forever" className="text-[18px] text-[#B94A48]" />
                    <span className="font-serif text-sm tracking-widest text-[#B94A48]">解散圈子</span>
                  </div>
                  <p className="text-xs leading-5 text-[#8B7355]">解散后圈子会归档并停止对成员开放。</p>
                  <button
                    type="button"
                    onClick={handleDissolveCircle}
                    disabled={dissolvingCircle}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#B94A48] px-4 py-2 text-xs tracking-widest text-white transition-colors hover:bg-[#963533] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MaterialIcon name={dissolvingCircle ? 'progress_activity' : 'delete'} className={`text-[15px] ${dissolvingCircle ? 'animate-spin' : ''}`} />
                    {dissolvingCircle ? '解散中...' : '解散圈子'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-serif text-xl tracking-widest">入圈审批</h2>
                <p className="mt-1 text-xs text-[#8B7355]">逐条核对申请说明，审批结果会写入站内通知。</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {localTestEnabled && requestFilter === 'pending_review' && requests.some((request) => request.status === 'pending_review') && (
                  <button
                    type="button"
                    onClick={() => void handleDevApproveAll()}
                    disabled={approvingAll || Boolean(reviewingRequestId)}
                    title="仅本地 development 环境可用"
                    className="rounded-full bg-[#420047] px-4 py-2 text-xs tracking-widest text-white transition-colors hover:bg-[#5b155f] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approvingAll ? '批量通过中...' : '测试一键通过全部'}
                  </button>
                )}
                <div className="flex gap-1 overflow-x-auto rounded-full bg-[#EAE7E1]/50 p-1">
                  {REQUEST_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setRequestFilter(filter.value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
                      requestFilter === filter.value
                        ? 'bg-white text-[#420047] shadow-sm'
                        : 'text-[#8B7355] hover:text-[#2C2825]'
                    }`}
                  >
                    {filter.label}
                  </button>
                  ))}
                </div>
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#8B7355]/30 bg-white/35 px-6 py-16 text-center">
                <MaterialIcon name="inbox" className="mb-3 text-[28px] text-[#8B7355]/70" />
                <p className="font-serif text-sm tracking-widest text-[#8B7355]">当前没有这类入圈申请</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const draft = rejectDrafts[request.id] || { reason: '', silent: false };
                  const reviewing = reviewingRequestId === request.id;
                  const pending = request.status === 'pending_review';
                  return (
                    <article key={request.id} className="rounded-xl border border-[#EAE7E1] bg-white/70 p-5 shadow-[0_4px_18px_rgba(139,115,85,0.04)]">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          {request.applicant.avatarUrl ? (
                            <img src={request.applicant.avatarUrl} alt="avatar" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8B7355]/10 font-serif text-[#8B7355]">
                              {getCircleApplicantName(request).charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-[#2C2825]">{getCircleApplicantName(request)}</h3>
                            <p className="mt-1 truncate text-xs text-[#8B7355]">
                              {[request.applicant.department, request.applicant.grade].filter(Boolean).join(' · ') || '资料未标注'}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-[#8B7355]/70 md:text-right">
                          <div>提交于 {formatCircleManageDate(request.createdAt)}</div>
                          {request.expiresAt && <div className="mt-1">过期于 {formatCircleManageDate(request.expiresAt)}</div>}
                        </div>
                      </div>

                      <div className="mt-4 whitespace-pre-wrap rounded-lg bg-[#F3F1ED] px-4 py-3 text-sm leading-6 text-[#2C2825]/90">
                        {getCircleJoinRequestText(request)}
                      </div>

                      {!pending && (
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#EAE7E1] bg-[#FCFBF8] px-3 py-1 text-xs text-[#8B7355]">
                          <MaterialIcon name={request.status === 'approved' ? 'check_circle' : request.status === 'rejected' ? 'block' : 'schedule'} className="text-[15px]" />
                          {request.status === 'approved'
                            ? '已通过'
                            : request.status === 'rejected'
                              ? `已拒绝${request.rejectReason ? `：${request.rejectReason}` : ''}`
                              : request.status === 'withdrawn'
                                ? '申请人已撤回'
                                : '已过期'}
                        </div>
                      )}

                      {pending && (
                        <div className="mt-4 space-y-3">
                          <textarea
                            value={draft.reason}
                            onChange={(event) => setRejectDrafts((prev) => ({
                              ...prev,
                              [request.id]: { ...draft, reason: event.target.value },
                            }))}
                            placeholder="拒绝时可填写简短理由，留空则只告知未通过"
                            maxLength={200}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[#EAE7E1] bg-[#FCFBF8] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[#8B7355]/45 focus:border-[#420047]/35"
                          />
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <label className="inline-flex select-none items-center gap-2 text-xs text-[#8B7355]">
                              <input
                                type="checkbox"
                                checked={draft.silent}
                                onChange={(event) => setRejectDrafts((prev) => ({
                                  ...prev,
                                  [request.id]: { ...draft, silent: event.target.checked },
                                }))}
                                className="h-3.5 w-3.5 rounded border-[#8B7355]/30 text-[#420047] focus:ring-[#420047]"
                              />
                              拒绝时静默处理
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={Boolean(reviewingRequestId)}
                                onClick={() => handleReview(request, 'reject')}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#B94A48]/25 bg-white px-4 py-2 text-xs tracking-widest text-[#B94A48] transition-colors hover:bg-[#B94A48]/6 disabled:opacity-50"
                              >
                                <MaterialIcon name="close" className="text-[15px]" />
                                拒绝
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(reviewingRequestId)}
                                onClick={() => handleReview(request, 'approve')}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#8B7355] px-4 py-2 text-xs tracking-widest text-white transition-colors hover:bg-[#6e5840] disabled:opacity-50"
                              >
                                <MaterialIcon name={reviewing ? 'progress_activity' : 'check'} className={`text-[15px] ${reviewing ? 'animate-spin' : ''}`} />
                                通过
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
      {confirmDialog}
    </div>
  );
}
