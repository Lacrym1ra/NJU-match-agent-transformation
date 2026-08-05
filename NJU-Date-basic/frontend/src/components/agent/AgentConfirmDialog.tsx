import { motion } from 'framer-motion';

interface Props {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export default function AgentConfirmDialog({ open, title, description, busy, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <motion.div className="agent-dialog-backdrop" role="presentation" onMouseDown={onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <motion.section className="agent-dialog" role="dialog" aria-modal="true" aria-labelledby="agent-confirm-title" onMouseDown={(event) => event.stopPropagation()} initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8 }}>
        <span className="agent-dialog__flag">需要你的明确确认</span>
        <h2 id="agent-confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="agent-dialog__actions">
          <button type="button" className="agent-button agent-button--ghost" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="agent-button" onClick={onConfirm} disabled={busy}>{busy ? '正在执行…' : '确认执行'}</button>
        </div>
      </motion.section>
    </motion.div>
  );
}
