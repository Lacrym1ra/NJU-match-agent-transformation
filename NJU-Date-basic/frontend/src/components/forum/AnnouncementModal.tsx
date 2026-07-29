import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAnnouncementDetail, type AnnouncementDetail } from '../../api/forum';
import MaterialIcon from '../MaterialIcon';

interface Props {
  announcementId: string | null;
  onClose: () => void;
}

export default function AnnouncementModal({ announcementId, onClose }: Props) {
  const [detail, setDetail] = useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!announcementId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError('');
    getAnnouncementDetail(announcementId)
      .then(setDetail)
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [announcementId]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <AnimatePresence>
      {announcementId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleBackdrop}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8B7355] hover:text-[#2C2825] hover:bg-[#EAE7E1]/50 transition-colors"
            >
              <MaterialIcon name="close" className="text-[20px]" />
            </button>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-[#8B7355] animate-pulse">加载中...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="py-8 text-center">
                <p className="text-sm text-red-500 mb-3">{error}</p>
                <button
                  onClick={onClose}
                  className="text-xs text-[#8B7355] hover:text-[#2C2825] underline"
                >
                  关闭
                </button>
              </div>
            )}

            {/* Content */}
            {detail && !loading && (
              <>
                <h2 className="text-xl font-serif text-[#2C2825] tracking-wide pr-8 mb-3">
                  {detail.title}
                </h2>
                <p className="text-xs text-[#8B7355]/60 mb-5">
                  {new Date(detail.createdAt).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <div className="text-sm text-[#5E5855] leading-relaxed whitespace-pre-wrap">
                  {detail.content}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
