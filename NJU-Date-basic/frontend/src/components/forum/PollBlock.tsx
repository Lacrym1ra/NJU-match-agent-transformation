import { useState } from 'react';
import type { ForumPoll } from '../../api/forum';
import MaterialIcon from '../MaterialIcon';

interface PollBlockProps {
  poll: ForumPoll;
  onVote: (optionId: string) => Promise<void>;
}

export default function PollBlock({ poll, onVote }: PollBlockProps) {
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);

  const handleVote = async (optionId: string) => {
    if (poll.votedByMe || votingOptionId) return;
    setVotingOptionId(optionId);
    try {
      await onVote(optionId);
    } finally {
      setVotingOptionId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-[#420047]">
          <MaterialIcon name="how_to_vote" className="text-[17px] leading-none" />
          投票
        </div>
        <span className="text-[11px] text-[#8B7355]">
          {poll.totalVotes} 票
        </span>
      </div>
      <div className="space-y-2">
        {poll.options.map((option) => {
          const selected = poll.myVoteOptionId === option.optionId;
          const disabled = poll.votedByMe || !!votingOptionId;
          const percent = poll.totalVotes > 0 ? Math.round((option.voteCount / poll.totalVotes) * 100) : 0;

          return (
            <button
              key={option.optionId}
              type="button"
              disabled={disabled}
              onClick={() => handleVote(option.optionId)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${
                selected && !poll.votedByMe
                  ? 'border-[#420047]/40 bg-[#420047]/10 text-[#420047]'
                  : selected
                    ? 'border-[#420047]/40 bg-white text-[#420047]'
                    : 'border-[#EAE7E1] bg-white text-[#2C2825] hover:border-[#420047]/30'
              } disabled:cursor-default`}
            >
              {poll.votedByMe && (
                <span
                  className="absolute inset-y-0 left-0 bg-[#420047]/5"
                  style={{ width: `${percent}%` }}
                />
              )}
              <span className="relative flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{option.text}</span>
                {selected && (
                  <MaterialIcon name="check_circle" className="text-[16px] leading-none" />
                )}
                {votingOptionId === option.optionId ? (
                  <span className="h-4 w-4 rounded-full border-2 border-[#420047] border-t-transparent animate-spin" />
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-[#8B7355]">
                    {option.voteCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {poll.votedByMe && (
        <p className="mt-3 text-[11px] text-[#8B7355]/70">
          已投票，投票后不能更改选项。
        </p>
      )}
    </div>
  );
}
