import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  icon?: string;
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setOptions(nextOptions);
  }), []);

  useEffect(() => () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const isDanger = options?.tone === 'danger';
  const confirmDialog = (
    <AnimatePresence>
      {options && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[#2C2825]/35 px-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => close(false)}
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-[24px] bg-[#FCFBF8] shadow-[0_24px_80px_rgba(44,40,37,0.18),0_0_0_1px_rgba(234,231,225,0.72)]"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4 px-6 pb-5 pt-6">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${isDanger ? 'border-red-900/20 bg-red-50 text-red-900' : 'border-[#420047]/15 bg-[#420047]/5 text-[#420047]'}`}>
                <span className="material-symbols-outlined text-[21px]">
                  {options.icon || (isDanger ? 'warning' : 'help')}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-xl tracking-widest text-[#2C2825]">
                  {options.title || '请确认'}
                </h2>
                <p className="mt-3 text-sm font-serif leading-relaxed text-[#8B7355]">
                  {options.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#EAE7E1]/65 bg-[#F7F4EF]/45 px-6 py-4">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-full border border-[#EAE7E1]/90 bg-[#FCFBF8] px-5 py-2 text-sm font-serif tracking-widest text-[#8B7355] transition hover:bg-white hover:text-[#2C2825]"
              >
                {options.cancelText || '取消'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-full px-5 py-2 text-sm font-serif tracking-widest text-white shadow-sm transition hover:-translate-y-0.5 ${isDanger ? 'bg-red-900 hover:bg-red-800' : 'bg-[#420047] hover:bg-[#5C0064]'}`}
              >
                {options.confirmText || '确认'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { confirm, confirmDialog };
}
