import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CommentItem as CommentItemType, ReplyItem as ReplyItemType } from '../../api/forum';
import MaterialIcon from '../MaterialIcon';

interface CommentItemProps {
  comment: CommentItemType;
  onReply: (commentId: string, nickname: string) => void;
  onDelete: (commentId: string) => void;
  onReport?: (commentId: string, type: 'comment', authorNickname: string) => void;
  onLoadMore?: (rootCommentId: string) => void;
  loadingReplies?: boolean;
  isExpanded?: boolean;
  onLike?: (commentId: string) => void;
  onPin?: (commentId: string) => void;
  onOpenImage?: (imageUrl: string) => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
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

export function ReplyItemComponent({
  reply,
  onReply,
  onDelete,
  onReport,
  onLike,
  onOpenImage,
}: {
  reply: ReplyItemType;
  onReply: (commentId: string, nickname: string) => void;
  onDelete: (commentId: string) => void;
  onReport?: (commentId: string, type: 'comment', authorNickname: string) => void;
  onLike?: (commentId: string) => void;
  onOpenImage?: (imageUrl: string) => void;
}) {
  const isOwn = reply.author.isOwn;
  const nickname = reply.author.nickname || '匿名';
  const initial = nickname[0];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const navigate = useNavigate();

  const isVoice = !reply.isDeleted && !!reply.voiceUrl;
  const hasText = !reply.isDeleted && !!reply.content?.trim();
  const hasImage = !reply.isDeleted && !!reply.imageUrl;

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex gap-3 py-2">
      <div className="w-6 h-6 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center text-[9px] font-serif shrink-0">
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span 
            className={`text-sm font-medium text-[#2C2825] ${reply.author.userId ? 'cursor-pointer hover:text-[#420047] transition-colors' : ''}`}
            onClick={(e) => {
              if (reply.author.userId) {
                e.stopPropagation();
                navigate(`/user/${reply.author.userId}`);
              }
            }}
          >
            {nickname}
          </span>
          {reply.replyToNickname && (
            <span className="text-[11px] text-[#8B7355]">
              回复 @{reply.replyToNickname}
            </span>
          )}
          <span className="text-[11px] text-[#8B7355]/60">
            {formatTime(reply.createdAt)}
          </span>
        </div>

        {reply.isDeleted ? (
          <p className="text-sm text-[#8B7355] leading-relaxed mt-0.5">该评论已被删除</p>
        ) : (
          <div className="mt-1 flex flex-col items-start gap-2">
            {hasText && (
              <p className="w-full text-sm text-[#2C2825] leading-relaxed whitespace-pre-wrap break-words">
                {reply.content}
              </p>
            )}
            {isVoice && reply.voiceUrl && (
              <div className="self-start">
                <button
                  onClick={togglePlay}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#420047]/5 hover:bg-[#420047]/10 transition-colors"
                >
                  <MaterialIcon
                    name={playing ? 'pause' : 'play_arrow'}
                    className="text-[14px] text-[#420047] leading-none"
                  />
                  <span className="flex items-end gap-[2px] h-4">
                    {[3, 7, 4, 10, 6, 9, 5, 8].map((h, i) => (
                      <span
                        key={i}
                        className="w-[2px] rounded-full bg-[#420047]/50 transition-all"
                        style={{ height: playing ? `${6 + Math.random() * 6}px` : `${h}px` }}
                      />
                    ))}
                  </span>
                  {reply.voiceDurationSec && (
                    <span className="text-[11px] text-[#420047]/70 tabular-nums">
                      {reply.voiceDurationSec}s
                    </span>
                  )}
                </button>
                <audio
                  ref={audioRef}
                  src={reply.voiceUrl ?? undefined}
                  onEnded={() => setPlaying(false)}
                  onPause={() => setPlaying(false)}
                  className="hidden"
                />
              </div>
            )}
            {hasImage && reply.imageUrl && (
              <img
                src={reply.imageUrl}
                alt="comment attachment"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenImage?.(reply.imageUrl!);
                }}
                className="max-w-[150px] max-h-[150px] w-auto rounded-md border border-[#EAE7E1] object-cover cursor-pointer hover:opacity-90 transition-opacity"
              />
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          {!reply.isDeleted && (
            <button
              onClick={() => onReply(reply.commentId, nickname)}
              className="text-[11px] text-[#8B7355] hover:text-[#420047] transition-colors"
            >
              回复
            </button>
          )}
          {!reply.isDeleted && onLike && (
            <button
              onClick={() => onLike(reply.commentId)}
              className={`text-[11px] transition-colors inline-flex items-center gap-0.5 ${
                reply.likedByMe
                    ? 'text-red-400'
                    : 'text-[#8B7355] hover:text-red-400'
              }`}
            >
              <MaterialIcon name={reply.likedByMe ? 'favorite' : 'favorite_border'} className="text-[9px] leading-none" />
              {reply.likeCount > 0 && <span>{reply.likeCount}</span>}
            </button>
          )}
          {!reply.isDeleted && isOwn && (
            <button
              onClick={() => onDelete(reply.commentId)}
              className="text-[11px] text-[#8B7355]/60 hover:text-red-500 transition-colors"
            >
              删除
            </button>
          )}
          {!reply.isDeleted && !isOwn && onReport && (
            <button
              onClick={() => onReport(reply.commentId, 'comment', nickname)}
              className="ml-auto text-[#8B7355]/60 hover:text-[#420047] transition-colors inline-flex items-center"
              title="举报"
              aria-label="举报"
            >
              <MaterialIcon name="flag" className="text-[14px] leading-none" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentItem({
  comment,
  onReply,
  onDelete,
  onReport,
  onLoadMore,
  loadingReplies,
  isExpanded,
  onLike,
  onPin,
  onOpenImage,
}: CommentItemProps) {
  const isOwn = comment.author.isOwn;
  const nickname = comment.author.nickname || '匿名';
  const initial = nickname[0];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const navigate = useNavigate();

  const isVoice = !comment.isDeleted && !!comment.voiceUrl;
  const hasText = !comment.isDeleted && !!comment.content?.trim();
  const hasImage = !comment.isDeleted && !!comment.imageUrl;

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const remainingReplies = comment.replyCount - comment.previewReplies.length;
  const hasMoreReplies = remainingReplies > 0;

  return (
    <div>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="flex w-8 shrink-0 self-stretch flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center text-xs font-serif">
            {initial}
          </div>
          {comment.canPinByMe && onPin && (!comment.isDeleted || comment.isPinned) && (
            <button
              onClick={() => onPin(comment.commentId)}
              className={`mt-auto transition-colors inline-flex items-center ${
                comment.isPinned
                  ? 'text-[#420047]'
                  : 'text-[#8B7355]/60 hover:text-[#420047]'
              }`}
              title={comment.isPinned ? '取消置顶' : '置顶评论'}
              aria-label={comment.isPinned ? '取消置顶' : '置顶评论'}
            >
              <MaterialIcon name="push_pin" className="text-[14px] leading-none" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span 
              className={`text-sm font-medium text-[#2C2825] ${comment.author.userId ? 'cursor-pointer hover:text-[#420047] transition-colors' : ''}`}
              onClick={(e) => {
                if (comment.author.userId) {
                  e.stopPropagation();
                  navigate(`/user/${comment.author.userId}`);
                }
              }}
            >
              {nickname}
            </span>
            <span className="text-[11px] text-[#8B7355]/60">
              {formatTime(comment.createdAt)}
            </span>
            {comment.isPinned && (
              <span className="text-[9px] bg-[#420047]/10 text-[#420047] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                <MaterialIcon name="push_pin" className="text-[9px] leading-none" />
                置顶
              </span>
            )}
          </div>

          {comment.isDeleted ? (
            <p className="text-sm text-[#8B7355] leading-relaxed mt-1">该评论已被删除</p>
          ) : (
            <div className="mt-1 flex flex-col items-start gap-2">
              {hasText && (
                <p className="w-full text-sm text-[#2C2825] leading-relaxed whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              )}
              {isVoice && comment.voiceUrl && (
                <div className="self-start">
                  <button
                    onClick={togglePlay}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#420047]/5 hover:bg-[#420047]/10 transition-colors"
                  >
                    <MaterialIcon
                      name={playing ? 'pause' : 'play_arrow'}
                      className="text-[14px] text-[#420047] leading-none"
                    />
                    <span className="flex items-end gap-[2px] h-4">
                      {[3, 7, 4, 10, 6, 9, 5, 8].map((h, i) => (
                        <span
                          key={i}
                          className="w-[2px] rounded-full bg-[#420047]/50 transition-all"
                          style={{ height: playing ? `${6 + Math.random() * 6}px` : `${h}px` }}
                        />
                      ))}
                    </span>
                    {comment.voiceDurationSec && (
                      <span className="text-[11px] text-[#420047]/70 tabular-nums">
                        {comment.voiceDurationSec}s
                      </span>
                    )}
                  </button>
                  <audio
                    ref={audioRef}
                    src={comment.voiceUrl ?? undefined}
                    onEnded={() => setPlaying(false)}
                    onPause={() => setPlaying(false)}
                    className="hidden"
                  />
                </div>
              )}
              {hasImage && comment.imageUrl && (
                <img
                  src={comment.imageUrl}
                  alt="comment attachment"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenImage?.(comment.imageUrl!);
                  }}
                  className="max-w-[150px] max-h-[150px] w-auto rounded-md border border-[#EAE7E1] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1.5">
            {!comment.isDeleted && (
              <button
                onClick={() => onReply(comment.commentId, nickname)}
                className="text-[11px] text-[#8B7355] hover:text-[#420047] transition-colors"
              >
                回复
              </button>
            )}
            {!comment.isDeleted && onLike && (
              <button
                onClick={() => onLike(comment.commentId)}
                className={`text-[11px] transition-colors inline-flex items-center gap-0.5 ${
                  comment.likedByMe
                      ? 'text-red-400'
                      : 'text-[#8B7355] hover:text-red-400'
                }`}
              >
                <MaterialIcon name={comment.likedByMe ? 'favorite' : 'favorite_border'} className="text-[9px] leading-none" />
                {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
              </button>
            )}
            {!comment.isDeleted && isOwn && (
              <button
                onClick={() => onDelete(comment.commentId)}
                className="text-[11px] text-[#8B7355]/60 hover:text-red-500 transition-colors"
              >
                删除
              </button>
            )}
            {!comment.isDeleted && !isOwn && onReport && (
              <button
                onClick={() => onReport(comment.commentId, 'comment', nickname)}
                className="ml-auto text-[#8B7355]/60 hover:text-[#420047] transition-colors inline-flex items-center"
                title="举报"
                aria-label="举报"
              >
                <MaterialIcon name="flag" className="text-[14px] leading-none" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview replies (level-2) — hidden when externally expanded */}
      {!isExpanded && comment.previewReplies.length > 0 && (
        <div className="ml-8 pl-4 border-l-2 border-[#EAE7E1] divide-y divide-[#EAE7E1]/40">
          {comment.previewReplies.map((reply) => (
            <ReplyItemComponent
              key={reply.commentId}
              reply={reply}
              onReply={onReply}
              onDelete={onDelete}
              onReport={onReport}
              onLike={onLike}
              onOpenImage={onOpenImage}
            />
          ))}
        </div>
      )}

      {/* Show more button — hidden when already expanded */}
      {!isExpanded && hasMoreReplies && onLoadMore && (
        <button
          onClick={() => onLoadMore(comment.commentId)}
          disabled={loadingReplies}
          className="ml-8 pl-4 mt-1 text-[11px] text-[#8B7355] hover:text-[#420047] transition-colors"
        >
          {loadingReplies ? '加载中...' : `展开更多 ${remainingReplies} 条回复`}
        </button>
      )}
    </div>
  );
}
