import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, updateStatus, deleteAccount } from '../api/user';
import { NavBar } from '../components/NavBar';
import Footer from '../components/Footer';

// 判断当前是否处于匹配锁定期间（北京时间周三 18:00 - 20:00）
function getIsMatchingLocked(): boolean {

  const now = new Date();
  const bj = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
  const day = bj.getDay();
  const hour = bj.getHours();
  return day === 3 && hour >= 18 && hour < 20;
}

export default function AccountSettings() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [toggleError, setToggleError] = useState('');
  const [emailToggleError, setEmailToggleError] = useState('');
  const [isTogglingEmail, setIsTogglingEmail] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleStatusToggle = async () => {
    if (!user || isTogglingStatus) return;
    if (getIsMatchingLocked()) {
      setToggleError('匹配计算中，状态暂时锁定 (18:00-20:00)');
      return;
    }
    setIsTogglingStatus(true);
    setToggleError('');
    try {
      const isParticipating = !user.isParticipating;
      await updateStatus(isParticipating);
      await refreshUser();
    } catch (err: any) {
      setToggleError(err.message || '状态更新失败');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleEmailToggle = async () => {
    if (!user || isTogglingEmail) return;
    setIsTogglingEmail(true);
    setEmailToggleError('');
    try {
      const newEmailPref = !user.emailNotifications;
      await updateProfile({ emailNotifications: newEmailPref });
      await refreshUser();
    } catch (err: any) {
      setEmailToggleError(err.message || '更新偏好失败');
    } finally {
      setIsTogglingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || isDeleting) return;
    
    const confirmText = prompt('输入 "CANCEL" 以注销账号。注销后个人信息将匿名化处理，操作不可逆：');
    if (confirmText !== 'CANCEL') {
      if (confirmText !== null) alert('输入不匹配，取消操作。');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      logout();
      navigate('/', { replace: true });
    } catch (err: any) {
      setDeleteError(err.message || '账号删除失败');
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FCFBF8] font-sans selection:bg-[#420047] selection:text-[#FCFBF8] pt-12 md:pt-20 flex flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-10 flex flex-col relative">
        <div className="mb-8">
          <Link replace to="/dashboard" className="inline-flex items-center text-xs md:text-sm font-sans tracking-[0.1em] md:tracking-[0.15em] text-[#8B7355] hover:text-[#2C2825] transition-all group">
            <span className="mr-2 group-hover:-translate-x-1 transition-transform text-lg leading-none">←</span> 返回仪表盘
          </Link>
        </div>

        <h1 className="text-2xl md:text-3xl font-serif text-[#2C2825] tracking-widest border-b border-[#EADBD8] pb-6 mb-8 md:mb-12">
          账户设置 / ACCOUNT
        </h1>

        <div className="space-y-6 md:space-y-8 flex-1">
          <section>
            <h2 className="text-xs md:text-sm font-sans tracking-widest text-[#8B7355] uppercase mb-3 md:mb-4">学号绑定 / Student ID</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-5 border-b border-[#EADBD8]/40 gap-4">
              <div className="pr-2 md:pr-4">
                <p className="text-[#2C2825] font-serif text-lg tracking-wide mb-1">绑定心动信笺学号</p>
                <p className="text-xs md:text-sm text-[#8B7355] font-light leading-relaxed">
                  学号邮箱注册会自动绑定。若使用邮箱别名注册，绑定后即可按学号投递心动信笺。
                </p>
              </div>
              <button
                onClick={() => navigate('/student-id/bind')}
                className="shrink-0 w-full sm:w-auto px-5 py-2.5 border border-[#8B7355]/50 text-[#8B7355] hover:border-[#420047] hover:text-[#420047] transition-colors text-xs md:text-sm tracking-widest font-sans rounded-sm bg-white/30"
              >
                去绑定
              </button>
            </div>
          </section>
          
          {/* Email Notifications */}
          <section>
            <h2 className="text-xs md:text-sm font-sans tracking-widest text-[#8B7355] uppercase mb-3 md:mb-4">邮件通知 / Notifications</h2>
            <div className="flex items-center justify-between py-5 border-b border-[#EADBD8]/40 gap-4">
              <div className="pr-2 md:pr-4">
                <p className="text-[#2C2825] font-serif text-lg tracking-wide mb-1">接收提醒邮件及宣传邮件</p>
                  <p className="text-xs md:text-sm text-[#8B7355] font-light leading-relaxed">关闭后您将不再收到系统发送的匹配通知、问卷填写提示及宣传活动邮件</p>
              </div>
              <button
                onClick={handleEmailToggle}
                disabled={isTogglingEmail}
                className={`shrink-0 relative w-12 h-6 md:w-14 md:h-7 rounded-full transition-colors duration-300 shadow-inner ${user.emailNotifications ? 'bg-[#420047]' : 'bg-[#EADBD8]'}`}
              >
                <div className={`absolute top-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#FCFBF8] shadow-sm transition-all duration-300 ${user.emailNotifications ? 'left-7 md:left-8' : 'left-1'}`} />
              </button>
            </div>
            {emailToggleError && <p className="text-red-500 text-xs mt-2">{emailToggleError}</p>}
          </section>

          {/* Account Status */}
          <section>
            <h2 className="text-xs md:text-sm font-sans tracking-widest text-[#8B7355] uppercase mb-3 md:mb-4 mt-8">归隐与落幕 / Account Status</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-5 border-b border-[#EADBD8]/40 gap-4">
              <div className="pr-2 md:pr-4">
                <p className="text-[#2C2825] font-serif text-lg tracking-wide mb-1">{user.isParticipating ? '合上封面（长期停止）' : '重启封面（恢复参与）'}</p>
                <p className="text-xs md:text-sm text-[#8B7355] font-light leading-relaxed max-w-md">
                  {user.isParticipating 
                    ? '永久停止参与匹配，直到手动重新开启。如只想跳过本周，可在首页便条中暂停本周。' 
                    : '重新开启匹配，让缘分再次流转。'}
                </p>
              </div>
              <button
                onClick={handleStatusToggle}
                disabled={isTogglingStatus || getIsMatchingLocked()}
                className="shrink-0 w-full sm:w-auto px-5 py-2.5 border border-[#8B7355]/50 text-[#8B7355] hover:border-[#420047] hover:text-[#420047] transition-colors text-xs md:text-sm tracking-widest font-sans rounded-sm bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {user.isParticipating ? '合上封面' : '重启封面'}
              </button>
            </div>
            {getIsMatchingLocked() && <p className="text-red-500 text-xs mt-2">匹配计算中，状态暂时锁定</p>}
            {toggleError && <p className="text-red-500 text-xs mt-2">{toggleError}</p>}
          </section>

          {/* Logout */}
          <section>
            <h2 className="text-xs md:text-sm font-sans tracking-widest text-[#8B7355] uppercase mb-3 md:mb-4 mt-8">登录管理 / Session</h2>
            <div className="flex items-center justify-between py-5 border-b border-[#EADBD8]/40 gap-4">
              <div className="pr-2 md:pr-4">
                <p className="text-[#2C2825] font-serif text-lg tracking-wide mb-1">登出当前设备</p>
                <p className="text-xs md:text-sm text-[#8B7355] font-light leading-relaxed">安全退出您的账号</p>
              </div>
              {logoutConfirm ? (
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={handleLogout} className="text-xs md:text-sm text-[#FCFBF8] bg-red-800/90 hover:bg-red-800 px-4 py-2 font-sans tracking-widest transition-colors rounded-sm shadow-sm">确认</button>
                  <button onClick={() => setLogoutConfirm(false)} className="text-xs md:text-sm text-[#8B7355] border border-[#8B7355]/30 hover:border-[#2C2825]/40 hover:text-[#2C2825] px-4 py-2 font-sans tracking-widest transition-colors rounded-sm">取消</button>
                </div>
              ) : (
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="shrink-0 px-5 py-2 border border-[#8B7355]/50 text-[#8B7355] hover:border-[#420047] hover:text-[#420047] transition-colors text-xs md:text-sm tracking-widest font-sans rounded-sm bg-white/30"
                >
                  登出
                </button>
              )}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-16 pb-8">
            <div className="p-6 md:p-8 border border-red-900/10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-50/40 to-transparent rounded-sm flex items-start justify-between flex-col md:flex-row gap-6 md:gap-8">
              <div>
                <p className="text-red-800/90 font-serif text-xl tracking-wide mb-2">注销账号</p>
                <p className="text-xs md:text-sm text-red-800/60 font-light leading-relaxed max-w-md">
                  决绝地离开。注销后，您的<strong className="font-medium">问卷数据</strong>将被匿名化处理（移除所有可识别字段）；<strong className="font-medium">配对记录</strong>以匿名形式留存用于算法改进；账号将<strong className="font-medium">无法恢复</strong>。<br />
                  如需完整删除全部数据，请发送邮件至{' '}
                  <a href="mailto:njumatch@163.com" className="underline underline-offset-2 hover:text-red-800/90 transition-colors">njumatch@163.com</a>
                  ，我们将在 7 个工作日内处理。
                </p>
              </div>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full md:w-auto px-6 py-2.5 bg-red-900/5 text-red-800 border border-red-900/20 hover:bg-red-900 hover:text-[#FCFBF8] transition-all duration-300 text-sm tracking-widest font-sans rounded-sm shrink-0 whitespace-nowrap shadow-sm"
              >
                {isDeleting ? '正在执行...' : '注销账号'}
              </button>
            </div>
            {deleteError && <p className="text-red-500 text-xs mt-3 flex justify-end">{deleteError}</p>}
          </section>

        </div>
      </main>
    </div>
  );
}
