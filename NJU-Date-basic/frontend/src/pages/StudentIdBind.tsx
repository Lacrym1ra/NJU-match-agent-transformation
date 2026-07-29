import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';
import { getStudentIdBindStatus, sendStudentIdBindCode, verifyStudentIdBind } from '../api/studentId';

const isValidStudentIdInput = (value: string) => /^(?:\d{9}|\d{12})$/.test(value);

export default function StudentIdBind() {
  const navigate = useNavigate();
  const location = useLocation();
  const [studentId, setStudentId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<{ verified: boolean; last4: string | null; source: string | null; mergedIntoUserId: string | null } | null>(null);

  const refresh = async () => {
    const res = await getStudentIdBindStatus();
    setStatus(res);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err: any) {
        toast.error(err?.message || '加载绑定状态失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSendCode = async () => {
    if (!isValidStudentIdInput(studentId.trim())) {
      toast.warning('请输入正确的学号格式');
      return;
    }
    setSending(true);
    try {
      await sendStudentIdBindCode(studentId.trim());
      toast.success(`验证码已发送到 ${studentId.trim()}@smail.nju.edu.cn`);
    } catch (err: any) {
      toast.error(err?.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const onVerify = async () => {
    if (!isValidStudentIdInput(studentId.trim())) {
      toast.warning('请输入正确的学号格式');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      toast.warning('请输入 6 位验证码');
      return;
    }
    setVerifying(true);
    try {
      await verifyStudentIdBind(studentId.trim(), code.trim());
      toast.success('学号绑定成功');
      await refresh();
      if ((location.state as { from?: string } | null)?.from === '/heartbox') {
        navigate('/heartbox', { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || '绑定失败');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center text-[#8B7355] font-serif tracking-widest">加载中…</div>;
  }

  if (status?.mergedIntoUserId) {
    return (
      <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex overflow-x-hidden">
        <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[60px] bg-[#F3F1ED] border-r border-[#EAE7E1] flex-col items-center justify-evenly py-10 shadow-[inset_-6px_0_15px_rgba(0,0,0,0.03)] z-30">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full bg-[#EAE7E1] shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.15)] relative">
              <div className="absolute inset-0 rounded-full bg-[#2C2825]/5" />
            </div>
          ))}
          <div className="absolute top-0 bottom-0 w-[2px] bg-[#8B7355]/20 left-1/2 -translate-x-[50%]" />
        </div>
        <div
          className="flex-1 min-h-screen relative md:ml-[60px] flex flex-col items-center pt-10 pb-20 px-5 md:px-8"
          style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)', backgroundSize: '100% 48px' }}
        >
          <header className="w-full max-w-3xl flex justify-between items-center mb-12 relative z-10">
            <button type="button" onClick={() => navigate('/settings')} className="flex items-center gap-2 text-[#8B7355] hover:text-[#2C2825] transition-colors group">
              <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">west</span>
              <span className="font-serif tracking-widest text-sm">返回设置</span>
            </button>
            <div className="font-serif tracking-widest text-lg text-[#2C2825] opacity-50">学号绑定</div>
          </header>
          <div className="w-full max-w-3xl md:pl-10 md:border-l border-[#8B7355]/10">
            <div className="max-w-xl rounded-2xl border border-[#EAE7E1] shadow-md bg-[#FCFBF8]/95 p-6 md:p-8 text-[#2C2825]">
              <h1 className="font-serif text-2xl tracking-widest mb-3">账号已合并</h1>
              <p className="text-sm text-[#8B7355] leading-relaxed">当前账号已被标记为合并态，不能继续参与绑定、匹配或心动信笺。</p>
              <button type="button" onClick={() => navigate('/dashboard')} className="mt-5 px-4 py-2 border border-[#EAE7E1] rounded-full text-[#8B7355] hover:border-[#8B7355]/40 hover:text-[#2C2825] transition-colors">
                返回
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] bg-[#FCFBF8] flex overflow-x-hidden">
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[60px] bg-[#F3F1ED] border-r border-[#EAE7E1] flex-col items-center justify-evenly py-10 shadow-[inset_-6px_0_15px_rgba(0,0,0,0.03)] z-30">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full bg-[#EAE7E1] shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.15)] relative">
            <div className="absolute inset-0 rounded-full bg-[#2C2825]/5" />
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-[2px] bg-[#8B7355]/20 left-1/2 -translate-x-[50%]" />
      </div>
      <div
        className="flex-1 min-h-screen relative md:ml-[60px] flex flex-col items-center pt-10 pb-20 px-5 md:px-8"
        style={{ backgroundImage: 'linear-gradient(transparent 47px, rgba(139,115,85,0.1) 48px)', backgroundSize: '100% 48px' }}
      >
        <header className="w-full max-w-3xl flex justify-between items-center mb-12 relative z-10">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-2 h-10 px-4 border border-[#EAE7E1] bg-[#FCFBF8] text-[#8B7355] hover:text-[#2C2825] hover:border-[#8B7355]/35 rounded-full shadow-[0_2px_8px_rgba(44,40,37,0.06)] transition-all group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">west</span>
            <span className="font-serif tracking-widest text-sm">返回设置</span>
          </button>
          <div className="font-serif tracking-widest text-lg text-[#2C2825] opacity-50">学号绑定</div>
        </header>

        <div className="w-full max-w-3xl flex justify-center">
          <div className="w-full max-w-2xl border border-[#EAE7E1] bg-[#FCFBF8]/95 shadow-md rounded-2xl p-6 md:p-8">
            <div className="mb-6 text-center">
              <h1 className="font-serif text-3xl tracking-widest mb-2">学号绑定</h1>
              <p className="text-xs md:text-sm text-[#8B7355] font-serif tracking-widest opacity-80">
                绑定后可使用心动信笺
              </p>
            </div>
            <div className="text-sm text-[#8B7355] leading-relaxed mb-6">
              学号邮箱注册的账号会自动绑定，无需再次操作。若你使用邮箱别名注册，需先绑定学号；验证码会发送到你输入学号对应的规范邮箱（学号@smail.nju.edu.cn）。
            </div>

            {status?.verified ? (
              <div className="p-6 md:p-8 bg-[#F8F5F1] border border-[#8B7355]/20 rounded-xl text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#FCFBF8] rounded-full flex items-center justify-center border border-[#EAE7E1] shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-[#420047]">verified_user</span>
                </div>
                <div className="font-serif text-xl tracking-widest mb-5 text-[#2C2825]">学号已绑定</div>
                
                <div className="flex flex-col gap-3 items-center bg-[#FCFBF8] border border-[#EAE7E1] py-4 px-6 rounded-lg max-w-sm mx-auto mb-6">
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-[#8B7355]">学号尾号</span>
                    <span className="font-mono text-[#2C2825] font-medium">****{status.last4 ?? '----'}</span>
                  </div>
                  <div className="w-full h-[1px] bg-[#EAE7E1]/60"></div>
                  <div className="flex justify-between w-full text-xs">
                    <span className="text-[#8B7355]">认证方式</span>
                    <span className="text-[#2C2825]/70">
                      {status.source?.includes('otp') ? '邮箱验证码认证' : 
                       status.source?.includes('register') || status.source?.includes('registration') ? '注册时自动绑定' : '系统认证'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/heartbox')}
                  className="px-6 py-2.5 rounded-full bg-[#420047] text-[#FCFBF8] tracking-widest shadow-sm hover:shadow-md hover:bg-[#5C0064] transition-all inline-flex items-center gap-2"
                >
                  前往心动信笺
                  <span className="material-symbols-outlined text-[18px]">east</span>
                </button>
              </div>
            ) : (
              <>
                <label className="block text-xs tracking-widest text-[#8B7355] mb-2 uppercase">学号</label>
                <input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.trim())}
                  placeholder="例如：123456789 或 000000000000"
                  className="w-full px-4 py-3 rounded-lg border border-[#EAE7E1] bg-[#FCFBF8] focus:outline-none focus:border-[#420047]/50 transition-colors"
                />

                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={onSendCode} disabled={sending} className="px-5 py-2 rounded-full border border-[#420047]/30 text-[#420047] hover:bg-[#420047]/5 transition-colors disabled:opacity-60">
                    {sending ? '发送中…' : '发送验证码'}
                  </button>
                </div>

                <label className="block text-xs tracking-widest text-[#8B7355] mt-6 mb-2 uppercase">验证码</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="6 位数字"
                  className="w-full px-4 py-3 rounded-lg border border-[#EAE7E1] bg-[#FCFBF8] focus:outline-none focus:border-[#420047]/50 transition-colors"
                />

                <button type="button" onClick={onVerify} disabled={verifying} className="mt-4 w-full px-4 py-3 rounded-full bg-[#420047] text-[#FCFBF8] tracking-widest shadow-sm hover:shadow-md hover:bg-[#5C0064] transition-all disabled:opacity-60">
                  {verifying ? '绑定中…' : '确认绑定'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
