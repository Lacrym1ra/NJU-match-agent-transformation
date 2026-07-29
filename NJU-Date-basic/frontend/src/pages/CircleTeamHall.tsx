import React, { useDeferredValue, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence,Variants } from 'framer-motion';
import { api } from '../api/client'; // 引入你的真实 API 客户端
import { getTeamUps, type TeamUpApplicationType, type TeamUpType } from '../api/teamups';
import { toast } from '../components/Toast'; // 引入你的真实 Toast 组件
import {
  TEAMUP_TYPE_FILTERS,
  getTeamupBadgeClass,
  getTeamupBadgeText,
  getTeamupTypeText,
  isJoinedTeamup,
} from '../modules/teamups/hall';

// 定义大厅列表所需的组队简略信息接口
interface TeamUpItem {
  id: string;
  title: string;
  descriptionPreview?: string;
  maxMembers: number;
  currentMemberCount: number;
  deadlineAt: string;
  endAt: string;
  teamupType: TeamUpType;
  joinMode: 'direct' | 'approval';
  joinable: boolean;
  waitlistable?: boolean;
  waitlistCount?: number;
  waitlistCapacity?: number;
  waitlistAvailable?: number;
  effectiveStatus: 'recruiting' | 'full' | 'expired' | 'ended' | 'cancelled';
  leader?: { userId: string; nickname: string | null; avatarUrl: string | null } | null;
  viewer?: {
    isTeamupMember: boolean;
    isLeader: boolean;
    pendingApplicationId: string | null;
    activeApplicationId?: string | null;
    applicationStatus?: 'pending' | 'approved' | 'rejected' | 'withdrawn' | null;
    applicationType?: TeamUpApplicationType | null;
    waitlistPosition?: number | null;
  };
}

// 定义圈子基础信息接口
interface CircleInfo {
  id: string;
  name: string;
}

const staggerContainer: Variants = { 
  hidden: { opacity: 0 }, 
  show: { opacity: 1, transition: { staggerChildren: 0.1 } } 
};

const itemAnim: Variants = { 
  hidden: { opacity: 0, y: 20 }, 
  show: { opacity: 1, y: 0, transition: { duration: 0.8, type: 'spring', damping: 20 } } 
};

