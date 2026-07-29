import { Link } from 'react-router-dom';

interface CircleForumHeaderProps {
  circleId: string;
  circleName: string;
}

export default function CircleForumHeader({ circleId, circleName }: CircleForumHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link
        to={`/circles/${circleId}`}
        className="flex items-center gap-1 text-sm text-[#8B7355] hover:text-[#2C2825] transition-colors"
      >
        <span className="text-lg leading-none">←</span>
        <span>返回圈子</span>
      </Link>
      <span className="text-[#8B7355]/30">|</span>
      <span className="text-sm text-[#5E5855] font-serif">{circleName} · 论坛</span>
    </div>
  );
}
