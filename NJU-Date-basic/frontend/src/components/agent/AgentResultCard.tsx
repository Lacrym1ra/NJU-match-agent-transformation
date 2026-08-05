import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
  action?: ReactNode;
}

export default function AgentResultCard({ eyebrow, title, description, meta, action }: Props) {
  return (
    <motion.article className="agent-result-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -6 }} transition={{ duration: 0.8 }}>
      <span className="agent-result-card__eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <footer>
        <span>{meta}</span>
        {action}
      </footer>
    </motion.article>
  );
}
