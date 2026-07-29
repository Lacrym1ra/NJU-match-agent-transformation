import React, { useEffect, useMemo, useState } from 'react';
import {
  acceptFriendRequest,
  FriendRequest,
  rejectFriendRequest,
  SentFriendRequest,
  getPendingRequests,
  silentRejectFriendRequest,
  withdrawFriendRequest,
} from '../api/friends';
import { blockUser } from '../api/safety';
import { toast } from '../components/Toast';
import MaterialIcon from '../components/MaterialIcon';

type BusyAction = 'accept' | 'reject' | 'silent-reject' | 'block' | 'withdraw';

const STATUS_LABELS: Record<FriendRequest['status'], { label: string; className: string }> = {
  pending: { label: '待处理', className: 'border-[#C4842F]/25 bg-[#FFF7E8] text-[#9B641A]' },
  accepted: { label: '已通过', className: 'border-[#420047]/20 bg-[#420047]/5 text-[#420047]' },
  rejected: { label: '已拒绝', className: 'border-[#D7D1C8] bg-[#F3F1ED] text-[#8B7355]' },
  withdrawn: { label: '已撤回', className: 'border-[#D7D1C8] bg-[#F3F1ED] text-[#8B7355]' },
  expired: { label: '已过期', className: 'border-[#D7D1C8] bg-[#F3F1ED] text-[#8B7355]' },
};

function formatDate(value?: string) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN');
}

function getSourceLabel(item: Pick<FriendRequest, 'circle_name' | 'circle_id'>) {
  return item.circle_name || item.circle_id || '该圈子';
}

