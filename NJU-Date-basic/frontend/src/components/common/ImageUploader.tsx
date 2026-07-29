import { useRef } from 'react';
import { useMediaUpload } from '../../shared/hooks/useMediaUpload';
import type { UploadScene } from '../../api/upload';
import { toast } from '../Toast';

// ─── Types ────────────────────────────────────────────────────────

let nextId = 1;
export function nextPreviewId(): string {
  return `img_${Date.now()}_${nextId++}`;
}

export interface ImagePreview {
  id: string;
  file?: File;
  previewUrl: string;
  uploading: boolean;
  uploadedUrl?: string;
  error?: string;
}

// ─── Props ────────────────────────────────────────────────────────

interface ImageUploaderProps {
  /** List of image previews (controlled) */
  value: ImagePreview[];
  /** Called when the list changes — accepts new array or React setState updater */
  onChange: (previews: ImagePreview[] | ((prev: ImagePreview[]) => ImagePreview[])) => void;
  /** Max number of images (default 9) */
  maxCount?: number;
  /** Max single file size in MB (default 5) */
  maxSizeMB?: number;
  /** Upload scene for cloud storage routing */
  scene: UploadScene;
  /** Disabled state (e.g. while submitting) */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

export default function ImageUploader({
  value,
  onChange,
  maxCount = 9,
  maxSizeMB = 5,
  scene,
  disabled = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage } = useMediaUpload(scene);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // ── File selection ──────────────────────────────────────────────

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remaining = maxCount - value.length;
    const files = Array.from(fileList).slice(0, remaining);

    const newPreviews: ImagePreview[] = files.map((file) => {
      if (!file.type.startsWith('image/')) {
        return {
          id: nextPreviewId(),
          file,
          previewUrl: '',
          uploading: false,
          error: '不支持的文件类型',
        };
      }
      if (file.size > maxSizeBytes) {
        return {
          id: nextPreviewId(),
          file,
          previewUrl: '',
          uploading: false,
          error: `图片超过 ${maxSizeMB}MB 限制`,
        };
      }
      return {
        id: nextPreviewId(),
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: true,
      };
    });

    onChange([...value, ...newPreviews]);

    // Upload each valid image asynchronously (Promise-based to avoid Babel await issue)
    newPreviews.forEach((preview) => {
      if (preview.error || !preview.file) return;
      void (async () => {
        try {
          const result = await uploadImage(preview.file!);
          onChange((prev) =>
            prev.map((p) =>
              p.id === preview.id
                ? { ...p, uploading: false, uploadedUrl: result.url }
                : p,
            ),
          );
        } catch {
          onChange((prev) =>
            prev.map((p) =>
              p.id === preview.id
                ? { ...p, uploading: false, error: '上传失败' }
                : p,
            ),
          );
        }
      })();
    });
  };

  // ── Remove ──────────────────────────────────────────────────────

  const removeImage = (id: string) => {
    onChange((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl && target.file) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  // ── Derived state ───────────────────────────────────────────────

  const hasUploading = value.some((p) => p.uploading);
  const uploadedUrls = value.filter((p) => p.uploadedUrl).map((p) => p.uploadedUrl!);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((img) => (
          <div
            key={img.id}
            className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#EAE7E1] group/img"
          >
            {img.error ? (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-red-500 text-center p-1">
                {img.error}
              </div>
            ) : img.previewUrl ? (
              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
            {img.uploading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#420047] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute inset-0 m-auto w-6 h-6 bg-black/40 text-white rounded-full items-center justify-center text-xs hidden group-hover/img:flex"
                aria-label="删除图片"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {value.length < maxCount && !disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-[#8B7355]/30 hover:border-[#420047]/40 flex items-center justify-center text-[#8B7355]/50 hover:text-[#420047]/60 transition-colors"
            aria-label="添加图片"
          >
            <span className="text-2xl">+</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="text-[10px] text-[#8B7355]/50">
        支持 JPG/PNG/WebP，单张 ≤ {maxSizeMB}MB，最多 {maxCount} 张
      </p>
    </div>
  );
}

// ─── Helpers exported for parent convenience ──────────────────────

/** Derive uploaded URLs from preview list */
export function getUploadedUrls(previews: ImagePreview[]): string[] {
  return previews.filter((p) => p.uploadedUrl).map((p) => p.uploadedUrl!);
}

/** Check if any preview is still uploading */
export function hasUploading(previews: ImagePreview[]): boolean {
  return previews.some((p) => p.uploading);
}
