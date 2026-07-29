import { useState, useRef, useCallback } from 'react';
import MaterialIcon from '../MaterialIcon';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSec: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  iconClassName?: string;
}

type RecorderState = 'idle' | 'recording' | 'done';

export default function VoiceRecorder({
  onRecordingComplete,
  disabled,
  label = '录制语音',
  className = 'inline-flex items-center gap-1 text-xs text-[#8B7355] hover:text-[#420047] transition-colors disabled:opacity-50',
  iconClassName = 'text-[16px] leading-none',
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const startRecording = async () => {
    setError(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
        setDuration(dur);
        setState('done');
        onRecordingComplete(blob, dur);
      };

      recorder.start();
      startTimeRef.current = Date.now();
      setState('recording');

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许');
      } else {
        setError('无法访问麦克风，请检查设备');
      }
    }
  };

  const handleStop = () => {
    stopRecording();
  };

  const reset = () => {
    setState('idle');
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  };

  if (error) {
    return (
      <div className="text-xs text-red-500 py-1">{error}</div>
    );
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8B7355]">
          语音已录制 ({duration}s)
        </span>
        <button
          onClick={reset}
          className="text-xs text-[#8B7355] hover:text-[#420047] transition-colors"
        >
          重新录制
        </button>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs text-[#8B7355] tabular-nums">
            {duration}s
          </span>
        </div>
        <button
          onClick={handleStop}
          className="px-3 py-1 rounded-full bg-[#420047] text-[#FCFBF8] text-xs hover:bg-[#2A002D] transition-colors"
        >
          停止录音
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className={className}
    >
      <MaterialIcon name="mic" className={iconClassName} />
      {label}
    </button>
  );
}
