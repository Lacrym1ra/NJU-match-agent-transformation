import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CardSnapshotPreview } from '../api/cardSnapshots';
import { formatCardDisplayValue } from '../modules/cards/display';
import MaterialIcon from './MaterialIcon';

interface CardSnapshotModalProps {
  snapshot: CardSnapshotPreview | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export default function CardSnapshotModal({
  snapshot,
  title,
  subtitle,
  onClose,
}: CardSnapshotModalProps) {
  if (!snapshot) return null;

  const avatarLetter = (snapshot.nickname || '?').charAt(0).toUpperCase();
  const previewLabel = snapshot.previewMode === 'friend' ? '好友态名片快照' : '公开态名片快照';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2C2825]/35 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[28px] border border-[#EAE7E1] bg-[#FCFBF8] shadow-[0_24px_80px_rgba(0,0,0,0.16)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#EAE7E1] px-6 py-5 md:px-8 md:py-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#EAE7E1] bg-[#F3F1ED] text-center text-xl font-serif leading-[56px] text-[#8B7355]">
                {snapshot.avatarUrl ? (
                  <img src={snapshot.avatarUrl} alt={snapshot.nickname || '神秘同窗'} className="h-full w-full object-cover" />
                ) : (
                  avatarLetter
                )}
              </div>
              <div>
                <h2 className="font-serif text-2xl tracking-widest text-[#2C2825]">
                  {title || snapshot.nickname || '名片快照'}
                </h2>
                <p className="mt-1 text-[11px] font-serif tracking-[0.22em] text-[#8B7355]">
                  {subtitle || `${previewLabel} · 这是请求送达时附上的展示内容`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center text-[#8B7355] transition-colors hover:text-[#2C2825]"
            >
              <MaterialIcon name="close" className="text-[24px] font-thin" />
            </button>
          </div>

          <div className="max-h-[calc(90vh-100px)] overflow-y-auto px-6 py-6 md:px-8 md:py-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)]">
              <section className="rounded-[24px] border border-[#EAE7E1] bg-[#F8F5F0] p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-serif uppercase tracking-[0.28em] text-[#420047]/70">
                  <MaterialIcon name="mark_email_read" className="text-[18px]" />
                  快照说明
                </div>
                <div className="rounded-2xl border border-dashed border-[#D7D1C8] bg-white/75 px-4 py-5 text-sm font-serif leading-relaxed text-[#8B7355]/90">
                  这张名片会随申请一起抵达，帮助你在回复前先翻看对方当时愿意展露的内容。
                </div>
              </section>

              <section className="rounded-[24px] border border-[#EAE7E1] bg-white p-5 md:p-6">
                <div className="mb-5 flex items-center gap-2 text-[11px] font-serif uppercase tracking-[0.28em] text-[#420047]/70">
                  <MaterialIcon name="badge" className="text-[18px]" />
                  名片快照
                </div>

                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="mb-3 font-serif text-lg tracking-widest text-[#2C2825]">初见</h3>
                    {snapshot.baseModules.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#EAE7E1] px-4 py-5 text-sm font-serif italic text-[#8B7355]/75">
                        这张快照里没有留下初见名片内容。
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {snapshot.baseModules.map((module) => (
                          <div key={module.key} className="rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] px-4 py-3">
                            <div className="text-[11px] font-serif tracking-[0.22em] text-[#8B7355]/75">{module.label}</div>
                            <div className="mt-2 font-serif text-sm text-[#2C2825]">{formatCardDisplayValue(module)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 font-serif text-lg tracking-widest text-[#2C2825]">同好</h3>
                    {snapshot.circleCards.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#EAE7E1] px-4 py-5 text-sm font-serif italic text-[#8B7355]/75">
                        这张快照里没有附带可展示的同好名片内容。
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {snapshot.circleCards.map((circleCard, index) => (
                          <div key={`${circleCard.circleId || 'snapshot'}-${index}`} className="rounded-[22px] border border-[#EAE7E1] bg-[#FCFBF8] p-4">
                            <div className="mb-3 font-serif text-base tracking-wide text-[#2C2825]">
                              {circleCard.circleName || '未标注圈子'}
                            </div>
                            {circleCard.modules.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-[#EAE7E1] px-4 py-4 text-sm font-serif italic text-[#8B7355]/75">
                                这个来源里没有附带可展示的同好名片内容。
                              </div>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2">
                                {circleCard.modules.map((module) => (
                                  <div key={`${circleCard.circleId || 'snapshot'}-${module.key}`} className="rounded-2xl border border-[#EAE7E1] bg-white px-4 py-3">
                                    <div className="text-[11px] font-serif tracking-[0.22em] text-[#8B7355]/75">{module.label}</div>
                                    <div className="mt-2 font-serif text-sm text-[#2C2825]">{formatCardDisplayValue(module)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
