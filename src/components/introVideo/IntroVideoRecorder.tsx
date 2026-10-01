import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, Circle, RotateCcw, Square } from 'lucide-react';
import { INTRO_VIDEO_MAX_BYTES, INTRO_VIDEO_MAX_SECONDS } from '../../lib/firestore/introVideos';
import { getMediaErrorMessage } from '../../lib/callUtils';
import './IntroVideo.css';

// Low bitrates keep a full minute around 4 MB, small enough to store in Firestore.
const VIDEO_BITS_PER_SECOND = 450_000;
const AUDIO_BITS_PER_SECOND = 48_000;
const PREFERRED_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

type Phase = 'idle' | 'preview' | 'recording' | 'recorded';

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return PREFERRED_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

interface IntroVideoRecorderProps {
  disabled?: boolean;
  /** Called with the finished clip when the student chooses "Use this video". */
  onRecorded: (file: File) => void;
}

/** Record a short introduction with the camera: preview, record up to 60 s, review, retake or use. */
export function IntroVideoRecorder({ disabled = false, onRecorded }: IntroVideoRecorderProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => {
    clearTimer();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopCamera();
  }, []);

  const playbackUrl = useMemo(() => (recording ? URL.createObjectURL(recording) : ''), [recording]);
  useEffect(() => () => { if (playbackUrl) URL.revokeObjectURL(playbackUrl); }, [playbackUrl]);

  // Show the live camera while previewing or recording.
  useEffect(() => {
    if ((phase === 'preview' || phase === 'recording') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  const startCamera = async () => {
    setError('');
    if (pickMimeType() === null) {
      setError('Your browser cannot record video. Use the latest Chrome, Edge or Firefox.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });
      setRecording(null);
      setPhase('preview');
    } catch (cameraError) {
      setError(getMediaErrorMessage(cameraError));
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    const mimeType = pickMimeType();
    if (!stream || mimeType === null) return;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.onstop = () => {
      clearTimer();
      stopCamera();
      const type = (recorder.mimeType || mimeType || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      if (blob.size > INTRO_VIDEO_MAX_BYTES) {
        setError('That recording is too large to save. Please record again, a little shorter.');
        setPhase('idle');
        return;
      }
      setRecording(new File([blob], `introduction.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type }));
      setPhase('recorded');
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setElapsed(0);
    setPhase('recording');
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(Math.min(seconds, INTRO_VIDEO_MAX_SECONDS));
      if (seconds >= INTRO_VIDEO_MAX_SECONDS && recorder.state === 'recording') recorder.stop();
    }, 250);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const retake = () => {
    setRecording(null);
    void startCamera();
  };

  const useRecording = () => {
    if (!recording) return;
    onRecorded(recording);
    setRecording(null);
    setPhase('idle');
  };

  return (
    <div className="intro-recorder">
      {phase === 'idle' && (
        <div className="intro-recorder-start">
          <p>Record a short hello: who you are, what you can teach and what you want to learn. Up to {INTRO_VIDEO_MAX_SECONDS} seconds.</p>
          <button type="button" className="intro-recorder-btn primary" onClick={() => void startCamera()} disabled={disabled}>
            <Camera size={16} /> Record introduction
          </button>
        </div>
      )}

      {(phase === 'preview' || phase === 'recording') && (
        <div className="intro-recorder-stage">
          <video ref={videoRef} autoPlay muted playsInline className="intro-recorder-video mirrored" />
          {phase === 'recording' && (
            <span className="intro-recorder-timer" aria-live="polite"><span className="intro-recorder-dot" />{formatSeconds(elapsed)} / {formatSeconds(INTRO_VIDEO_MAX_SECONDS)}</span>
          )}
          <div className="intro-recorder-actions">
            {phase === 'preview' ? (
              <>
                <button type="button" className="intro-recorder-btn danger" onClick={startRecording}><Circle size={16} /> Start recording</button>
                <button type="button" className="intro-recorder-btn" onClick={() => { stopCamera(); setPhase('idle'); }}>Cancel</button>
              </>
            ) : (
              <button type="button" className="intro-recorder-btn" onClick={stopRecording}><Square size={14} /> Stop</button>
            )}
          </div>
        </div>
      )}

      {phase === 'recorded' && playbackUrl && (
        <div className="intro-recorder-stage">
          <video src={playbackUrl} controls playsInline className="intro-recorder-video" />
          <div className="intro-recorder-actions">
            <button type="button" className="intro-recorder-btn primary" onClick={useRecording}><Check size={16} /> Use this video</button>
            <button type="button" className="intro-recorder-btn" onClick={retake}><RotateCcw size={15} /> Retake</button>
          </div>
        </div>
      )}

      {error && <p className="intro-recorder-error" role="alert">{error}</p>}
    </div>
  );
}
