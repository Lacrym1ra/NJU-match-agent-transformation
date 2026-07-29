import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createTeamUp, type TeamUpType } from '../api/teamups';
import { toast } from '../components/Toast';
import TeamupContactsEditor from '../components/TeamupContactsEditor';
import {
  buildTeamupContacts,
  createEmptyTeamupContactDraft,
  hasIncompleteTeamupContactDraft,
} from '../modules/teamups/contact';

const SHOW_PUBLIC_SYNC_OPTION: boolean = false;

export default function CreateTeamUp() {
  const { id } = useParams<{ id: string }>(); // 老老实实用 id
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxMembers: 4,
    joinMode: 'direct' as 'direct' | 'approval',
    deadlineAt: '',
    endAt: '',
    teamupType: '' as '' | TeamUpType,
    isPublic: false,
  });
  const [contactDrafts, setContactDrafts] = useState(() => [createEmptyTeamupContactDraft()]);

  const handleSubmit = async () => {
    if (!id || id === 'undefined') {
    return toast.error('系统异常：未获取到当前圈子身份标识');
    }
    // 1. 必填项校验
    if (!formData.title || !formData.description || !formData.deadlineAt || !formData.endAt || !formData.teamupType) {
      return toast.error('请将邀约卷宗填写完整');
    }
    if (hasIncompleteTeamupContactDraft(contactDrafts)) {
      return toast.error('请补全已添加的联系方式，或删除空白项');
    }
    const contacts = buildTeamupContacts(contactDrafts);
    if (contacts.length === 0) {
      return toast.error('请至少填写一种联络方式');
    }
    
    // 2. 严格的时间逻辑校验
    const now = new Date().getTime();
    const deadlineTime = new Date(formData.deadlineAt).getTime();
    const endTime = new Date(formData.endAt).getTime();
    
    if (deadlineTime <= now) {
      return toast.error('荒唐！招募截止时辰必须晚于当下。');
    }
    if (endTime <= deadlineTime) {
      return toast.error('荒唐！活动终了时辰怎能早于或等于招募截止？');
    }
    
    setLoading(true);
    try {
      await createTeamUp(id!, {
        title: formData.title,
        description: formData.description,
        maxMembers: Number(formData.maxMembers),
        deadlineAt: new Date(formData.deadlineAt).toISOString(),
        endAt: new Date(formData.endAt).toISOString(),
        teamupType: formData.teamupType,
        joinMode: formData.joinMode,
        isPublic: false,
        contacts,
      });
      toast.success('邀约已发布，静候同好');
      // 发布成功后，跳回大厅
      navigate(`/circles/${id}/teamups`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex flex-col py-8 md:py-16 px-4 selection:bg-[#420047] selection:text-[#FCFBF8]" style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.05) 48px)', backgroundSize: '100% 48px' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto relative z-10">
        
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors mb-8">
          <span className="material-symbols-outlined text-[18px]">west</span>
          <span className="font-serif tracking-widest text-sm">暂缓草拟</span>
        </button>
    
        <h1 className="font-serif text-3xl text-[#2C2825] tracking-widest mb-8 border-b border-[#EAE7E1] pb-6">撰写同游邀约</h1>
    
        <div className="space-y-6 bg-white/50 backdrop-blur-sm p-8 rounded-2xl border border-[#EAE7E1] shadow-[0_4px_20px_rgba(139,115,85,0.02)]">
          <div>
            <label className="block font-serif text-[#8B7355] mb-2">雅集名目 (标题)</label>
            <input type="text" maxLength={30} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 transition-colors" placeholder="例如：周末玄武湖寻秋摄影" />
          </div>
    
          <div>
            <label className="block font-serif text-[#8B7355] mb-2">详情细则 (正文)</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 h-32 resize-none leading-relaxed" placeholder="详细说明你们的行程、费用、要求等，也可以写上关键词，方便同好搜索到这则邀约..." />
          </div>
    
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block font-serif text-[#8B7355] mb-2">同游规模 (最多人数)</label>
              <input type="number" min={2} max={20} value={formData.maxMembers} onChange={e => setFormData({ ...formData, maxMembers: Number(e.target.value) })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50" />
            </div>
            <div>
              <label className="block font-serif text-[#8B7355] mb-2">准入规则</label>
              <select value={formData.joinMode} onChange={e => setFormData({ ...formData, joinMode: e.target.value as any })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-serif">
                <option value="direct">推门即入 (免审)</option>
                <option value="approval">需递拜帖 (审核)</option>
              </select>
            </div>
            <div>
              <label className="block font-serif text-[#8B7355] mb-2">组队类型</label>
              <select value={formData.teamupType} onChange={e => setFormData({ ...formData, teamupType: e.target.value as '' | TeamUpType })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none focus:border-[#420047]/50 font-serif">
                <option value="">请选择组队类型</option>
                <option value="short_term">临期组队</option>
                <option value="long_term">长期组队</option>
              </select>
            </div>
          </div>
    
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block font-serif text-[#8B7355] mb-2">招募截止时辰</label>
              <input lang="zh-CN" type="datetime-local" value={formData.deadlineAt} onChange={e => setFormData({ ...formData, deadlineAt: e.target.value })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none" />
            </div>
            <div>
              <label className="block font-serif text-[#8B7355] mb-2">活动终了时辰</label>
              <input lang="zh-CN" type="datetime-local" value={formData.endAt} onChange={e => setFormData({ ...formData, endAt: e.target.value })} className="w-full bg-white border border-[#EAE7E1] rounded-lg px-4 py-3 outline-none" />
            </div>
          </div>
    
          <div className="pt-4 border-t border-[#EAE7E1]">
            <TeamupContactsEditor
              drafts={contactDrafts}
              onChange={setContactDrafts}
              circleId={id || ''}
              label="您的联络方式 (截至前对非成员保密)"
            />
          </div>

          {SHOW_PUBLIC_SYNC_OPTION && (
            <div className="pt-4 border-t border-[#EAE7E1] flex items-center gap-3">
              <input
                type="checkbox"
                id="isPublic"
                checked={formData.isPublic}
                onChange={e => setFormData({...formData, isPublic: e.target.checked})}
                className="w-4 h-4 accent-[#420047]"
              />
              <label htmlFor="isPublic" className="text-[#8B7355] font-serif text-sm cursor-pointer">
                公开此书 (允许同步至公共论坛以招募更多同好)
              </label>
            </div>
          )}
          <div className="pt-6">
            <button onClick={handleSubmit} disabled={loading} className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#420047] to-[#611066] text-[#FCFBF8] font-serif tracking-widest shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50">
              {loading ? '用印中...' : '盖印发布'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
