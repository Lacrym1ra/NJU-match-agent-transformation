import { motion } from 'framer-motion';
import type { ForumPostType } from '../../api/forum';

const TYPE_OPTIONS: { value: ForumPostType | null; label: string }[] = [
  { value: null, label: '全部' },
  { value: 'general', label: '交流' },
  { value: 'squad', label: '组队' },
  { value: 'help', label: '互助' },
  { value: 'trade', label: '二手' },
  { value: 'activity', label: '活动' },
];

interface PostTypeFilterProps {
  active: ForumPostType | null;
  onChange: (type: ForumPostType | null) => void;
}

export default function PostTypeFilter({ active, onChange }: PostTypeFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {TYPE_OPTIONS.map((opt) => (
        <motion.button
          key={String(opt.value)}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-full text-sm transition-all duration-300 ${
            active === opt.value
              ? 'bg-[#420047] text-white shadow-md'
              : 'bg-white text-[#8B7355] hover:bg-[#8B7355]/10 border border-[#EAE7E1]'
          }`}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}
