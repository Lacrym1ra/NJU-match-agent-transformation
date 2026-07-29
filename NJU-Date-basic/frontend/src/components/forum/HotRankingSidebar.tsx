import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHotRanking } from '../../api/forum';
import type { HotRankingItem } from '../../api/forum';
import MaterialIcon from '../MaterialIcon';

const RANK_MEDALS: Record<number, string> = {
  1: 'bg-amber-100 text-amber-600',
  2: 'bg-slate-100 text-slate-500',
  3: 'bg-orange-50 text-orange-400',
};

const REFRESH_INTERVAL = 60 * 60 * 1000;

export default function HotRankingSidebar() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HotRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchRanking = () => {
    getHotRanking({ limit: 10 })
      .then((res) => setItems(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRanking();
    timerRef.current = setInterval(fetchRanking, REFRESH_INTERVAL);

    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        fetchRanking();
        timerRef.current = setInterval(fetchRanking, REFRESH_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div className="flex items-center gap-2 mb-4">
          <MaterialIcon name="local_fire_department" className="text-[18px] text-red-400" />
          <span className="text-sm font-serif text-[#2C2825] tracking-wide">热 榜</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-[#EAE7E1]" />
              <div className="flex-1 h-3 bg-[#EAE7E1] rounded" />
              <div className="w-10 h-3 bg-[#EAE7E1] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div className="flex items-center gap-2 mb-4">
          <MaterialIcon name="local_fire_department" className="text-[18px] text-red-400" />
          <span className="text-sm font-serif text-[#2C2825] tracking-wide">热 榜</span>
        </div>
        <p className="text-center text-xs text-[#8B7355]/60 py-4">暂无帖子</p>
        <button
          onClick={() => navigate('/forum/ranking')}
          className="w-full pt-3 border-t border-[#EAE7E1] text-center text-[11px] text-[#8B7355] hover:text-[#420047] transition-colors"
        >
          查看完整热榜 →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon name="local_fire_department" className="text-[18px] text-red-400" />
        <span className="text-sm font-serif text-[#2C2825] tracking-wide">热 榜</span>
      </div>

      <div className="space-y-1">
        {items.map((item, i) => {
          const rank = i + 1;
          const medal = rank <= 3 ? RANK_MEDALS[rank] : null;
          return (
            <button
              key={item.postId}
              onClick={() => {
                navigate(`/forum/${item.postId}`, { state: { from: 'ranking' } });
              }}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#FCFBF8] transition-colors text-left group"
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                  medal ?? 'bg-[#EAE7E1] text-[#8B7355]'
                }`}
              >
                {rank}
              </span>
              <span className="flex-1 text-xs text-[#2C2825] truncate group-hover:text-[#420047] transition-colors">
                {item.title}
              </span>
              <span className="shrink-0 text-[10px] text-[#8B7355]/60 tabular-nums">
                {item.hotScore.toFixed(1)}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/forum/ranking')}
        className="w-full mt-3 pt-3 border-t border-[#EAE7E1] text-center text-[11px] text-[#8B7355] hover:text-[#420047] transition-colors"
      >
        查看完整热榜 →
      </button>
    </div>
  );
}
