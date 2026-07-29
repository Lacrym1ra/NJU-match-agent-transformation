import { useCallback } from 'react';
import type { UploadScene, UploadMediaResult } from '../../api/upload';
import { uploadMedia } from '../../api/upload';

/**
 * Unified media upload hook.
 * Provides `uploadImage` and `uploadVoice` that auto-inject the scene context.
 * The parent only needs to call these — no knowledge of upload internals required.
 */
export function useMediaUpload(scene: UploadScene) {
  const uploadImage = useCallback(
    async (file: File): Promise<UploadMediaResult> => {
      return uploadMedia(file, { scene });
    },
    [scene],
  );

  const uploadVoice = useCallback(
    async (blob: Blob): Promise<UploadMediaResult> => {
      return uploadMedia(blob, { scene, filename: 'recording.webm' });
    },
    [scene],
  );

  return { uploadImage, uploadVoice };
}
