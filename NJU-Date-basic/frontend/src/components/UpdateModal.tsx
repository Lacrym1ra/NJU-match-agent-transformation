import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CHANGELOG_NOTICE } from '../pages/Changelog';
import MaterialIcon from './MaterialIcon';

const UpdateModal = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const SEEN_KEY = 'last_seen_update_version';

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(SEEN_KEY);
    if (lastSeenVersion !== CHANGELOG_NOTICE.version) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [SEEN_KEY]);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(SEEN_KEY, CHANGELOG_NOTICE.version);
  };

  const handleAction = () => {
    setIsVisible(false);
    localStorage.setItem(SEEN_KEY, CHANGELOG_NOTICE.version);
    navigate('/changelog');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2C2825]/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-md bg-[#FCFBF8] border border-[#EAE7E1] shadow-2xl relative overflow-hidden"
          >
            {/* 纸质纹理边框点缀 */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#8B7355]/20" />
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8B7355]/10" />

            <div className="p-8 pb-6 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="auto_awesome" className="text-[24px] text-[#8B7355]" />
                  <span className="font-serif text-[#8B7355] text-xs tracking-widest">{CHANGELOG_NOTICE.version}</span>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-[#F3F1ED] hover:bg-[#EAE7E1] flex items-center justify-center text-[#8B7355] transition-colors"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>

              <h2 className="font-serif text-2xl text-[#2C2825] mb-4 tracking-wide font-medium">版本更新提示</h2>

              <div className="bg-[#F3F1ED]/50 p-4 border border-[#EAE7E1] mb-6">
                <p className="font-serif text-[15px] leading-relaxed text-[#2C2825]/90 tracking-wide">
                  {CHANGELOG_NOTICE.summary}
                </p>
                <div className="mt-3 text-xs text-[#8B7355] leading-relaxed font-sans">
                  {CHANGELOG_NOTICE.detail || '请查阅完整的更新日志，体验各项功能的全面改善。'}
                </div>
              </div>

              <div className="flex justify-end gap-3 font-serif">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-[13px] text-[#8B7355] hover:bg-[#F3F1ED] transition-colors border border-transparent rounded-sm tracking-widest"
                >
                  稍后拆阅
                </button>
                <button
                  onClick={handleAction}
                  className="px-5 py-2.5 text-[13px] text-[#FCFBF8] bg-[#420047] hover:bg-[#611066] shadow-sm transition-colors rounded-sm flex items-center gap-2 tracking-widest"
                >
                  <MaterialIcon name="menu_book" className="text-[16px]" />
                  查阅更新日志
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UpdateModal;
