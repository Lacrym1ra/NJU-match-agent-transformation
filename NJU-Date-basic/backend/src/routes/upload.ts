import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromFile } from 'file-type';
import { requireAuth } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

// ─── Constants ────────────────────────────────────────────────────

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VOICE_SIZE = 3 * 1024 * 1024;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VOICE_TYPES = [
  'audio/webm', 'video/webm', 'audio/mp4', 'audio/x-m4a',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/ogg; codecs=opus',
];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VOICE_TYPES];

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'audio/webm': '.webm', 'video/webm': '.webm', 'audio/mp4': '.mp4',
  'audio/x-m4a': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav',
  'audio/ogg': '.ogg', 'audio/ogg; codecs=opus': '.opus',
};

interface SceneConfig {
  imageMaxSize: number;
  voiceMaxSize: number;
  subPath: string;
}

const SCENE_CONFIG: Record<string, SceneConfig> = {
  post:    { imageMaxSize: MAX_IMAGE_SIZE, voiceMaxSize: MAX_VOICE_SIZE, subPath: 'posts' },
  comment: { imageMaxSize: MAX_IMAGE_SIZE, voiceMaxSize: MAX_VOICE_SIZE, subPath: 'comments' },
  message: { imageMaxSize: MAX_IMAGE_SIZE, voiceMaxSize: MAX_VOICE_SIZE, subPath: 'messages' },
  avatar:  { imageMaxSize: MAX_AVATAR_SIZE, voiceMaxSize: 0,             subPath: 'avatars' },
};

// ─── Helpers ──────────────────────────────────────────────────────

export function safeExtension(mime: string, fallback: string): string {
  return MIME_TO_EXT[mime] ?? fallback;
}

function classifyMime(mime: string): 'image' | 'voice' {
  return mime.startsWith('image/') ? 'image' : 'voice';
}

function fileFilter(allowedTypes: string[]) {
  return (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError(`不支持的文件类型: ${file.mimetype}`));
  };
}

export async function verifyFileMagic(
  filePath: string,
  declaredMime: string,
  allowedMimes: string[],
): Promise<string> {
  const detected = await fileTypeFromFile(filePath);
  if (!detected || !allowedMimes.includes(detected.mime)) {
    await fs.unlink(filePath).catch(() => {});
    throw new ValidationError(
      detected
        ? `文件类型校验失败：声明为 ${declaredMime}，实际检测为 ${detected.mime}`
        : '无法识别文件类型',
    );
  }
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const safeExt = `.${detected.ext}`;
  if (path.extname(filePath) !== safeExt) {
    const newPath = path.join(dir, `${base}${safeExt}`);
    await fs.rename(filePath, newPath);
    return path.basename(newPath);
  }
  return path.basename(filePath);
}

// ─── Single-file upload handler (scene is already resolved) ───────

async function handleUpload(
  req: any, res: any, file: Express.Multer.File,
  allowedTypes: string[], typeMaxSize: number,
  finalSubPath: string, mediaType: 'image' | 'voice',
): Promise<void> {
  // Size check
  if (file.size > (typeMaxSize || MAX_IMAGE_SIZE)) {
    await fs.unlink(file.path).catch(() => {});
    const limitMB = Math.round((typeMaxSize || MAX_IMAGE_SIZE) / (1024 * 1024));
    res.status(400).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: `${mediaType === 'image' ? '图片' : '语音'}不能超过 ${limitMB}MB`,
      },
    });
    return;
  }

  // Move to media-type subdirectory
  const targetDir = path.join(UPLOADS_ROOT, finalSubPath, mediaType === 'image' ? 'images' : 'voice');
  await fs.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, file.filename);
  await fs.rename(file.path, targetPath);

  // Magic-number verification
  let finalFilename = file.filename;
  finalFilename = await verifyFileMagic(targetPath, file.mimetype, allowedTypes);

  const url = `/api/v1/uploads/${finalSubPath}/${mediaType === 'image' ? 'images' : 'voice'}/${finalFilename}`;
  res.status(201).json({ url, mimeType: file.mimetype });
}

// ─── Builder: create an Express handler for a (possibly deferred) scene ─

function uploadHandler(getScene: (req: any) => string): RequestHandler {
  return async (req, res, next) => {
    // Resolve scene NOW — req.query is always available at this point
    const scene = getScene(req);
    const cfg = SCENE_CONFIG[scene];
    if (!cfg) {
      res.status(400).json({ error: { code: 'INVALID_SCENE', message: `无效的 scene: ${scene}` } });
      return;
    }

    const dest = path.join(UPLOADS_ROOT, cfg.subPath);

    try {
      await fs.mkdir(dest, { recursive: true });

      const storage = multer.diskStorage({
        destination(_req, _file, cb) { cb(null, dest); },
        filename(_req, f, cb) { cb(null, `${uuidv4()}${safeExtension(f.mimetype, '.bin')}`); },
      });

      const up = multer({
        storage,
        limits: { fileSize: Math.max(cfg.imageMaxSize, cfg.voiceMaxSize || MAX_IMAGE_SIZE) },
        fileFilter: fileFilter(ALL_ALLOWED_TYPES),
      });

      up.single('file')(req, res, (err: any) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: '文件大小超出限制' } });
              return;
            }
            res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
            return;
          }
          next(err);
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: { code: 'NO_FILE', message: '请选择文件' } });
          return;
        }

        const mediaType = classifyMime(req.file.mimetype);
        const allowedTypes = mediaType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VOICE_TYPES;
        const typeMaxSize = mediaType === 'image' ? cfg.imageMaxSize : cfg.voiceMaxSize;

        handleUpload(req, res, req.file, allowedTypes, typeMaxSize, cfg.subPath, mediaType)
          .catch(next);
      });
    } catch (err) {
      next(err);
    }
  };
}

// ─── Router ───────────────────────────────────────────────────────

const router = Router();

// POST /upload/media?scene=xxx — unified, reads scene from req.query
router.post('/media', requireAuth, uploadHandler((req) => (req.query.scene as string) || 'general'));

// POST /upload/image — legacy alias (scene=post)
router.post('/image', requireAuth, uploadHandler(() => 'post'));

// POST /upload/voice — legacy alias (scene=comment)
router.post('/voice', requireAuth, uploadHandler(() => 'comment'));

export default router;
