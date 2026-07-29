import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MaterialIcon from '../components/MaterialIcon';
import { useAuth } from '../context/AuthContext';
import {
  updateProfile,
  updateStatus,
  deleteAccount,
  getMessagePrivacySetting,
  updateMessagePrivacySetting,
  type DirectMessagePrivacySetting,
  type ProfileUpdatePayload,
} from '../api/user';
import { ApiError } from '../api/client';
import SettingPrivacyTab from './SettingPrivacyTab';

const DEPARTMENTS = [
  '文学院', '历史学院', '哲学学院', '新闻传播学院', '法学院', '商学院',
  '外国语学院', '政府管理学院', '国际关系学院', '信息管理学院', '社会学院',
  '数学学院', '物理学院', '天文与空间科学学院', '化学学院', '化工学院',
  '计算机学院', '软件学院', '人工智能学院', '电子科学与工程学院',
  '现代工程与应用科学学院', '环境学院', '地球科学与工程学院',
  '地理与海洋科学学院', '大气科学学院', '南赫学院', '生命科学学院',
  '医学院', '工程管理学院', '匡亚明学院', '海外教育学院', '教育研究院・陶行知教师教育学院',
  '建筑与城市规划学院', '马克思主义学院', '艺术学院',
  '智能科学与技术学院', '智能软件与工程学院', '集成电路学院',
  '数字经济与管理学院', '能源与资源学院', '国家卓越工程师学院',
  '机器人与自动化学院', '未来技术学院', '前沿科学学院',
  '先进制造学院', '生物医学工程学院', '其他',
];

const GRADE_OPTIONS = ['大一', '大二', '大三', '大四', '大五', '研一', '研二', '研三', '博一', '博二', '博三及以上', '博士后'];

const GENDER_OPTIONS = [
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' },
];

const GENDER_PREF_OPTIONS = [
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' },
  { value: 'any', label: '不限' },
];

const INTENTION_OPTIONS = [
  { value: 'friend', label: '朋友' },
  { value: 'partner', label: '伴侣' },
];

const CAMPUS_OPTIONS = [
  { value: 'gulou', label: '鼓楼' },
  { value: 'xianlin', label: '仙林' },
  { value: 'suzhou', label: '苏州' },
  { value: 'pukou', label: '浦口' },
];

const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP', 'UNKNOWN',
];

const CONTACT_PLATFORM_OPTIONS = [
  { value: 'wechat', label: '微信' },
  { value: 'qq', label: 'QQ' },
  { value: 'xiaohongshu', label: '小红书' },
];

const DIRECT_MESSAGE_PRIVACY_OPTIONS: Array<{
  value: DirectMessagePrivacySetting;
  label: string;
  description: string;
}> = [
  { value: 'all', label: '所有人', description: '任何用户都可以先向你发起私信。' },
  { value: 'following', label: '我关注的人', description: '只有你已经关注的人，才能先给你发私信。' },
  { value: 'mutual', label: '互相关注的人', description: '只有双方互相关注后，才可以先发私信。' },
  { value: 'none', label: '所有人都不可以', description: '关闭陌生私信入口，任何人都不能先向你发私信。' },
];

type SettingsTab = 'profile' | 'friends' | 'privacy';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string; icon: string }> = [
  { value: 'profile', label: '档案', icon: 'badge' },
  { value: 'friends', label: '好友申请', icon: 'person_add' },
  { value: 'privacy', label: '隐私申请', icon: 'shield_lock' },
];

function normalizeSettingsTab(value: string | null): SettingsTab {
  return value === 'friends' || value === 'privacy' ? value : 'profile';
}

// 辅助组件：行内文字输入框
const InlineInput = ({ value, onChange, placeholder, width = 'w-[120px]' }: any) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`mx-3 border-b border-[#8B7355]/40 bg-transparent px-2 py-0 text-center text-[#420047] transition-colors placeholder-[#8B7355]/30 focus:border-[#420047] focus:outline-none ${width}`}
  />
);

