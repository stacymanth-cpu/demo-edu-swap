import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getIntroVideoUrl, isStoredIntroVideo } from '../../lib/firestore/introVideos';
import './IntroVideo.css';

interface IntroVideoPlayerProps {
  userId: string;
  /** The profile's introductionVideoUrl: a stored-video marker, or an older direct link. */
  videoUrl?: string;
  /** Called when there is no video the viewer may watch, so the parent can hide its section. */
  onUnavailable?: () => void;
}

/** Plays a student's introduction video, loading recorded clips from Firestore. */
export function IntroVideoPlayer({ userId, videoUrl, onUnavailable }: IntroVideoPlayerProps) {
  const directUrl = videoUrl && !isStoredIntroVideo(videoUrl) ? videoUrl : '';
  const [loaded, setLoaded] = useState<{ userId: string; url: string | null } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (directUrl) return;
    let cancelled = false;
    getIntroVideoUrl(userId)
      .then(url => {
        if (cancelled) return;
        setLoaded({ userId, url });
        if (!url) onUnavailable?.();
      })
      .catch(error => {
        console.error('Failed to load introduction video:', error);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  // onUnavailable is a notification callback; reloading when it changes identity is unnecessary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, directUrl, videoUrl]);

  if (directUrl) return <video className="intro-player" controls preload="metadata" playsInline src={directUrl} />;
  if (failed) return <p className="intro-player-note">The introduction video could not be loaded. Please try again later.</p>;
  if (!loaded || loaded.userId !== userId) return <div className="intro-player-loading"><Loader2 size={20} className="spinner" /> Loading video…</div>;
  if (!loaded.url) return null;
  return <video className="intro-player" controls preload="metadata" playsInline src={loaded.url} />;
}
