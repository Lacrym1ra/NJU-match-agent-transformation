import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import NavBar from '../components/NavBar';
import {
  createMeetupSafetyPlan, listMeetupSafetyPlans, transitionMeetupSafetyPlan,
  type MeetupSafetyPlan,
} from '../api/meetupSafety';
import { useToast } from '../components/Toast';
import './ProjectBModules.css';

const labels: Record<MeetupSafetyPlan['status'], string> = {
  scheduled: '等待本人签到', checked_in: '已经抵达', completed: '平安结束', cancelled: '已取消', overdue: '已超过预计时间',
};

export default function MeetupSafety() {
  const toast = useToast();
  const [plans, setPlans] = useState<MeetupSafetyPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setPlans((await listMeetupSafetyPlans()).plans); }
    catch (error) { toast.error(error instanceof Error ? error.message : '读取计划失败'); }
  }, [toast]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await createMeetupSafetyPlan({
        title: String(data.get('title')), meetingPlace: String(data.get('meetingPlace')),
        meetingAt: new Date(String(data.get('meetingAt'))).toISOString(),
        expectedEndAt: new Date(String(data.get('expectedEndAt'))).toISOString(),
        note: String(data.get('note') ?? ''),
      });
      form.reset(); await refresh(); toast.success('安心赴约计划已创建');
    } catch (error) { toast.error(error instanceof Error ? error.message : '创建失败'); }
    finally { setBusy(false); }
  }
  async function transition(id: string, action: 'check_in' | 'complete' | 'cancel') {
    setBusy(true);
    try { await transitionMeetupSafetyPlan(id, action); await refresh(); toast.success('计划状态已更新'); }
    catch (error) { toast.error(error instanceof Error ? error.message : '状态更新失败'); }
    finally { setBusy(false); }
  }

  return <div className="pb-page"><NavBar /><main className="pb-shell">
    <motion.header className="pb-hero pb-hero--safety" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
      <p className="pb-kicker">PROJECT B / MEETUP SAFETY</p><h1>出发前留下一份计划，<br />抵达与结束都由你确认。</h1>
      <p>“安心赴约”是本阶段独立新增的私有计划模块。地点与备注只对当前账号可见；它提供自助签到，不替代紧急求助或报警服务。</p>
    </motion.header>
    <section className="pb-two-column pb-two-column--safety">
      <form className="pb-panel" onSubmit={create}>
        <span className="pb-number">01</span><h2>制定计划</h2>
        <label>计划标题<input name="title" required maxLength={100} placeholder="例如：先锋书店见面" /></label>
        <label>约定的公共地点<input name="meetingPlace" required maxLength={200} placeholder="尽量填写公开、有人流的场所" /></label>
        <div className="pb-date-row"><label>见面时间<input name="meetingAt" type="datetime-local" required /></label><label>预计结束<input name="expectedEndAt" type="datetime-local" required /></label></div>
        <label>给自己的备注<textarea name="note" maxLength={500} placeholder="可选；不要填写他人的敏感身份信息" /></label>
        <button className="pb-primary" disabled={busy}>保存私有计划</button>
      </form>
      <aside className="pb-principles"><p className="pb-kicker">BOUNDARY</p><h2>三条清楚的边界</h2><ol><li><strong>本人签到</strong><span>Agent 可以创建草案，但不能代替你抵达或结束。</span></li><li><strong>账号私有</strong><span>计划不进入论坛、圈子或其他用户资料。</span></li><li><strong>不是应急服务</strong><span>遇到危险请直接联系警方、校方或可信联系人。</span></li></ol></aside>
    </section>
    <section className="pb-list-section"><div className="pb-section-heading"><div><p className="pb-kicker">MY PLANS</p><h2>我的赴约计划</h2></div><span>{plans.length} 份</span></div>
      <div className="pb-card-grid">{plans.map((plan, index) => <motion.article className={`pb-card pb-card--${plan.status}`} key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: index * .05 }}>
        <span>{labels[plan.status]}</span><h3>{plan.title}</h3><p>{plan.meetingPlace}</p>
        <small>{new Date(plan.meetingAt).toLocaleString('zh-CN')} — {new Date(plan.expectedEndAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small>
        <div className="pb-actions">{['scheduled', 'overdue'].includes(plan.status) && <button onClick={() => transition(plan.id, 'check_in')} disabled={busy}>我已抵达</button>}{plan.status === 'checked_in' && <button onClick={() => transition(plan.id, 'complete')} disabled={busy}>平安结束</button>}{['scheduled', 'checked_in', 'overdue'].includes(plan.status) && <button onClick={() => transition(plan.id, 'cancel')} disabled={busy}>取消</button>}</div>
      </motion.article>)}{plans.length === 0 && <div className="pb-empty">还没有计划。第一次使用时，可以先创建一份短时测试计划。</div>}</div>
    </section>
  </main></div>;
}
