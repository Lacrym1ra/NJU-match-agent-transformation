import { useEffect, useState } from 'react';
import { REPORT_REASON_OPTIONS, type ReportReasonValue } from '../../lib/reportReasons';

interface ReportDialogProps {
  open: boolean;
  targetLabel: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { reasons: ReportReasonValue[]; detail?: string }) => Promise<void> | void;
}

export default function ReportDialog({
  open,
  targetLabel,
  submitting = false,
  onClose,
  onSubmit,
}: ReportDialogProps) {
  const [reasons, setReasons] = useState<ReportReasonValue[]>([]);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!open) return;
    setReasons([]);
    setDetail('');
  }, [open, targetLabel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] p-6 shadow-2xl">
        <h3 className="font-serif text-2xl tracking-widest text-[#2C2825]">举报内容</h3>
        <p className="mt-2 text-sm text-[#8B7355]">
          你正在举报：{targetLabel}
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-[14px] font-serif tracking-widest text-[#8B7355]">举报原因</label>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_REASON_OPTIONS.map((item) => (
              <label
                key={item.value}
                className="flex items-center gap-2 rounded-xl border border-[#EAE7E1] bg-white px-3 py-2 text-sm text-[#5E5855]"
              >
                <input
                  type="checkbox"
                  checked={reasons.includes(item.value)}
                  onChange={() => {
                    setReasons((prev) => prev.includes(item.value)
                      ? prev.filter((v) => v !== item.value)
                      : [...prev, item.value]);
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-[14px] font-serif tracking-widest text-[#8B7355]">补充说明（可选）</label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded-none border border-[#EAE7E1] bg-white px-3 py-2 text-sm break-words outline-none overflow-auto focus:border-[#420047]"
            placeholder="可补充时间、具体内容、上下文等信息"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#D9D1C7] px-4 py-2 text-sm text-[#8B7355] hover:bg-[#F3EEE7]"
          >
            取消
          </button>
          <button
            onClick={() => void onSubmit({ reasons, detail: detail.trim() || undefined })}
            disabled={submitting || reasons.length === 0}
            className="rounded-xl bg-[#420047] px-4 py-2 text-sm text-white hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '提交中...' : '提交举报'}
          </button>
        </div>
      </div>
    </div>
  );
}
