import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

function resolveVoicePath(voiceUrl: string): string {
  const filename = voiceUrl.split('/').pop()!;
  return path.join(UPLOADS_ROOT, 'voice', filename);
}

const FORMAT_MAP: Record<string, string> = {
  '.webm': 'webm',
  '.wav': 'wav',
  '.mp3': 'mp3',
  '.mpeg': 'mp3',
  '.mp4': 'mp4',
  '.m4a': 'mp4',
  '.ogg': 'ogg',
  '.oga': 'ogg',
  '.opus': 'ogg',
};

export async function transcribeVoiceFile(voiceUrl: string): Promise<string> {
  const apiKey = config.qwen.apiKey;
  if (!apiKey) {
    throw new Error('DashScope API key not configured');
  }

  const filePath = resolveVoicePath(voiceUrl);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Voice file not found: ${filePath}`);
  }

  const audioBuffer = fs.readFileSync(filePath);
  const base64 = audioBuffer.toString('base64');
  const ext = path.extname(filePath).toLowerCase();
  const format = FORMAT_MAP[ext] || 'webm';

  const response = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'paraformer-v2',
        input: { audio: base64 },
        parameters: { format },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ASR API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as any;

  if (data.output?.text) {
    return data.output.text;
  }
  if (data.output?.sentences) {
    return data.output.sentences.map((s: any) => s.text).join('');
  }

  throw new Error('Unexpected ASR response: ' + JSON.stringify(data));
}