const InlineSelect = ({ value, onChange, options, width = 'w-auto min-w-[140px]' }: any) => (
  <div className={`relative mx-2 inline-flex items-center border-b border-[#8B7355]/40 transition-colors hover:border-[#420047] ${width}`}>
    <select
      value={value}
      onChange={onChange}
      aria-label="选项"
      className="relative z-10 w-full cursor-pointer appearance-none bg-transparent py-0 pl-2 pr-6 text-center text-[#420047] focus:outline-none"
    >
      {options.map((opt: any) => (
        <option key={opt.value ?? opt} value={opt.value ?? opt}>
          {opt.label ?? opt}
        </option>
      ))}
    </select>
    <MaterialIcon name="expand_more" className="pointer-events-none absolute right-1 z-0 text-[14px] text-[#8B7355]" />
  </div>
);

function getIsMatchingLocked(): boolean {
  const now = new Date();
  const bj = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
  const day = bj.getDay();
  const hour = bj.getHours();
  return day === 3 && hour >= 18 && hour < 20;
}

const Settings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSettingsTab = normalizeSettingsTab(searchParams.get('tab'));
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/dashboard';
  const { user, refreshUser, logout } = useAuth();

  const [formData, setFormData] = useState({
    nickname: '',
    gender: '',
    genderPreference: '',
    intention: '',
    department: '',
    grade: '',
    campus: '',
    mbti: '',
    bio: '',
    contactPlatform: 'wechat',
    contactId: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [messagePrivacy, setMessagePrivacy] = useState<DirectMessagePrivacySetting>('all');
  const [savingMessagePrivacy, setSavingMessagePrivacy] = useState(false);

  useEffect(() => {
    if (!user) return;

    setFormData({
      nickname: user.nickname || '',
      gender: user.gender || '',
      genderPreference: user.genderPreference || '',
      intention: user.intention || '',
      department: user.department || '',
      grade: user.grade || '',
      campus: user.campus || '',
      mbti: user.mbti || '',
      bio: user.bio || '',
      contactPlatform: user.contactPlatform || 'wechat',
      contactId: user.contactId || '',
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await getMessagePrivacySetting();
        if (!cancelled) {
          setMessagePrivacy(res.allowDirectMessagesFrom);
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCloseSettings = () => {
    navigate(backTo, { replace: true });
  };

  const handleTabChange = (tab: SettingsTab) => {
    setSaveMsg('');
    setSaveError('');
    setToggleError('');
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveMsg('');
    setSaveError('');
  };

  const handleSave = async () => {
    if (!formData.nickname.trim()) {
      setSaveError('请填写昵称');
      return;
    }
    if (formData.nickname.length > 20) {
      setSaveError('昵称最多可填 20 个字符');
      return;
    }
    if (/[<>]/.test(formData.nickname)) {
      setSaveError('昵称不能包含 < 或 > 符号');
      return;
    }
    if (!formData.gender) {
      setSaveError('请选择性别');
      return;
    }
    if (!formData.intention) {
      setSaveError('请选择交友目标');
      return;
    }
    if (!formData.genderPreference) {
      setSaveError('请选择期望对象');
      return;
    }
    if (!formData.department) {
      setSaveError('请选择院系');
      return;
    }
    if (!formData.grade) {
      setSaveError('请选择年级');
      return;
    }
    if (!formData.campus) {
      setSaveError('请选择校区');
      return;
    }
    if (formData.contactId && formData.contactId.length > 50) {
      setSaveError('联系方式最多可填 50 个字符');
      return;
    }
    if (formData.contactId && /[<>]/.test(formData.contactId)) {
      setSaveError('联系方式不能包含 < 或 > 符号');
      return;
    }
    if (formData.bio && formData.bio.length > 200) {
      setSaveError('个人简介最多可填 200 个字符');
      return;
    }
    if (formData.bio && /[<>]/.test(formData.bio)) {
      setSaveError('个人简介不能包含 < 或 > 符号');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      const payload: ProfileUpdatePayload = {
        nickname: formData.nickname,
        gender: formData.gender as ProfileUpdatePayload['gender'],
        genderPref: formData.genderPreference as ProfileUpdatePayload['genderPref'],
        intention: formData.intention as ProfileUpdatePayload['intention'],
        department: formData.department,
        grade: formData.grade,
        campus: formData.campus as ProfileUpdatePayload['campus'],
        mbti: formData.mbti || undefined,
        bio: formData.bio || undefined,
        contactPlatform: formData.contactPlatform || undefined,
        contactId: formData.contactId || undefined,
      };

      await updateProfile(payload);
      await refreshUser();
      setSaveMsg('档案已保存');

      if (user && !user.surveyComplete) {
        setTimeout(() => navigate('/survey', { replace: true }), 800);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message || '保存失败');
      } else {
        setSaveError('网络异常，请稍后重试');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleParticipation = async () => {
    if (!user) return;

    if (!user.isParticipating && (user.creditScore ?? 100) <= 90) {
      setToggleError('当前信用分未达标，暂不可恢复匹配');
      return;
    }
    if (getIsMatchingLocked()) {
      setToggleError('匹配计算中，当前时段暂时无法修改');
      return;
    }

    setToggleError('');
    try {
      await updateStatus(!user.isParticipating);
      await refreshUser();
    } catch (err: any) {
      setToggleError(err.message || '操作失败，请稍后重试');
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteAccount();
      localStorage.removeItem('survey_draft');
      logout();
      navigate('/login', { replace: true });
    } catch {
      setSaveError('注销失败，请稍后重试');
      setIsDeleting(false);
    }
  };

  const handleMessagePrivacyChange = async (value: DirectMessagePrivacySetting) => {
    const previousValue = messagePrivacy;
    setSaveError('');
    setSaveMsg('');
    setMessagePrivacy(value);
    setSavingMessagePrivacy(true);
    try {
      await updateMessagePrivacySetting(value);
      setSaveMsg('私信与防打扰设置已实时生效');
    } catch (err) {
      setMessagePrivacy(previousValue);
      setSaveError(err instanceof ApiError ? err.message : '私信设置保存失败');
    } finally {
      setSavingMessagePrivacy(false);
    }
  };

  const avatarLetter = formData.nickname?.[0] || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-[#FCFBF8] font-sans text-[#2C2825] selection:bg-[#420047] selection:text-[#FCFBF8]">
      <div className="fixed left-0 top-0 bottom-0 z-50 hidden w-[60px] flex-col items-center justify-evenly border-r border-[#EAE7E1] bg-[#F3F1ED] py-10 shadow-[inset_-6px_0_15px_rgba(0,0,0,0.03)] md:flex">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="relative h-3.5 w-3.5 rounded-full bg-[#EAE7E1] shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.15)]">
            <div className="absolute inset-0 rounded-full bg-[#2C2825]/5" />
          </div>
        ))}
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-[50%] bg-[#8B7355]/20" />
      </div>

      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-screen flex-1 flex-col items-center px-5 pt-10 pb-40 md:ml-[60px] md:px-8 md:py-20"
        style={{
          backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)',
          backgroundSize: '100% 48px',
        }}
      >
        <header className="relative z-10 mb-12 flex w-full max-w-3xl items-center justify-between md:mb-24">
          <button
            type="button"
            onClick={handleCloseSettings}
            className="group flex items-center gap-2 text-[#8B7355] transition-colors hover:text-[#2C2825]"
          >
            <MaterialIcon name="west" className="text-[18px] transition-transform group-hover:-translate-x-1" />
            <span className="font-serif text-sm tracking-widest">关闭设置页</span>
          </button>
          <div className="font-serif text-lg tracking-widest text-[#2C2825] opacity-50">档案</div>
        </header>

        <div className="w-full max-w-3xl relative z-10 mb-10">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#EAE7E1] bg-[#FCFBF8]/90 p-1 shadow-sm">
            {SETTINGS_TABS.map((tab) => {
              const active = activeSettingsTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleTabChange(tab.value)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-serif tracking-widest transition-colors ${
                    active
                      ? 'bg-[#420047] text-[#FCFBF8] shadow-sm'
                      : 'text-[#8B7355] hover:bg-[#F3F1ED] hover:text-[#2C2825]'
                  }`}
                >
                  <MaterialIcon name={tab.icon} className="text-[16px]" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 证件印戳 */}
        <div className="absolute top-16 right-6 md:top-20 md:right-24 flex flex-col items-end opacity-60 md:opacity-80 rotate-2 pointer-events-none z-0">
          <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 border-[2px] md:border-[3px] border-[#8B7355]/40 rounded-full flex items-center justify-center text-3xl md:text-4xl mb-2 md:mb-3 font-serif bg-[#FCFBF8]">
            {avatarLetter}
          </div>
          <div className="font-serif text-[8px] md:text-[10px] tracking-widest text-[#8B7355]">邮箱: {user?.email}</div>
        </div>

        {activeSettingsTab === 'profile' ? (
          <div className="w-full max-w-3xl flex flex-col gap-16 md:gap-20 relative z-10 pl-0 md:pl-10 md:border-l border-[#8B7355]/10">
          {/* Section 1: 个人底档 */}
          <section className="flex flex-col gap-8">
            <div className="mb-4 flex items-center gap-4">
              <MaterialIcon name="fingerprint" className="text-[24px] font-light text-[#8B7355]/60" />
              <h2 className="font-serif text-2xl tracking-wide text-[#2C2825]">基础档案</h2>
            </div>

            <div className="w-full whitespace-pre-wrap text-justify font-serif text-xl leading-[48px] tracking-wide text-[#2C2825]/90 md:w-5/6">
              在这本册子里，我的昵称是
              <InlineInput
                value={formData.nickname}
                onChange={(e: any) => handleInputChange('nickname', e.target.value)}
                placeholder="你的名字"
                width="w-[200px]"
              />
              。{'\n'}
              我是
              <InlineSelect
                value={formData.gender}
                onChange={(e: any) => handleInputChange('gender', e.target.value)}
                options={[{ value: '', label: '请选择' }, ...GENDER_OPTIONS]}
                width="w-[90px]"
              />
              ，来这里想寻找
              <InlineSelect
                value={formData.intention}
                onChange={(e: any) => handleInputChange('intention', e.target.value)}
                options={[{ value: '', label: '请选择' }, ...INTENTION_OPTIONS]}
                width="w-[90px]"
              />
              ，希望遇见
              <InlineSelect
                value={formData.genderPreference}
                onChange={(e: any) => handleInputChange('genderPreference', e.target.value)}
                options={[{ value: '', label: '请选择' }, ...GENDER_PREF_OPTIONS]}
                width="w-[90px]"
              />
              。{'\n'}
              我目前就读于
              <InlineSelect
                value={formData.department}
                onChange={(e: any) => handleInputChange('department', e.target.value)}
                options={[{ value: '', label: '请选择院系' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
                width="w-[240px]"
              />
              ，年级是
              <InlineSelect
                value={formData.grade}
                onChange={(e: any) => handleInputChange('grade', e.target.value)}
                options={[{ value: '', label: '请选择' }, ...GRADE_OPTIONS.map((g) => ({ value: g, label: g }))]}
                width="w-[120px]"
              />
              ，校区在
              <InlineSelect
                value={formData.campus}
                onChange={(e: any) => handleInputChange('campus', e.target.value)}
                options={[{ value: '', label: '请选择' }, ...CAMPUS_OPTIONS]}
                width="w-[90px]"
              />
              ，MBTI 是
              <InlineSelect
                value={formData.mbti}
                onChange={(e: any) => handleInputChange('mbti', e.target.value)}
                options={[{ value: '', label: '请选择' }, ...MBTI_OPTIONS.map((m) => ({ value: m, label: m }))]}
                width="w-[110px]"
              />
              。
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <label className="ml-1 text-xs font-medium uppercase tracking-[0.1em] text-[#8B7355]">自我介绍（可选，最多 200 字）</label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                maxLength={200}
                placeholder="用几句话介绍一下你自己。"
                rows={3}
                className="w-full resize-none rounded-xl bg-[#F3F1ED] px-5 py-4 font-serif text-base leading-relaxed text-[#2C2825] outline-none transition-colors placeholder:text-[#B5AFA6] focus:bg-[#EAE7E1]"
              />
              <div className="text-right text-xs text-[#8B7355]/50">{formData.bio.length}/200</div>
            </div>
          </section>

          <section className="flex flex-col gap-8">
            <div className="mb-2 flex items-center gap-4">
              <MaterialIcon name="mark_email_read" className="text-[24px] font-light text-[#8B7355]/60" />
              <h2 className="font-serif text-2xl tracking-wide text-[#2C2825]">联系方式</h2>
            </div>

            <div className="border border-transparent bg-transparent p-0 md:p-4">
              <div className="font-serif text-lg leading-[48px] text-[#2C2825]/90">
                如果双方都愿意见面，我的
                <InlineSelect
                  value={formData.contactPlatform}
                  onChange={(e: any) => handleInputChange('contactPlatform', e.target.value)}
                  options={CONTACT_PLATFORM_OPTIONS}
                  width="w-[90px]"
                />
                账号是
                <InlineInput
                  value={formData.contactId}
                  onChange={(e: any) => handleInputChange('contactId', e.target.value)}
                  placeholder="账号"
                  width="w-[200px]"
                />
                。这项信息仅在双方确认后对彼此可见。
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-8">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <MaterialIcon name="shield" className="text-[24px] font-light text-[#8B7355]/60" />
                <h2 className="font-serif text-2xl tracking-wide text-[#2C2825]">私信与防打扰</h2>
              </div>
              <div className="text-xs tracking-[0.18em] text-[#8B7355]/70">
                {savingMessagePrivacy ? '保存中...' : '实时生效'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {DIRECT_MESSAGE_PRIVACY_OPTIONS.map((option) => {
                const active = messagePrivacy === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void handleMessagePrivacyChange(option.value)}
                    disabled={savingMessagePrivacy && !active}
                    className={`rounded-2xl border px-5 py-5 text-left transition-all duration-300 disabled:opacity-60 ${
                      active
                        ? 'border-[#420047] bg-[#420047] text-[#FCFBF8] shadow-[0_10px_30px_rgba(66,0,71,0.16)]'
                        : 'border-[#EAE7E1] bg-[#FCFBF8] text-[#2C2825] hover:border-[#8B7355]/40 hover:bg-white'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-serif text-lg">{option.label}</span>
                      <MaterialIcon
                        name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                        className={`text-[18px] ${active ? 'text-[#FCFBF8]' : 'text-[#8B7355]/60'}`}
                      />
                    </div>
                    <p className={`text-sm leading-relaxed ${active ? 'text-[#FCFBF8]/80' : 'text-[#8B7355]'}`}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-dashed border-[#EAE7E1] bg-white/60 px-5 py-4 text-sm leading-relaxed text-[#8B7355]">
              非互相关注状态下，系统仍会限制对方在你回复前最多连续发送 3 条私信。
            </div>
          </section>

          <section className="flex flex-col gap-8">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <MaterialIcon name="badge" className="text-[24px] font-light text-[#8B7355]/60" />
                <h2 className="font-serif text-2xl tracking-wide text-[#2C2825]">名片与社交</h2>
              </div>
            </div>

            <div
              className="group flex cursor-pointer items-center justify-between border border-[#EAE7E1] bg-[#FCFBF8] p-6 transition-colors hover:border-[#8B7355]/40"
              onClick={() => navigate('/settings/card', { state: { backTo: '/settings' } })}
            >
              <div className="flex flex-col gap-2">
                <div className="font-serif text-lg text-[#2C2825] transition-colors group-hover:text-[#8B7355]">编辑公开名片</div>
                <div className="w-4/5 text-xs leading-relaxed text-[#8B7355]/70">
                  定制你在社区中向他人展示的名片信息，包括兴趣、偏好和公开展示内容。
                </div>
              </div>
              <MaterialIcon name="arrow_forward_ios" className="text-[#8B7355]/50 transition-colors group-hover:translate-x-1 group-hover:text-[#8B7355]" />
            </div>
          </section>

          <section className="mt-12 flex flex-col gap-6 border-t border-dashed border-[#8B7355]/20 pt-16">
            <div className="mb-4 flex flex-col gap-2">
              <h2 className="font-serif text-xl tracking-wide text-[#2C2825]">账号管理</h2>
              <p className="mt-1 font-serif text-xs italic tracking-widest text-[#8B7355]">缘起缘灭，都有定数。</p>
            </div>

            <div className="flex flex-col gap-6 sm:flex-row">
              <button
                type="button"
                onClick={handleToggleParticipation}
                disabled={getIsMatchingLocked() || (!user?.isParticipating && (user?.creditScore ?? 100) <= 90)}
                className="group relative flex-1 overflow-hidden border border-[#EAE7E1] bg-[#FCFBF8] p-6 text-left transition-all duration-300 hover:border-[#8B7355]/40 hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[#EAE7E1] disabled:hover:shadow-none disabled:active:scale-100"
              >
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-[#8B7355]/10 transition-colors group-hover:bg-[#8B7355]/30" />
                <div className="mb-2 font-serif text-lg text-[#2C2825] transition-colors group-hover:text-[#8B7355]">
                  {user?.isParticipating ? '暂停长期匹配' : '恢复匹配'}
                </div>
                <div className="text-xs leading-relaxed text-[#8B7355]/70">
                  {user?.isParticipating
                    ? '你将暂时不再参与新的匹配，直到你手动重新开启。'
                    : '重新开启匹配，让新的缘分继续流动。'}
                </div>
                {getIsMatchingLocked() && (
                  <p className="mt-3 text-xs text-red-500/80">匹配计算中，当前时段暂时无法修改。</p>
                )}
                {!user?.isParticipating && (user?.creditScore ?? 100) <= 90 && (
                  <p className="mt-3 text-xs text-red-500/80">当前信用分未达标，暂不可恢复匹配。</p>
                )}
                {toggleError && (
                  <p className="mt-3 text-xs text-red-600/80">{toggleError}</p>
                )}
              </button>

              <div className="relative flex-1">
                <AnimatePresence mode="wait">
                  {!isDeleteConfirming ? (
                    <motion.button
                      key="delete-btn"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      type="button"
                      onClick={() => setIsDeleteConfirming(true)}
                      className="group relative flex h-full w-full flex-col overflow-hidden border border-red-900/10 bg-[#FCFBF8] p-6 text-left transition-all duration-300 hover:border-red-900/40 hover:bg-red-900/[0.02] hover:shadow-sm active:scale-[0.98]"
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-1 bg-red-900/10 transition-colors group-hover:bg-red-900/40" />
                      <div className="mb-2 font-serif text-lg font-medium text-red-800 transition-colors group-hover:text-red-900">注销账号</div>
                      <div className="text-xs leading-relaxed text-red-800/60 group-hover:text-red-900/80">
                        删除后将无法恢复，系统会匿名化保留必要的历史记录。
                      </div>
                    </motion.button>
                  ) : (
                    <motion.div
                      key="delete-confirm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative flex h-full flex-col justify-between border border-red-900/20 bg-red-50 p-6 text-left"
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-1 bg-red-800" />
                      <div>
                        <div className="mb-2 flex items-center justify-between font-serif text-lg font-medium text-red-900">
                          <span>确认要离开吗？</span>
                          <button
                            type="button"
                            onClick={() => setIsDeleteConfirming(false)}
                            className="text-xs text-red-900/50 hover:text-red-900"
                          >
                            先等等
                          </button>
                        </div>
                        <div className="mb-4 text-xs leading-relaxed text-red-800/70">
                          注销后无法恢复。如需彻底清除更多数据，请联系项目管理员。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="mt-2 self-start bg-red-900 px-6 py-2 text-xs tracking-widest text-white transition-all hover:bg-red-950 hover:shadow-md disabled:opacity-50"
                      >
                        {isDeleting ? '处理中...' : '确认注销'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>
          ) : (
            <div className="w-full max-w-3xl relative z-10 pl-0 md:pl-10 md:border-l border-[#8B7355]/10">
              <SettingPrivacyTab />
            </div>
          )}
      </motion.div>

      {/* 保存按钮 & 状态提示 */}
      {activeSettingsTab === 'profile' && (
      <div className="fixed bottom-6 right-4 md:bottom-8 md:right-8 flex flex-col items-end gap-3 z-50">
        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 shadow-sm"
          >
            {saveError}
          </motion.div>
        )}
        {saveMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 border border-[#EAE7E1] bg-[#FCFBF8] px-4 py-2 text-xs tracking-widest text-[#8B7355] shadow-sm"
          >
            <MaterialIcon name="cloud_done" className="text-[14px] text-[#420047]" />
            {saveMsg}
          </motion.div>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleCloseSettings}
            className="flex items-center gap-2 rounded-[3rem] border border-[#EAE7E1] bg-[#FCFBF8] px-6 py-3 text-sm font-medium tracking-widest text-[#8B7355] shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-0.5 hover:text-[#2C2825] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          >
            <MaterialIcon name="west" className="text-sm" />
            关闭设置
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-[3rem] bg-gradient-to-br from-[#611066] to-[#420047] px-8 py-3 text-sm font-medium tracking-widest text-[#FCFBF8] shadow-[0_8px_24px_rgba(66,0,71,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(66,0,71,0.3)] disabled:opacity-70"
          >
            {isSaving ? (
              <MaterialIcon name="refresh" className="animate-spin text-sm" />
            ) : (
              <MaterialIcon name="save" className="text-sm" />
            )}
            {isSaving ? '保存中...' : '保存档案'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default Settings;
