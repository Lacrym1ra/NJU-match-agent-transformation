import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CHANGELOG_NOTICE } from '../pages/Changelog';

const CHANGELOG_SEEN_KEY = 'nj_changelog_seen';

export const NavBar = () => {
  const { isAuthenticated, user } = useAuth();
  const [showBadge, setShowBadge] = useState(false);
  useEffect(() => {
    setShowBadge(localStorage.getItem(CHANGELOG_SEEN_KEY) !== CHANGELOG_NOTICE.version);
  }, []);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#FCFBF8]/80 backdrop-blur-md border-b border-[#EADBD8]/40 h-20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-serif text-xl md:text-2xl tracking-widest text-[#2C2825] flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/icon.svg" alt="Logo" className="w-[1.2em] h-[1.2em] md:w-[1.1em] md:h-[1.1em] object-contain shrink-0" />
            <span>NJU Match</span>
          </Link>
          {/* 未登录时移动端显示"关于"小标签 */}
          {!isAuthenticated && (
            <Link to="/about" className="md:hidden ml-1 text-xs font-sans tracking-widest text-[#8B7355] border border-[#8B7355]/30 px-3 py-1.5 hover:text-[#2C2825] hover:border-[#2C2825]/40 transition-colors rounded-sm">
              关于
            </Link>
          )}
        </div>

        {/* 导航菜单 - 绝对定位居中 */}
        <div className="hidden md:flex gap-10 items-center absolute left-1/2 -translate-x-1/2">
          <Link to="/about" className="text-sm font-sans tracking-widest text-[#5E5855] hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300">
            关于我们
          </Link>
          <div className="relative flex flex-col items-center">
            <Link
              to="/personality-test"
              onClick={() => { localStorage.setItem('nj_personality_test_seen', 'true'); }}
              className="text-sm font-sans tracking-widest text-[#5E5855] hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300"
            >
              人格测验
              {localStorage.getItem('nj_personality_test_seen') !== 'true' && Date.now() < new Date('2026-04-29T00:00:00Z').getTime() && (
                <span className="absolute -top-1 -right-2 w-[6px] h-[6px] rounded-full bg-[#420047] animate-pulse" />
              )}
            </Link>
          </div>
          <div className="relative flex flex-col items-center">
            <Link
              to="/changelog"
              onClick={() => { localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG_NOTICE.version); setShowBadge(false); }}
              className="text-sm font-sans tracking-widest text-[#5E5855] hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300"
            >
              更新日志
              {showBadge && (
                <span className="absolute -top-1 -right-2 w-[6px] h-[6px] rounded-full bg-[#420047] animate-pulse" />
              )}
            </Link>
            {showBadge && (
              <span className="absolute top-full mt-2 whitespace-nowrap text-[10px] tracking-widest text-[#420047] font-serif pointer-events-none">
                {CHANGELOG_NOTICE.summary}
              </span>
            )}
          </div>
          <Link to="/privacy" className="text-sm font-sans tracking-widest text-[#5E5855] hover:text-[#2C2825] transition-colors relative after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-[#2C2825] hover:after:w-full after:transition-all after:duration-300">
            隐私协议
          </Link>
        </div>

        {/* 右侧操作区 - 确保占据一定空间支撑 flex */}
        <div className="flex justify-end">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 md:gap-3">
              <Link
                to="/dashboard"
                title={user?.nickname || '案榻'}
                className="w-9 h-9 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center font-serif text-sm font-medium shrink-0 hover:bg-[#2A002D] transition-colors select-none"
              >
                {(user?.nickname || '案')[0]}
              </Link>
              <Link
                to="/account"
                className="text-xs md:text-sm font-sans tracking-widest text-[#8B7355] hover:text-[#2C2825] transition-colors border border-[#8B7355]/30 px-3 py-1.5 md:px-4 md:py-2 hover:border-[#2C2825]/40 rounded-sm"
              >
                设置
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-xs md:text-sm font-sans tracking-widest text-[#FCFBF8] bg-[#420047] px-4 py-2 md:px-5 md:py-2.5 rounded-sm hover:bg-[#2A002D] transition-colors shadow-sm"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
