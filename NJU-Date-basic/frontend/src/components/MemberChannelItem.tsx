import React from 'react';
import { motion } from 'framer-motion';
import { ChannelMember } from '../api/circles';
import MaterialIcon from './MaterialIcon';

interface MemberChannelItemProps {
  member: ChannelMember;
  onViewCard: (userId: string) => void;
}

export default function MemberChannelItem({ member, onViewCard }: MemberChannelItemProps) {
  const avatarFallback = member.nickname ? member.nickname.charAt(0).toUpperCase() : '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 border border-[#EAE7E1] bg-white rounded-lg shadow-sm hover:border-[#8B7355]/40 transition-colors group cursor-pointer"
      onClick={() => onViewCard(member.userId)}
    >
      <div 
        className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B7355]/20 to-[#8B7355]/5 flex items-center justify-center text-[#2C2825] font-serif text-lg shrink-0 overflow-hidden border border-[#EAE7E1]"
      >
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.nickname} className="w-full h-full object-cover" />
        ) : (
          avatarFallback
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-[#2C2825] text-lg hover:text-[#420047] transition-colors truncate">
            {member.nickname}
          </h3>
          {member.distanceText && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#420047]/15 bg-[#420047]/5 px-2 py-0.5 text-xs text-[#420047]">
              <MaterialIcon name="near_me" className="text-[13px]" />
              {member.distanceText}
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-1">
          {member.channelTags.map((tag) => (
             <span 
               key={tag.key}
               className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#F3F1ED] text-[#8B7355] border border-[#EAE7E1] whitespace-nowrap"
             >
               <span className="opacity-60 mr-1">{tag.label}:</span>
               {tag.value}
             </span>
          ))}
          {member.channelTags.length === 0 && (
             <span className="text-xs text-[#8B7355]/40 italic font-serif">暂无频道标签</span>
          )}
        </div>
      </div>

      <button
        className="flex items-center gap-1 text-[#8B7355]/60 hover:text-[#420047] text-xs font-serif tracking-widest bg-transparent border-none opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <MaterialIcon name="id_card" className="text-[16px]" />
        <span className="hidden sm:inline">名片</span>
      </button>
    </motion.div>
  );
}
