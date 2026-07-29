import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ContactModule } from '../api/contacts';
import { GroupedFriend } from '../api/friends';
import MaterialIcon from './MaterialIcon';

interface CircleCardSection {
  circleId: string;
  circleName: string;
  friendSince: string;
  modules: Array<{
    key: string;
    label: string;
    value: string;
  }>;
}

interface AddressBookFriendDetailModalProps {
  friend: GroupedFriend | null;
  loading: boolean;
  errorMessage?: string | null;
  contacts: ContactModule[];
  baseModules: Array<{
    moduleKey: string;
    label: string;
    value: string;
  }>;
  circleCards: CircleCardSection[];
  onClose: () => void;
  onRequestContact?: () => void;
  isRequestingContact?: boolean;
  onRevokeContact?: () => void;
  isRevokingContact?: boolean;
  onRemoveFriendEverywhere?: () => void;
  isRemovingFriendEverywhere?: boolean;
  onReport?: () => void;
  onToggleBlock?: () => void;
  isBlocking?: boolean;
  isBlocked?: boolean;
  disableSafetyActions?: boolean;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

export default function AddressBookFriendDetailModal({
  friend,
  loading,
  errorMessage,
  contacts,
  baseModules,
  circleCards,
  onClose,
  onRequestContact,
  isRequestingContact = false,
  onRevokeContact,
  isRevokingContact = false,
  onRemoveFriendEverywhere,
  isRemovingFriendEverywhere = false,
  onReport,
  onToggleBlock,
  isBlocking = false,
  isBlocked = false,
  disableSafetyActions = false,
}: AddressBookFriendDetailModalProps) {
  return (
    <AnimatePresence>
      {friend ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-[#2C2825]/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
            className="fixed inset-0 z-[111] flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
          >
            <div
              className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[28px] border border-[#EAE7E1] bg-[#FCFBF8] shadow-[0_24px_80px_rgba(0,0,0,0.16)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#EAE7E1] px-6 py-5 md:px-8 md:py-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#EAE7E1] bg-[#F3F1ED] text-center text-xl font-serif leading-[56px] text-[#8B7355]">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt={friend.nickname} className="h-full w-full object-cover" />
                    ) : (
                      friend.nickname?.[0] || '?'
                    )}
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl tracking-widest text-[#2C2825]">{friend.nickname || '神秘同窗'}</h2>
                    <p className="mt-1 text-[11px] font-serif tracking-[0.25em] text-[#8B7355]">
                      {friend.circleCount > 0
                        ? `已在 ${friend.circleCount} 个圈子结缘 · 自 ${formatDate(friend.friendSince)} 起留档`
                        : `已保留全局好友身份 · 自 ${formatDate(friend.friendSince)} 起留档`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onReport && (
                    <button
                      type="button"
                      onClick={onReport}
                      disabled={disableSafetyActions}
                      className="inline-flex items-center justify-center rounded-full bg-[#F3F1ED] px-4 py-2 text-[12px] font-serif tracking-[0.16em] text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      举报
                    </button>
                  )}
                  {onToggleBlock && (
                    <button
                      type="button"
                      onClick={onToggleBlock}
                      disabled={disableSafetyActions || isBlocking}
                      className="inline-flex items-center justify-center rounded-full bg-[#F3F1ED] px-4 py-2 text-[12px] font-serif tracking-[0.16em] text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBlocking ? '处理中' : isBlocked ? '取消拉黑' : '拉黑'}
                    </button>
                  )}
                  {onRemoveFriendEverywhere && (
                    <button
                      type="button"
                      onClick={onRemoveFriendEverywhere}
                      disabled={isRemovingFriendEverywhere}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#B94A48]/30 px-4 py-2 text-[11px] font-serif tracking-[0.2em] text-[#B94A48] transition hover:bg-[#B94A48]/6 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MaterialIcon name={isRemovingFriendEverywhere ? 'progress_activity' : 'person_remove'} className={`text-[16px] ${isRemovingFriendEverywhere ? 'animate-spin' : ''}`} />
                      {isRemovingFriendEverywhere ? '解除中' : '解除全部好友'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center text-[#8B7355] transition-colors hover:text-[#2C2825]"
                  >
                    <MaterialIcon name="close" className="text-[24px] font-thin" />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(90vh-100px)] overflow-y-auto px-6 py-6 md:px-8 md:py-8">
                {loading ? (
                  <div className="py-16 text-center text-sm font-serif italic tracking-widest text-[#8B7355]/70">
                    正在翻阅这位同窗的结缘档案...
                  </div>
                ) : errorMessage ? (
                  <div className="rounded-2xl border border-[#E7D7D8] bg-[#FFF7F7] px-5 py-10 text-center text-sm font-serif text-[#7B4A4A]">
                    {errorMessage}
                  </div>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <section className="rounded-[24px] border border-[#EAE7E1] bg-[#F8F5F0] p-5 md:p-6">
                      <div className="mb-4 flex items-center gap-2 text-[11px] font-serif uppercase tracking-[0.28em] text-[#420047]/70">
                        <MaterialIcon name="contact_mail" className="text-[18px]" />
                        联络印记
                      </div>

                      {friend.contactStatus === 'granted' ? (
                        contacts.length > 0 ? (
                          <div className="flex flex-col gap-4">
                            {contacts.map((contact) => (
                              <div key={contact.moduleKey} className="rounded-2xl border border-[#EAE7E1] bg-white/80 px-4 py-3">
                                <div className="text-[11px] font-serif tracking-[0.22em] text-[#8B7355]/75">{contact.label}</div>
                                <div className="mt-2 break-all font-serif text-sm text-[#2C2825]">{contact.value || '—'}</div>
                              </div>
                            ))}
                            {onRevokeContact && (
                              <button
                                type="button"
                                onClick={onRevokeContact}
                                disabled={isRevokingContact}
                                className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[#B94A48]/30 px-4 py-2.5 text-[11px] font-serif tracking-[0.2em] text-[#B94A48] transition hover:bg-[#B94A48]/6 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <MaterialIcon name={isRevokingContact ? 'progress_activity' : 'lock_reset'} className={`text-[16px] ${isRevokingContact ? 'animate-spin' : ''}`} />
                                {isRevokingContact ? '撤销中' : '撤销授权'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[#D7D1C8] bg-white/70 px-4 py-6 text-sm font-serif italic text-[#8B7355]/80">
                            这段联络已经被应允，但对方暂未填写可展示的联系方式。
                          </div>
                        )
                      ) : friend.contactStatus === 'sent' ? (
                        <div className="rounded-2xl border border-dashed border-[#D7D1C8] bg-white/70 px-4 py-6 text-sm font-serif italic text-[#8B7355]/80">
                          你已递出联系方式申请，正在等待对方回信。
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div className="rounded-2xl border border-dashed border-[#D7D1C8] bg-white/70 px-4 py-6 text-sm font-serif italic text-[#8B7355]/80">
                            你们已经结缘，但这份联络印记还未交换。
                          </div>
                          {onRequestContact && (
                            <button
                              type="button"
                              onClick={onRequestContact}
                              disabled={isRequestingContact}
                              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#420047] px-4 py-3 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047] hover:text-[#FCFBF8] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <MaterialIcon name={isRequestingContact ? 'progress_activity' : 'forward_to_inbox'} className={`text-[16px] ${isRequestingContact ? 'animate-spin' : ''}`} />
                              {isRequestingContact ? '递送中' : '从同窗名录申请'}
                            </button>
                          )}
                        </div>
                      )}
                    </section>

                    <section className="rounded-[24px] border border-[#EAE7E1] bg-white p-5 md:p-6">
                      <div className="mb-5 flex items-center gap-2 text-[11px] font-serif uppercase tracking-[0.28em] text-[#420047]/70">
                        <MaterialIcon name="badge" className="text-[18px]" />
                        名片档案
                      </div>

                      <div className="flex flex-col gap-6">
                        <div>
                          <h3 className="mb-3 font-serif text-lg tracking-widest text-[#2C2825]">初见</h3>
                          {baseModules.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#EAE7E1] px-4 py-5 text-sm font-serif italic text-[#8B7355]/75">
                              对方暂未公开展示初见名片内容。
                            </div>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                              {baseModules.map((module) => (
                                <div key={module.moduleKey} className="rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] px-4 py-3">
                                  <div className="text-[11px] font-serif tracking-[0.22em] text-[#8B7355]/75">{module.label}</div>
                                  <div className="mt-2 font-serif text-sm text-[#2C2825]">{module.value || '—'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="mb-3 font-serif text-lg tracking-widest text-[#2C2825]">同好</h3>
                          <div className="flex flex-col gap-4">
                            {circleCards.map((circleCard) => (
                              <div key={circleCard.circleId} className="rounded-[22px] border border-[#EAE7E1] bg-[#FCFBF8] p-4">
                                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                                  <div className="font-serif text-base tracking-wide text-[#2C2825]">{circleCard.circleName}</div>
                                  <div className="text-[10px] font-serif tracking-[0.22em] text-[#8B7355]">
                                    于 {formatDate(circleCard.friendSince)} 结缘
                                  </div>
                                </div>
                                {circleCard.modules.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-[#EAE7E1] px-4 py-4 text-sm font-serif italic text-[#8B7355]/75">
                                    这个圈子里暂未留下可展示的同好名片内容。
                                  </div>
                                ) : (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {circleCard.modules.map((module) => (
                                      <div key={`${circleCard.circleId}-${module.key}`} className="rounded-2xl border border-[#EAE7E1] bg-white px-4 py-3">
                                        <div className="text-[11px] font-serif tracking-[0.22em] text-[#8B7355]/75">{module.label}</div>
                                        <div className="mt-2 font-serif text-sm text-[#2C2825]">{module.value || '—'}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
