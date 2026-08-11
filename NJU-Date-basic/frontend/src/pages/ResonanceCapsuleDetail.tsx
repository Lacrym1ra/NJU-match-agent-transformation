import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import NavBar from '../components/NavBar';
import {
  cancelResonanceCapsule, getResonanceCapsule, respondToResonanceCapsule,
  type ResonanceCapsule,
} from '../api/resonance';
import { useToast } from '../components/Toast';
import './ProjectBModules.css';

export default function ResonanceCapsuleDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [capsule, setCapsule] = useState<ResonanceCapsule | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getResonanceCapsule(id).then((r) => setCapsule(r.capsule)).catch((e) => toast.error(e.message)); }, [id, toast]);

  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = String(new FormData(event.currentTarget).get('response'));
      setCapsule((await respondToResonanceCapsule(id, response)).capsule);
      toast.success('回应已封存');
    } catch (error) { toast.error(error instanceof Error ? error.message : '回应失败'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { setCapsule((await cancelResonanceCapsule(id)).capsule); toast.success('胶囊已取消'); }
    catch (error) { toast.error(error instanceof Error ? error.message : '取消失败'); }
    finally { setBusy(false); }
  }

  return <div className="pb-page"><NavBar /><main className="pb-shell pb-shell--narrow">
    <Link className="pb-back" to="/resonance">← 返回共鸣胶囊</Link>
    {!capsule ? <div className="pb-empty">正在取回胶囊…</div> : <motion.article className="pb-detail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
      <p className="pb-kicker">SEALED CONVERSATION</p><h1>{capsule.title}</h1><blockquote>{capsule.prompt}</blockquote>
      {capsule.isRevealed ? <div className="pb-reveal-grid">
        <section><small>我的回答</small><p>{capsule.myResponse}</p></section>
        <section><small>对方的回答</small><p>{capsule.otherResponse}</p></section>
      </div> : <>
        <div className="pb-seal-status"><strong>{capsule.hasResponded ? '你的回答已经封存' : capsule.hasParticipant ? '轮到你写下回答' : '正在等待另一人加入'}</strong><span>{capsule.otherHasResponded ? '对方已回应' : '对方尚未回应'}</span></div>
        {capsule.hasParticipant && !capsule.hasResponded && capsule.status === 'collecting' && <form className="pb-response" onSubmit={respond}>
          <label>你的回答<textarea name="response" required maxLength={2000} placeholder="这段内容会在双方都提交后才同时出现。" /></label>
          <button className="pb-primary" disabled={busy}>封存我的回答</button>
        </form>}
      </>}
      {capsule.role === 'creator' && ['awaiting_participant', 'collecting'].includes(capsule.status) && <button className="pb-text-button" type="button" onClick={cancel} disabled={busy}>取消这只胶囊</button>}
    </motion.article>}
  </main></div>;
}
