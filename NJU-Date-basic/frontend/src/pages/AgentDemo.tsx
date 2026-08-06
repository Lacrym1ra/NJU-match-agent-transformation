import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import AgentConfirmDialog from '../components/agent/AgentConfirmDialog';
import AgentResultCard from '../components/agent/AgentResultCard';
import './Agent.css';

const demoCircles = [
  { id: 'demo-ai', name: 'AI 学习交流圈', description: '讨论 Agent、LLM 应用与 AI 工程实践。', meta: '128 位成员 · 学习' },
  { id: 'demo-badminton', name: '仙林羽毛球搭子', description: '寻找周末球友，新手和进阶玩家都欢迎。', meta: '86 位成员 · 运动' },
];

const demoPosts = [
  { id: 'demo-post-1', title: '周末 Agent Harness 讨论', description: '想找几位同学一起交流工具调用、反馈循环和 HITL。', meta: '12 赞 · 8 条评论' },
  { id: 'demo-post-2', title: '仙林周六羽毛球缺两人', description: '下午三点到五点，水平不限，可现场组队。', meta: '7 赞 · 5 条评论' },
];

export default function AgentDemo() {
  const [query, setQuery] = useState('想找 AI 学习搭子');
  const [searched, setSearched] = useState(false);
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDraft({ title: String(form.get('title')), content: String(form.get('content')) });
    setNotice('演示草稿已生成；没有写入数据库。');
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className="agent-page">
      <motion.header className="agent-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <Link to="/" className="agent-back">← 返回首页</Link>
        <span className="agent-kicker">NJU Match Agent · 安全演示</span>
        <h1>无需登录，体验 Agent 的交互流程。</h1>
        <p>此页面只使用固定 Mock 数据，不读取账户信息，也不会真正发布帖子或加入圈子。</p>
        <div className="agent-search">
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="演示搜索" />
          <button className="agent-button" type="button" onClick={() => { setSearched(true); setNotice('已完成 Mock 搜索。'); }}>演示查找</button>
        </div>
        {notice && <div className="agent-notice" role="status">{notice}</div>}
      </motion.header>

      {searched && <motion.section className="agent-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <div className="agent-section__heading"><span>固定测试数据</span><h2>结果卡片</h2></div>
        <div className="agent-grid">
          {demoCircles.map((circle) => <AgentResultCard key={circle.id} eyebrow="圈子 Demo" title={circle.name} description={circle.description} meta={circle.meta} action={<button type="button" onClick={() => setConfirmation(`申请加入“${circle.name}”`)}>模拟加入</button>} />)}
          {demoPosts.map((post) => <AgentResultCard key={post.id} eyebrow="论坛 Demo" title={post.title} description={post.description} meta={post.meta} action={<button type="button" onClick={() => setNotice('演示帖子没有真实详情页。')}>查看演示</button>} />)}
        </div>
      </motion.section>}

      <motion.section className="agent-section agent-compose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12 }}>
        <div className="agent-section__heading"><span>零副作用演示</span><h2>准备一篇帖子</h2></div>
        <form onSubmit={createDraft}>
          <input name="title" required maxLength={100} defaultValue="寻找 Agent 学习搭子" />
          <textarea name="content" required maxLength={10000} rows={5} defaultValue="想在周末一起讨论 Agent Harness 和工具调用。" />
          <div className="agent-form-row">
            <select aria-label="帖子类型" defaultValue="squad"><option value="squad">寻找搭子</option></select>
            <span>演示页面不会调用后端</span>
            <button className="agent-button">生成演示草稿</button>
          </div>
        </form>
        {draft && <div className="agent-draft"><span>Mock 草稿 · 未发布</span><h3>{draft.title}</h3><p>{draft.content}</p><button className="agent-button" type="button" onClick={() => setConfirmation('发布这篇演示帖子')}>模拟发布确认</button></div>}
      </motion.section>

      <AgentConfirmDialog open={confirmation !== null} title={`确认${confirmation ?? ''}？`} description="这是纯前端演示。点击确认只会展示成功提示，不会请求后端或改变任何账户数据。" onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); setNotice('已完成确认交互演示；没有产生真实副作用。'); }} />
    </main>
    </MotionConfig>
  );
}
