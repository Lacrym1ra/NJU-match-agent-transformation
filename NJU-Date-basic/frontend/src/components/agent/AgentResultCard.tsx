import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
  action?: ReactNode;
}

export default function AgentResultCard({ eyebrow, title, description, meta, action }: Props) {
  return (
    <article className="agent-result-card">
      <span className="agent-result-card__eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <footer>
        <span>{meta}</span>
        {action}
      </footer>
    </article>
  );
}
