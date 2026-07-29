import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MaterialIcon from './MaterialIcon';

const FEATURE_VERSION = 'nju-ti-v1';
const SEEN_KEY = `has_seen_guest_feature_${FEATURE_VERSION}`;

export default function GuestFeatureModal() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) return;

    const hasSeen = localStorage.getItem(SEEN_KEY);
    if (hasSeen) return;

    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(SEEN_KEY, 'true');
  };

  const handleAction = () => {
    setIsVisible(false);
    localStorage.setItem(SEEN_KEY, 'true');
    navigate('/personality-test');
  };

  if (isAuthenticated) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2C2825]/45 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative w-full max-w-lg overflow-hidden border border-[#EAE7E1] bg-[#FCFBF8] shadow-2xl"
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#8B7355]/25 via-[#420047]/20 to-[#8B7355]/25" />

            <div className="p-7 md:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="new_releases" className="text-[22px] text-[#8B7355]" />
                  <span className="font-serif text-xs tracking-[0.24em] text-[#8B7355]">NEW FEATURE</span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F1ED] text-[#8B7355] transition-colors hover:bg-[#EAE7E1]"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>

              <div className="mb-6 border border-[#EAE7E1] bg-[#F8F5F0] px-5 py-4">
                <div className="mb-2 font-serif text-[12px] tracking-[0.28em] text-[#420047]">NJU Ti</div>
                <h2 className="font-serif text-2xl tracking-wide text-[#2C2825] md:text-[30px]">
                  南大人格测试上线了！
                </h2>
              </div>

              <div className="space-y-4 text-[14px] leading-relaxed text-[#5E5855] md:text-[15px]">
                <p className="font-serif text-[#2C2825]/90">
                  26 题即可生成你的校园人格画像，看看你是怎样的南大同学，再决定是否寄出信笺。
                </p>
                <p>
                  不用登录也能先感受 <span className="font-medium text-[#420047]">NJU Ti</span> 的结果页、人格介绍和分享体验。
                </p>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 font-serif sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-sm px-5 py-2.5 text-[13px] tracking-widest text-[#8B7355] transition-colors hover:bg-[#F3F1ED]"
                >
                  稍后再看
                </button>
                <button
                  type="button"
                  onClick={handleAction}
                  className="flex items-center justify-center gap-2 rounded-sm bg-[#420047] px-5 py-2.5 text-[13px] tracking-widest text-[#FCFBF8] shadow-sm transition-colors hover:bg-[#611066]"
                >
                  <MaterialIcon name="psychology" className="text-[16px]" />
                  立即体验 NJU Ti
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
