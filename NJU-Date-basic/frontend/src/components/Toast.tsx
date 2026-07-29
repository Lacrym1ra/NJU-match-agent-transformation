import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

// ─── Types ─────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number; // ms, 0 = persist
}

interface ToastContextType {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

// ─── Module-level bus (allows imperative API from non-React code) ──

type BusFn = (message: string, type: ToastType, duration?: number) => void;
let _bus: BusFn | null = null;

export const toastBus = {
  register(fn: BusFn) { _bus = fn; },
  unregister() { _bus = null; },
  emit(message: string, type: ToastType = 'info', duration?: number) {
    _bus?.(message, type, duration);
  },
};

/** Imperative API — usable outside React (e.g. api/client.ts) */
export const toast = {
  show: (message: string, type: ToastType = 'info', duration?: number) =>
    toastBus.emit(message, type, duration),
  success: (message: string, duration?: number) => toastBus.emit(message, 'success', duration),
  error: (message: string, duration?: number) => toastBus.emit(message, 'error', duration),
  warning: (message: string, duration?: number) => toastBus.emit(message, 'warning', duration),
  info: (message: string, duration?: number) => toastBus.emit(message, 'info', duration),
};

// ─── Context & Hook ────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Toast item style config ────────────────────────────────────────

const CONFIG: Record<ToastType, { icon: string; iconColor: string }> = {
  success: { icon: 'check_circle', iconColor: 'text-emerald-500' },
  error:   { icon: 'error',        iconColor: 'text-rose-500' },
  warning: { icon: 'warning',      iconColor: 'text-amber-500' },
  info:    { icon: 'info',         iconColor: 'text-[#8B7355]' },
};

// ─── Provider ──────────────────────────────────────────────────────

let _nextId = 0;
const MAX_TOASTS = 5;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = ++_nextId;
    setToasts(prev => {
      const next = [...prev, { id, message, type, duration }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }
  }, [dismiss]);

  // Register imperative bus
  useEffect(() => {
    toastBus.register(show);
    return () => toastBus.unregister();
  }, [show]);

  const ctx = useMemo<ToastContextType>(() => ({
    show,
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info', dur),
  }), [show]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Toast stack — centered on mobile, bottom-right on desktop */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-8 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[9999] flex flex-col items-center sm:items-end gap-3 w-max max-w-[90vw] sm:max-w-sm pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const { icon, iconColor } = CONFIG[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 1.2 }}
                className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#EAE7E1]/80 bg-[#FCFBF8]/95 backdrop-blur-md shadow-[0_8px_30px_rgb(139,115,85,0.08)] px-5 py-3 min-w-min"
              >
                <MaterialIcon name={icon} className={`flex-shrink-0 text-[22px] ${iconColor}`} />
                <p className="flex-1 text-[14px] font-medium text-[#2C2825] leading-snug">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="flex-shrink-0 ml-1 text-[#BEB2A0] hover:text-[#8B7355] transition-colors"
                  aria-label="关闭提示"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
