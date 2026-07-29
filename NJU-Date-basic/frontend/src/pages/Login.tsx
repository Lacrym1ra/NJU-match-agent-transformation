import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  sendCode,
  loginWithPassword,
  registerWithPassword,
  sendResetPasswordCode,
  resetPassword,
} from '../api/auth';
import MaterialIcon from '../components/MaterialIcon';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import UserAgreement from '../components/UserAgreement';

type TabMode = 'login' | 'register';
type RegisterStep = 1 | 2;

const Login = () => {
  const [mode, setMode] = useState<TabMode>('login');
  const [regStep, setRegStep] = useState<RegisterStep>(1);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, refreshUser } = useAuth();

  // 已经登录直接跳转
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(prev => prev - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const smailRegex = /^[a-zA-Z0-9._%+-]+@smail\.nju\.edu\.cn$/;

  const clearMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleModeSwitch = (newMode: TabMode) => {
    setMode(newMode);
    clearMessages();
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setIsResetMode(false);
    setRegStep(1);
  };

  // --- 登录模式 ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!agreed) { setShowAgreement(true); return; }
    if (!email) { setErrorMsg('邮箱不能为空'); return; }
    if (!smailRegex.test(email)) { setErrorMsg('仅支持 @smail.nju.edu.cn 后缀的南大邮箱'); return; }
    if (!password) { setErrorMsg('密码不能为空'); return; }

    setIsLoading(true);
    try {
      const res = await loginWithPassword(email, password);
      await refreshUser();
      if (!res.user.profileComplete) navigate('/settings', { replace: true });
      else navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'USER_NOT_REGISTERED') {
          // 未注册邮箱 → 自动切换到注册 tab 并保留邮箱
          handleModeSwitch('register');
          setEmail(email);
          setErrorMsg('该邮箱尚未注册，已为你跳转到注册页面');
        } else {
          setErrorMsg(err.message || '登录失败，请检查邮箱与密码');
        }
      } else {
        setErrorMsg('临时离线或网络异常，请稍后再试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    clearMessages();
    if (!email) { setErrorMsg('邮箱不能为空'); return; }
    if (!smailRegex.test(email)) { setErrorMsg('仅支持 @smail.nju.edu.cn 后缀的南大邮箱'); return; }
    if (cooldown > 0) { setErrorMsg(`请等待 ${cooldown} 秒后再试`); return; }

    setIsLoading(true);
    try {
      await sendResetPasswordCode(email);
      setCooldown(60);
      setSuccessMsg('若邮箱存在，验证码已发送');
    } catch (err) {
      if (err instanceof ApiError) setErrorMsg(err.message || '发送失败，请重试');
      else setErrorMsg('网络异常，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!email) { setErrorMsg('邮箱不能为空'); return; }
    if (!smailRegex.test(email)) { setErrorMsg('仅支持 @smail.nju.edu.cn 后缀的南大邮箱'); return; }
    if (!resetCode || resetCode.length < 6) { setErrorMsg('请填入完整的六位验证码'); return; }
    if (resetNewPassword.length < 6) { setErrorMsg('新密码至少需要 6 个字符'); return; }
    if (resetNewPassword !== resetConfirmPassword) { setErrorMsg('两次输入的新密码不一致'); return; }

    setIsLoading(true);
    try {
      await resetPassword(email, resetCode, resetNewPassword);
      setPassword('');
      setConfirmPassword('');
      setResetCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setIsResetMode(false);
      setSuccessMsg('密码重置成功，请使用新密码登录');
    } catch (err) {
      if (err instanceof ApiError) setErrorMsg(err.message || '重置失败，请检查验证码');
      else setErrorMsg('网络异常，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 注册模式：步骤 1 (发验证码) ---
  const handleSendCode = async () => {
    clearMessages();
    if (!agreed) { setShowAgreement(true); return; }
    if (!email) { setErrorMsg('邮箱不能为空'); return; }
    if (!smailRegex.test(email)) { setErrorMsg('仅支持 @smail.nju.edu.cn 后缀的南大邮箱'); return; }
    if (cooldown > 0) { setErrorMsg(`请等待 ${cooldown} 秒后再试`); return; }

    setIsLoading(true);
    try {
      await sendCode(email);
      setCooldown(60);
      // 并没有立马跳转，只是发送验证码。发完后用户需要在此步输入验证码，并在前端校验长度然后进入下一步。
      setSuccessMsg('验证码已发送，请查收邮箱');
    } catch (err) {
      if (err instanceof ApiError) setErrorMsg(err.message || '发送失败，请重试');
      else setErrorMsg('网络异常，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  // 验证码长度足够后进入下一步设置密码
  const handleNextToPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) { setErrorMsg('请填入完整的六位验证码'); return; }
    setRegStep(2);
    clearMessages();
  };

  // --- 注册模式：步骤 2 (注册并设置账号) ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (password.length < 6) { setErrorMsg('密码至少需要 6 个字符'); return; }
    if (password !== confirmPassword) { setErrorMsg('两次输入的密码不一致'); return; }

    setIsLoading(true);
    try {
      const res = await registerWithPassword(email, code, password);
      await refreshUser();
      // 注册成功，引导去完成个人信息 (流程 3)
      navigate('/onboarding', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setErrorMsg(err.message || '注册失败，可能验证码错误或账号已存在');
      else setErrorMsg('发生未知错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const pageVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
    exit: { opacity: 0, x: 10, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen bg-[#FCFBF8] flex flex-col md:flex-row overflow-hidden font-sans text-[#2C2825]">
      
      {/* Mobile Top Image Banner */}
      <div className="block md:hidden relative w-full h-[28vh] shrink-0 z-0">
        <img
          src="/images/login.jpg"
          alt="Nanjing University"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
        <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-[#FCFBF8] drop-shadow-md text-sm tracking-widest uppercase">
          <MaterialIcon name="arrow_back" className="text-base" />归去
        </Link>
        <div className="absolute bottom-10 right-6 text-right z-10">
          <p className="font-serif text-[#FCFBF8] text-lg drop-shadow-md">
            「斯人若彩虹，遇上方知有」
          </p>
          <p className="font-sans text-[#FCFBF8]/90 text-xs mt-1 tracking-widest uppercase drop-shadow-md">
            NJU Match
          </p>
        </div>
      </div>

      {/* Left Form Section (Desktop) / Mobile Drawer */}
      <div className="w-full md:w-5/12 lg:w-1/3 flex flex-col md:justify-center px-8 md:px-16 py-10 md:py-12 relative z-20 min-h-[75vh] md:min-h-screen bg-[#FCFBF8] rounded-t-3xl md:rounded-none -mt-5 md:mt-0 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] md:shadow-none">

        {/* Desktop Back Button */}
        <Link to="/" className="hidden md:flex absolute top-8 left-12 items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors text-sm tracking-widest uppercase">
          <MaterialIcon name="arrow_back" className="text-base" />归去
        </Link>

        <div className="w-full max-w-sm mx-auto">
          
          {/* Tab Switcher */}
          <div className="flex gap-8 mb-8 md:mb-12 mt-2 md:mt-0">
            <button 
              type="button"
              onClick={() => handleModeSwitch('login')} 
              className={`text-2xl md:text-3xl font-serif transition-colors ${mode === 'login' ? 'text-[#2C2825]' : 'text-[#B5AFA6] hover:text-[#8B7355]'}`}
            >
              登录
            </button>
            <button 
              type="button"
              onClick={() => handleModeSwitch('register')} 
              className={`text-2xl md:text-3xl font-serif transition-colors ${mode === 'register' ? 'text-[#2C2825]' : 'text-[#B5AFA6] hover:text-[#8B7355]'}`}
            >
              注册
            </button>
          </div>

          <AnimatePresence mode="wait">
            
            {/* ====== 登录流 ====== */}
            {mode === 'login' && (
              <motion.div key="login" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                {!isResetMode ? (
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2 relative">
                      <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">Smail Email</label>
                      <input
                        type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
                        placeholder="学号@smail.nju.edu.cn"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                    </div>

                    <div className="space-y-2 relative pb-2">
                      <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">Password</label>
                      <input
                        type="password" value={password} onChange={(e) => { setPassword(e.target.value); clearMessages(); }}
                        placeholder="请输入密码"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                    </div>

                    {errorMsg && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-800/80 text-xs -mt-2 ml-1">
                        {errorMsg}
                      </motion.p>
                    )}
                    {successMsg && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-700 text-xs -mt-2 ml-1">
                        {successMsg}
                      </motion.p>
                    )}

                    <button
                      type="submit" disabled={isLoading}
                      className="w-full relative overflow-hidden bg-gradient-to-br from-[#611066] to-[#420047] text-[#FCFBF8] font-medium py-4 rounded-[3rem] shadow-[0_12px_32px_rgba(66,0,71,0.15)] hover:shadow-[0_16px_40px_rgba(66,0,71,0.25)] hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-70 flex justify-center items-center mt-4"
                    >
                      {isLoading ? <MaterialIcon name="refresh" className="animate-spin" /> : '登录'}
                    </button>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <input
                        type="checkbox"
                        id="agree-login"
                        checked={agreed}
                        onChange={(e) => { setAgreed(e.target.checked); clearMessages(); }}
                        className="w-4 h-4 accent-[#611066] rounded cursor-pointer"
                      />
                      <label htmlFor="agree-login" className="text-xs text-[#8B7355] cursor-pointer">
                        我已阅读并同意 <button type="button" onClick={(e) => { e.preventDefault(); setShowAgreement(true); }} className="text-[#611066] hover:underline underline-offset-2">用户协议</button>
                      </label>
                    </div>
                    <p className="text-center text-[11px] text-[#8B7355]/70 pt-3 leading-relaxed">
                      此账号密码为本平台注册的账号密码，非南大邮箱密码
                    </p>
                    <p className="text-center text-[10px] text-[#8B7355]/50 leading-relaxed flex items-center justify-center gap-1">
                      <MaterialIcon name="lock" className="" style={{ fontSize: 11 }} />
                      HTTPS 加密传输 · bcrypt 单向哈希存储 · 平台无法获取原始密码
                    </p>
                    <div className="flex items-center justify-center gap-4 pt-2 text-xs text-[#8B7355] tracking-widest">
                      <button
                        type="button"
                        onClick={() => { setIsResetMode(true); clearMessages(); }}
                        className="text-[#611066] hover:underline underline-offset-2"
                      >
                        忘记密码
                      </button>
                      <span className="text-[#EAE7E1]">|</span>
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('register')}
                        className="text-[#611066] hover:underline underline-offset-2"
                      >
                        没有账号？去注册
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="space-y-2 relative">
                      <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">Smail Email</label>
                      <input
                        type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
                        placeholder="学号@smail.nju.edu.cn"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                    </div>

                    <div className="space-y-2 relative">
                      <label className="flex justify-between items-center text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1 z-10 w-full relative">
                        <span>Verification Code</span>
                        <button
                          type="button" onClick={handleSendResetCode} disabled={cooldown > 0 || isLoading}
                          className="text-[#611066] hover:text-[#420047] disabled:text-[#B5AFA6] transition-colors mr-1"
                        >
                          {cooldown > 0 ? `${cooldown}s后重发` : '获取验证码'}
                        </button>
                      </label>
                      <input
                        type="text" maxLength={6} value={resetCode} onChange={(e) => { setResetCode(e.target.value.replace(/\D/g, '')); clearMessages(); }}
                        placeholder="六位数字"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] tracking-[0.5em] text-center font-serif text-xl px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6] placeholder:tracking-normal placeholder:font-sans placeholder:text-base"
                      />
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">New Password</label>
                      <input
                        type="password" value={resetNewPassword} onChange={(e) => { setResetNewPassword(e.target.value); clearMessages(); }}
                        placeholder="设置新密码 (至少6位)"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">Confirm Password</label>
                      <input
                        type="password" value={resetConfirmPassword} onChange={(e) => { setResetConfirmPassword(e.target.value); clearMessages(); }}
                        placeholder="再次输入确认"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                    </div>

                    {errorMsg && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-800/80 text-xs -mt-2 ml-1">
                        {errorMsg}
                      </motion.p>
                    )}
                    {successMsg && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-700 text-xs -mt-2 ml-1">
                        {successMsg}
                      </motion.p>
                    )}

                    <button
                      type="submit" disabled={isLoading}
                      className="w-full relative overflow-hidden bg-gradient-to-br from-[#611066] to-[#420047] text-[#FCFBF8] font-medium py-4 rounded-[3rem] shadow-[0_12px_32px_rgba(66,0,71,0.15)] hover:shadow-[0_16px_40px_rgba(66,0,71,0.25)] hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-70 flex justify-center items-center mt-4"
                    >
                      {isLoading ? <MaterialIcon name="refresh" className="animate-spin" /> : '重置密码'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsResetMode(false); clearMessages(); }}
                      className="w-full text-sm text-[#8B7355] hover:text-[#2C2825] transition-colors"
                    >
                      返回密码登录
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* ====== 注册流 ====== */}
            {mode === 'register' && (
              <motion.div key="register" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col">
                
                {/* 注册进度指示器 */}
                <div className="flex items-center gap-2 mb-8 text-[11px] md:text-xs tracking-wider font-medium text-[#B5AFA6]">
                   <span className={`transition-colors ${regStep === 1 ? 'text-[#420047] font-semibold' : ''}`}>1 邮徽验证</span>
                   <span className="flex-1 h-[1px] bg-[#EAE7E1]"></span>
                   <span className={`transition-colors ${regStep === 2 ? 'text-[#420047] font-semibold' : ''}`}>2 锻造秘钥</span>
                   <span className="flex-1 h-[1px] bg-[#EAE7E1]"></span>
                   <span>3 个人画像</span>
                </div>

                {regStep === 1 && (
                  <form onSubmit={handleNextToPassword} className="space-y-6">
                    <div className="space-y-2 relative">
                      <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">Smail Email</label>
                      <div className="flex gap-2">
                        <input
                          type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                          placeholder="学号@smail.nju.edu.cn"
                          className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 relative pb-2">
                      <label className="flex justify-between items-center text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1 z-10 w-full relative">
                        <span>Verification Code</span>
                        <button 
                          type="button" onClick={handleSendCode} disabled={cooldown > 0 || isLoading}
                          className="text-[#611066] hover:text-[#420047] disabled:text-[#B5AFA6] transition-colors mr-1"
                        >
                          {cooldown > 0 ? `${cooldown}s后重发` : '获取验证码'}
                        </button>
                      </label>
                      <input
                        type="text" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
                        placeholder="六位数字"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] tracking-[0.5em] text-center font-serif text-xl px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6] placeholder:tracking-normal placeholder:font-sans placeholder:text-base relative z-0"
                      />
                      {errorMsg && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-800/80 text-xs absolute -bottom-4 left-1">
                          {errorMsg}
                        </motion.p>
                      )}
                    </div>

                    <button
                      type="submit" disabled={code.length < 6}
                      className="w-full relative overflow-hidden bg-[#2C2825] text-[#FCFBF8] font-medium py-4 rounded-[3rem] shadow-lg hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50 mt-4 flex justify-center items-center"
                    >
                      下一步
                    </button>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <input 
                        type="checkbox" 
                        id="agree-register" 
                        checked={agreed} 
                        onChange={(e) => { setAgreed(e.target.checked); setErrorMsg(''); }}
                        className="w-4 h-4 accent-[#611066] rounded cursor-pointer"
                      />
                      <label htmlFor="agree-register" className="text-xs text-[#8B7355] cursor-pointer">
                        我已阅读并同意 <button type="button" onClick={(e) => { e.preventDefault(); setShowAgreement(true); }} className="text-[#611066] hover:underline underline-offset-2">用户协议</button>
                      </label>
                    </div>
                  </form>
                )}

                {regStep === 2 && (
                  <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-2 relative">
                      <label className="flex justify-between text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">
                        <span>New Password</span>
                        <button type="button" onClick={() => { setRegStep(1); setErrorMsg(''); }} className="hover:text-[#2C2825]">上一步</button>
                      </label>
                      <input
                        type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                        placeholder="设置账号密码 (至少6位)"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                    </div>
                    
                    <div className="space-y-2 relative pb-2">
                       <label className="text-xs tracking-[0.1em] text-[#8B7355] font-medium uppercase ml-1">Confirm Password</label>
                       <input
                        type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                        placeholder="再次输入确认"
                        className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-4 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6]"
                      />
                      {errorMsg && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-800/80 text-xs absolute -bottom-4 left-1">
                          {errorMsg}
                        </motion.p>
                      )}
                    </div>

                    <button
                      type="submit" disabled={isLoading || password.length < 6 || confirmPassword.length < 6}
                      className="w-full relative overflow-hidden bg-gradient-to-br from-[#611066] to-[#420047] text-[#FCFBF8] font-medium py-4 rounded-[3rem] shadow-[0_12px_32px_rgba(66,0,71,0.15)] hover:shadow-[0_16px_40px_rgba(66,0,71,0.25)] hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-70 flex justify-center items-center mt-4"
                    >
                      {isLoading ? <MaterialIcon name="refresh" className="animate-spin" /> : '创建数字契约'}
                    </button>
                  </form>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Right Image Section (Desktop) */}
      <div className="hidden md:block md:w-7/12 lg:w-2/3 relative min-h-screen">
        <motion.div
          className="absolute inset-0 bg-[#FCFBF8]"
          initial={{ opacity: 1 }} animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{ zIndex: 10 }}
        />
        <img
          src="/images/login.jpg"
          alt="Nanjing University"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FCFBF8] via-transparent to-transparent opacity-60 z-0" />
        <div className="absolute inset-0 bg-black/10 z-0" />
        <div className="absolute bottom-12 right-12 text-right z-10">
          <p className="font-serif text-[#FCFBF8] text-xl md:text-2xl drop-shadow-md">
            「斯人若彩虹，遇上方知有」
          </p>
          <p className="font-sans text-[#FCFBF8]/80 text-sm mt-3 tracking-widest uppercase drop-shadow-md">
            Nanjing University Match
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showAgreement && (
          <UserAgreement 
            onAccept={() => {
              setAgreed(true);
              setShowAgreement(false);
              setErrorMsg('');
            }}
            onClose={() => setShowAgreement(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