export default function SettingPrivacyTab() {
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentFriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pendingSentRequests = useMemo(
    () => sentRequests.filter((request) => request.status === 'pending'),
    [sentRequests],
  );

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getPendingRequests();
      setReceivedRequests(data.requests || []);
      setSentRequests(data.sentRequests || []);
    } catch (err: any) {
      toast.error(err.message || '加载申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRequests();
  }, []);

  const runRequestAction = async (
    requestId: string,
    action: BusyAction,
    callback: () => Promise<unknown>,
    successMessage: string,
  ) => {
    const key = `${action}:${requestId}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      await callback();
      toast.success(successMessage);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    } finally {
      setBusyKey(null);
    }
  };

  const handleBlockUser = async (request: FriendRequest) => {
    const confirmed = window.confirm(`确定要拉黑「${request.nickname || '这位同窗'}」吗？拉黑后将不再收到对方的消息与申请。`);
    if (!confirmed) return;
    await runRequestAction(
      request.request_id,
      'block',
      () => blockUser(request.user_id),
      '已拉黑该用户',
    );
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-[#EAE7E1] bg-[#FCFBF8] px-6 py-10 text-center font-serif text-sm tracking-widest text-[#8B7355]">
        翻阅交友与隐私档案中...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border border-[#EAE7E1] bg-[#FCFBF8] p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-serif text-lg tracking-widest text-[#2C2825]">
              <MaterialIcon name="inbox" className="text-[20px] text-[#8B7355]" />
              收到的好友申请
            </div>
            <p className="mt-1 text-xs font-serif tracking-widest text-[#8B7355]/75">仅接收方可同意、拒绝、忽略或拉黑。</p>
          </div>
          <span className="rounded-full border border-[#EAE7E1] px-3 py-1 text-[11px] font-serif text-[#8B7355]">
            {receivedRequests.length} 条
          </span>
        </div>

        {receivedRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D7D1C8] bg-white/60 px-5 py-8 text-center text-sm font-serif italic text-[#8B7355]/75">
            暂无新的好友申请
          </div>
        ) : (
          <ul className="space-y-3">
            {receivedRequests.map((request) => {
              const status = STATUS_LABELS[request.status];
              const isPending = request.status === 'pending';
              return (
                <li key={request.request_id} className="rounded-2xl border border-[#EAE7E1] bg-white/80 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#EAE7E1] bg-[#F3F1ED] text-center font-serif leading-[44px] text-[#8B7355]">
                        {request.avatar_url ? <img src={request.avatar_url} alt={request.nickname} className="h-full w-full object-cover" /> : request.nickname?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-serif text-sm font-semibold tracking-wide text-[#2C2825]">{request.nickname || '神秘同窗'}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-serif tracking-widest ${status.className}`}>{status.label}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#8B7355]">
                          {getSourceLabel(request)} · {request.message || '请求添加你为好友'}
                        </p>
                        <p className="mt-1 text-[10px] font-serif tracking-widest text-[#8B7355]/55">
                          送达于 {formatDate(request.created_at)}
                          {request.expires_at ? ` · 过期于 ${formatDate(request.expires_at)}` : ''}
                        </p>
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => runRequestAction(request.request_id, 'accept', () => acceptFriendRequest(request.request_id), '已同意好友申请')}
                          disabled={Boolean(busyKey)}
                          className="rounded-full bg-[#420047] px-3 py-1.5 text-[11px] font-serif tracking-widest text-[#FCFBF8] transition hover:bg-[#2A002D] disabled:opacity-50"
                        >
                          同意
                        </button>
                        <button
                          type="button"
                          onClick={() => runRequestAction(request.request_id, 'reject', () => rejectFriendRequest(request.request_id), '已拒绝好友申请')}
                          disabled={Boolean(busyKey)}
                          className="rounded-full border border-[#EAE7E1] bg-[#FCFBF8] px-3 py-1.5 text-[11px] font-serif tracking-widest text-[#8B7355] transition hover:bg-[#F3F1ED] disabled:opacity-50"
                        >
                          拒绝
                        </button>
                        <button
                          type="button"
                          onClick={() => runRequestAction(request.request_id, 'silent-reject', () => silentRejectFriendRequest(request.request_id), '已忽略此申请')}
                          disabled={Boolean(busyKey)}
                          className="rounded-full border border-[#EAE7E1] bg-[#F3F1ED] px-3 py-1.5 text-[11px] font-serif tracking-widest text-[#8B7355] transition hover:bg-[#EEE8DE] disabled:opacity-50"
                        >
                          忽略
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBlockUser(request)}
                          disabled={Boolean(busyKey)}
                          className="rounded-full border border-[#B94A48]/30 bg-[#FFF4F4] px-3 py-1.5 text-[11px] font-serif tracking-widest text-[#B94A48] transition hover:bg-[#FFECEC] disabled:opacity-50"
                        >
                          拉黑
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[24px] border border-[#EAE7E1] bg-[#FCFBF8] p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-serif text-lg tracking-widest text-[#2C2825]">
              <MaterialIcon name="outbox" className="text-[20px] text-[#8B7355]" />
              我发出的好友申请
            </div>
            <p className="mt-1 text-xs font-serif tracking-widest text-[#8B7355]/75">只有发送方可撤回仍在等待处理的申请。</p>
          </div>
          <span className="rounded-full border border-[#EAE7E1] px-3 py-1 text-[11px] font-serif text-[#8B7355]">
            {pendingSentRequests.length} 条待回
          </span>
        </div>

        {pendingSentRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D7D1C8] bg-white/60 px-5 py-8 text-center text-sm font-serif italic text-[#8B7355]/75">
            暂无可撤回的好友申请
          </div>
        ) : (
          <ul className="space-y-3">
            {pendingSentRequests.map((request) => (
              <li key={request.request_id} className="rounded-2xl border border-[#EAE7E1] bg-white/80 p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#EAE7E1] bg-[#F3F1ED] text-center font-serif leading-[44px] text-[#8B7355]">
                      {request.avatar_url ? <img src={request.avatar_url} alt={request.nickname} className="h-full w-full object-cover" /> : request.nickname?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-serif text-sm font-semibold tracking-wide text-[#2C2825]">{request.nickname || '神秘同窗'}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-serif tracking-widest ${STATUS_LABELS[request.status].className}`}>
                          {STATUS_LABELS[request.status].label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-[#8B7355]">
                        {getSourceLabel(request)} · {request.message || '等待对方回应'}
                      </p>
                      <p className="mt-1 text-[10px] font-serif tracking-widest text-[#8B7355]/55">
                        送达于 {formatDate(request.created_at)}
                        {request.expires_at ? ` · 过期于 ${formatDate(request.expires_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runRequestAction(request.request_id, 'withdraw', () => withdrawFriendRequest(request.request_id), '已撤回好友申请')}
                    disabled={Boolean(busyKey)}
                    className="self-start rounded-full border border-[#B94A48]/30 px-3 py-1.5 text-[11px] font-serif tracking-widest text-[#B94A48] transition hover:bg-[#B94A48]/6 disabled:opacity-50 md:self-auto"
                  >
                    撤回
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
