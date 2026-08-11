import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

const Announcement = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ANNOUNCEMENT_VERSION = 'course-derivative-v1'; // 更新此版本号可重新给所有人展示
  const EXPIRATION_DATE = '2024-04-10T00:00:00+08:00'; // 活动截止时间，超过此时间不再显示

  useEffect(() => {
    // 如果当前时间已经超过活动截止时间，则不显示
    if (new Date() > new Date(EXPIRATION_DATE)) return;

    // Check if the user has already dismissed or clicked the announcement
    const hasSeen = localStorage.getItem(`has_seen_project_update_${ANNOUNCEMENT_VERSION}`);
    if (!hasSeen) {
      // Delay the popup so it doesn't interrupt the initial page load (e.g. 1 seconds)
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(`has_seen_project_update_${ANNOUNCEMENT_VERSION}`, 'true');
  };

  const handleAction = () => {
    setIsVisible(false);
    localStorage.setItem(`has_seen_project_update_${ANNOUNCEMENT_VERSION}`, 'true');
    window.open('https://github.com/Lacrym1ra/NJU-match-agent-transformation', '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-[85vw] max-w-[280px] md:max-w-none md:w-[340px] bg-[#FCFBF8] border border-[#EADBD8] shadow-[0_20px_60px_-15px_rgba(44,40,37,0.1)] rounded overflow-hidden"
        >
          {/* Close Button */}
          <button 
            onClick={handleClose}
            className="absolute top-2 right-2 md:top-3 md:right-3 z-10 w-8 h-8 flex items-center justify-center bg-[#2C2825]/5 hover:bg-[#2C2825]/10 rounded-full text-[#2C2825]/60 hover:text-[#2C2825] transition-colors"
            title="关闭并不再显示"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>

          {/* Graphic Area (Placeholder) */}
          <div 
            className="h-28 md:h-36 w-full relative overflow-hidden group cursor-pointer bg-gradient-to-tr from-[#EADBD8]/40 to-[#D5C2C4]/20 flex items-center justify-center" 
            onClick={handleAction}
          >
            <img 
              src="/images/xhs-promo.png" 
              alt="NJU Match 最新动态"
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                // If the user hasn't put the image yet, hide the img tag to show the fallback gradient underneath
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Fallback styling/layering when img is missing */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40 pointer-events-none mix-blend-multiply">
               <MaterialIcon name="auto_awesome" className="text-4xl mb-1 text-[#420047]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#FCFBF8] via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Content Area */}
          <div className="px-6 pb-6 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B2323] animate-pulse" />
              <h3 className="font-serif text-[16px] text-[#420047] tracking-widest font-medium">了解最新动态</h3>
            </div>
            
            <p className="font-sans text-[12px] md:text-[13px] text-[#5E5855] leading-relaxed mb-5 md:mb-6 font-light tracking-wide">
              本课程衍生版不沿用原项目运营账号。代码、版本说明和测试证据统一以独立仓库为准。
            </p>
            
            <button 
              onClick={handleAction}
              className="w-full py-2.5 md:py-3 bg-transparent border border-[#420047] text-[#420047] text-xs font-sans tracking-widest hover:bg-[#420047] hover:text-[#FCFBF8] transition-colors duration-300 rounded flex items-center justify-center gap-2"
            >
              <MaterialIcon name="menu_book" className="text-[16px]" />
              查看项目仓库
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Announcement;
