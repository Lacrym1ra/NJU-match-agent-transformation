import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, updateProfileDraft, ProfileDraftPayload, ProfileUpdatePayload } from '../api/user';
import MaterialIcon from '../components/MaterialIcon';

const DEPARTMENTS = [
  "文学院", "历史学院", "哲学学院", "新闻传播学院", "法学院", "商学院",
  "外国语学院", "政府管理学院", "国际关系学院", "信息管理学院", "社会学院",
  "数学学院", "物理学院", "天文与空间科学学院", "化学学院", "化工学院",
  "计算机学院", "软件学院", "人工智能学院", "电子科学与工程学院",
  "现代工程与应用科学学院", "环境学院", "地球科学与工程学院",
  "地理与海洋科学学院", "大气科学学院", "南赫学院", "生命科学学院",
  "医学院", "工程管理学院", "匡亚明学院", "海外教育学院", "教育研究院・陶行知教师教育学院",
  "建筑与城市规划学院", "马克思主义学院", "艺术学院",
  "智能科学与技术学院", "智能软件与工程学院", "集成电路学院",
  "数字经济与管理学院", "能源与资源学院", "国家卓越工程师学院",
  "机器人与自动化学院", "未来技术学院", "前沿科学学院",
  "先进制造学院", "生物医学工程学院", "其他"
];

const GRADE_OPTIONS = ['大一', '大二', '大三', '大四', '大五', '研一', '研二', '研三', '博一', '博二', '博三及以上', '博士后'];

const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP'
];

type StepId = 'nickname' | 'gender' | 'intention' | 'genderPref' | 'edu' | 'contact' | 'mbti';

interface Step {
  id: StepId;
  title: string;
  subtitle?: string;
}

const CONTACT_PLATFORMS = [
  { value: 'wechat', label: '微信' },
  { value: 'qq', label: 'QQ' },
  { value: 'xiaohongshu', label: '小红书' },
] as const;

const STEPS: Step[] = [
  { id: 'nickname', title: '该如何称呼你？', subtitle: '随便填个化名即可，无需真名' },
  { id: 'gender', title: '你的性别是？' },
  { id: 'intention', title: '来到这里，主要是为了...' },
  { id: 'genderPref', title: '希望在此遇见的 Ta 是？' },
  { id: 'edu', title: '目前处于什么学习阶段？', subtitle: '这会帮助我们了解你的生活轨迹' },
  { id: 'contact', title: '留个联络方式吧', subtitle: '匹配成功后对方可见，选填' },
  { id: 'mbti', title: '你的 MBTI 是？', subtitle: '也可直接跳过' },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.9,
    rotateY: direction > 0 ? 45 : -45,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.9,
    rotateY: direction < 0 ? 45 : -45,
  })
};

