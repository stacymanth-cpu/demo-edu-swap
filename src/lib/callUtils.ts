import type { CallHistoryEntry } from '../types';

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface TurnEnv {
  VITE_TURN_URLS?: string;
  VITE_TURN_USERNAME?: string;
  VITE_TURN_CREDENTIAL?: string;
}

/**
 * STUN finds a direct route between devices; TURN relays the call when no direct
 * route exists (for example mobile data to campus Wi-Fi). TURN is used only when configured.
 */
export function buildIceServers(env: TurnEnv): RTCConfiguration {
  const turnUrls = (env.VITE_TURN_URLS || '').split(',').map(url => url.trim()).filter(Boolean);
  if (turnUrls.length === 0 || !env.VITE_TURN_USERNAME || !env.VITE_TURN_CREDENTIAL) {
    return { iceServers: STUN_SERVERS };
  }
  return {
    iceServers: [
      ...STUN_SERVERS,
      { urls: turnUrls, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL },
    ],
  };
}

export const ICE_SERVERS: RTCConfiguration = buildIceServers(import.meta.env as TurnEnv);

export type ConnectionPhase = 'setup' | 'ready' | 'ringing' | 'connecting' | 'connected' | 'error';
export type ConnectionQuality = 'unknown' | 'connecting' | 'good' | 'reconnecting' | 'failed';

const PHASE_LABELS: Record<ConnectionPhase, string> = {
  setup: 'Device setup needed',
  ready: 'Ready to connect',
  ringing: 'Ringing',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Needs attention',
};

export function getConnectionPhase(state: {
  hasError: boolean;
  hasRemoteStream: boolean;
  inRoom: boolean;
  isRinging: boolean;
  isLocalMediaReady: boolean;
}): ConnectionPhase {
  if (state.hasError) return 'error';
  if (state.hasRemoteStream) return 'connected';
  if (state.inRoom) return state.isRinging ? 'ringing' : 'connecting';
  return state.isLocalMediaReady ? 'ready' : 'setup';
}

export const getConnectionPhaseLabel = (phase: ConnectionPhase) => PHASE_LABELS[phase];

/** Label for the status bar; a reconnecting or failed connection overrides the phase. */
export function getDisplayedConnectionLabel(phase: ConnectionPhase, quality: ConnectionQuality): string {
  if (quality === 'reconnecting') return 'Reconnecting';
  if (quality === 'failed') return 'Connection failed';
  return PHASE_LABELS[phase];
}

export function getMediaErrorMessage(mediaError: unknown): string {
  const name = (mediaError as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera and microphone access is blocked. Allow access in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera or microphone was found. Connect a device and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your camera or microphone is already in use by another app.';
  }
  return 'We could not access your camera and microphone. Check your device settings and try again.';
}

export const SCREEN_SHARE_UNSUPPORTED_MESSAGE = 'Screen sharing is not available on this device. Use Chrome, Edge or Firefox on a computer.';

interface ScreenShareEnvironment {
  hasGetDisplayMedia: boolean;
  isSecureContext: boolean;
  isEmbedded: boolean;
  isMobile: boolean;
}

/** Why screen sharing cannot start here, or null when it should work. */
export function getScreenShareSupportIssue(env: ScreenShareEnvironment): string | null {
  if (env.isMobile) {
    return 'Phones and tablets cannot share their screen from a browser. Join the call from Chrome, Edge or Firefox on a computer to share your screen.';
  }
  if (!env.isSecureContext) {
    return 'Screen sharing only works on a secure address. Open EduSwap at http://localhost:5173 on this computer or use the https link of the deployed app, not a network address like http://192.168…';
  }
  if (env.isEmbedded) {
    return 'Screen sharing is blocked inside embedded previews. Open EduSwap in a normal Chrome, Edge or Firefox tab.';
  }
  if (!env.hasGetDisplayMedia) {
    return 'This browser does not support screen sharing. Use the latest Chrome, Edge or Firefox on a computer.';
  }
  return null;
}

/** Read the current browser's screen sharing environment. */
export function detectScreenShareEnvironment(): ScreenShareEnvironment {
  let isEmbedded = false;
  try {
    isEmbedded = window.self !== window.top;
  } catch {
    isEmbedded = true;
  }
  return {
    hasGetDisplayMedia: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia),
    isSecureContext: window.isSecureContext,
    isEmbedded,
    isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)),
  };
}

/**
 * Explain why getDisplayMedia failed. Returns null when the user simply closed the
 * picker, which is not an error worth showing.
 */
export function getScreenShareErrorMessage(screenError: unknown): string | null {
  const name = (screenError as { name?: string })?.name;
  const message = (screenError as { message?: string })?.message || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    // Chrome reports the operating system blocking capture as "Permission denied by system".
    if (/system/i.test(message)) {
      return 'Your computer is blocking screen recording for this browser. On a Mac, open System Settings → Privacy & Security → Screen Recording, allow your browser, then restart it.';
    }
    return null;
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'Your screen could not be captured. Close other apps that are recording your screen and try again.';
  }
  if (name === 'NotSupportedError') {
    return SCREEN_SHARE_UNSUPPORTED_MESSAGE;
  }
  // Include the browser's own wording so unexpected failures can be diagnosed.
  return `Unable to share your screen${name ? ` (${name}${message ? `: ${message}` : ''})` : ''}. Please try again.`;
}

/** Format seconds as mm:ss. */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainderSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainderSeconds}`;
}

export function formatHistoryDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildCallInviteLink(origin: string, roomId: string, chatRoomId?: string | null, sessionId?: string | null): string {
  const params = new URLSearchParams({ room: roomId });
  if (chatRoomId) params.set('chatRoomId', chatRoomId);
  if (sessionId) params.set('sessionId', sessionId);
  return `${origin}/video-call?${params.toString()}`;
}

export function getCallPartnerName(entry: Pick<CallHistoryEntry, 'participantNames'>, currentUserId: string | undefined): string {
  return Object.entries(entry.participantNames || {}).find(([uid]) => uid !== currentUserId)?.[1] || 'Call partner';
}
