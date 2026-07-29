import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../components/Toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import CircleChatPanel from '../components/chat/CircleChatPanel';
import TeamupContactsEditor from '../components/TeamupContactsEditor';
import { useAuth } from '../context/AuthContext';
import { reportUser, ReportReason } from '../api/safety';
import {
  getTeamUpDetail,
  joinTeamUp,
  applyTeamUp,
  leaveTeamUp,
  cancelTeamUp,
  getTeamUpContacts,
  getApplications,
  reviewApplication,
  withdrawTeamUpApplication,
  TeamUp,
  Contact,
  Application,
  ApplicationCardSnapshot,
} from '../api/teamups';
import { CardSnapshotModule } from '../api/cardSnapshots';
import {
  buildTeamupContacts,
  createEmptyTeamupContactDraft,
  hasIncompleteTeamupContactDraft,
} from '../modules/teamups/contact';
import { teamupApplicationSnapshotToPreview } from '../modules/teamups/snapshots';
import { ApiError } from '../api/client';

export function displayName(nickname: string | null | undefined, fallback = '神秘同窗') {
  return nickname?.trim() || fallback;
}

export function displayInitial(nickname: string | null | undefined, fallback = '?') {
  return displayName(nickname, fallback).charAt(0);
}

export const TEAMUP_TYPE_TEXT = {
  short_term: '临期组队',
  long_term: '长期组队',
};

export function canReportTeamupMember(
  effectiveStatus: TeamUp['effectiveStatus'],
  currentUserId: string | null | undefined,
  memberUserId: string,
) {
  return effectiveStatus === 'ended' && Boolean(currentUserId) && memberUserId !== currentUserId;
}

const USER_REPORT_REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'harassment', label: '骚扰辱骂' },
  { value: 'spam', label: '垃圾信息' },
  { value: 'fake_profile', label: '虚假资料' },
  { value: 'inappropriate_content', label: '不当内容' },
  { value: 'other', label: '其他原因' },
];

function SnapshotModules({ modules }: { modules?: CardSnapshotModule[] }) {
  if (!modules || modules.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {modules.map((module) => (
        <div key={module.key} className="rounded-md bg-white/70 border border-[#EAE7E1] px-3 py-2">
          <div className="text-[10px] text-[#8B7355] font-serif tracking-widest">{module.label || module.key}</div>
          <div className="text-xs text-[#2C2825] mt-1 break-words">{module.value || '未填写'}</div>
        </div>
      ))}
    </div>
  );
}

