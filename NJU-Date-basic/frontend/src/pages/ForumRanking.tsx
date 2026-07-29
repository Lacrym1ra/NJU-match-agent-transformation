import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { getHotRanking } from '../api/forum';
import type { HotRankingItem } from '../api/forum';
import { toast } from '../components/Toast';
import MaterialIcon from '../components/MaterialIcon';

const TYPE_LABELS: Record<string, string> = {
  general: '交流',
  squad: '组队',
  help: '互助',
  trade: '二手',
  activity: '活动',
};

const TYPE_COLORS: Record<string, string> = {
  general: 'bg-[#EAE7E1] text-[#5E5855]',
  squad: 'bg-[#420047]/10 text-[#420047]',
  help: 'bg-blue-50 text-blue-700',
  trade: 'bg-amber-50 text-amber-700',
  activity: 'bg-green-50 text-green-700',
};

const RANK_MEDALS: Record<number, string> = {
  1: 'bg-amber-100 text-amber-600',
  2: 'bg-slate-100 text-slate-500',
  3: 'bg-orange-50 text-orange-400',
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function ForumRanking() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HotRankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getHotRanking({ limit: 20 })
      .then((res) => setItems(res))
      .catch(() => toast.error('加载热榜失败'))
      .finally(() => setLoading(false));
  }, []);

  const handlePostClick = (postId: string) => {
    navigate(`/forum/${postId}`, { state: { from: 'ranking' } });
  };

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825] font-sans selection:bg-[#420047] selection:text-white px-4 md:px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-[#8B7355] hover:text-[#2C2825] transition-colors mb-8"
        >
          <span className="text-lg leading-none">←</span>
          <span>返回论坛</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-serif text-[#2C2825] tracking-wide">
            热榜
          </h1>
          <p className="text-sm text-[#8B7355] mt-2">风起云涌，最为人传颂的篇章</p>
          <div className="w-16 h-[1px] bg-[#420047]/30 mt-3" />
        </motion.div>

        {loading ? (
          <div className="text-center text-[#8B7355] mt-20 animate-pulse font-serif">
            卷轴正在展开...
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-[#8B7355] font-serif text-lg">暂无热帖</p>
            <p className="text-[#8B7355]/60 text-sm mt-2">还没有足够的数据</p>
          </motion.div>
        ) : (
          <motion.div
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.05 } },
            }}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {items.map((item, i) => {
              const rank = i + 1;
              const medal = rank <= 3 ? RANK_MEDALS[rank] : null;
              return (
                <motion.div
                  key={item.postId}
                  variants={itemVariants}
                  onClick={() => handlePostClick(item.postId)}
                  className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgb(66,0,71,0.06)] transition-all duration-300 cursor-pointer"
                >
                  <div className="flex items-stretch gap-3">
                    {/* Rank medal */}
                    <div
                      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-serif text-lg font-bold self-center ${
                        medal ?? 'bg-[#EAE7E1] text-[#8B7355]'
                      }`}
                    >
                      {rank}
                    </div>

                    {/* Main content — takes remaining space */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                      {/* Row 1: type badge + anonymous + title */}
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_COLORS[item.type] || TYPE_COLORS.general}`}>
                          {TYPE_LABELS[item.type] || item.type}
                        </span>
                        {item.isAnonymous && (
                          <span className="shrink-0 text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">匿名</span>
                        )}
                        <h3 className="flex-1 text-sm font-serif text-[#2C2825] truncate min-w-0 leading-relaxed">
                          {item.title}
                        </h3>
                      </div>

                      {/* Row 2: username */}
                      <div className="text-[11px] text-[#8B7355]/70">
                        <span className="max-w-[80px] truncate block">
                          {item.author.nickname || '匿名'}
                        </span>
                      </div>
                    </div>

                    {/* Data column — fixed right side, hotScore top / stats bottom */}
                    <div className="shrink-0 flex flex-col items-end justify-between py-1">
                      <span className="text-xs font-mono tabular-nums text-[#8B7355]/60">
                        {item.hotScore.toFixed(1)}
                      </span>
                      <div className="flex items-center gap-3 text-[11px] text-[#8B7355]/70">
                        <span className="inline-flex items-center gap-0.5">
                          <MaterialIcon name="favorite" className="text-[12px] leading-none" />
                          {item.likeCount}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <MaterialIcon name="chat_bubble" className="text-[12px] leading-none" />
                          {item.commentCount}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <MaterialIcon name="visibility" className="text-[12px] leading-none" />
                          {item.viewCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
