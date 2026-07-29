import { useState, useRef, useEffect } from 'react';
import VoiceRecorder from './VoiceRecorder';
import { useMediaUpload } from '../../shared/hooks/useMediaUpload';
import { toast } from '../Toast';

interface CommentFormProps {
  replyTo: { commentId: string; nickname: string } | null;
  onCancelReply: () => void;
  onSubmit: (payload: {
    content?: string;
    parentCommentId?: string | null;
    voiceUrl?: string;
    voiceDurationSec?: number;
    imageUrl?: string;
  }) => Promise<void>;
  disabled?: boolean;
  docked?: boolean;
}

export default function CommentForm({
  replyTo,
  onCancelReply,
  onSubmit,
  disabled,
  docked = false,
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { uploadVoice, uploadImage } = useMediaUpload('comment');

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const handleVoiceComplete = (blob: Blob, durationSec: number) => {
    setVoiceBlob(blob);
    setVoiceDuration(durationSec);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片不能超过 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const trimmed = content.trim();
    const hasVoice = voiceBlob !== null;
    const hasImage = !!imageFile;

    if (!trimmed && !hasVoice && !hasImage) return;

    setSubmitting(true);
    try {
      let voiceUrl: string | undefined;
      let voiceDurationSec: number | undefined;
      let imageUrl: string | undefined;

      if (hasVoice) {
        const result = await uploadVoice(voiceBlob!);
        voiceUrl = result.url;
        voiceDurationSec = voiceDuration;
      }

      if (hasImage) {
        const result = await uploadImage(imageFile!);
        imageUrl = result.url;
      }

      await onSubmit({
        content: trimmed || undefined,
        parentCommentId: replyTo?.commentId ?? null,
        voiceUrl,
        voiceDurationSec,
        imageUrl,
      });

      setContent('');
      setVoiceBlob(null);
      setVoiceDuration(0);
      removeImage();
      if (replyTo) onCancelReply();
    } catch {
      toast.error('评论发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = content.trim().length > 0 || voiceBlob !== null || imageFile !== null;

  return (
    <div className={docked ? 'rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] p-3 shadow-[0_8px_24px_rgba(44,40,37,0.06)]' : 'pt-4 px-4 pb-1'}>
      {replyTo && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-[#8B7355]">
            正在回复 <span className="text-[#420047] font-medium">@{replyTo.nickname}</span>
          </span>
          <button
            onClick={onCancelReply}
            className="text-xs text-[#8B7355]/60 hover:text-[#2C2825] transition-colors"
          >
            取消
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="text-xs text-[#8B7355] hover:text-[#420047] transition-colors"
        >
          + 图片
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="comment-preview" className="h-24 w-24 object-cover rounded-xl border border-[#EAE7E1]" />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#420047] text-white text-[10px]"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTo ? `回复 @${replyTo.nickname}...` : '写下你的评论...'}
          maxLength={2000}
          rows={2}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-[#2C2825] placeholder:text-[#8B7355]/50 outline-none border border-[#EAE7E1] rounded-xl px-4 py-2.5 focus:border-[#420047]/30 resize-none disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting || disabled}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-[#420047] text-[#FCFBF8] text-sm tracking-widest hover:bg-[#2A002D] transition-colors disabled:bg-[#EAE7E1] disabled:text-[#8B7355]/50 disabled:cursor-not-allowed shadow-md"
        >
          {submitting ? '发送中' : '发送'}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <VoiceRecorder
          onRecordingComplete={handleVoiceComplete}
          disabled={disabled}
        />
      </div>

      <p className="text-[10px] text-[#8B7355]/50 mt-1.5 text-right">
        可同时附带文字、语音和图片；Ctrl + Enter 快速发送
      </p>
    </div>
  );
}
