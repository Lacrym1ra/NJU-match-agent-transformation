import { useEffect, useState } from 'react';
import { setToken } from '../api/token';
import './Agent.css';

export default function AgentLocalEntry() {
  const [message, setMessage] = useState('正在创建本地测试会话…');

  useEffect(() => {
    void fetch('/api/v1/auth/dev-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'agent-local@test.local' }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Local development endpoint is disabled');
      const result = await response.json() as { token: string };
      setToken(result.token);
      window.location.replace('/agent');
    }).catch(() => {
      setMessage('本地测试入口未启用。请确认 .env.local-test 中 NODE_ENV=development。');
    });
  }, []);

  return <main className="agent-page"><section className="agent-hero"><span className="agent-kicker">Local Agent Test</span><h1>{message}</h1></section></main>;
}
