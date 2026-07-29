import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getCircles, Circle, joinCircle } from '../api/circles';
import { toast } from '../components/Toast';
import MaterialIcon from '../components/MaterialIcon';

export default function CircleList() {
  const navigate = useNavigate();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCircles()
      .then((res) => setCircles(res.circles))
      .catch((err) => setError(err.message || '获取圈子失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (e: React.MouseEvent, circleId: string) => {
    e.stopPropagation();
    try {
      await joinCircle(circleId);
      setCircles(prev =>
        prev.map(c => c.id === circleId ? { ...c, isJoined: true, memberCount: c.memberCount + 1 } : c)
      );
      toast.success('加入圈子成功');
      navigate(`/circles/${circleId}`);
    } catch (err: any) {
      toast.error(err.message || '加入失败');
    }
  };

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex flex-col md:py-20 px-4 md:px-8 relative selection:bg-[#420047] selection:text-[#FCFBF8]"
      style={{
        backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)',
        backgroundSize: '100% 48px',
      }}
    >
      <header className="w-full max-w-4xl mx-auto flex flex-col mb-12 relative z-10 pt-10 md:pt-0">
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors group mb-8 w-max"
        >
          <MaterialIcon name="west" className="text-[18px] group-hover:-translate-x-1 transition-transform" />
          <span className="font-serif tracking-widest text-sm">返回档案</span>
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <h1 className="font-serif text-4xl text-[#2C2825] tracking-widest">破冰频道</h1>
          <button
            onClick={() => navigate('/settings/card', { state: { backTo: '/circles' } })}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#EAE7E1] rounded-full shadow-sm text-[#8B7355] hover:border-[#8B7355]/40 hover:text-[#420047] transition-all font-serif group"
          >
            <MaterialIcon name="edit_document" className="text-[18px] group-hover:scale-110 transition-transform" />
            <span className="text-sm tracking-widest tracking-widest">编辑名片</span>
          </button>
        </div>

        <p className="text-[#8B7355] font-serif text-sm tracking-wide leading-relaxed max-w-lg">
          不同的圈子，不同维度的你。
          在这里，没有喧嚣的群聊，只有共同爱好的灵魂与公开的名片。
          发现适合你的圈子，结识新的朋友。
        </p>
      </header>

      <main className="w-full max-w-4xl mx-auto relative z-10">
        {loading ? (
          <div className="flex flex-col gap-4 text-[#8B7355] items-center justify-center py-20 font-serif">
            <MaterialIcon name="refresh" className="animate-spin text-2xl" />
            载入圈卷中...
          </div>
        ) : error ? (
          <div className="text-red-500 font-serif text-center py-10 bg-red-50/50 rounded-lg">{error}</div>
        ) : circles.length === 0 ? (
          <div className="text-[#8B7355] font-serif text-center py-20 border border-dashed border-[#EAE7E1] rounded-2xl">暂无更多破冰频道</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            <AnimatePresence>
              {circles.map(circle => (
                <motion.div
                  key={circle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  onClick={() => circle.isJoined ? navigate(`/circles/${circle.id}`) : null}
                  className={`flex flex-col p-6 rounded-2xl bg-white border ${circle.isJoined ? 'border-[#8B7355]/40 hover:border-[#420047]/60 cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.04)]' : 'border-[#EAE7E1] cursor-default shadow-sm'} transition-all group`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      {circle.image ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-[#EAE7E1]/50 flex items-center justify-center text-[#420047] bg-[#420047]/5">
                          <MaterialIcon name={circle.image} className="!text-3xl" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#8B7355]/10 to-[#8B7355]/5 text-[#8B7355] shrink-0 border border-[#EAE7E1] flex items-center justify-center text-3xl">
                          {circle.name?.charAt(0) || '圈'}
                        </div>
                      )}
                      <div>
                        <h2 className={`font-serif text-2xl tracking-widest ${circle.isJoined ? 'text-[#2C2825] group-hover:text-[#420047]' : 'text-[#8B7355]'} transition-colors`}>
                          {circle.name}
                        </h2>
                        <div className="text-xs text-[#8B7355]/60 mt-1 font-serif flex items-center gap-1">
                          <MaterialIcon name="group" className="text-[14px]" />
                          {circle.memberCount} 人已驻留
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-[#8B7355] leading-relaxed line-clamp-2 min-h-[40px] flex-1">
                    {circle.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-[#EAE7E1]/60 pt-4">
                    <span className="text-xs font-serif text-[#8B7355]/40 italic">
                      {circle.isJoined ? '已解锁圈子名帖' : '名帖被封印'}
                    </span>
                    {circle.isJoined ? (
                      <button className="text-sm font-serif tracking-widest text-[#420047] flex items-center gap-1 group-hover:gap-2 transition-all">
                        踏入大厅 <MaterialIcon name="arrow_forward" className="text-[16px]" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleJoin(e, circle.id)}
                        className="px-6 py-2 rounded-full border border-[#8B7355]/30 text-sm font-serif tracking-widest text-[#2C2825] hover:bg-[#8B7355]/10 transition-colors"
                      >
                        加入并解印
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
