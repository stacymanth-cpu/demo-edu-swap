import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mic, MicOff, PhoneOff, Video, VideoOff, ScreenShare, CircleStop } from 'lucide-react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { endGroupCallRoom, subscribeGroupCallRoom } from '../lib/firestoreService';
import './GroupCallPage.css';

const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL as string | undefined;
const tokenEndpoint = (import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT as string | undefined) || '/api/livekit/token';

// Room events after which the participant list or their tracks may have changed.
const ROOM_UPDATE_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

function participantName(participant: Participant): string {
  return participant.name || participant.identity || 'Participant';
}

/** One participant's video (screen share first, then camera) and, for others, their audio. */
function ParticipantTile({ participant, isLocal, version }: { participant: Participant; isLocal: boolean; version: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const videoPublication = screenPublication?.track && !screenPublication.isMuted ? screenPublication : cameraPublication;
  const videoTrack = videoPublication && !videoPublication.isMuted ? videoPublication.track : undefined;
  const audioTrack = isLocal ? undefined : participant.getTrackPublication(Track.Source.Microphone)?.track;

  useEffect(() => {
    const element = videoRef.current;
    if (!videoTrack || !element) return;
    videoTrack.attach(element);
    return () => { videoTrack.detach(element); };
  }, [videoTrack, version]);

  useEffect(() => {
    const element = audioRef.current;
    if (!audioTrack || !element) return;
    audioTrack.attach(element);
    return () => { audioTrack.detach(element); };
  }, [audioTrack, version]);

  return (
    <div className="group-call-tile">
      {videoTrack
        ? <video ref={videoRef} autoPlay playsInline muted className={isLocal && videoPublication === cameraPublication ? 'mirrored' : ''} />
        : <div className="group-call-tile-placeholder">{participantName(participant).slice(0, 1).toUpperCase()}</div>}
      {!isLocal && <audio ref={audioRef} autoPlay />}
      <span>{isLocal ? `${participantName(participant)} (you)` : participantName(participant)}{participant.isMicrophoneEnabled ? '' : ' · muted'}</span>
    </div>
  );
}

export function GroupCallPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomVersion, setRoomVersion] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [hostId, setHostId] = useState<string | null>(null);
  const [roomEnded, setRoomEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const roomId = searchParams.get('room') || '';
  const roomTitle = searchParams.get('title') || 'Group call';
  const isHost = Boolean(user && hostId === user.uid);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => setCallSeconds(seconds => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [connected]);

  // Leave automatically when the host ends the call for everyone.
  useEffect(() => {
    if (!roomId) return;
    return subscribeGroupCallRoom(roomId, room => {
      setHostId(room?.hostId ?? null);
      if (room?.status === 'ended') {
        setRoomEnded(true);
        setConnected(false);
        roomRef.current?.disconnect();
      }
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !liveKitUrl) {
      setError('LiveKit is not configured. Set VITE_LIVEKIT_URL to start a native group call.');
      return;
    }
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    // The local participant is always first; tiles rely on that to skip playing your own audio.
    const refresh = () => {
      setParticipants([room.localParticipant, ...Array.from(room.remoteParticipants.values())]);
      setRoomVersion(version => version + 1);
    };
    ROOM_UPDATE_EVENTS.forEach(event => room.on(event, refresh));
    void (async () => {
      try {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error('Authentication required');
        const firebaseToken = await firebaseUser.getIdToken();
        const tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${firebaseToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomId }),
        });
        if (tokenResponse.status === 403) throw new Error('forbidden');
        if (!tokenResponse.ok) throw new Error('Token request failed');
        const tokenData = await tokenResponse.json() as { token?: string };
        if (!tokenData.token) throw new Error('Token missing');
        await room.connect(liveKitUrl, tokenData.token, { autoSubscribe: true });
        setConnected(true);
        refresh();
      } catch (joinError) {
        console.error('Failed to join LiveKit room:', joinError);
        setError(joinError instanceof Error && joinError.message === 'forbidden'
          ? 'This group call has ended or you are not invited to it.'
          : 'Unable to join the group call. Check that the call server is running and try again.');
        return;
      }
      // Stay in the call even if the camera or microphone is unavailable.
      try {
        await room.localParticipant.enableCameraAndMicrophone();
      } catch (mediaError) {
        console.error('Unable to start camera or microphone:', mediaError);
        setNotice('Your camera or microphone could not start. Others can still see and hear you once you allow access and turn them on.');
      }
      setMicEnabled(room.localParticipant.isMicrophoneEnabled);
      setCameraEnabled(room.localParticipant.isCameraEnabled);
      refresh();
    })();
    return () => { room.removeAllListeners(); void room.disconnect(); roomRef.current = null; };
  }, [roomId]);

  const runToggle = async (action: (room: Room) => Promise<unknown>) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await action(room);
      setNotice('');
    } catch (toggleError) {
      console.error('Group call control failed:', toggleError);
      setNotice('That did not work. Check your browser permissions and try again.');
    }
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setScreenSharing(room.localParticipant.isScreenShareEnabled);
  };
  const toggleMicrophone = () => runToggle(room => room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled));
  const toggleCamera = () => runToggle(room => room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled));
  const toggleScreenShare = () => runToggle(room => room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled));
  const formatCallTime = () => `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`;
  const leaveCall = () => { void roomRef.current?.disconnect(); navigate('/video-call'); };
  const endCallForEveryone = async () => {
    if (!window.confirm('End this group call for everyone?')) return;
    setEnding(true);
    try {
      await endGroupCallRoom(roomId);
      leaveCall();
    } catch (endError) {
      console.error('Failed to end group call:', endError);
      setNotice('Unable to end the call for everyone. Please try again.');
    } finally {
      setEnding(false);
    }
  };

  const statusLabel = roomEnded ? 'Ended' : connected ? `${participants.length} in call` : error ? 'Not connected' : 'Connecting…';

  return <div className="group-call-page">
    <div className="group-call-stage">
      <header className="group-call-header">
        <button className="group-call-back" type="button" onClick={leaveCall} aria-label="Back to Calls"><ArrowLeft size={18} /></button>
        <div className="group-call-title">
          <h1>{roomTitle}</h1>
          <p><span className={`group-call-dot ${connected ? 'live' : roomEnded || error ? 'off' : 'pending'}`} />{statusLabel}{connected ? ` · ${formatCallTime()}` : ''}</p>
        </div>
      </header>

      <div className="group-call-alerts">
        {error && <div className="group-call-alert error" role="alert">{error}</div>}
        {roomEnded && <div className="group-call-alert error" role="status">The host ended this group call.</div>}
        {notice && <div className="group-call-alert" role="status">{notice}</div>}
      </div>

      <div className={`group-call-grid count-${Math.min(participants.length, 4)}`}>
        {participants.map((participant, index) => <ParticipantTile key={participant.identity} participant={participant} isLocal={index === 0} version={roomVersion} />)}
      </div>

      <div className="group-call-controls" role="toolbar" aria-label="Call controls">
        <button type="button" className={`gc-control ${micEnabled ? '' : 'is-active'}`} onClick={() => void toggleMicrophone()} disabled={!connected} aria-pressed={!micEnabled} aria-label={micEnabled ? 'Mute' : 'Unmute'} title={micEnabled ? 'Mute' : 'Unmute'}>{micEnabled ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <button type="button" className={`gc-control ${cameraEnabled ? '' : 'is-active'}`} onClick={() => void toggleCamera()} disabled={!connected} aria-pressed={!cameraEnabled} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}</button>
        <button type="button" className={`gc-control ${screenSharing ? 'is-active' : ''}`} onClick={() => void toggleScreenShare()} disabled={!connected} aria-pressed={screenSharing} aria-label={screenSharing ? 'Stop sharing' : 'Share screen'} title={screenSharing ? 'Stop sharing' : 'Share screen'}><ScreenShare size={20} /></button>
        <button className="gc-control is-danger" type="button" onClick={leaveCall} aria-label="Leave call" title="Leave call"><PhoneOff size={22} /></button>
        {isHost && !roomEnded && <button className="gc-end-all" type="button" onClick={() => void endCallForEveryone()} disabled={ending}><CircleStop size={16} /> {ending ? 'Ending…' : 'End for everyone'}</button>}
      </div>
    </div>
  </div>;
}
