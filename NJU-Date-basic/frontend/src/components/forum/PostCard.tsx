import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { PostListItem } from '../../api/forum';
import MaterialIcon from '../MaterialIcon';

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

interface PostCardProps {
  post: PostListItem;
  onClick: () => void;
  onReport?: (postId: string) => void;
  onLike?: (postId: string) => void;
  onFavorite?: (postId: string) => void;
  variants?: Variants;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffH < 24) return `${diffH} 小时前`;
  if (diffD < 7) return `${diffD} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function PostCard({ post, onClick, onReport, onLike, onFavorite, variants }: PostCardProps) {
  const isHot = post.hotScore > 5;
  const navigate = useNavigate();

  return (
    <motion.div
      variants={variants}
      onClick={onClick}
      className={`relative bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(66,0,71,0.08)] transition-all duration-300 cursor-pointer group ${
        post.isPinned ? 'border-l-[3px] border-l-[#420047]' : ''
      }`}
    >
      {/* Title — large, bold, at the very top */}
      <h3 className="text-xl font-serif text-[#2C2825] line-clamp-1 break-words mb-2 group-hover:text-[#420047] transition-colors font-bold">
        {post.title}
      </h3>

      {/* Content snippet row: thumbnail + summary with inline author */}
      {(post.summary || post.coverImageUrl) && (
        <div className="flex items-start gap-3 mb-3">
          {post.coverImageUrl && (
            <img
              src={post.coverImageUrl}
              alt=""
              className="w-[180px] h-[108px] object-cover rounded-md shrink-0 bg-[#EAE7E1]"
              loading="lazy"
            />
          )}
          {post.summary && (
            <p className="text-base text-[#8B7355] leading-relaxed line-clamp-2 flex-1 min-w-0">
              <span className="text-[#2C2825]">{post.author.nickname || '匿名'}：</span>
              {post.summary}
            </p>
          )}
        </div>
      )}

      {/* Footer: tags + time left, interactions right */}
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        {/* Left: all tags · time */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-[#8B7355]">
          <span className={`px-2 py-0.5 rounded-full ${TYPE_COLORS[post.type] || TYPE_COLORS.general}`}>
            {TYPE_LABELS[post.type] || post.type}
          </span>
          {post.isPinned && (
            <span className="bg-[#420047]/10 text-[#420047] px-2 py-0.5 rounded-full">
              置顶
            </span>
          )}
          {post.isAnonymous && (
            <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
              <MaterialIcon name="visibility_off" className="text-[12px] leading-none" />
              匿名
            </span>
          )}
          {post.visibility === 'private' && (
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
              <MaterialIcon name="lock" className="text-[12px] leading-none" />
              私密
            </span>
          )}
          {isHot && (
            <span className="bg-red-50 text-red-500 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
              <MaterialIcon name="local_fire_department" className="text-[12px] leading-none" />
              热帖
            </span>
          )}
          <span className="text-[#8B7355]/40">·</span>
          <span>{formatTime(post.createdAt)}</span>
        </div>

        {/* Right: interactions only */}
        <div className="flex items-center gap-5 text-xs text-[#8B7355]">
          <span
            className="inline-flex items-center gap-1 cursor-pointer hover:text-[#E53935] transition-colors"
            style={{ color: post.likedByMe ? '#E53935' : undefined }}
            onClick={(e) => { e.stopPropagation(); onLike?.(post.postId); }}
          >
            <MaterialIcon name="favorite" className="text-[14px] leading-none" />
            <span className="tabular-nums min-w-[5ch] text-left">{post.likeCount}</span>
          </span>
          <span
            className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F59E0B] transition-colors"
            style={{ color: post.favoritedByMe ? '#F59E0B' : undefined }}
            onClick={(e) => { e.stopPropagation(); onFavorite?.(post.postId); }}
          >
            <MaterialIcon name="star" className="text-[14px] leading-none" />
            <span className="tabular-nums min-w-[5ch] text-left">{post.favoriteCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MaterialIcon name="visibility" className="text-[14px] leading-none" />
            <span className="tabular-nums min-w-[5ch] text-left">{post.viewCount}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
