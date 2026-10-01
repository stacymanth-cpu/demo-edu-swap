import { useCallback, useRef, useState } from 'react';

/** Outgoing-call ringtone generated with the Web Audio API. */
export function useRingtone() {
  const [isRinging, setIsRinging] = useState(false);
  const ringAudioRef = useRef<{ context: AudioContext; oscillator: OscillatorNode; gain: GainNode } | null>(null);
  const ringIntervalRef = useRef<number | null>(null);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current !== null) {
      window.clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }

    if (ringAudioRef.current) {
      try {
        ringAudioRef.current.oscillator.stop();
      } catch {
        // ignore oscillator stop errors
      }

      ringAudioRef.current.context.close().catch(() => {
        // ignore close errors
      });
      ringAudioRef.current = null;
    }

    setIsRinging(false);
  }, []);

  const startRingtone = useCallback(async () => {
    if (ringAudioRef.current) return;

    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = new AudioContextCtor();
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();

      ringAudioRef.current = { context, oscillator, gain };
      setIsRinging(true);

      ringIntervalRef.current = window.setInterval(() => {
        const current = ringAudioRef.current;
        if (!current) return;
        const now = current.context.currentTime;
        current.gain.gain.cancelScheduledValues(now);
        current.gain.gain.setValueAtTime(0.0001, now);
        current.gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        current.gain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      }, 600);
    } catch (ringError) {
      console.error('Unable to start ringtone:', ringError);
      setIsRinging(true);
    }
  }, []);

  return { isRinging, startRingtone, stopRingtone };
}
