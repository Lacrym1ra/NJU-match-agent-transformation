import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';

interface ImageLightboxProps {
  open: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  showNav?: boolean;
}

export default function ImageLightbox({
  open,
  imageUrl,
  onClose,
  onPrev,
  onNext,
  showNav = false,
}: ImageLightboxProps) {
  if (!open || !imageUrl) return null;

  const lightbox = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white text-2xl hover:opacity-70 transition-opacity z-10"
        aria-label="关闭大图"
      >
        ✕
      </button>

      {showNav && onPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 text-white text-3xl hover:opacity-70 transition-opacity z-10"
          aria-label="上一张"
        >
          ‹
        </button>
      )}

      <motion.img
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.2 }}
        src={imageUrl}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-md"
        onClick={(e) => e.stopPropagation()}
      />

      {showNav && onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 text-white text-3xl hover:opacity-70 transition-opacity z-10"
          aria-label="下一张"
        >
          ›
        </button>
      )}
    </motion.div>
  );

  return createPortal(lightbox, document.body);
}