function CardSnapshotDetails({ snapshot }: { snapshot?: ApplicationCardSnapshot }) {
  const preview = teamupApplicationSnapshotToPreview(snapshot);
  if (!preview) return null;
  return (
    <details className="rounded-lg border border-[#420047]/15 bg-[#420047]/5 px-3 py-2">
      <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-[11px] font-serif tracking-[0.2em] text-[#420047]">
        <span className="material-symbols-outlined text-[15px]">badge</span>
        翻阅附带名片
        <span className="text-[10px] tracking-normal text-[#8B7355]">
          {preview.previewMode === 'friend' ? '好友态' : '公开态'}
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <SnapshotModules modules={preview.baseModules} />
        {preview.circleCards?.map((card, index) => (
          <div key={card.circleId || index} className="space-y-2">
            <div className="text-[10px] text-[#8B7355] font-serif tracking-widest">{card.circleName || '圈内名片'}</div>
            <SnapshotModules modules={card.modules} />
          </div>
        ))}
      </div>
    </details>
  );
}

export default function TeamUpDetail() {
  const { id, teamupId } = useParams<{ id: string; teamupId: string }>(); // 使用 id
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { user } = useAuth();

  const [teamup, setTeamup] = useState<TeamUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactsData, setContactsData] = useState<any[] | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
  const [withdrawingApplication, setWithdrawingApplication] = useState(false);

  // 表单交互状态
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [contactDrafts, setContactDrafts] = useState(() => [createEmptyTeamupContactDraft()]);
  const [applyNote, setApplyNote] = useState('');
  const [reportTarget, setReportTarget] = useState<TeamUp['members'][number] | null>(null);
  const [reportReasons, setReportReasons] = useState<ReportReason[]>([]);
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 拉取详情
  const fetchDetail = async () => {
    if (!id || !teamupId) return;
    try {
      const res = await getTeamUpDetail(id, teamupId);
      setTeamup(res.teamup);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'JOIN_CIRCLE_REQUIRED') {
        const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
        toast.warning('请先加入来源兴趣圈，再查看这份组队邀约');
        navigate(`/circles/${id}?redirect=${redirect}`, { replace: true });
        return;
      }
      toast.error(err.message || '卷宗读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id, teamupId]);

  const fetchApplications = async () => {
    if (!id || !teamupId) return;
    setLoadingApplications(true);
    try {
      const res = await getApplications(id, teamupId);
      setApplications(res.applications || []);
    } catch (err: any) {
      toast.error(err.message || '拜帖读取失败');
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    if (teamup?.viewer.isLeader && teamup.joinMode === 'approval' && teamup.effectiveStatus !== 'cancelled' && teamup.effectiveStatus !== 'ended') {
      fetchApplications();
    } else {
      setApplications([]);
    }
  }, [id, teamupId, teamup?.id, teamup?.viewer.isLeader, teamup?.joinMode, teamup?.effectiveStatus]);

  // 处理加入/申请 (包含联系方式录入)
  const handleJoinOrApply = async () => {
    if (!id || !teamupId) {
    return toast.error('系统异常：卷宗定位失败');
    }
    const isWaitlistIntent = Boolean(teamup && !teamup.joinable && teamup.waitlistable);
    if (hasIncompleteTeamupContactDraft(contactDrafts)) {
      return toast.error('请补全已添加的联系方式，或删除空白项');
    }
    const contacts: Contact[] = buildTeamupContacts(contactDrafts);
    if (contacts.length === 0) return toast.error('请至少留下一种联络方式');
    try {
      if (teamup?.joinMode === 'direct') {
        const result: any = await joinTeamUp(id!, teamupId!, contacts);
        toast.success(result.message || (isWaitlistIntent ? '候补已登记' : '入列成功'));
      } else {
        if (!applyNote) return toast.error('请填写拜帖说明');
        const result: any = await applyTeamUp(id!, teamupId!, applyNote, contacts);
        toast.success(result.message || (isWaitlistIntent ? '候补拜帖已递交，静候空位' : '拜帖已递交，静候佳音'));
      }
      setShowJoinModal(false);
      fetchDetail(); // 刷新状态
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    }
  };

  // 退出组队
  const handleLeave = async () => {
    const confirmed = await confirm({
      title: '退出同游',
      message: '确认退出此次同游？退出后如需重新加入，需按当前准入规则重新操作。',
      confirmText: '退出',
      tone: 'danger',
      icon: 'logout',
    });
    if (!confirmed) return;
    try {
      await leaveTeamUp(id!, teamupId!);
      toast.success('已退出组队');
      fetchDetail();
    } catch (err: any) { toast.error(err.message || '退出失败'); }
  };

  // 取消组队 (组长)
  const handleCancel = async () => {
    const confirmed = await confirm({
      title: '取消组队',
      message: '确认取消这次组队？已加入成员将不再看到本次邀约。',
      confirmText: '取消组队',
      tone: 'danger',
      icon: 'cancel',
    });
    if (!confirmed) return;
    try {
      await cancelTeamUp(id!, teamupId!, '组长主动取消');
      toast.success('组队已取消');
      fetchDetail();
    } catch (err: any) { toast.error(err.message || '取消失败'); }
  };

  // 查看联系方式
  const handleViewContacts = async () => {
    try {
      const res = await getTeamUpContacts(id!, teamupId!);
      setContactsData(res.members);
      toast.success('联络名录已展开');
    } catch (err: any) { toast.error(err.message || '获取失败'); }
  };

  const handleReviewApplication = async (application: Application, action: 'approve' | 'reject') => {
    if (!id || !teamupId) return toast.error('系统异常：卷宗定位失败');
    const isWaitlistApplication = application.applicationType === 'waitlist';
    const confirmed = await confirm({
      title: action === 'approve' ? (isWaitlistApplication ? '通过候补' : '准入同游') : '婉拒拜帖',
      message: action === 'approve'
        ? (isWaitlistApplication ? '确认通过这份候补申请？有空位时会按候补顺序自动补位。' : '确认通过这份拜帖，让对方加入本次同游？')
        : '确认婉拒这份拜帖？',
      confirmText: action === 'approve' ? (isWaitlistApplication ? '通过候补' : '准入') : '婉拒',
      tone: action === 'approve' ? 'default' : 'danger',
      icon: action === 'approve' ? 'how_to_reg' : 'do_not_disturb_on',
    });
    if (!confirmed) return;

    setReviewingApplicationId(application.id);
    try {
      const result: any = await reviewApplication(id, teamupId, application.id, action);
      toast.success(result.message || (action === 'approve' ? (isWaitlistApplication ? '已通过候补' : '已准入同游') : '已婉拒拜帖'));
      await Promise.all([fetchDetail(), fetchApplications()]);
    } catch (err: any) {
      toast.error(err.message || '审核失败');
    } finally {
      setReviewingApplicationId(null);
    }
  };

  const handleWithdrawApplication = async () => {
    if (!id || !teamupId || !teamup || withdrawingApplication) return;
    const applicationId = teamup.viewer.activeApplicationId ?? teamup.viewer.pendingApplicationId;
    if (!applicationId) return;

    const isWaitlist = teamup.viewer.applicationType === 'waitlist';
    const confirmed = await confirm({
      title: isWaitlist ? '撤回候补申请' : '撤回组队申请',
      message: isWaitlist
        ? '确认撤回这份候补申请吗？撤回后将从候补队列中移除。'
        : '确认撤回这份组队申请吗？撤回后如需加入，需要重新递交。',
      confirmText: '撤回',
      tone: 'danger',
      icon: 'undo',
    });
    if (!confirmed) return;

    setWithdrawingApplication(true);
    try {
      const result = await withdrawTeamUpApplication(id, teamupId, applicationId);
      toast.success(result.message || (isWaitlist ? '候补申请已撤回' : '组队申请已撤回'));
      await fetchDetail();
    } catch (err: any) {
      toast.error(err.message || '撤回申请失败');
    } finally {
      setWithdrawingApplication(false);
    }
  };

  const openMemberReport = (member: TeamUp['members'][number]) => {
    if (member.userId === user?.id) return;
    setReportTarget(member);
    setReportReasons([]);
    setReportDetail('');
  };

  const closeMemberReport = () => {
    if (isSubmittingReport) return;
    setReportTarget(null);
    setReportReasons([]);
    setReportDetail('');
  };

  const handleSubmitMemberReport = async () => {
    if (!reportTarget || isSubmittingReport || reportReasons.length === 0) return;
    if (reportTarget.userId === user?.id) {
      toast.error('不能举报自己');
      return;
    }
    setIsSubmittingReport(true);
    try {
      const result = await reportUser(reportTarget.userId, {
        reasons: reportReasons,
        detail: reportDetail.trim() || undefined,
      });
      toast.success(result.message || '举报已提交，我们将尽快处理');
      setReportTarget(null);
      setReportReasons([]);
      setReportDetail('');
    } catch (err: any) {
      toast.error(err.message || '举报失败，请稍后重试');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#FCFBF8] flex justify-center pt-32 text-[#8B7355] font-serif">展卷中...</div>;
  if (!teamup) return <div className="min-h-screen bg-[#FCFBF8] flex justify-center pt-32 text-[#8B7355] font-serif">页面已迷失，请返回上一级界面</div>;

  const { viewer, effectiveStatus } = teamup;
  const currentUserId = user?.id;
  const canLeaveTeamup = viewer.isTeamupMember && !viewer.isLeader && effectiveStatus !== 'cancelled' && effectiveStatus !== 'ended';
  const canUseTeamupChat = viewer.isTeamupMember && effectiveStatus !== 'cancelled' && effectiveStatus !== 'ended';
  const activeApplicationId = viewer.activeApplicationId ?? viewer.pendingApplicationId;
  const hasActiveApplication = Boolean(activeApplicationId);
  const isViewerWaitlisted = viewer.applicationType === 'waitlist';
  const isWaitlistFlow = !teamup.joinable && Boolean(teamup.waitlistable);
  const canOpenJoinFlow = !viewer.isTeamupMember && !hasActiveApplication && (teamup.joinable || teamup.waitlistable);
  const canWithdrawApplication = !viewer.isTeamupMember
    && hasActiveApplication
    && (viewer.applicationStatus === 'pending' || (viewer.applicationType === 'waitlist' && viewer.applicationStatus === 'approved'));
  const waitlistStatusText = viewer.applicationStatus === 'approved'
    ? (viewer.waitlistPosition ? `候补中 · 第 ${viewer.waitlistPosition} 位` : '候补中')
    : '候补审核中';
  const unavailableText = teamup.effectiveStatus === 'full' && (teamup.waitlistAvailable ?? 0) <= 0
    ? '候补已满'
    : '暂不可加入';
  const joinActionText = isWaitlistFlow
    ? (teamup.joinMode === 'direct' ? '加入候补' : '递交候补拜帖')
    : (teamup.joinMode === 'direct' ? '立即入列' : '递交拜帖');
  const modalTitle = isWaitlistFlow
    ? (teamup.joinMode === 'direct' ? '候补登记' : '撰写候补拜帖')
    : (teamup.joinMode === 'direct' ? '入列登记' : '撰写拜帖');
  const submitText = isWaitlistFlow
    ? (teamup.joinMode === 'direct' ? '确认候补' : '投递候补')
    : (teamup.joinMode === 'direct' ? '确认入列' : '投递');

  return (
    <div className="min-h-screen w-full bg-[#FCFBF8] text-[#2C2825] font-sans pb-32" style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.04) 48px)', backgroundSize: '100% 48px' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto px-6 pt-12">
        <button onClick={() => navigate(`/circles/${id}/teamups`)} className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] mb-10 w-max"><span className="material-symbols-outlined text-[18px]">west</span><span className="font-serif tracking-widest text-sm">合拢卷宗</span></button>

        <header className="mb-10 pb-8 border-b border-[#EAE7E1]">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-serif text-[#8B7355] border border-[#8B7355]/30 px-2 py-1 rounded-sm bg-[#8B7355]/5">
              {effectiveStatus === 'recruiting' ? '招募中' : effectiveStatus === 'full' ? '已满员' : effectiveStatus === 'expired' ? '已截止' : effectiveStatus === 'ended' ? '已结束' : '已取消'}
            </span>
            <span className="text-xs font-serif text-[#420047] border border-[#420047]/25 px-2 py-1 rounded-sm bg-[#420047]/5">
              {TEAMUP_TYPE_TEXT[teamup.teamupType] ?? '临期组队'}
            </span>
            <span className="text-xs font-serif text-[#8B7355]/60 tracking-wider">招募至 {new Date(teamup.deadlineAt).toLocaleString()}</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#2C2825] tracking-widest leading-tight">{teamup.title}</h1>
        </header>
    
        <main className="space-y-12">
          {/* 信息看板 */}
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-xl border border-[#EAE7E1]/60 flex flex-wrap gap-8 items-center">
            <div><p className="text-xs text-[#8B7355] font-serif mb-1 tracking-widest">同游规模</p><p className="font-serif">{teamup.currentMemberCount} / {teamup.maxMembers} 人</p></div>
            <div className="w-px h-10 bg-[#EAE7E1] hidden md:block"></div>
            <div><p className="text-xs text-[#8B7355] font-serif mb-1 tracking-widest">准入规则</p><p className="font-serif">{teamup.joinMode === 'direct' ? '推门即入' : '需递拜帖'}</p></div>
            <div className="w-px h-10 bg-[#EAE7E1] hidden md:block"></div>
            <div><p className="text-xs text-[#8B7355] font-serif mb-1 tracking-widest">组队类型</p><p className="font-serif">{TEAMUP_TYPE_TEXT[teamup.teamupType] ?? '临期组队'}</p></div>
            {(teamup.waitlistable || teamup.waitlistCount || isViewerWaitlisted) && (
              <>
                <div className="w-px h-10 bg-[#EAE7E1] hidden md:block"></div>
                <div>
                  <p className="text-xs text-[#8B7355] font-serif mb-1 tracking-widest">候补池</p>
                  <p className="font-serif">
                    {teamup.waitlistCount ?? 0}
                    <span className="text-[#8B7355]/50 mx-1">/</span>
                    {teamup.waitlistCapacity ?? 0}
                    <span className="ml-2 text-xs text-[#8B7355]">余 {teamup.waitlistAvailable ?? 0}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          {isViewerWaitlisted && hasActiveApplication && (
            <section className="rounded-xl border border-[#420047]/15 bg-[#420047]/5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#420047]/10 text-[#420047]">
                    <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
                  </div>
                  <div>
                    <h3 className="font-serif text-lg tracking-widest text-[#2C2825]">候补状态</h3>
                    <p className="mt-1 text-sm leading-6 text-[#8B7355]">
                      {viewer.applicationStatus === 'approved'
                        ? '你的候补已通过，出现空位时会按顺序自动补位。'
                        : '你的候补拜帖正在等待组长处理。'}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-[#420047]/15 bg-white/65 px-4 py-3 text-center">
                  <div className="text-xs tracking-widest text-[#8B7355]">当前排位</div>
                  <div className="mt-1 font-serif text-xl text-[#420047]">
                    {viewer.waitlistPosition ? `第 ${viewer.waitlistPosition} 位` : waitlistStatusText}
                  </div>
                </div>
              </div>
            </section>
          )}
    
          <article className="prose max-w-none text-[#2C2825]/90 font-serif leading-loose whitespace-pre-wrap">{teamup.description}</article>

          {canUseTeamupChat && id && teamupId && (
            <CircleChatPanel
              roomType="teamup"
              circleId={id}
              teamupId={teamupId}
              circleName={teamup.title}
              title="同游茶话"
              subtitle="已入列成员的实时交流区"
            />
          )}
    
          {/* 成员列表与联系方式 */}
          <section className="pt-8 border-t border-[#EAE7E1]/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif text-lg tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-[#8B7355]">groups</span> 已入列同游</h3>
              {viewer.canViewContacts && !contactsData && (
                <button onClick={handleViewContacts} className="text-sm font-serif text-[#420047] border border-[#420047]/30 px-4 py-1.5 rounded-full hover:bg-[#420047]/5">展开联络名录</button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4">
              {teamup.members.map((m) => {
                const memberName = displayName(m.nickname, '无名氏');
                return (
                  <div key={m.userId} className="flex flex-col items-center gap-2 p-3 bg-white/40 rounded-lg border border-[#EAE7E1]/50 min-w-[80px]">
                      {m.avatarUrl ? <img src={m.avatarUrl} className="w-10 h-10 rounded-full" alt="avatar" /> : <div className="w-10 h-10 rounded-full bg-[#8B7355]/10 text-[#8B7355] flex items-center justify-center">{displayInitial(m.nickname)}</div>}
                      <span className="text-xs font-serif">{memberName} {m.memberRole === 'leader' && '👑'}</span>
                      {canReportTeamupMember(effectiveStatus, currentUserId, m.userId) && (
                        <button
                          type="button"
                          onClick={() => openMemberReport(m)}
                          className="rounded-full border border-[#B94A48]/25 bg-white px-3 py-1 text-[11px] font-serif tracking-widest text-[#B94A48] transition-colors hover:bg-[#B94A48]/6"
                        >
                          举报
                        </button>
                      )}
                      {/* 如果请求了联系方式且能匹配到，则展示 */}
                      {contactsData && contactsData.find(c => c.userId === m.userId)?.contacts?.map((contact: any) => (
                      <button 
                        key={contact.value} 
                        className="text-[10px] text-green-700 hover:text-green-800 font-sans break-all cursor-pointer transition-colors active:scale-95 flex items-center justify-center gap-1 mt-1"
                        onClick={() => {
                          navigator.clipboard.writeText(contact.value);
                          toast.success('已誊写至剪贴板');
                        }}
                        title="点击复制"
                      >
                        <span>{contact.label}: {contact.value}</span>
                        <span className="material-symbols-outlined text-[10px]">content_copy</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          {viewer.isLeader && teamup.joinMode === 'approval' && effectiveStatus !== 'cancelled' && effectiveStatus !== 'ended' && (
            <section className="pt-8 border-t border-[#EAE7E1]/50 space-y-4">
              <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                <span className="material-symbols-outlined text-[15px]">mark_email_unread</span>
                待回同游拜帖
              </div>

              {loadingApplications ? (
                <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻寻拜帖...</div>
              ) : applications.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                  <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">尚无待回拜帖</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((application) => {
                    const applicantName = displayName(application.applicant.nickname);
                    const isReviewing = reviewingApplicationId === application.id;
                    const isWaitlistApplication = application.applicationType === 'waitlist';
                    return (
                      <div key={application.id} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                            {application.applicant.avatarUrl ? <img src={application.applicant.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : displayInitial(application.applicant.nickname)}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-[#2C2825]">{applicantName}</h4>
                            <p className="text-[10px] text-[#8B7355] mt-0.5">
                              {isWaitlistApplication ? `申请候补此组队${application.waitlistPosition ? ` · 第 ${application.waitlistPosition} 位` : ''}` : '申请加入此组队'}
                            </p>
                          </div>
                          <span className="text-[10px] text-[#8B7355]/60 font-serif">{new Date(application.createdAt).toLocaleDateString()}</span>
                        </div>

                        {application.applicationNote && (
                          <div className="bg-[#F3F1ED] p-2.5 rounded text-xs text-[#2C2825] italic font-serif relative">
                            <span className="absolute -top-1 -left-1 text-2xl text-[#8B7355]/20 font-serif leading-none">&quot;</span>
                            {application.applicationNote}
                          </div>
                        )}

                        <CardSnapshotDetails snapshot={application.cardSnapshot} />

                        <div className="flex gap-2 mt-1">
                          <button disabled={Boolean(reviewingApplicationId)} onClick={() => handleReviewApplication(application, 'approve')} className="flex-1 py-1.5 bg-[#8B7355] text-white text-xs tracking-widest rounded hover:bg-[#6e5840] transition-colors disabled:opacity-50">{isReviewing ? '处理中...' : (isWaitlistApplication ? '通过候补' : '准入同游')}</button>
                          <button disabled={Boolean(reviewingApplicationId)} onClick={() => handleReviewApplication(application, 'reject')} className="flex-1 py-1.5 bg-white border border-[#EAE7E1] text-[#8B7355] text-xs tracking-widest rounded hover:bg-[#F3F1ED] transition-colors disabled:opacity-50">婉言谢绝</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      </motion.div>
    
      {/* 底部悬浮操作台 - 严格按照 viewer 权限渲染 */}
      <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-[#EAE7E1]/50 p-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-2">
          <div className="text-[#8B7355] font-serif text-sm tracking-widest hidden md:block">诚朴之间，候一场相逢</div>
          <div className="flex gap-4">
            {/* 组长操作：取消/查看申请 */}
            {viewer.isLeader && effectiveStatus !== 'cancelled' && effectiveStatus !== 'ended' && (
              <button onClick={handleCancel} className="px-6 py-2.5 rounded-full border border-red-900/30 text-red-900 bg-red-50 font-serif text-sm hover:bg-red-100">取消队伍</button>
            )}
    
            {/* 普通成员操作：退出 */}
            {canLeaveTeamup && (
              <button onClick={handleLeave} className="px-6 py-2.5 rounded-full border border-[#8B7355]/30 text-[#8B7355] bg-white font-serif text-sm">退出队伍</button>
            )}
    
            {/* 申请者状态 */}
            {hasActiveApplication && (
              <>
                <button disabled className="px-8 py-2.5 rounded-full bg-gray-100 text-gray-500 font-serif text-sm">
                  {isViewerWaitlisted ? waitlistStatusText : '拜帖审核中'}
                </button>
                {canWithdrawApplication && (
                  <button
                    onClick={() => void handleWithdrawApplication()}
                    disabled={withdrawingApplication}
                    className="px-6 py-2.5 rounded-full border border-[#B94A48]/25 bg-white text-[#B94A48] font-serif text-sm hover:bg-[#B94A48]/6 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {withdrawingApplication ? '撤回中...' : '撤回申请'}
                  </button>
                )}
              </>
            )}
    
            {/* 未加入者：加入操作 */}
            {canOpenJoinFlow && (
              <button onClick={() => setShowJoinModal(true)} className="px-10 py-2.5 rounded-full bg-gradient-to-r from-[#420047] to-[#611066] text-[#FCFBF8] font-serif shadow-lg hover:-translate-y-0.5 transition-transform">
                {joinActionText}
              </button>
            )}
    
            {!teamup.joinable && !teamup.waitlistable && !viewer.isTeamupMember && !hasActiveApplication && (
              <button disabled className="px-8 py-2.5 rounded-full bg-gray-200 text-gray-400 font-serif">{unavailableText}</button>
            )}
          </div>
        </div>
      </div>
    
      {/* 加入队伍时填写的表单弹窗 (内置，极简优雅风) */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 bg-[#2C2825]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-[#FCFBF8] w-full max-w-md p-8 rounded-2xl shadow-2xl border border-[#EAE7E1]">
              <h3 className="font-serif text-2xl text-[#2C2825] mb-6">{modalTitle}</h3>
              
              <div className="space-y-4">
                <div>
                  <TeamupContactsEditor
                    drafts={contactDrafts}
                    onChange={setContactDrafts}
                    circleId={id || ''}
                    label={isWaitlistFlow ? '留下联络方式 (补位前保密)' : '留下联络方式 (截至前保密)'}
                    gridClassName="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] gap-3"
                  />
                </div>
    
                {teamup.joinMode === 'approval' && (
                  <div>
                    <label className="block text-sm text-[#8B7355] font-serif mb-2">{isWaitlistFlow ? '候补拜帖正文 (简述来意/能力)' : '拜帖正文 (简述来意/能力)'}</label>
                    <textarea placeholder="例如：我周六有空，水平尚可..." value={applyNote} onChange={e => setApplyNote(e.target.value)} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-sans h-24 resize-none" />
                  </div>
                )}
              </div>
    
              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowJoinModal(false)} className="flex-1 py-3 border border-[#EAE7E1] rounded-full text-[#8B7355] font-serif">取消</button>
                <button onClick={handleJoinOrApply} className="flex-1 py-3 bg-[#420047] rounded-full text-white font-serif">{submitText}</button>
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {reportTarget && (
            <div
              className="fixed inset-0 bg-[#2C2825]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeMemberReport}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#FCFBF8] w-full max-w-xl p-8 rounded-2xl shadow-2xl border border-[#EAE7E1]"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="font-serif text-2xl text-[#2C2825] mb-2">举报同行者</h3>
                <p className="text-sm font-serif text-[#8B7355]">
                  你正在举报：{displayName(reportTarget.nickname, '无名氏')}
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm text-[#8B7355] font-serif mb-2">举报原因</label>
                    <div className="space-y-2 rounded-lg border border-[#EAE7E1] bg-white px-4 py-3">
                      {USER_REPORT_REASON_OPTIONS.map((item) => (
                        <label key={item.value} className="flex cursor-pointer items-center gap-2 text-sm text-[#2C2825]">
                          <input
                            type="checkbox"
                            checked={reportReasons.includes(item.value)}
                            onChange={(event) => {
                              setReportReasons((prev) => (
                                event.target.checked
                                  ? prev.includes(item.value) ? prev : [...prev, item.value]
                                  : prev.filter((reason) => reason !== item.value)
                              ));
                            }}
                            className="h-4 w-4 accent-[#420047]"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#8B7355] font-serif mb-2">补充说明（可选）</label>
                    <textarea
                      value={reportDetail}
                      onChange={(event) => setReportDetail(event.target.value)}
                      maxLength={500}
                      rows={5}
                      className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-sans resize-none"
                      placeholder="可填写更多细节，便于管理员核实"
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={closeMemberReport}
                    className="flex-1 py-3 border border-[#EAE7E1] rounded-full text-[#8B7355] font-serif"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmitMemberReport()}
                    disabled={isSubmittingReport || reportReasons.length === 0}
                    className="flex-1 py-3 bg-[#420047] rounded-full text-white font-serif disabled:opacity-50"
                  >
                    {isSubmittingReport ? '提交中...' : '提交举报'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {confirmDialog}
      </div>
  );
}
