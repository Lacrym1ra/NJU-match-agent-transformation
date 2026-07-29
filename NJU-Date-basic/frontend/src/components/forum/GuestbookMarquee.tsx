import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGuestbookMessages, createGuestbookMessage } from '../../api/forum';
import type { GuestbookMessage } from '../../api/forum';
import { toast } from '../Toast';
import { ApiError } from '../../api/client';
import MaterialIcon from '../MaterialIcon';

export default function GuestbookMarquee() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<GuestbookMessage[] | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(() => {
    getGuestbookMessages({ page: 1, limit: 15 })
      .then((res) => setMessages(res.messages))
      .catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Silent poll every 30s
  useEffect(() => {
    const timer = setInterval(fetchMessages, 30_000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 200 || sending) return;
    setSending(true);
    try {
      await createGuestbookMessage(trimmed);
      setInput('');
      toast.success('留言成功');
      fetchMessages();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '留言失败');
    } finally {
      setSending(false);
    }
  };

  // Loading state
  if (messages === null) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div className="flex items-center gap-2 mb-4">
          <MaterialIcon name="book" className="text-[18px] text-[#8B7355]" />
          <span className="text-sm font-serif text-[#2C2825] tracking-wide">留言板</span>
        </div>
        <div className="flex gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-[#EAE7E1]" />
              <div className="w-24 h-3 bg-[#EAE7E1] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon name="book" className="text-[18px] text-[#8B7355]" />
        <span className="text-sm font-serif text-[#2C2825] tracking-wide">留言板</span>
        {messages.length > 0 && (
          <button
            onClick={() => navigate('/forum/guestbook')}
            className="ml-auto text-[10px] text-[#8B7355]/60 hover:text-[#420047] transition-colors"
          >
            查看全部 →
          </button>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="text-center text-xs text-[#8B7355]/60 py-3">
          暂无留言，不妨做第一位留墨人
        </p>
      ) : messages.length < 5 ? (
        /* Few messages: static display, no duplication */
        <div className="flex gap-3 flex-wrap">
          {messages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => navigate('/forum/guestbook')}
              className="flex items-center gap-2 max-w-[260px] px-3 py-2 rounded-full bg-[#FCFBF8] hover:bg-[#420047]/5 transition-colors text-left"
            >
              <span className="w-6 h-6 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center text-[10px] font-serif shrink-0">
                {(msg.author.nickname || '?')[0]}
              </span>
              <span className="text-xs text-[#5E5855] truncate max-w-[180px]">
                {msg.content}
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* Enough messages: 3 marquee rows, split evenly */
        (() => {
          const chunkSize = Math.ceil(messages.length / 3);
          const rows = [
            messages.slice(0, chunkSize),
            messages.slice(chunkSize, chunkSize * 2),
            messages.slice(chunkSize * 2),
          ].filter((r) => r.length > 0);

          return (
            <div className="space-y-3">
              {rows.map((row, ri) => {
                const dir = ri % 2 === 0 ? 'normal' : 'reverse';
                const dur = Math.max(row.length * 1.5 + ri * 1, 6);
                return (
                  <div
                    key={ri}
                    className="overflow-hidden"
                    style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}
                  >
                    <div
                      className="flex gap-6 hover:[animation-play-state:paused]"
                      style={{
                        animation: `marquee-scroll ${dur}s linear infinite`,
                        animationDirection: dir,
                        width: 'max-content',
                      }}
                    >
                      {[...row, ...row].map((msg, i) => (
                        <button
                          key={`${msg.id}-${ri}-${i}`}
                          onClick={() => navigate('/forum/guestbook')}
                          className="flex items-center gap-2 shrink-0 max-w-[280px] px-3 py-2 rounded-full bg-[#FCFBF8] hover:bg-[#420047]/5 transition-colors text-left"
                        >
                          <span className="w-6 h-6 rounded-full bg-[#420047] text-[#FCFBF8] flex items-center justify-center text-[10px] font-serif shrink-0">
                            {(msg.author.nickname || '?')[0]}
                          </span>
                          <span className="text-xs text-[#5E5855] truncate max-w-[200px]">
                            {msg.content}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {/* Input */}
      <div className="mt-4 pt-4 border-t border-[#EAE7E1] flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="留一句话..."
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          className="flex-1 bg-transparent text-xs text-[#2C2825] placeholder:text-[#8B7355]/50 outline-none min-w-0"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0 px-3 py-1 rounded-full bg-[#420047] text-[#FCFBF8] text-[11px] hover:bg-[#2A002D] transition-colors disabled:bg-[#EAE7E1] disabled:text-[#8B7355]/50"
        >
          {sending ? '...' : '发送'}
        </button>
      </div>
    </div>
  );
}
