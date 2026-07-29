import React, { useEffect, useMemo, useState } from 'react';
import { Circle, JoinCirclePayload } from '../api/circles';
import {
  buildJoinCirclePayload,
  getJoinFormError,
  getJoinPolicyMode,
} from '../modules/circles/joinForm';
import MaterialIcon from './MaterialIcon';

interface CircleJoinModalProps {
  circle: Circle | null;
  isOpen: boolean;
  submitting?: boolean;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (payload: JoinCirclePayload) => Promise<void> | void;
}

export default function CircleJoinModal({
  circle,
  isOpen,
  submitting = false,
  submitLabel,
  onClose,
  onSubmit,
}: CircleJoinModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [applicationReason, setApplicationReason] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const joinPolicy = useMemo(() => getJoinPolicyMode(circle?.joinPolicy), [circle?.joinPolicy]);
  const questions = circle?.joinQuestions ?? [];
  const needsForm = joinPolicy !== 'public' || questions.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setInviteCode('');
    setApplicationReason('');
    setAnswers({});
    setError('');
  }, [isOpen, circle?.id]);

  if (!isOpen || !circle) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const validationError = getJoinFormError({
      joinPolicy,
      inviteCode,
      questions,
      answers,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    await onSubmit(buildJoinCirclePayload({ inviteCode, applicationReason, answers }));
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#EAE7E1] bg-white px-5 py-4">
          <div>
            <h2 className="font-serif text-lg tracking-widest text-[#2C2825]">{circle.name}</h2>
            <p className="mt-1 text-xs text-[#8B7355]">
              {joinPolicy === 'public' ? '公开加入' : joinPolicy === 'invite' ? '邀请制入圈' : '申请审核'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#8B7355] transition-colors hover:bg-[#F3F1ED] hover:text-[#2C2825]"
            aria-label="关闭"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {joinPolicy === 'invite' && (
            <label className="block">
              <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">邀请码</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="w-full rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#420047]/40"
                maxLength={80}
              />
            </label>
          )}

          {questions.map((question) => (
            <label key={question.id} className="block">
              <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">
                {question.question}{question.required ? ' *' : ''}
              </span>
              <textarea
                value={answers[question.id] ?? ''}
                onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                className="min-h-20 w-full resize-none rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#420047]/40"
                maxLength={300}
              />
            </label>
          ))}

          {joinPolicy === 'review' && (
            <label className="block">
              <span className="mb-1 block text-xs font-serif tracking-widest text-[#8B7355]">申请说明</span>
              <textarea
                value={applicationReason}
                onChange={(event) => setApplicationReason(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border border-[#EAE7E1] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#420047]/40"
                maxLength={300}
              />
            </label>
          )}

          {!needsForm && (
            <div className="rounded-lg border border-[#EAE7E1] bg-white px-4 py-4 text-sm font-serif text-[#8B7355]">
              点击确认后即可加入该圈子。
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#EAE7E1] bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#EAE7E1] px-4 py-2 text-sm text-[#8B7355] transition-colors hover:bg-[#F3F1ED]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[#420047] px-5 py-2 text-sm text-[#FCFBF8] transition-colors hover:bg-[#2A002D] disabled:opacity-60"
          >
            <MaterialIcon name={submitting ? 'progress_activity' : 'login'} className={`text-[16px] ${submitting ? 'animate-spin' : ''}`} />
            {submitting ? '提交中...' : submitLabel ?? (joinPolicy === 'review' ? '提交申请' : '确认加入')}
          </button>
        </div>
      </form>
    </div>
  );
}
