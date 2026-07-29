import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentHeartboxReveal, HeartboxRevealResponse } from '../api/heartbox';
import MaterialIcon from '../components/MaterialIcon';
import { useToast } from '../components/Toast';
import { copyText } from '../lib/copyText';

function getPlatformLabel(platform?: string): string {
  if (platform === 'qq') return 'QQ';
  if (platform === 'xiaohongshu') return '小红书';
  return '微信';
}

const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', non_binary: '非二元', other: '其他' };
const CAMPUS_LABEL: Record<string, string> = {
  xianlin: '仙林',
  gulou: '鼓楼',
  pukou: '浦口',
  suzhou: '苏州',
  Xianlin: '仙林',
  Gulou: '鼓楼',
  Pukou: '浦口',
  Suzhou: '苏州',
};

const HeartboxReveal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success: toastSuccess, error: toastError } = useToast();
  const [data, setData] = useState<HeartboxRevealResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revealStep, setRevealStep] = useState<'sealed' | 'opening' | 'reading'>('sealed');

  useEffect(() => {
    (async () => {
      try {
        const res = await getCurrentHeartboxReveal();
        const state = (location.state as { heartboxIntro?: boolean } | null) ?? null;
        const storageKey = `heartbox_reveal_seen_${res.heartMatchId}`;
        const hasSeen = localStorage.getItem(storageKey) === '1';
        setData(res);
        setRevealStep(state?.heartboxIntro || !hasSeen ? 'sealed' : 'reading');
      } catch (err: any) {
        setLoadError(err?.message || '暂无可启封的心动信笺');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (revealStep !== 'opening') return;
    const timer = window.setTimeout(() => {
      if (data?.heartMatchId) {
        localStorage.setItem(`heartbox_reveal_seen_${data.heartMatchId}`, '1');
      }
      setRevealStep('reading');
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [data?.heartMatchId, revealStep]);

  const openEnvelope = () => {
    if (revealStep !== 'sealed') return;
    setRevealStep('opening');
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.y > 40) openEnvelope();
  };

  const handleCopy = useCallback(async () => {
    if (!data?.partnerContact.contactId) return;
    const copied = await copyText(data.partnerContact.contactId);
    if (copied) {
      toastSuccess(`${getPlatformLabel(data.partnerContact.contactPlatform)}已复制`);
      return;
    }
    toastError('复制失败，请手动选中复制');
  }, [data?.partnerContact.contactId, data?.partnerContact.contactPlatform, toastError, toastSuccess]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center">
        <MaterialIcon name="refresh" className="animate-spin text-4xl text-[#8B7355]" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="font-serif text-[#8B7355] tracking-widest">{loadError || '暂无可启封的心动信笺'}</p>
        <button
          type="button"
          onClick={() => navigate('/heartbox', { replace: true })}
          className="rounded-full border border-[#EAE7E1] px-5 py-2 text-sm font-serif tracking-widest text-[#8B7355] transition hover:border-[#8B7355]/40 hover:text-[#2C2825]"
        >
          返回心动信笺
        </button>
      </div>
    );
  }

  const partner = data.partner;
  const avatarLetter = partner.nickname?.[0] || '?';
  const contactLabel = getPlatformLabel(data.partnerContact.contactPlatform);

  if (revealStep === 'sealed' || revealStep === 'opening') {
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#F3F1ED] px-6" style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.7) 0%, transparent 60%)' }}>
        <div
          className="relative flex h-[220px] w-[340px] justify-center perspective-[1500px] md:h-[260px] md:w-[400px]"
          style={{ filter: 'drop-shadow(0 25px 40px rgba(139,115,85,0.2))' }}
        >
          <motion.div
            animate={revealStep === 'opening' ? { y: 250, scale: 1.1, opacity: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 rounded border border-[#FCFBF8]/60 bg-gradient-to-br from-[#E8E2D6] via-[#DFD9CE] to-[#CFC8B9] shadow-[inset_0_2px_15px_rgba(139,115,85,0.1)]"
          >
            <div className="absolute inset-0 rounded opacity-[0.03] mix-blend-multiply" />
          </motion.div>

          <motion.div
            initial={{ y: 0, scale: 1 }}
            animate={revealStep === 'opening' ? { y: -250, scale: 1.15, opacity: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-[15px] z-10 flex origin-bottom flex-col items-center rounded-sm border border-[#EAE7E1] bg-[#FCFBF8] pt-8 shadow-[0_0_20px_rgba(139,115,85,0.15)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-[2px] border-[#8B7355]/20 font-serif text-xl text-[#7C3636] shadow-sm">
              {avatarLetter}
            </div>
            <div className="mb-3 h-px w-2/3 bg-[#8B7355]/10" />
            <div className="mb-3 h-px w-1/2 bg-[#8B7355]/10" />
            <div className="h-px w-1/3 bg-[#8B7355]/10" />
          </motion.div>

          <motion.div
            animate={revealStep === 'opening' ? { y: 250, scale: 1.1, opacity: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.5, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <div className="absolute bottom-0 left-0 top-0 w-[53%] bg-gradient-to-br from-[#FAF8F5] via-[#F3F1ED] to-[#DFD9CE]" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)', filter: 'drop-shadow(4px 0px 8px rgba(139,115,85,0.15))' }} />
            <div className="absolute bottom-0 right-0 top-0 w-[53%] bg-gradient-to-bl from-[#FAF8F5] via-[#F3F1ED] to-[#DFD9CE]" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)', filter: 'drop-shadow(-4px 0px 8px rgba(139,115,85,0.15))' }} />
            <div className="absolute bottom-0 left-0 right-0 h-[62%] bg-gradient-to-t from-[#EFEBE3] via-[#F8F6F1] to-[#FAF9F6]" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)', filter: 'drop-shadow(0px -5px 10px rgba(139,115,85,0.2))' }}>
              <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-[#8B7355]/5 to-transparent" />
            </div>
          </motion.div>

          <motion.div
            initial={{ rotateX: 0, y: 0, scale: 1, opacity: 1, zIndex: 30 }}
            animate={revealStep === 'opening' ? { rotateX: 180, zIndex: -1, y: 250, scale: 1.1, opacity: 0 } : {}}
            transition={{
              rotateX: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
              default: { duration: 1.2, delay: 0.5, ease: 'easeInOut' },
            }}
            className="absolute left-0 right-0 top-0 h-[60%] origin-top bg-gradient-to-b from-[#FAF9F6] via-[#F2EFE8] to-[#DCD6CA]"
            style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', filter: 'drop-shadow(0px 6px 12px rgba(139,115,85,0.25))' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" style={{ clipPath: 'polygon(1px 0, calc(100% - 1px) 0, 50% calc(100% - 1px))' }} />
          </motion.div>

          <AnimatePresence>
            {revealStep === 'sealed' && (
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                onClick={openEnvelope}
                exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
                className="group absolute left-1/2 top-[58%] z-40 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center transition-transform hover:scale-105 active:cursor-grabbing"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-[-4px_2px_-2px_-5px] rotate-12 rounded-[38%_62%_41%_59%_/_52%_38%_62%_48%] bg-gradient-to-br from-[#8E1C1C] to-[#5A0C0C] shadow-[0_6px_10px_rgba(50,5,5,0.6)] transition-all duration-700" />
                <div className="absolute inset-[2px_-5px_1px_3px] -rotate-12 rounded-[58%_42%_55%_45%_/_48%_55%_45%_52%] bg-gradient-to-bl from-[#A32222] to-[#4A0808] shadow-[0_5px_8px_rgba(50,5,5,0.5)] transition-all duration-700" />
                <div className="absolute inset-0 -rotate-3 rounded-[48%_52%_49%_51%_/_51%_49%_52%_48%] bg-gradient-to-br from-[#C93232] via-[#942020] to-[#540D0D] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(30,0,0,0.6)] transition-all duration-700 group-hover:rotate-[15deg] group-hover:rounded-[50%_50%_49%_51%_/_49%_51%_50%_50%]" />
                <div className="absolute inset-[3.5px] flex items-center justify-center rounded-full bg-gradient-to-br from-[#5A0C0C] to-[#B32424] shadow-[inset_0_4px_6px_rgba(0,0,0,0.8),0_1px_1.5px_rgba(255,255,255,0.4)]">
                  <div className="absolute inset-[3px] rounded-full border border-[#EB5757]/30 shadow-[0_1px_1px_rgba(0,0,0,0.5)] transition-transform duration-1000 group-hover:rotate-[45deg]" />
                </div>
                <span className="relative z-10 ml-1 font-serif text-[22px] font-bold tracking-widest text-[#E0C0A0]" style={{ textShadow: '0 2px 2px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.1)' }}>启</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute left-1/2 top-full z-50 mt-8 w-[440px] max-w-[90vw] -translate-x-1/2 text-center">
            <div className="font-serif text-2xl tracking-[0.2em] text-[#7C3636] md:text-[30px]">双向奔赴</div>
            <div className="mt-2 font-serif text-sm tracking-wider text-[#8B7355] md:text-base">
              你们不是被算法随机分到的，是彼此都主动选择了对方。
            </div>
            {revealStep === 'sealed' && (
              <div className="mt-6 animate-pulse font-serif text-xs tracking-widest text-[#8B7355]/80">
                向下拨动火漆 以启锦书
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#FCFBF8] px-6 py-12 text-[#2C2825] md:px-12"
      style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(234,231,225,0.7) 48px)', backgroundSize: '100% 48px' }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#EAE7E1] bg-[#FCFBF8] px-4 text-[#8B7355] shadow-sm transition hover:border-[#8B7355]/35 hover:text-[#2C2825]"
          >
            <MaterialIcon name="west" className="text-[18px]" />
            <span className="font-serif text-sm tracking-widest">回到档案册</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/heartbox', { state: { skipAutoRevealRedirect: true } })}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#EAE7E1] bg-[#FCFBF8] px-4 text-[#8B7355] shadow-sm transition hover:border-[#8B7355]/35 hover:text-[#2C2825]"
          >
            <MaterialIcon name="redeem" className="text-[18px]" />
            <span className="font-serif text-sm tracking-widest">返回心动信笺</span>
          </button>
        </div>

        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <p className="mb-3 font-serif text-xs uppercase tracking-[0.35em] text-[#8B7355]">Heartbox Letter</p>
          <div className="flex items-center gap-6">
            <div className="relative flex h-20 w-20 shrink-0 rotate-[-5deg] items-center justify-center rounded-full border-[3px] border-[#8B2323] bg-[#FCFBF8] shadow-lg">
              <div className="absolute inset-[3px] rounded-full border border-dashed border-[#8B2323]/40" />
              <span className="relative z-10 font-serif text-3xl font-bold tracking-widest text-[#8B2323]">{avatarLetter}</span>
            </div>
            <div>
              <h1 className="font-serif text-3xl tracking-widest text-[#2C2825]">{partner.nickname || '这位同学'}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {partner.gender && GENDER_LABEL[partner.gender] && <span className="rounded-sm border border-[#8B2323]/20 bg-[#8B2323]/5 px-3 py-1 font-serif text-[13px] tracking-widest text-[#8B2323]">{GENDER_LABEL[partner.gender]}</span>}
                {partner.department && <span className="rounded-sm border border-[#8B7355]/20 bg-[#F3F1ED] px-3 py-1 font-serif text-[13px] tracking-widest">{partner.department}</span>}
                {partner.grade && <span className="rounded-sm border border-[#8B7355]/20 bg-[#F3F1ED] px-3 py-1 font-serif text-[13px] tracking-widest">{partner.grade}</span>}
                {partner.campus && <span className="rounded-sm border border-[#8B7355]/20 bg-[#F3F1ED] px-3 py-1 font-serif text-[13px] tracking-widest">{CAMPUS_LABEL[partner.campus] || partner.campus}</span>}
                {partner.mbti && partner.mbti !== 'UNKNOWN' && <span className="rounded-sm border border-[#8B7355]/20 bg-[#F3F1ED] px-3 py-1 font-serif text-[13px] tracking-widest">{partner.mbti}</span>}
              </div>
            </div>
          </div>
        </motion.header>

        <div className="mb-12 rounded-2xl border border-[#E8DED8] bg-[#F7F4EF]/70 p-5">
          <div className="mb-2 flex items-center gap-2 font-serif text-xl tracking-widest text-[#8B2323]">
            <MaterialIcon name="favorite" className="text-[22px]" />
            {data.specialLabel}
          </div>
          <p className="font-serif text-[16px] leading-[2] text-[#50434e]">
            {data.note}
          </p>
        </div>

        {partner.bio && (
          <section className="mb-12">
            <h2 className="mb-4 flex items-center gap-3 font-serif text-xl text-[#8B2323]">
              <span className="rotate-45 text-sm opacity-50">✦</span>
              「 TA说 」
            </h2>
            <p className="pl-8 font-serif text-[17px] italic leading-[2.2] tracking-wide text-[#2C2825]/90 md:pl-10">
              {partner.bio}
            </p>
          </section>
        )}

        <section className="mb-20">
          <h2 className="mb-4 flex items-center gap-3 font-serif text-xl text-[#8B2323]">
            <span className="rotate-45 text-sm opacity-50">✦</span>
            「 留下的联系方式 」
          </h2>
          <div className="rounded-[24px] border border-[#E4DAD2] bg-[#FCFBF8]/90 p-5 shadow-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-[#8B7355]">{contactLabel}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="group flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#E4DAD2] bg-[#F7F4EF] px-4 py-3 text-left transition hover:border-[#D7C9BD] hover:bg-[#FCFBF8]"
            >
              <span className="break-all font-mono text-sm text-[#2C2825]">{data.partnerContact.contactId || '对方暂未填写联系方式'}</span>
              {data.partnerContact.contactId && <MaterialIcon name="content_copy" className="text-[18px] text-[#8B7355] group-hover:text-[#420047]" />}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HeartboxReveal;
