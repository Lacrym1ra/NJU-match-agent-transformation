import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FullCard } from '../api/card';
import MaterialIcon from './MaterialIcon';

interface FullCardModalProps {
  onClose: () => void;
  cardData: FullCard;
  onRequestContact?: () => void;
}

export default function FullCardModal({ onClose, cardData, onRequestContact }: FullCardModalProps) {
  const letter = (cardData.nickname || 'N').charAt(0).toUpperCase();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#420047]/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="flex min-h-[calc(100vh-2rem)] min-h-[calc(100dvh-2rem)] items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[400px] overflow-hidden rounded-2xl bg-[#FCFBF8] shadow-2xl"
          >
            {/* Card Header (Rich) */}
            <div className="relative flex flex-col items-center bg-gradient-to-br from-[#420047] to-[#2C2825] p-6 pb-12">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white/50 transition-colors hover:text-white"
              >
                <MaterialIcon name="close" className="" />
              </button>
              <div className="relative z-10 mt-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#FCFBF8] bg-white text-3xl font-serif text-[#420047] shadow-lg">
                {letter}
              </div>
              <h3 className="relative z-10 mt-4 font-serif text-2xl tracking-widest text-[#FCFBF8]">{cardData.nickname}</h3>
              
              {/* Background decorative pattern */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at 20px 20px, white 2px, transparent 2px)',
                  backgroundSize: '40px 40px'
                }}
              />
            </div>

            {/* Module list */}
            <div className="relative z-20 mt-[-24px] rounded-t-3xl bg-[#FCFBF8] p-8 pb-4">
              {cardData.modules.length === 0 ? (
                <div className="py-6 text-center text-sm font-serif italic text-[#8B7355]/50">这卷宗还未提笔书写...</div>
              ) : (
                <div className="flex flex-col gap-5">
                  {cardData.modules.map((mod) => (
                    <div key={mod.moduleKey} className="flex flex-col gap-1 border-b border-[#EAE7E1]/50 pb-2">
                      <span className="text-xs font-serif tracking-widest text-[#8B7355]">{mod.label}</span>
                      <span className="text-[15px] font-serif leading-relaxed whitespace-pre-wrap break-words text-[#2C2825]">{mod.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 p-8 pt-4">
              <div className="mb-2 text-center text-xs italic text-[#8B7355]/60">
                联系方式被无形的力量隐去了...
              </div>
              <button
                onClick={onRequestContact}
                className="w-full rounded-full border bg-gradient-to-r from-[#611066] to-[#420047] py-3 text-sm font-serif tracking-widest text-[#FCFBF8] shadow transition-all hover:-translate-y-[1px] hover:shadow-lg"
              >
                申请解封联系方式
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