// 组队大厅主组件
export default function CircleTeamHall() {
  const { id } = useParams<{ id: string }>(); // 老老实实用 id
  const navigate = useNavigate();

  const [circle, setCircle] = useState<CircleInfo | null>(null);
  const [teamups, setTeamups] = useState<TeamUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamupTypeFilter, setTeamupTypeFilter] = useState<'all' | TeamUpType>('all');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadCircle = async () => {
      try {
        const circleRes = await api.get<{ circle: CircleInfo }>(`/circles/${id}`);
        if (!cancelled) setCircle(circleRes.circle);
      } catch (err: any) {
        toast.error(err.message || '大厅卷宗加载失败');
      }
    };
    loadCircle();
    return () => { cancelled = true; };
  }, [id]);

  // 页面加载和筛选变化时拉取组队列表
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadTeamups = async () => {
      setLoading(true);
      try {
        const teamupsRes = await getTeamUps(id, {
          teamupType: teamupTypeFilter,
          keyword: deferredSearchQuery,
        });
        if (!cancelled) setTeamups(teamupsRes.teamups || []);
      } catch (err: any) {
        toast.error(err.message || '大厅卷宗加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTeamups();
    return () => { cancelled = true; };
  }, [id, deferredSearchQuery, teamupTypeFilter]);

  const joinedTeamups = teamups.filter(isJoinedTeamup);
  const unjoinedTeamups = teamups.filter((teamup) => !isJoinedTeamup(teamup));
  const hasActiveFilters = teamupTypeFilter !== 'all' || deferredSearchQuery.trim().length > 0;

  const renderTeamupCard = (teamup: TeamUpItem) => (
    <motion.div
      key={teamup.id}
      variants={itemAnim}
      onClick={() => navigate(`/circles/${id}/teamups/${teamup.id}`)}
      className={`group relative bg-white/60 backdrop-blur-sm p-6 rounded-2xl cursor-pointer hover:bg-white/90 transition-all duration-500 overflow-hidden shadow-[0_4px_30px_rgba(139,115,85,0.02)] hover:shadow-[0_8px_40px_rgba(139,115,85,0.06)] ${isJoinedTeamup(teamup) ? 'border border-[#420047]/15' : 'border border-transparent'}`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-[#8B7355]/5 to-transparent"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10 gap-3">
        <h3 className="font-serif text-xl text-[#2C2825] tracking-wide line-clamp-1 group-hover:text-[#420047] transition-colors">
          {teamup.title}
        </h3>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs font-serif border border-[#8B7355]/25 px-2 py-1 rounded-md text-[#8B7355] bg-white/70">
            {getTeamupTypeText(teamup)}
          </span>
          <span className={`text-xs font-serif border px-2 py-1 rounded-md ${getTeamupBadgeClass(teamup)}`}>
            {getTeamupBadgeText(teamup)}
          </span>
        </div>
      </div>
      
      <p className="text-[#8B7355]/80 text-sm leading-relaxed line-clamp-2 mb-6 font-sans">
        {teamup.descriptionPreview || '暂无详细邀约说明...'}
      </p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#EAE7E1]/50 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          {teamup.leader?.avatarUrl ? (
            <img src={teamup.leader.avatarUrl} className="w-6 h-6 rounded-full object-cover border border-[#EAE7E1] shrink-0" alt="avatar" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#8B7355]/10 text-[#8B7355] flex items-center justify-center text-xs font-serif shrink-0">
              {(teamup.leader?.nickname || '匿').charAt(0)}
            </div>
          )}
          <span className="text-xs text-[#8B7355] font-serif truncate">{teamup.leader?.nickname || '无名氏'} 发起</span>
        </div>
        
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-[#2C2825] font-serif text-sm">
            <span className="material-symbols-outlined text-[14px] text-[#8B7355]">group</span>
            <span>{teamup.currentMemberCount} <span className="text-[#8B7355]/50 mx-0.5">/</span> {teamup.maxMembers}</span>
          </div>
          {(teamup.waitlistable || teamup.waitlistCount || teamup.viewer?.applicationType === 'waitlist') && (
            <div className="flex items-center gap-1 text-[10px] font-serif text-[#8B7355]">
              <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
              <span>候补 {teamup.waitlistCount ?? 0}<span className="mx-0.5 text-[#8B7355]/45">/</span>{teamup.waitlistCapacity ?? 0}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderTeamupSection = (title: string, subtitle: string, items: TeamUpItem[]) => (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-[#2C2825] tracking-widest">{title}</h2>
          <p className="text-xs text-[#8B7355]/80 font-serif tracking-wide mt-1">{subtitle}</p>
        </div>
        <span className="text-xs text-[#8B7355] font-serif">{items.length} 则</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {items.map(renderTeamupCard)}
        </AnimatePresence>
      </div>
    </motion.section>
  );

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex flex-col md:py-20 px-4 md:px-8 relative selection:bg-[#420047] selection:text-[#FCFBF8]" style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.05) 48px)', backgroundSize: '100% 48px' }}>
      
      {/* 大厅页头 */}
      <header className="w-full max-w-4xl mx-auto flex flex-col mb-12 relative z-10 pt-10 md:pt-0">
        <button onClick={() => navigate(`/circles/${id}`)} className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors group mb-8 w-max">
          <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">west</span>
          <span className="font-serif tracking-widest text-sm">归返前庭</span>
        </button>
    
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#EAE7E1]/50">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#2C2825] tracking-widest mb-2 flex items-center gap-3">
              同游邀约
              <span className="text-xs tracking-widest px-3 py-1 rounded-full border border-[#8B7355]/30 text-[#8B7355] bg-[#8B7355]/5 opacity-80 mt-1">
                {circle?.name || '圈内'}专属
              </span>
            </h1>
            <p className="text-[#8B7355] font-serif text-sm tracking-wide mt-2 opacity-80">在诚朴之间，候一场风暖南大的相逢。</p>
          </div>
          
          <button onClick={() => navigate(`/circles/${id}/create-teamup`)} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#420047]/90 to-[#611066]/90 text-[#FCFBF8] text-sm shadow-[0_4px_14px_rgba(66,0,71,0.2)] hover:shadow-[0_6px_20px_rgba(66,0,71,0.3)] hover:-translate-y-0.5 transition-all duration-300 font-serif tracking-widest">
            <span className="material-symbols-outlined text-[18px]">edit_document</span>
            发起邀约
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-[#8B7355]/70">search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 w-full rounded-full border border-[#EAE7E1] bg-white/70 pl-11 pr-4 text-sm text-[#2C2825] outline-none transition-colors placeholder:text-[#8B7355]/50 focus:border-[#420047]/40"
              placeholder="按标题或详情关键词搜索"
            />
          </label>
          <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 md:pb-0">
            {TEAMUP_TYPE_FILTERS.map((filter) => {
              const active = teamupTypeFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setTeamupTypeFilter(filter.value)}
                  className={`h-10 shrink-0 rounded-full border px-4 text-xs font-serif tracking-widest transition-colors ${active ? 'border-[#420047]/30 bg-[#420047]/10 text-[#420047]' : 'border-[#EAE7E1] bg-white/60 text-[#8B7355] hover:border-[#8B7355]/40'}`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>
    
      {/* 列表主体区 */}
      <main className="w-full max-w-4xl mx-auto relative z-10 flex-1 flex flex-col mb-20">
        {loading ? (
          <div className="flex justify-center py-20 text-[#8B7355]">
            <span className="material-symbols-outlined animate-spin text-2xl">refresh</span>
          </div>
        ) : teamups.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#8B7355] font-serif text-center py-24 border border-dashed border-[#EAE7E1] rounded-2xl bg-white/30">
            {hasActiveFilters ? '没有找到符合条件的同游邀约。' : '此刻庭院深邃，尚无结伴之约。'}
          </motion.div>
        ) : (
          <div className="space-y-12">
            {joinedTeamups.length > 0 && renderTeamupSection('我的同游', '已加入或由我发起的邀约', joinedTeamups)}
            {unjoinedTeamups.length > 0 && renderTeamupSection('圈内邀约', '尚未加入的结伴邀请', unjoinedTeamups)}
          </div>
        )}
      </main>
    </div>
  );
}