function getFirstIncompleteStepIndex(state: {
  nickname: string;
  gender: 'male' | 'female' | '';
  intention: 'friend' | 'partner' | '';
  genderPref: 'male' | 'female' | 'any' | '';
  department: string;
  grade: string;
  campus: 'gulou' | 'xianlin' | 'suzhou' | 'pukou' | '';
}): number {
  if (!state.nickname.trim()) return 0;
  if (!state.gender) return 1;
  if (!state.intention) return 2;
  if (!state.genderPref) return 3;
  if (!state.department || !state.grade || !state.campus) return 4;
  // contact (5) is optional, skip to mbti (6)
  return 6;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const didHydrateRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<ProfileDraftPayload>({});

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 收集的数据
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [intention, setIntention] = useState<'friend' | 'partner' | ''>('');
  const [genderPref, setGenderPref] = useState<'male' | 'female' | 'any' | ''>('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [campus, setCampus] = useState<'gulou' | 'xianlin' | 'suzhou' | 'pukou' | ''>('');
  const [contactPlatform, setContactPlatform] = useState<'wechat' | 'qq' | 'xiaohongshu'>('wechat');
  const [contactId, setContactId] = useState('');
  const [mbti, setMbti] = useState('');

  const flushDraft = useCallback(async () => {
    const payload = pendingDraftRef.current;
    pendingDraftRef.current = {};

    if (Object.keys(payload).length === 0) return;

    setSaveStatus('saving');
    try {
      await updateProfileDraft(payload);
      setSaveStatus('saved');
    } catch {
      // Keep silent to avoid interrupting onboarding flow.
      setSaveStatus('error');
    } finally {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, []);

  const queueDraftSave = useCallback((patch: ProfileDraftPayload) => {
    const sanitized: ProfileDraftPayload = {};

    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined) return;
      if (typeof value === 'string' && value.trim() === '') return;
      (sanitized as any)[key] = value;
    });

    if (Object.keys(sanitized).length === 0) return;

    pendingDraftRef.current = {
      ...pendingDraftRef.current,
      ...sanitized,
    };

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }

    draftTimerRef.current = setTimeout(() => {
      void flushDraft();
    }, 600);
  }, [flushDraft]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user || didHydrateRef.current) return;

    const pref = (user.genderPref || user.genderPreference || '') as 'male' | 'female' | 'any' | '';
    const nextState = {
      nickname: user.nickname || '',
      gender: (user.gender || '') as 'male' | 'female' | '',
      intention: (user.intention || '') as 'friend' | 'partner' | '',
      genderPref: pref,
      department: user.department || '',
      grade: user.grade || '',
      campus: (user.campus || '') as 'gulou' | 'xianlin' | 'suzhou' | 'pukou' | '',
      mbti: user.mbti || '',
    };

    setNickname(nextState.nickname);
    setGender(nextState.gender);
    setIntention(nextState.intention);
    setGenderPref(nextState.genderPref);
    setDepartment(nextState.department);
    setGrade(nextState.grade);
    setCampus(nextState.campus);
    if (user.contactPlatform && ['wechat', 'qq', 'xiaohongshu'].includes(user.contactPlatform)) {
      setContactPlatform(user.contactPlatform as 'wechat' | 'qq' | 'xiaohongshu');
    }
    setContactId(user.contactId || '');
    setMbti(nextState.mbti);
    setCurrentIdx(getFirstIncompleteStepIndex(nextState));

    didHydrateRef.current = true;
  }, [user]);

  const nextStep = () => {
    if (currentIdx < STEPS.length - 1) {
      setDirection(1);
      setCurrentIdx((p) => p + 1);
    }
  };

  const prevStep = () => {
    if (currentIdx > 0) {
      setDirection(-1);
      setCurrentIdx((p) => p - 1);
    }
  };

  const handleFinish = async (finalMbti: string) => {
    setErrorMsg('');

    // 前端预校验，给出友好提示
    if (!nickname.trim()) { setErrorMsg('请填写昵称'); return; }
    if (!gender) { setErrorMsg('请选择性别'); return; }
    if (!intention) { setErrorMsg('请选择来此目的'); return; }
    if (!genderPref) { setErrorMsg('请选择希望遇见的对象'); return; }
    if (!department) { setErrorMsg('请选择所属学院'); return; }
    if (!grade) { setErrorMsg('请选择在读阶段'); return; }
    if (!campus) { setErrorMsg('请选择常驻校区'); return; }

    setIsSubmitting(true);

    try {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
      await flushDraft();

      const payload: ProfileUpdatePayload = {
        nickname,
        gender: gender as any,
        intention: intention as any,
        genderPref: genderPref as any,
        department,
        grade,
        campus: campus as any,
        mbti: finalMbti || 'UNKNOWN',
        ...(contactId.trim() ? { contactPlatform, contactId: contactId.trim() } : {}),
      };
      await updateProfile(payload);
      await refreshUser();
      // 完成基础设置后跳转问卷
      navigate('/survey', { replace: true });
    } catch {
      setErrorMsg('保存失败，请检查所有信息是否填写完整后重试');
      setIsSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (STEPS[currentIdx].id) {
      case 'nickname': return nickname.trim().length > 0 && !/[<>]/.test(nickname) && nickname.length <= 20;
      case 'gender': return !!gender;
      case 'intention': return !!intention;
      case 'genderPref': return !!genderPref;
      case 'edu': return !!department && !!grade && !!campus;
      case 'contact': return true; // 选填
      case 'mbti': return true; // 可跳过
      default: return true;
    }
  };

  const renderContent = () => {
    const stepId = STEPS[currentIdx].id;

    if (stepId === 'nickname') {
      const hasInvalidChars = /[<>]/.test(nickname);
      const tooLong = nickname.length > 20;
      const nicknameHint = hasInvalidChars
        ? '昵称不能包含 < 或 > 符号'
        : tooLong
        ? '昵称最多 20 个字符'
        : null;

      return (
        <div className="flex flex-col gap-2 w-full">
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={nickname}
              maxLength={20}
              onChange={(e) => {
                const next = e.target.value;
                setNickname(next);
                queueDraftSave({ nickname: next });
              }}
              onKeyDown={(e) => e.key === 'Enter' && isStepValid() && nextStep()}
              className="w-full text-center bg-transparent border-b-2 border-[#8B7355]/30 focus:border-[#420047] text-2xl font-serif text-[#2C2825] py-4 outline-none transition-colors"
              placeholder="起个好名字"
            />
            <span className={`absolute right-0 bottom-1 text-xs font-sans ${nickname.length >= 18 ? 'text-red-400' : 'text-[#8B7355]/40'}`}>
              {nickname.length}/20
            </span>
          </div>
          {nicknameHint ? (
            <p className="text-xs text-red-500 text-center font-sans">{nicknameHint}</p>
          ) : (
            <p className="text-xs text-[#8B7355]/60 text-center font-sans">1-20 个字符，支持中英文及数字</p>
          )}
        </div>
      );
    }

    if (stepId === 'gender') {
      return (
        <div className="flex gap-4 sm:gap-8 justify-center">
          <button
            onClick={() => {
              setGender('male');
              queueDraftSave({ gender: 'male' });
              setTimeout(nextStep, 300);
            }}
            className={`w-32 py-12 rounded-2xl flex flex-col justify-center items-center gap-4 transition-all ${gender === 'male' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner scale-105' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            男
          </button>
          <button
            onClick={() => {
              setGender('female');
              queueDraftSave({ gender: 'female' });
              setTimeout(nextStep, 300);
            }}
            className={`w-32 py-12 rounded-2xl flex flex-col justify-center items-center gap-4 transition-all ${gender === 'female' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner scale-105' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            女
          </button>
        </div>
      );
    }

    if (stepId === 'intention') {
      return (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              setIntention('friend');
              queueDraftSave({ intention: 'friend' });
              setTimeout(nextStep, 300);
            }}
            className={`w-full py-6 rounded-2xl transition-all font-serif text-xl ${intention === 'friend' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            找朋友
          </button>
          <button
            onClick={() => {
              setIntention('partner');
              queueDraftSave({ intention: 'partner' });
              setTimeout(nextStep, 300);
            }}
            className={`w-full py-6 rounded-2xl transition-all font-serif text-xl ${intention === 'partner' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            找伴侣
          </button>
        </div>
      );
    }

    if (stepId === 'genderPref') {
      return (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              setGenderPref('female');
              queueDraftSave({ genderPref: 'female' });
              setTimeout(nextStep, 300);
            }}
            className={`w-full py-6 rounded-2xl transition-all font-serif text-xl ${genderPref === 'female' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            女生
          </button>
          <button
            onClick={() => {
              setGenderPref('male');
              queueDraftSave({ genderPref: 'male' });
              setTimeout(nextStep, 300);
            }}
            className={`w-full py-6 rounded-2xl transition-all font-serif text-xl ${genderPref === 'male' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            男生
          </button>
          <button
            onClick={() => {
              setGenderPref('any');
              queueDraftSave({ genderPref: 'any' });
              setTimeout(nextStep, 300);
            }}
            className={`w-full py-6 rounded-2xl transition-all font-serif text-xl ${genderPref === 'any' ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
          >
            不限
          </button>
        </div>
      );
    }

    if (stepId === 'edu') {
      return (
        <div className="flex flex-col gap-6">
          <select
            value={department}
            onChange={(e) => {
              const next = e.target.value;
              setDepartment(next);
              queueDraftSave({ department: next });
            }}
            className="w-full bg-[#EAE7E1] text-[#2C2825] px-6 py-4 rounded-xl outline-none font-serif hover:bg-[#D5CFC7] transition-colors cursor-pointer appearance-none"
          >
            <option value="" disabled>选择所属学院</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={grade}
            onChange={(e) => {
              const next = e.target.value;
              setGrade(next);
              queueDraftSave({ grade: next });
            }}
            className="w-full bg-[#EAE7E1] text-[#2C2825] px-6 py-4 rounded-xl outline-none font-serif hover:bg-[#D5CFC7] transition-colors cursor-pointer appearance-none"
          >
            <option value="" disabled>选择在读阶段</option>
            {GRADE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={campus}
            onChange={(e) => {
              const next = e.target.value as 'gulou' | 'xianlin' | 'suzhou' | 'pukou' | '';
              setCampus(next);
              queueDraftSave({ campus: next || undefined });
            }}
            className="w-full bg-[#EAE7E1] text-[#2C2825] px-6 py-4 rounded-xl outline-none font-serif hover:bg-[#D5CFC7] transition-colors cursor-pointer appearance-none"
          >
            <option value="" disabled>选择常驻校区</option>
            <option value="xianlin">仙林</option>
            <option value="gulou">鼓楼</option>
            <option value="suzhou">苏州</option>
            <option value="pukou">浦口</option>
          </select>
        </div>
      );
    }

    if (stepId === 'contact') {
      return (
        <div className="flex flex-col gap-6 w-full">
          <div className="flex gap-2 justify-center">
            {CONTACT_PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setContactPlatform(p.value)}
                className={`px-5 py-3 rounded-xl text-sm font-serif transition-all ${contactPlatform === p.value ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner font-medium' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nextStep()}
            placeholder={contactPlatform === 'wechat' ? '微信号' : contactPlatform === 'qq' ? 'QQ 号' : '小红书号'}
            className="w-full text-center bg-transparent border-b-2 border-[#8B7355]/30 focus:border-[#420047] text-xl font-serif text-[#2C2825] py-4 outline-none transition-colors placeholder:text-[#B5AFA6]"
          />
          <p className="text-xs text-[#8B7355]/60 text-center font-sans">匹配成功双方互选后可见，不填也可以之后在设置中补充</p>
        </div>
      );
    }

    if (stepId === 'mbti') {
      return (
        <div className="flex flex-col gap-6 items-center">
          <div className="grid grid-cols-4 gap-2 w-full">
            {MBTI_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMbti(m);
                  queueDraftSave({ mbti: m });
                }}
                className={`py-3 rounded-lg text-sm transition-all font-serif ${mbti === m ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner font-medium' : 'bg-[#EAE7E1] text-[#8B7355] hover:bg-[#D5CFC7]'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#8B7355] font-serif text-center mt-2">
            不知道 MBTI？可以先去 <a href="https://www.16personalities.com/" target="_blank" rel="noreferrer" className="text-[#420047] underline hover:text-[#2A002D]">测试一下</a>
          </p>
          <div className="flex gap-4 w-full mt-4">
            <button onClick={() => handleFinish('UNKNOWN')} disabled={isSubmitting} className="flex-1 py-4 bg-transparent border border-[#8B7355]/30 text-[#8B7355] rounded-xl hover:bg-[#EAE7E1]">
              不填，直接完成
            </button>
            <button onClick={() => handleFinish(mbti)} disabled={isSubmitting || !mbti} className="flex-1 py-4 bg-[#420047] text-white rounded-xl disabled:opacity-50 tracking-widest font-serif flex items-center justify-center gap-2">
              {isSubmitting && <MaterialIcon name="refresh" className="text-[16px] animate-spin" />}
              提交落档
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FCFBF8] font-sans text-[#2C2825] flex flex-col items-center relative overflow-hidden">
      {/* 顶部进度条 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#EAE7E1]">
        <motion.div
          className="h-full bg-[#8B7355]"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* 静默保存提示 */}
      <div className="absolute top-6 right-6 z-50">
        <AnimatePresence mode="wait">
          {saveStatus !== 'idle' && (
            <motion.div
              key={saveStatus}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-1 text-xs font-serif tracking-widest text-[#8B7355]/60"
            >
              {saveStatus === 'saving' && (
                <>
                  <MaterialIcon name="sync" className="text-[14px] animate-spin" />
                  自动保存中...
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <MaterialIcon name="check" className="text-[14px]" />
                  已保存
                </>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-800/60 flex items-center gap-1">
                  <MaterialIcon name="error" className="text-[14px]" />
                  自动保存失败
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-lg px-6 flex-1 flex items-center justify-center relative">
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={currentIdx}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute w-full px-6 py-12 bg-[#FCFBF8] border border-[#EAE7E1] shadow-[0_20px_40px_rgba(139,115,85,0.08)] flex flex-col items-center gap-8 rounded-sm"
          >
            <div className="text-center">
              <h1 className="font-serif text-2xl tracking-widest text-[#2C2825] mb-2">{STEPS[currentIdx].title}</h1>
              {STEPS[currentIdx].subtitle && <p className="text-sm text-[#8B7355] font-serif">{STEPS[currentIdx].subtitle}</p>}
            </div>

            {errorMsg && (
              <div className="w-full bg-red-50 text-red-700 text-sm px-4 py-3 rounded border border-red-100 text-center leading-snug">
                {errorMsg}
              </div>
            )}

            <div className="w-full">
              {renderContent()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 底部导航条 */}
      <div className="flex items-center gap-8 py-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={prevStep}
          className={`p-2 text-2xl transition-colors ${currentIdx === 0 ? 'text-transparent cursor-default' : 'text-[#8B7355] hover:text-[#2C2825]'}`}
          aria-label="上一步"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <span className="font-serif text-[#8B7355] tracking-widest text-sm">
          {currentIdx + 1} / {STEPS.length}
        </span>
        <button
          onClick={nextStep}
          disabled={!isStepValid()}
          className={`p-2 text-2xl transition-colors ${currentIdx === STEPS.length - 1 || !isStepValid() ? 'text-[#EAE7E1] cursor-default' : 'text-[#8B7355] hover:text-[#2C2825]'}`}
          aria-label="下一步"
        >
          <MaterialIcon name="arrow_forward" />
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
