import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cancelHeartboxSignal, getHeartboxMe, submitHeartboxSignal } from '../api/heartbox';
import { toast } from '../components/Toast';
import { getStudentIdBindStatus } from '../api/studentId';

const Heartbox = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [targetStudentId, setTargetStudentId] = useState('');
  const [me, setMe] = useState<Awaited<ReturnType<typeof getHeartboxMe>> | null>(null);
  const [isStudentIdBound, setIsStudentIdBound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const hasActive = !!me?.hasActiveSignal && !!me?.signal;
  const latestHeartboxStatus = me?.latestHeartboxMatch?.status ?? null;
  const isMatched = latestHeartboxStatus === 'active';
  const cooldownUntilMs = me?.cooldownUntil ? new Date(me.cooldownUntil).getTime() : 0;
  const isInCooldown = Number.isFinite(cooldownUntilMs) && cooldownUntilMs > nowTs;

  const cooldownLabel = useMemo(() => {
    if (!isInCooldown || !cooldownUntilMs) return '';
    const remainSec = Math.max(0, Math.floor((cooldownUntilMs - nowTs) / 1000));
    const days = Math.floor(remainSec / 86400);
    const hours = Math.floor((remainSec % 86400) / 3600);
    if (days > 0) return `${days}天${hours}小时后可再次投递`;
    const mins = Math.floor((remainSec % 3600) / 60);
    return `${hours}小时${mins}分钟后可再次投递`;
  }, [isInCooldown, cooldownUntilMs, nowTs]);

  const incomingCopy = useMemo(() => {
    if (!me?.incomingHint?.hasIncoming) return null;
    return me.incomingHint.copy || '有人悄悄心动了你';
  }, [me?.incomingHint]);

  const refresh = async () => {
    const [heartbox, bindStatus] = await Promise.all([
      getHeartboxMe(),
      getStudentIdBindStatus(),
    ]);
    setMe(heartbox);
    setIsStudentIdBound(!!bindStatus.verified);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err: any) {
        toast.error(err?.message || '加载失败');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isInCooldown) return;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isInCooldown]);

  useEffect(() => {
    const skipAutoRedirect = (location.state as { skipAutoRevealRedirect?: boolean } | null)?.skipAutoRevealRedirect;
    if (!isLoading && me?.latestHeartboxMatch?.status === 'active' && !skipAutoRedirect) {
      navigate('/heartbox/reveal', { replace: true });
    }
  }, [isLoading, me?.latestHeartboxMatch?.status, navigate, location.state]);

  const onSubmit = async () => {
    if (submitting) return;
    if (!targetStudentId.trim()) {
      toast.warning('请输入学号');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitHeartboxSignal(targetStudentId.trim());
      if (res.status === 'saved') {
        toast.success('你的心动已投递');
        await refresh();
        return;
      }
      if (res.status === 'matched') {
        toast.success('双向奔赴');
        navigate('/heartbox/reveal', {
          replace: true,
          state: { heartboxIntro: true, heartboxMatchId: res.heartMatchId },
        });
      }
    } catch (err: any) {
        if (err?.code === 'HEARTBOX_COOLDOWN') {
          await refresh();
          toast.warning('撤回后需等待 7 天才能再次投递');
        } else if (err?.code === 'HEARTBOX_MATCH_LOCKED') {
          await refresh();
          toast.warning('双向心动已成立，无法撤回');
        } else if (err?.code === 'STUDENT_ID_BIND_REQUIRED') {
          toast.warning('请先完成学号绑定');
          navigate('/student-id/bind', { state: { from: '/heartbox' } });
        } else {
          toast.error(err?.message || '投递失败，请稍后再试');
        }
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await cancelHeartboxSignal();
      toast.success('已撤回');
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || '撤回失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center text-[#8B7355] font-serif tracking-widest">
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex overflow-x-hidden">
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[60px] bg-[#F3F1ED] border-r border-[#EAE7E1] flex-col items-center justify-evenly py-10 shadow-[inset_-6px_0_15px_rgba(0,0,0,0.03)] z-30">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full bg-[#EAE7E1] shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.15)] relative">
            <div className="absolute inset-0 rounded-full bg-[#2C2825]/5" />
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-[2px] bg-[#8B7355]/20 left-1/2 -translate-x-[50%]" />
      </div>

      <div
        className="flex-1 min-h-screen relative md:ml-[60px] flex flex-col items-center pt-10 pb-20 px-5 md:px-8"
        style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)', backgroundSize: '100% 48px' }}
      >
        <header className="w-full max-w-3xl flex justify-between items-center mb-12 relative z-10">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 h-10 px-4 border border-[#EAE7E1] bg-[#FCFBF8] text-[#8B7355] hover:text-[#2C2825] hover:border-[#8B7355]/35 rounded-full shadow-[0_2px_8px_rgba(44,40,37,0.06)] transition-all group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">west</span>
            <span className="font-serif tracking-widest text-sm">返回档案册</span>
          </button>
          <div className="font-serif tracking-widest text-lg text-[#2C2825] opacity-50">心动信笺</div>
        </header>

        <div className="w-full max-w-xl mx-auto">
          <div className="border border-[#EAE7E1] bg-[#FCFBF8]/95 shadow-md rounded-2xl p-6 md:p-8">
            <div className="mb-6 text-center">
              <h1 className="font-serif text-3xl tracking-widest mb-2">心动信笺</h1>
              <p className="text-xs md:text-sm text-[#8B7355] font-serif tracking-widest opacity-80">
                只在双向时揭晓，不暴露单向状态。
              </p>
            </div>

            {incomingCopy && !['active', 'queued'].includes(latestHeartboxStatus || '') && (
              <div className="mb-6 p-4 border border-[#420047]/15 bg-[#420047]/[0.03] rounded-lg">
                <div className="font-serif tracking-widest text-[#420047] mb-1">信箱提示</div>
                <div className="text-sm text-[#8B7355] leading-relaxed">
                  {incomingCopy}
                </div>
              </div>
            )}

            <div className="mb-8 p-5 rounded-xl bg-gradient-to-b from-[#FCFBF8] to-[#F3F1ED] border border-[#EAE7E1] shadow-sm">
              <h2 className="font-serif text-[15px] tracking-widest text-[#2C2825] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#8B7355] text-[18px]">info</span>
                玩法与规则指北
              </h2>
              <ul className="space-y-3 text-[13px] text-[#8B7355] leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-[#420047] opacity-60">✦</span>
                  <span><strong>绝对保密：</strong>你的单向投递对所有人保密。TA 在没有亲自投递你的学号前，绝不会知道背后的那个你。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#420047] opacity-60">✦</span>
                  <span><strong>双向揭晓：</strong>只有当对方也恰巧投递了你，缘分方能生效。就算对方尚未注册，你也可提前投递等待，所以无法靠此功能得知对方注册与否。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#420047] opacity-60">✦</span>
                  <span><strong>独立信笺：</strong>心动信笺独立于每周主线匹配。即使你正在参与主线，双向奔赴也会即时启封。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#420047] opacity-60">✦</span>
                  <span><strong>专注选择：</strong>双向揭晓后，系统会自动暂停双方主线匹配，方便你们把注意力留给这封信笺；之后也可以在档案册里重新开启。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#420047] opacity-60">✦</span>
                  <span><strong>唯一投递：</strong>同一时间最多维系一封发出的信笺。反悔撤回后，会有 7 天的冷却隔离期保护平台氛围。</span>
                </li>
              </ul>
            </div>

            {!isStudentIdBound ? (
              <div className="p-5 border border-[#8B7355]/20 bg-[#FCFBF8] rounded-lg">
                <div className="font-serif text-lg tracking-widest mb-2">请先完成学号绑定</div>
                <div className="text-sm text-[#8B7355] leading-relaxed">
                  学号邮箱注册的账号会自动绑定。若你使用邮箱别名注册，只需验证一次学号邮箱，之后即可按本科生或研究生学号投递心动。
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/student-id/bind', { state: { from: '/heartbox' } })}
                  className="mt-5 px-5 py-2 rounded-full bg-[#420047] text-[#FCFBF8] tracking-widest shadow-sm hover:bg-[#5C0064] hover:shadow-md transition-all"
                >
                  去绑定
                </button>
              </div>
            ) : hasActive ? (
              <div className="p-5 border border-[#8B7355]/20 bg-[#FCFBF8] rounded-lg">
                <div className="font-serif text-lg tracking-widest mb-2">你已经投递了一次心动</div>
                <div className="text-sm text-[#8B7355] leading-relaxed">
                  目标学号：<span className="font-mono text-[#2C2825]">{me!.signal!.targetStudentIdMasked}</span>
                  <br />
                  当前状态：等待双向心动
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={submitting}
                    className="px-5 py-2 rounded-full border border-[#EAE7E1] text-[#8B7355] hover:text-[#2C2825] hover:border-[#8B7355]/40 transition"
                  >
                    撤回
                  </button>
                </div>
              </div>
            ) : isMatched ? (
              <div className="p-5 border border-[#8B7355]/20 bg-[#FCFBF8] rounded-lg">
                <div className="font-serif text-lg tracking-widest mb-2">你们已经双向奔赴</div>
                <div className="text-sm text-[#8B7355] leading-relaxed">
                  这封信笺已独立启封；系统也已自动暂停主线，方便你专注当下。若你想查看详情，请前往心动信笺揭晓页。
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/heartbox/reveal')}
                  className="mt-5 px-5 py-2 rounded-full bg-[#420047] text-[#FCFBF8] tracking-widest shadow-sm hover:bg-[#5C0064] hover:shadow-md transition-all"
                >
                  启封心动信笺
                </button>
              </div>
            ) : (
              <div className="p-5 border border-[#8B7355]/20 bg-[#FCFBF8] rounded-lg">
                <div className="text-sm text-[#8B7355] leading-relaxed mb-6">
                  输入 TA 的学号，悄悄投递一次心动。只有当 TA 也选择你时，你们才会互相知道。
                  <br />
                  系统不会告诉你 TA 是否已注册；单向心动不会让对方知道是你。
                </div>

                <label className="block text-xs tracking-widest text-[#8B7355] mb-2 uppercase">学号</label>
                <input
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value.trim())}
                  placeholder="例如：123456789"
                  disabled={isInCooldown}
                  className="w-full px-4 py-3 rounded-lg border border-[#EAE7E1] bg-[#FCFBF8] focus:outline-none focus:border-[#420047]/50 transition-colors"
                />

                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting || isInCooldown}
                  className="mt-4 w-full px-4 py-3 rounded-full bg-[#420047] text-[#FCFBF8] tracking-widest shadow-sm hover:bg-[#5C0064] hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? '投递中…' : isInCooldown ? '冷却中' : '投递心动'}
                </button>
                {isInCooldown && (
                  <p className="mt-3 text-xs text-[#8B7355]">{cooldownLabel}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2825]/35 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg border border-[#EAE7E1] bg-[#FCFBF8] shadow-xl rounded-2xl p-6 md:p-8">
            <div className="font-serif text-xl tracking-widest text-[#2C2825] mb-3">
              要撤回这份心意吗？
            </div>
            <p className="text-sm text-[#8B7355] leading-relaxed mb-4">
              撤回后，对方不会知道你曾投递过。
            </p>
            <p className="text-sm font-serif italic text-[#8B7355] leading-relaxed mb-6 border-l-2 border-[#8B7355]/25 pl-3">
              “我知道，一个人的勇敢，终究还是太累人了。 这次先把心意收回，把温柔留给愿意并肩的人。”
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-5 py-2 rounded-full border border-[#EAE7E1] text-[#8B7355] hover:text-[#2C2825] hover:border-[#8B7355]/40 transition-colors"
              >
                再想想
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowCancelConfirm(false);
                  await onCancel();
                }}
                className="px-5 py-2 rounded-full bg-[#420047] text-[#FCFBF8] hover:bg-[#5C0064] shadow-sm hover:shadow-md transition-all"
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Heartbox;
