import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import NavBar from '../components/NavBar';
import {
  createResonanceCapsule, joinResonanceCapsule, listResonanceCapsules,
  type ResonanceCapsule,
} from '../api/resonance';
import { useToast } from '../components/Toast';
import './ProjectBModules.css';

const statusText: Record<ResonanceCapsule['status'], string> = {
  awaiting_participant: '等待另一人加入', collecting: '静候双方回应',
  revealed: '已经共同揭晓', cancelled: '已取消',
};

export default function ResonanceCapsules() {
  const toast = useToast();
  const [capsules, setCapsules] = useState<ResonanceCapsule[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setCapsules((await listResonanceCapsules()).capsules); }
    catch (error) { toast.error(error instanceof Error ? error.message : '暂时无法读取胶囊'); }
  }, [toast]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await createResonanceCapsule({
        title: String(data.get('title')), prompt: String(data.get('prompt')), expiresInDays: 7,
      });
      setCreatedCode(result.inviteCode); form.reset(); await refresh();
      toast.success('共鸣胶囊已创建');
    } catch (error) { toast.error(error instanceof Error ? error.message : '创建失败'); }
    finally { setBusy(false); }
  }

  async function join(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await joinResonanceCapsule(inviteCode); setInviteCode(''); await refresh();
      toast.success('已经加入这只胶囊');
    } catch (error) { toast.error(error instanceof Error ? error.message : '邀请码不可用'); }
    finally { setBusy(false); }
  }

  return <MotionConfig reducedMotion="user"><div className="pb-page">
    <NavBar />
    <main className="pb-shell">
      <motion.header className="pb-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
        <p className="pb-kicker">PROJECT B / RESONANCE</p>
        <h1>把答案暂时封存，<br />等两个人都准备好。</h1>
        <p>共鸣胶囊是本阶段独立新增的双人互动模块。任何一方都看不到单边答案；只有双方提交后才同时揭晓。</p>
      </motion.header>

      <section className="pb-two-column" aria-label="创建或加入共鸣胶囊">
        <form className="pb-panel" onSubmit={create}>
          <span className="pb-number">01</span><h2>发起一只胶囊</h2>
          <label>胶囊标题<input name="title" maxLength={80} required placeholder="例如：慢慢认识" /></label>
          <label>留给彼此的问题<textarea name="prompt" maxLength={500} required placeholder="哪一个瞬间让你感到被理解？" /></label>
          <button className="pb-primary" disabled={busy}>生成一次性邀请码</button>
          {createdCode && <div className="pb-code" role="status"><small>邀请码仅在此刻展示，请妥善转交</small><strong>{createdCode}</strong></div>}
        </form>
        <form className="pb-panel pb-panel--tint" onSubmit={join}>
          <span className="pb-number">02</span><h2>加入朋友的胶囊</h2>
          <p>输入对方单独发给你的 8 位邀请码。邀请码不会出现在论坛、圈子或 Agent 检索结果中。</p>
          <label>邀请码<input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} maxLength={9} required placeholder="ABCD2345" /></label>
          <button className="pb-secondary" disabled={busy}>进入胶囊</button>
        </form>
      </section>

      <section className="pb-list-section"><div className="pb-section-heading"><div><p className="pb-kicker">MY CAPSULES</p><h2>我的共鸣胶囊</h2></div><span>{capsules.length} 只</span></div>
        <div className="pb-card-grid">
          {capsules.map((capsule, index) => <motion.article className="pb-card" key={capsule.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: index * .05 }}>
            <span>{statusText[capsule.status]}</span><h3>{capsule.title}</h3><p>{capsule.prompt}</p>
            <small>{capsule.role === 'creator' ? '由我发起' : '受邀参与'} · {capsule.hasResponded ? '我已回应' : '等待我回应'}</small>
            <Link to={`/resonance/${capsule.id}`}>打开胶囊 →</Link>
          </motion.article>)}
          {capsules.length === 0 && <div className="pb-empty">这里还很安静。发起第一只胶囊，或者输入朋友的邀请码。</div>}
        </div>
      </section>
    </main>
  </div></MotionConfig>;
}
