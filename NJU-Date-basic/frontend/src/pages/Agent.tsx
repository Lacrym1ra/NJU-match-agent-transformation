import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import AgentConfirmDialog from '../components/agent/AgentConfirmDialog';
import AgentResultCard from '../components/agent/AgentResultCard';
import {
  chatWithAgent, createAgentDraft, getAgentStatus, joinAgentCircle, publishAgentDraft,
  requestAgentConfirmation,
  type AgentCircleCard, type AgentDraft, type AgentPostCard,
} from '../api/agent';
import './Agent.css';

type PendingAction = { kind: 'publish'; draft: AgentDraft } | { kind: 'join'; circle: AgentCircleCard };

export default function Agent() {
  const [query, setQuery] = useState('');
  const [circles, setCircles] = useState<AgentCircleCard[]>([]);
  const [posts, setPosts] = useState<AgentPostCard[]>([]);
  const [status, setStatus] = useState('正在读取你的资料状态…');
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [agentReply, setAgentReply] = useState('');

  useEffect(() => {
    void getAgentStatus().then(({ profile, questionnaire }) => {
      if (!profile.profileComplete) setStatus(`资料还缺少 ${profile.missingFields.length} 项，我可以帮你定位。`);
      else if (!questionnaire.complete || questionnaire.needsUpdate) setStatus('资料已就绪，问卷需要完成或更新。');
      else setStatus('资料与问卷均已就绪，可以搜索圈子、论坛或准备帖子。');
    }).catch(() => setStatus('暂时无法读取状态，请稍后重试。'));
  }, []);

  async function search() {
    if (!query.trim()) return;
    setBusy(true); setNotice('');
    try {
      const result = await chatWithAgent(query.trim());
      setCircles(result.circles); setPosts(result.posts); setAgentReply(result.reply);
      setNotice(`Agent 已结合 ${result.circles.length} 个圈子和 ${result.posts.length} 篇帖子完成回答。`);
    } catch { setNotice('Agent 暂时无法回答，请检查 LLM 配置或稍后重试。'); }
    finally { setBusy(false); }
  }

  async function makeDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await createAgentDraft({
        title: String(form.get('title')), content: String(form.get('content')),
        type: String(form.get('type')), isAnonymous: form.get('anonymous') === 'on',
      });
      setDraft(result.draft); setNotice('草稿已生成。发布前你仍可检查内容。');
    } catch { setNotice('草稿生成失败，请检查标题和正文。'); }
    finally { setBusy(false); }
  }

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'publish') {
        const confirmation = await requestAgentConfirmation('publish_post', pending.draft.draftId);
        const result = await publishAgentDraft(pending.draft.draftId, confirmation.confirmationToken);
        setDraft(null); setNotice(`帖子已发布：${result.postId}`);
      } else {
        const confirmation = await requestAgentConfirmation('join_circle', pending.circle.id);
        await joinAgentCircle(pending.circle.id, confirmation.confirmationToken);
        setNotice(`已提交加入“${pending.circle.name}”的请求。`);
      }
      setPending(null);
    } catch { setNotice('操作未完成，确认凭据可能已过期，请重试。'); }
    finally { setBusy(false); }
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className="agent-page">
      <motion.header className="agent-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <Link to="/dashboard" className="agent-back">← 返回主页</Link>
        <span className="agent-kicker">NJU Match Agent</span>
        <h1>把想认识的人和想参与的事，说给我听。</h1>
        <p>{status}</p>
        <div className="agent-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} placeholder="例如：想找人工智能方向的学习搭子" aria-label="搜索圈子和论坛" />
          <button className="agent-button" type="button" onClick={() => void search()} disabled={busy}>开始查找</button>
        </div>
        {notice && <div className="agent-notice" role="status">{notice}</div>}
        {agentReply && <div className="agent-reply" aria-live="polite"><span>Agent 回答</span><p>{agentReply}</p></div>}
      </motion.header>

      {(circles.length > 0 || posts.length > 0) && <motion.section className="agent-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <div className="agent-section__heading"><span>为你整理</span><h2>搜索结果</h2></div>
        <div className="agent-grid">
          {circles.map((circle) => <AgentResultCard key={circle.id} eyebrow="圈子" title={circle.name} description={circle.description} meta={`${circle.memberCount} 位成员 · ${circle.category}`} action={<button type="button" onClick={() => setPending({ kind: 'join', circle })}>申请加入</button>} />)}
          {posts.map((post) => <AgentResultCard key={post.postId} eyebrow="论坛" title={post.title} description={post.summary ?? '暂无摘要'} meta={`${post.likeCount} 赞 · ${post.commentCount} 条评论`} action={<Link to={`/forum/${post.postId}`}>查看帖子</Link>} />)}
        </div>
      </motion.section>}

      <motion.section className="agent-section agent-compose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12 }}>
        <div className="agent-section__heading"><span>先形成草稿，再由你决定</span><h2>准备一篇帖子</h2></div>
        <form onSubmit={(event) => void makeDraft(event)}>
          <input name="title" required maxLength={100} placeholder="帖子标题" />
          <textarea name="content" required maxLength={10000} rows={5} placeholder="告诉大家你想交流什么…" />
          <div className="agent-form-row">
            <select name="type" defaultValue="general"><option value="general">日常交流</option><option value="squad">寻找搭子</option><option value="help">求助</option><option value="activity">活动</option><option value="trade">闲置</option></select>
            <label><input name="anonymous" type="checkbox" /> 匿名发布</label>
            <button className="agent-button" disabled={busy}>生成草稿</button>
          </div>
        </form>
        {draft && <div className="agent-draft"><span>未发布草稿</span><h3>{draft.title}</h3><p>{draft.content}</p><button className="agent-button" type="button" onClick={() => setPending({ kind: 'publish', draft })}>检查无误，准备发布</button></div>}
      </motion.section>

      <AgentConfirmDialog open={pending !== null} busy={busy} title={pending?.kind === 'publish' ? '确认发布这篇帖子？' : `确认申请加入“${pending?.kind === 'join' ? pending.circle.name : ''}”？`} description="该操作会产生真实的账户变更。确认凭据只对本次操作有效，取消不会产生任何副作用。" onCancel={() => setPending(null)} onConfirm={() => void confirmAction()} />
    </main>
    </MotionConfig>
  );
}
