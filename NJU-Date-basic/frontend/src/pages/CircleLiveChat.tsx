import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCircleDetail, type Circle } from '../api/circles';
import CircleChatPanel from '../components/chat/CircleChatPanel';
import MaterialIcon from '../components/MaterialIcon';
import { toast } from '../components/Toast';

export default function CircleLiveChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate('/circles', { replace: true });
      return;
    }

    let cancelled = false;
    const loadCircle = async () => {
      setLoading(true);
      try {
        const circleRes = await getCircleDetail(id);
        const circleData = circleRes.circle || circleRes as any;
        if (!cancelled) setCircle(circleData);
      } catch (err: any) {
        toast.error(err.message || '茶话间加载失败');
        navigate(`/circles/${id}`, { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCircle();
    return () => { cancelled = true; };
  }, [id, navigate]);

  const handleJoinFromChat = () => {
    if (!id) return;
    navigate(`/circles/${id}?redirect=${encodeURIComponent(`/circles/${id}/livechat`)}`);
  };

  return (
    <div
      className="min-h-screen w-full bg-[#FCFBF8] px-4 text-[#2C2825] selection:bg-[#420047] selection:text-[#FCFBF8] md:px-8 md:py-20"
      style={{
        backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.05) 48px)',
        backgroundSize: '100% 48px',
      }}
    >
      <header className="relative z-10 mx-auto mb-10 flex w-full max-w-4xl flex-col pt-10 md:pt-0">
        <button
          type="button"
          onClick={() => navigate(`/circles/${id}`)}
          className="group mb-8 flex w-max items-center gap-2 text-[#8B7355] transition-colors hover:text-[#2C2825]"
        >
          <MaterialIcon name="west" className="text-[18px] transition-transform group-hover:-translate-x-1" />
          <span className="font-serif text-sm tracking-widest">归返前庭</span>
        </button>

        <div className="flex flex-col gap-6 border-b border-[#EAE7E1]/50 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 flex flex-wrap items-center gap-3 font-serif text-3xl tracking-widest text-[#2C2825] md:text-4xl">
              圈内茶话
              <span className="mt-1 rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1 text-xs tracking-widest text-[#420047]">
                {circle?.name || 'LiveChat'}
              </span>
            </h1>
            <p className="mt-2 font-serif text-sm tracking-wide text-[#8B7355] opacity-80">
              同好在线相逢，随手续上圈内话题。
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#EAE7E1] bg-white/60 px-4 py-2 font-serif text-xs tracking-widest text-[#8B7355]">
            <MaterialIcon name="forum" className="text-[16px]" />
            LiveChat
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col pb-20">
        {loading ? (
          <div className="flex justify-center py-24 text-[#8B7355]">
            <MaterialIcon name="progress_activity" className="animate-spin text-2xl" />
          </div>
        ) : circle?.isJoined && id ? (
          <CircleChatPanel circleId={id} circleName={circle.name} variant="page" />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#EAE7E1] bg-white/35 px-6 py-20 text-center">
            <MaterialIcon name="lock" className="mx-auto mb-4 text-3xl text-[#8B7355]/55" />
            <h2 className="font-serif text-xl tracking-widest text-[#2C2825]">茶话间仅对圈内成员开放</h2>
            <p className="mx-auto mt-3 max-w-md font-serif text-sm leading-relaxed text-[#8B7355]/80">
              先加入「{circle?.name || '这个圈子'}」，再进入独立 LiveChat 与同圈成员交流。
            </p>
            <button
              type="button"
              onClick={handleJoinFromChat}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#420047] px-6 py-2.5 font-serif text-sm tracking-widest text-[#FCFBF8] transition hover:bg-[#2A002D]"
            >
              <MaterialIcon name="login" className="text-[17px]" />
              前往加入圈子
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
