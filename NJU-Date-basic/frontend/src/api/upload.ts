import { api } from './client';

export type UploadScene = 'post' | 'comment' | 'message' | 'avatar' | 'general';

export interface UploadMediaResult {
  url: string;
  mimeType: string;
}

/** Unified media upload — scene passed as URL query param (readable before body parsing) */
export async function uploadMedia(
  file: File | Blob,
  options: { scene: UploadScene; filename?: string },
): Promise<UploadMediaResult> {
  const formData = new FormData();
  formData.append('file', file, options.filename ?? 'file');
  return api.postForm<UploadMediaResult>(
    `/upload/media?scene=${encodeURIComponent(options.scene)}`,
    formData,
  );
}

// ─── Backward-compatible convenience wrappers ──────────────────────

/** Upload an image. Defaults to scene='post' for backward compatibility. */
export async function uploadImage(file: File, scene: UploadScene = 'post'): Promise<string> {
  const result = await uploadMedia(file, { scene });
  return result.url;
}

/** Upload a voice recording. Defaults to scene='comment' for backward compatibility. */
export async function uploadVoice(blob: Blob, scene: UploadScene = 'comment'): Promise<string> {
  const result = await uploadMedia(blob, { scene, filename: 'recording.webm' });
  return result.url;
}
