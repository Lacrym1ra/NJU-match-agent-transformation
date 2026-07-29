import MaterialIcon from './MaterialIcon';
// frontend/src/components/PublicCardModal.tsx
import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicCard } from '../api/card';
import { ApiError } from '../api/client';
import { ContactModule, ContactUnlockStatus, getContactUnlockStatus, getUnlockedContacts, sendContactUnlockRequest } from '../api/contacts';
import { toast } from './Toast';
import { formatCardDisplayValue } from '../modules/cards/display';

interface PublicCardModalProps {
  onClose: () => void;
  circleId?: string;
  overrideData?: { 
    nickname: string;
    avatarLetter: string;
    modules: { moduleKey: string; label: string; value: any }[];
    circleHighlights?: { key: string; label: string; value: string }[];
    isFriend: boolean;
    isCircleFriend?: boolean;
    pendingRequest: string | null;
  };
  cardData?: PublicCard; 
  onAddFriend?: (message?: string) => void; // 【已修改】：允许接收破冰留言
  onRemoveFriendInCircle?: () => void;
  isRemovingFriendInCircle?: boolean;
}

type ContactRequestStatus = ContactUnlockStatus['status'];

export default function PublicCardModal({
  onClose,
  circleId,
  overrideData,
  cardData,
  onAddFriend,
  onRemoveFriendInCircle,
  isRemovingFriendInCircle = false,
}: PublicCardModalProps) {
  const data = overrideData || cardData;
  const headerRef = useRef<HTMLDivElement>(null);
  const [ticketY, setTicketY] = useState(162);
  const [showContactCard, setShowContactCard] = useState(false);

  // 私密联系方式请求状态
  const [contactStatus, setContactStatus] = useState<ContactRequestStatus>('idle');
  const [contactModules, setContactModules] = useState<ContactModule[]>([]);
  const [isRequestingContact, setIsRequestingContact] = useState(false);
  const [isLoadingContactStatus, setIsLoadingContactStatus] = useState(false);
  const [hasPendingAdditionalContactRequest, setHasPendingAdditionalContactRequest] = useState(false);

  useLayoutEffect(() => {
    if (headerRef.current && !showContactCard) {
      setTicketY(headerRef.current.offsetHeight);
    }
  }, [data, showContactCard]);

  const letter = overrideData?.avatarLetter || (data?.nickname || 'N').charAt(0).toUpperCase();
  const targetUserId = cardData?.userId;
  const displayedContactModules = contactModules;
  const isCardCircleFriend = (cardData?.isCircleFriend ?? false) === true;


  const [isDrafting, setIsDrafting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [aiResult, setAiResult] = useState('');

  const ICEBREAKERS = [
    '在诚朴之间，候一场明月相逢。',
    '对你分享的见解很感兴趣。',
    '同为圈友，希望能结识一下。'
  ];

  const handleSimulateAi = () => {
    setAiState('thinking');
    setTimeout(() => {
      setAiResult('✨ 观其名帖，似有高山流水之音。不妨这样说：“见君名帖，品味甚佳，不知最近在读哪本书？”');
      setAiState('done');
    }, 1200);
  }

  useEffect(() => {
    if (!isCardCircleFriend || !targetUserId || !circleId) {
      setContactStatus('idle');
      setContactModules([]);
      setHasPendingAdditionalContactRequest(false);
      setIsLoadingContactStatus(false);
      return;
    }

    let cancelled = false;

    const loadContactState = async () => {
      setIsLoadingContactStatus(true);
      try {
        const status = await getContactUnlockStatus(targetUserId, circleId);
        if (cancelled) return;

        setContactStatus(status.status);
        setHasPendingAdditionalContactRequest(Boolean(status.hasPendingRequest));

        if (status.status === 'granted') {
          const res = await getUnlockedContacts(targetUserId, circleId);
          if (cancelled) return;
          setContactModules(res.contacts || []);
        } else {
          setContactModules([]);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (!(err instanceof ApiError) || (
          err.code !== 'CONTACT_NOT_UNLOCKED' &&
          err.code !== 'NOT_FRIEND'
        )) {
          console.error('读取联系方式状态失败', err);
        }
        setHasPendingAdditionalContactRequest(false);
      } finally {
        if (!cancelled) {
          setIsLoadingContactStatus(false);
        }
      }
    };

    void loadContactState();

    return () => {
      cancelled = true;
    };
  }, [circleId, isCardCircleFriend, targetUserId]);

  if (!data) return null;

  const isGlobalFriend = data.isFriend;
  const isCurrentCircleFriend = (data.isCircleFriend ?? false) === true;

  const contactSectionDescription = (() => {
    if (!isCurrentCircleFriend) {
      return isGlobalFriend
        ? '你们已在别处结缘，但仍需先在本圈补记好友关系，之后这里才会展示联络印记入口。'
        : '结缘之后，方可递出联络印记申请。';
    }
    if (isLoadingContactStatus) return '正在为你翻检这段联络往来。';
    if (contactStatus === 'sent') return '申请已经送达，对方点头后，你可在本圈翻阅其开放的联系方式。';
    if (contactStatus === 'granted' && hasPendingAdditionalContactRequest) return '这段联络已被应允，更多联系方式申请也已送达。';
    if (contactStatus === 'granted') return '这段联络已被应允，可在本圈查看对方开放给你的联系方式，也可继续申请其他联系方式。';
    return '向这位同窗申请本圈联系方式；对方同意时会选择向你开放哪些联系方式。';
  })();

  const handleRequestContact = async () => {
    if (!targetUserId || !circleId) {
      toast.error('缺少圈子上下文，暂时无法申请联系方式');
      return;
    }
    if (isRequestingContact) return;

    setIsRequestingContact(true);
    try {
      await sendContactUnlockRequest({
        targetUserId,
        circleId,
        sourceType: 'circle',
      });
      if (contactStatus === 'granted') {
        setHasPendingAdditionalContactRequest(true);
        toast.success('其他联系方式申请已发送');
      } else {
        setContactStatus('sent');
        toast.success('联系方式交换申请已发送');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'CONTACT_REQUEST_EXISTS') {
          if (contactStatus === 'granted') {
            setHasPendingAdditionalContactRequest(true);
          } else {
            setContactStatus('sent');
          }
          toast.warning('你已发送过联系方式交换申请');
          return;
        }

        if (err.code === 'CONTACT_ALREADY_UNLOCKED') {
          const res = await getUnlockedContacts(targetUserId, circleId);
          setContactModules(res.contacts || []);
          setContactStatus('granted');
          toast.warning(err.message || '对方当前可开放的联系方式均已解锁');
          return;
        }
      }

      toast.error(err instanceof Error ? err.message : '发送联系方式申请失败');
    } finally {
      setIsRequestingContact(false);
    }
  };

  const handleUnlockRequest = async (fieldKey: string) => {
    // 【类型修复】：优先使用真实的 cardData，如果一定要从 data 取，则使用 'in' 关键字进行类型守卫
    const targetUserId = cardData?.userId || ('userId' in data ? data.userId : undefined);

    if (!targetUserId) {
      toast.error('这是名片预览，无法发送解锁申请');
      return;
    }

    try {
      // 1. 发送带有特定 fieldKey 的解锁请求 (P0-0)
      await sendContactUnlockRequest({
        targetUserId: targetUserId, // 现在这是一个类型安全的 string
        circleId: circleId,
        sourceType: circleId ? 'circle' : 'address_book',
        fieldKey: fieldKey, 
      });
      
      toast.success('解锁申请已发送，请等待对方同意');
      
      // 如果组件内有刷新联系人状态的方法，可以在这里调用，例如：
      // fetchContactStatus();

    } catch (error: any) {
      // 2. 优雅处理 429 频率限制 (P0-0)
      const errorCode = error?.code || error?.response?.data?.error?.code;
      const retryAt = error?.retryAt || error?.response?.data?.error?.retryAt;

      if (errorCode === 'REQUEST_RATE_LIMITED' && retryAt) {
        const retryDate = new Date(retryAt).toLocaleDateString();
        toast.error(`申请过于频繁，请在 ${retryDate} 后再试`);
      } else {
        toast.error(error.message || '申请发送失败');
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#2C2825]/40 p-4 backdrop-blur-sm perspective-1000"
        onClick={onClose}
      >
        <div className="flex min-h-[calc(100vh-2rem)] min-h-[calc(100dvh-2rem)] items-center justify-center">
          <AnimatePresence mode="wait">
            {!showContactCard ? (
              /* ================= 正面：公开展示票根 ================= */
              <motion.div
                key="front-ticket"
                initial={{ opacity: 0, y: 40, rotateY: -90 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[360px] origin-center drop-shadow-2xl"
              >
                <div 
                  className="relative w-full overflow-hidden rounded-2xl bg-[#FCFBF8] pb-6"
                  style={{
                    WebkitMaskImage: `radial-gradient(circle at 0px ${ticketY}px, transparent 12px, white 12.5px), radial-gradient(circle at 100% ${ticketY}px, transparent 12px, white 12.5px)`,
                    WebkitMaskComposite: 'intersect',
                    maskImage: `radial-gradient(circle at 0px ${ticketY}px, transparent 12px, white 12.5px), radial-gradient(circle at 100% ${ticketY}px, transparent 12px, white 12.5px)`,
                    maskComposite: 'intersect'
                  }}
                >
                  <div ref={headerRef} className="relative flex w-full flex-col bg-gradient-to-br from-[#8B7355]/10 to-transparent">
                    <div className="relative flex flex-col items-center p-6 pb-6">
                      <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-[#8B7355]/50 transition-colors hover:text-[#2C2825]"
                      >
                        <MaterialIcon name="close" className="" />
                      </button>
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-[#EAE7E1] bg-white text-2xl font-serif text-[#8B7355] shadow-sm">
                        {letter}
                      </div>
                      <h3 className="font-serif text-xl tracking-widest text-[#2C2825]">{data.nickname}</h3>
                    </div>

                    {data.circleHighlights && data.circleHighlights.length > 0 && (
                      <div className="px-6 pb-6 pt-0">
                        <div className="mb-4 text-left text-[11px] font-serif uppercase tracking-[0.25em] text-[#420047]/70">
                          本圈信息
                        </div>
                        <div className="flex flex-col gap-4">
                          {data.circleHighlights.map((item) => (
                            <div key={item.key} className="flex flex-col gap-1 border-b border-[#EAE7E1]/50 pb-2">
                              <span className="text-xs font-serif tracking-widest text-[#8B7355]/80">{item.label}</span>
                              <span className="text-sm font-serif leading-relaxed whitespace-pre-wrap break-words text-[#2C2825]">{formatCardDisplayValue({ key: item.key, label: item.label, value: item.value })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex h-1 w-full gap-1 px-8 opacity-20">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="h-[1px] flex-1 bg-[#8B7355]" />
                    ))}
                  </div>

                  <div className="p-6">
                    {data.modules.length === 0 ? (
                      <p className="text-center text-sm font-serif italic text-[#8B7355]/50">尚未展露个人信息</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {data.modules.map((mod) => (
                          <div key={mod.moduleKey} className="flex flex-col gap-1 border-b border-[#EAE7E1]/50 pb-2">
                            <span className="text-xs font-serif tracking-widest text-[#8B7355]/80">{mod.label}</span>
                            <span className="text-sm font-serif leading-relaxed whitespace-pre-wrap break-words text-[#2C2825]">{formatCardDisplayValue(mod)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 底部联系方式区 */}
                  <div className="mt-2 px-6 pt-0 pb-6">
                    <div className="rounded-2xl border border-[#EAE7E1] bg-[#F8F5F0] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="mb-1 text-[11px] font-serif uppercase tracking-[0.25em] text-[#420047]/70">
                            联络印记
                          </div>
                          <p className="text-xs font-serif leading-relaxed break-words text-[#8B7355]/90">
                            {contactSectionDescription}
                          </p>
                        </div>
                        <MaterialIcon name={contactStatus === 'granted' ? 'contact_mail' : 'outgoing_mail'} className="text-[20px] text-[#420047]/35" />
                      </div>


                      {!isCurrentCircleFriend ? (
                        <div className="w-full">
                          {/* 状态 1：已发送申请 */}
                          {data.pendingRequest === 'sent' && (
                            <button disabled className="w-full rounded-full border border-[#8B7355]/50 py-3 text-sm font-serif tracking-widest text-[#8B7355]/60 transition-all cursor-wait">
                              请等待回音...
                            </button>
                          )}

                          {/* 状态 2：对方已发送申请 */}
                          {data.pendingRequest === 'received' && (
                            <button disabled className="w-full rounded-full border border-[#8B7355]/50 py-3 text-sm font-serif tracking-widest text-[#8B7355]/60 transition-all cursor-not-allowed">
                              对方已先递来申请
                            </button>
                          )}

                          {/* 状态 3：未发送申请，且未点击撰写（展示原有按钮） */}
                          {!data.pendingRequest && !isDrafting && (
                            <button
                              onClick={() => setIsDrafting(true)}
                              disabled={!onAddFriend}
                              className="w-full rounded-full border border-[#8B7355] py-3 text-sm font-serif tracking-widest text-[#8B7355] transition-all hover:bg-[#8B7355] hover:text-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isGlobalFriend ? '补记本圈好友' : '递交交际申请'}
                            </button>
                          )}

                          {/* 状态 4：核心新增，展开破冰面板与 AIcebreaker */}
                          {!data.pendingRequest && isDrafting && (
                            <div className="w-full flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="relative">
                                <textarea
                                  value={requestMessage}
                                  onChange={(e) => setRequestMessage(e.target.value)}
                                  placeholder="写下你的破冰寄语..."
                                  className="w-full p-2.5 bg-white border border-[#EAE7E1] rounded-xl text-xs text-[#2C2825] focus:outline-none focus:border-[#8B7355]/50 transition-all resize-none h-20 font-serif shadow-inner"
                                />
                                
                                {/* AIcebreaker 呼唤小挂件 */}
                                <button 
                                  onClick={() => setShowAi(!showAi)}
                                  className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-sans flex items-center gap-0.5 transition-colors ${showAi ? 'bg-[#8B7355] text-white' : 'bg-[#8B7355]/10 text-[#8B7355] hover:bg-[#8B7355]/20'}`}
                                  title="唤醒 AIcebreaker"
                                >
                                  <MaterialIcon name="auto_awesome" className="text-[11px]" />
                                  <span>AIcebreaker</span>
                                </button>
                              </div>

                              {/* 3 个写死的默认话题 Tag 区域 */}
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] text-[#8B7355]/70 font-serif">选用推荐破冰寄语：</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {ICEBREAKERS.map((text, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setRequestMessage(text)}
                                      className="text-[11px] px-2.5 py-1.5 bg-white border border-[#EAE7E1] rounded-full text-[#8B7355] hover:border-[#8B7355] hover:text-[#2C2825] transition-colors text-left"
                                    >
                                      {text}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 🌟 AIcebreaker 彩蛋专区（高仿真大模型互动面板展示） */}
                              {showAi && (
                                <div className="p-3 bg-gradient-to-br from-[#FCFBF8] to-[#F7F5F0] border border-[#EAE7E1] rounded-xl flex flex-col gap-2 mt-1">
                                  <p className="text-[11px] text-[#8B7355] font-serif leading-relaxed">
                                    💡 不知道怎么破冰？试着让 AI 助力成为你的 <b>AIcebreaker</b> 吧！
                                  </p>
                                  
                                  {aiState === 'idle' && (
                                    <button 
                                      onClick={handleSimulateAi}
                                      className="text-[11px] w-max px-3 py-1 bg-white border border-[#8B7355]/30 text-[#8B7355] rounded-md shadow-sm hover:shadow transition-all flex items-center gap-1"
                                    >
                                      <MaterialIcon name="magic_button" className="text-[12px]" /> 智能推敲词句
                                    </button>
                                  )}

                                  {aiState === 'thinking' && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[#8B7355] animate-pulse">
                                      <MaterialIcon name="hourglass_empty" className="text-[12px] animate-spin" /> 
                                      AIcebreaker 正在揣摩名帖...
                                    </div>
                                  )}

                                  {aiState === 'done' && (
                                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
                                      <p className="text-[11px] text-[#2C2825] bg-white/80 p-2 rounded-lg leading-relaxed font-serif">
                                        {aiResult}
                                      </p>
                                      <button 
                                        onClick={() => {
                                          setRequestMessage('见君名帖，品味甚佳，不知最近在读哪本书？');
                                          setShowAi(false);
                                        }}
                                        className="text-[10px] w-max text-white bg-[#8B7355] px-2.5 py-1 rounded hover:bg-[#7a6449] transition-colors font-serif"
                                      >
                                        采纳词句
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 确定和取消操作底栏 */}
                              <div className="flex justify-end gap-2 mt-1">
                                <button 
                                  onClick={() => {
                                    setIsDrafting(false);
                                    setRequestMessage('');
                                    setShowAi(false);
                                    setAiState('idle');
                                  }}
                                  className="px-4 py-1.5 text-xs text-[#8B7355] hover:text-[#2C2825] font-serif transition-colors"
                                >
                                  收起
                                </button>
                                <button 
                                  onClick={() => {
                                    if(onAddFriend) onAddFriend(requestMessage);
                                    setIsDrafting(false);
                                  }}
                                  className="px-5 py-1.5 bg-[#8B7355] text-[#FCFBF8] text-xs rounded-full font-serif tracking-widest shadow-sm hover:bg-[#7a6449] transition-colors"
                                >
                                  递交
                                </button>
                              </div>
                            </div>
                          )}
                        </div>


                      ) : (
                        <div className="w-full">
                          {isLoadingContactStatus ? (
                            <button
                              disabled
                              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#420047]/30 py-3 text-sm font-serif tracking-widest text-[#420047]/50 transition-all cursor-wait"
                            >
                              <MaterialIcon name="progress_activity" className="animate-spin text-[18px]" />
                              正在翻检联络状态
                            </button>
                          ) : null}
                          {!isLoadingContactStatus && contactStatus === 'idle' && (
                            <button
                              onClick={handleRequestContact}
                              disabled={isRequestingContact}
                              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#420047] py-3 text-sm font-serif tracking-widest text-[#420047] shadow-sm transition-all hover:bg-[#420047] hover:text-[#FCFBF8]"
                            >
                              <MaterialIcon name="forward_to_inbox" className="text-[18px]" />
                              {isRequestingContact ? '递送印记中...' : '求取联络印记'}
                            </button>
                          )}
                          {!isLoadingContactStatus && contactStatus === 'sent' && (
                            <button
                              disabled
                              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#420047]/40 py-3 text-sm font-serif tracking-widest text-[#420047]/60 transition-all cursor-wait"
                            >
                              <MaterialIcon name="outgoing_mail" className="animate-pulse text-[18px]" />
                              信函已递，静候回音
                            </button>
                          )}
                          {!isLoadingContactStatus && contactStatus === 'granted' && (
                            <div className="space-y-3">
                              <button
                                onClick={() => setShowContactCard(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#420047] py-3 text-sm font-serif tracking-widest text-[#FCFBF8] shadow-md transition-all hover:bg-[#5C0064]"
                              >
                                <MaterialIcon name="menu_book" className="text-[18px]" />
                                展阅同窗私录
                              </button>
                              <button
                                onClick={handleRequestContact}
                                disabled={isRequestingContact || hasPendingAdditionalContactRequest}
                                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#420047]/40 py-3 text-sm font-serif tracking-widest text-[#420047] transition-all hover:bg-[#420047]/5 disabled:cursor-not-allowed disabled:opacity-55"
                              >
                                <MaterialIcon name={hasPendingAdditionalContactRequest ? 'outgoing_mail' : isRequestingContact ? 'progress_activity' : 'add'} className={`text-[18px] ${isRequestingContact ? 'animate-spin' : ''}`} />
                                {hasPendingAdditionalContactRequest ? '其他申请已递出' : isRequestingContact ? '递送中...' : '申请其他联系方式'}
                              </button>
                            </div>
                          )}
                          {onRemoveFriendInCircle && (
                            <button
                              onClick={onRemoveFriendInCircle}
                              disabled={isRemovingFriendInCircle}
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#B94A48]/30 py-3 text-sm font-serif tracking-widest text-[#B94A48] transition-all hover:bg-[#B94A48]/6 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <MaterialIcon name={isRemovingFriendInCircle ? 'progress_activity' : 'person_remove'} className={`text-[18px] ${isRemovingFriendInCircle ? 'animate-spin' : ''}`} />
                              {isRemovingFriendInCircle ? '解除中...' : '解除本圈好友'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="back-contact"
                initial={{ opacity: 0, rotateY: -90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[340px] origin-center"
              >
                <div className="relative flex w-full flex-col items-center overflow-hidden rounded-md border border-[#8B7355]/20 bg-[#FCFBF8] p-8 shadow-2xl">
                
                {/* 装饰水印底纹 */}
                <MaterialIcon name="contact_mail" className="absolute -top-10 -right-10 text-[120px] text-[#8B7355]/5 select-none pointer-events-none" />
    
                <button 
                  onClick={() => setShowContactCard(false)}
                  className="absolute top-4 left-4 text-[#8B7355]/60 hover:text-[#2C2825] transition-colors flex items-center gap-1"
                >
                  <MaterialIcon name="arrow_back" className="text-sm" />
                  <span className="text-[10px] font-serif tracking-widest">掩卷</span>
                </button>
    
                <div className="mt-6 mb-4 relative">
                  <div className="w-20 h-20 rounded-sm bg-[#F3F1ED] border border-[#8B7355]/20 flex items-center justify-center text-3xl font-serif text-[#420047] shadow-inner rotate-3">
                    {letter}
                  </div>
                </div>
    
                <h2 className="text-2xl font-serif text-[#2C2825] tracking-widest mb-1">{data.nickname}</h2>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#8B7355] font-serif italic mb-8">Personal Contact</div>
    
                {/* 核心通讯录内容 */}
                <div className="w-full flex flex-col gap-5">
                  {displayedContactModules.length === 0 ? (
                    <div className="text-center text-sm font-serif text-[#8B7355]/60 italic">
                      对方暂未填写可展示的联系方式
                    </div>
                  ) : (
                    displayedContactModules.map((mod) => (
                      <div key={mod.moduleKey} className="flex items-start gap-4">
                        <div className="w-16 shrink-0 text-right">
                          <span className="text-[11px] font-serif text-[#8B7355]/70 tracking-widest leading-relaxed">
                            {mod.label}
                          </span>
                        </div>
                        <div className="flex-1 border-b border-dashed border-[#EAE7E1] pb-1">
                          <span className="text-sm font-serif text-[#2C2825] tracking-wide break-all">
                            {mod.value || '—'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
    
                {/* 底部小字注脚：前往同窗名录的暗示 */}
                <div className="mt-10 w-full flex flex-col items-center justify-center opacity-70">
                  <div className="flex items-center gap-3 w-full justify-center mb-2">
                    <div className="w-10 h-[1px] bg-gradient-to-r from-transparent to-[#8B7355]/50" />
                    <MaterialIcon name="bookmark_added" className="text-[14px] text-[#8B7355]" />
                    <div className="w-10 h-[1px] bg-gradient-to-l from-transparent to-[#8B7355]/50" />
                  </div>
                  <span className="text-[11px] font-serif tracking-widest text-[#2C2825]/70 mb-1">
                    此私录已妥帖留存
                  </span>
                  <span className="text-[9px] font-serif tracking-wide text-[#8B7355]/80 italic">
                    * 后续可在本圈名片中翻阅
                  </span>
                </div>
                
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
