import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { History, Link2, Mic, MicOff, Phone, Video, VideoOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { completeSessionWithCreditsById, createCallHistoryEntry, findWaitingCallForChat, getChatRooms, getUser, markChatMessagesRead, sendChatMessage, subscribeCallHistory, subscribeGroupCallRooms, subscribeToChatMessages } from '../lib/firestoreService';
import { db } from '../lib/firebase';
import type { CallHistoryEntry, ChatRoom, GroupCallRoom } from '../types';
import {
  ICE_SERVERS, buildCallInviteLink, formatDuration, getConnectionPhase,
  getDisplayedConnectionLabel, getMediaErrorMessage, getScreenShareErrorMessage, getScreenShareSupportIssue, detectScreenShareEnvironment, type ConnectionQuality,
} from '../lib/callUtils';
import { useRingtone } from '../hooks/useRingtone';
import { CallActivityPanel } from '../components/videoCall/CallActivityPanel';
import { CallControls } from '../components/videoCall/CallControls';
import { InCallChat, type InCallChatMessage } from '../components/videoCall/InCallChat';
import { extractCallInvite } from '../lib/chatUtils';
import './VideoCallPage.css';

// Automatic call status messages stay in the main chat but are noise inside the call.
const IN_CALL_HIDDEN_MESSAGES = /^(Missed call|Call declined|Call ended)/;
const CLOCK_SKEW_GRACE_MS = 60_000;
const MAX_AUTO_RECONNECT_ATTEMPTS = 3;

export function VideoCallPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [, setRoomId] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready to start a video call');
  const [isCreator, setIsCreator] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [callChatMessage, setCallChatMessage] = useState('');
  const [callChatMessages, setCallChatMessages] = useState<InCallChatMessage[]>([]);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const [endedCallDuration, setEndedCallDuration] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [directCallMode, setDirectCallMode] = useState(false);
  const [, setDirectCallPartnerId] = useState<string | null>(null);
  const [directCallPartnerName, setDirectCallPartnerName] = useState('');
  const [directCallPartnerPhoto, setDirectCallPartnerPhoto] = useState('');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('video');
  const [pendingChatRoomInvite, setPendingChatRoomInvite] = useState<string | null>(null);
  const [pendingAutoJoinRoom, setPendingAutoJoinRoom] = useState<string | null>(null);
  const [pendingAutoStartCall, setPendingAutoStartCall] = useState(false);
  const [chatRoomContextId, setChatRoomContextId] = useState<string | null>(null);
  const [sessionContextId, setSessionContextId] = useState<string | null>(null);
  const [callableRooms, setCallableRooms] = useState<ChatRoom[]>([]);
  const [selectedCallableRoomId, setSelectedCallableRoomId] = useState('');
  const [isLocalMediaReady, setIsLocalMediaReady] = useState(false);
  const [, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [groupCallRooms, setGroupCallRooms] = useState<GroupCallRoom[]>([]);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('unknown');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [seenPartnerMessageCount, setSeenPartnerMessageCount] = useState(0);
  const [inviteCopied, setInviteCopied] = useState(false);
  const { isRinging, startRingtone, stopRingtone } = useRingtone();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const missedCallTimeoutRef = useRef<number | null>(null);
  const hasPeerAnsweredRef = useRef(false);
  const unsubscribeRefs = useRef<(() => void)[]>([]);
  const activeRoomIdRef = useRef<string | null>(null);
  const isEndingRef = useRef(false);
  // Refs mirror call state for timers and async handlers that would otherwise see stale values.
  const callStartedAtRef = useRef<number | null>(null);
  const callPartnerRef = useRef<{ id: string | null; name: string }>({ id: null, name: '' });
  const hangUpRef = useRef<() => Promise<void>>(async () => {});
  // ICE restarts: the caller bumps offerVersion with each new offer; answers echo the version they answer.
  const offerVersionRef = useRef(0);
  const lastRestartRequestRef = useRef<number | null>(null);
  const reconnectRef = useRef<() => Promise<void>>(async () => {});
  const autoReconnectAttemptsRef = useRef(0);
  const callTargetName = directCallPartnerName || 'Chat partner';
  const connectionPhase = getConnectionPhase({
    hasError: Boolean(error),
    hasRemoteStream: Boolean(remoteStream),
    inRoom: Boolean(currentRoomId),
    isRinging,
    isLocalMediaReady,
  });
  const displayedConnectionLabel = getDisplayedConnectionLabel(connectionPhase, connectionQuality);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setError('You are offline. Check your connection before starting or joining a call.');
      setStatus('Waiting for your internet connection.');
      stopRingtone();
    };
    const handleOnline = () => {
      setIsOnline(true);
      setError('');
      setStatus(currentRoomId ? 'Connection restored. Call may reconnect.' : 'Connection restored. Ready to start a video call.');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [currentRoomId, stopRingtone]);

  const ensureLocalStream = async (mode: 'audio' | 'video' = callMode) => {
    if (!isOnline) {
      setError('You are offline. Reconnect to the internet before using video calls.');
      return Promise.reject(new Error('Offline'));
    }
    if (localStreamRef.current) {
      await matchStreamToCallMode(localStreamRef.current, mode);
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: mode === 'video', audio: true });
      localStreamRef.current = stream;
      setIsMicMuted(!stream.getAudioTracks().some((track) => track.enabled));
      setIsCameraOff(!stream.getVideoTracks().some((track) => track.enabled));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsLocalMediaReady(true);
      return stream;
    } catch (streamError) {
      console.error('Unable to access camera or microphone', streamError);
      setIsLocalMediaReady(false);
      setError(getMediaErrorMessage(streamError));
      setStatus('Camera and microphone are not ready.');
      throw streamError;
    }
  };

  // The same stream is reused across calls, so an audio call must drop the camera
  // and a video call must bring it back.
  const matchStreamToCallMode = async (stream: MediaStream, mode: 'audio' | 'video') => {
    const videoTracks = stream.getVideoTracks();
    if (mode === 'audio') {
      videoTracks.forEach((track) => {
        stream.removeTrack(track);
        track.stop();
      });
      setIsCameraOff(true);
      return;
    }
    if (videoTracks.length > 0) return;

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacingMode } });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      if (!cameraTrack) return;
      stream.addTrack(cameraTrack);
      setIsCameraOff(false);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (cameraError) {
      console.error('Unable to turn on camera for video call', cameraError);
      setError(getMediaErrorMessage(cameraError));
    }
  };

  const retryMediaAccess = async () => {
    setError('');
    setStatus('Requesting camera and microphone access...');
    try {
      await ensureLocalStream();
      setStatus('Camera and microphone ready. Choose a user to start a call.');
    } catch {
      // ensureLocalStream provides the user-facing error.
    }
  };

  const stopRtpConnection = () => {
    pcRef.current?.close();
    pcRef.current = null;
    unsubscribeRefs.current.forEach((unsub) => unsub());
    unsubscribeRefs.current = [];
    activeRoomIdRef.current = null;
  };

  const autoCompleteSessionCredits = async () => {
    // Credit only when a session-linked call actually connected to a peer.
    if (!sessionContextId || !hasPeerAnsweredRef.current) return;

    try {
      await completeSessionWithCreditsById(sessionContextId);
    } catch (creditError) {
      console.error('Failed to auto-complete session credits:', creditError);
    }
  };

  const clearMissedCallTimeout = () => {
    if (missedCallTimeoutRef.current !== null) {
      window.clearTimeout(missedCallTimeoutRef.current);
      missedCallTimeoutRef.current = null;
    }
  };

  const getFinalDuration = () => {
    if (!callStartedAt) {
      return callDuration !== '00:00' ? callDuration : null;
    }
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000));
    return formatDuration(elapsedSeconds);
  };

  const stopLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIsLocalMediaReady(false);
  };

  const endCallLocally = (nextStatus: string, finalDuration?: string | null) => {
    setStatus(nextStatus);
    setCurrentRoomId(null);
    setIsCreator(false);
    setRemoteStream(null);
    callStartedAtRef.current = null;
    setCallStartedAt(null);
    setEndedCallDuration(finalDuration ?? null);
    setCallDuration(finalDuration || '00:00');
    setIsSharingScreen(false);
    // Start the next call with the partner audible.
    setSpeakerEnabled(true);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
    }
    hasPeerAnsweredRef.current = false;
    clearMissedCallTimeout();
    stopRingtone();
    stopRtpConnection();

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    stopLocalMedia();
    returnToCallsLobby();
  };

  // After any call ends, show the Calls page with the finished call in Recent calls.
  // Clears the chat/session context so the lobby is not tied to the last call.
  const returnToCallsLobby = () => {
    setDirectCallMode(false);
    setChatRoomContextId(null);
    setSessionContextId(null);
    setIsChatOpen(false);
    setCallChatMessages([]);
    setPendingChatRoomInvite(null);
    setPendingAutoJoinRoom(null);
    setPendingAutoStartCall(false);
    // Skip when the user already navigated elsewhere (this also runs during unmount cleanup).
    if (window.location.pathname === '/video-call' && window.location.search) {
      navigate('/video-call', { replace: true });
    }
  };

  const watchRoomLifecycle = (roomPathId: string) => {
    const roomRef = doc(db, 'videoCalls', roomPathId);
    const roomListener = onSnapshot(roomRef, (snapshot) => {
      if (!activeRoomIdRef.current || activeRoomIdRef.current !== roomPathId) return;
      if (isEndingRef.current) return;

      if (!snapshot.exists()) {
        void (async () => {
          await autoCompleteSessionCredits();
          endCallLocally('Call ended by the other user', getFinalDuration());
        })();
        return;
      }

      const roomData = snapshot.data();
      if (roomData?.endedAt) {
        const endedBySelf = roomData.endedBy === user?.uid;
        void (async () => {
          await autoCompleteSessionCredits();
          endCallLocally(endedBySelf ? 'Call ended' : 'Call ended by the other user', getFinalDuration());
        })();
      }
    });

    unsubscribeRefs.current.push(roomListener);
  };

  const createPeerConnection = async (roomToUse: string, creator: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setConnectionQuality('good');
      if (pc.connectionState === 'connecting' || pc.connectionState === 'new') setConnectionQuality('connecting');
      if (pc.connectionState === 'disconnected') setConnectionQuality('reconnecting');
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') setConnectionQuality('failed');
      if (pc.connectionState === 'connected') {
        autoReconnectAttemptsRef.current = 0;
        setStatus('Call connected.');
      }
      // The caller tries to recover the existing call a few times once the network path is lost.
      if (pc.connectionState === 'failed' && creator && pcRef.current === pc && autoReconnectAttemptsRef.current < MAX_AUTO_RECONNECT_ATTEMPTS) {
        autoReconnectAttemptsRef.current += 1;
        void reconnectRef.current();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'checking') setConnectionQuality('connecting');
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setConnectionQuality('good');
      if (pc.iceConnectionState === 'disconnected') setConnectionQuality('reconnecting');
      if (pc.iceConnectionState === 'failed') setConnectionQuality('failed');
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      const candidateCollection = creator ? 'offerCandidates' : 'answerCandidates';
      const candidatesRef = collection(db, 'videoCalls', roomToUse, candidateCollection);
      await addDoc(candidatesRef, event.candidate.toJSON());
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) {
        pc.addTrack(track, localStreamRef.current);
      }
    });

    pcRef.current = pc;
    return pc;
  };

  const createRoom = async (chatRoomIdToInvite?: string, mode: 'audio' | 'video' = callMode) => {
    if (!user) return;

    // If the other person already started a call in this chat, join it rather than ringing each other.
    if (chatRoomIdToInvite) {
      const waitingCall = await findWaitingCallForChat(user.uid, chatRoomIdToInvite).catch((lookupError) => {
        console.error('Failed to check for a waiting call:', lookupError);
        return null;
      });
      if (waitingCall) {
        setCallMode(waitingCall.callType);
        await joinRoomById(waitingCall.roomId, waitingCall.callType);
        return;
      }
    }

    try {
      hasPeerAnsweredRef.current = false;
      setConnectionQuality('connecting');
      clearMissedCallTimeout();
      setIsCreating(true);
      setCallMode(mode);
      await ensureLocalStream(mode);
      setError('');
      setStatus('Creating video room...');
      stopRtpConnection();

      const roomRef = doc(collection(db, 'videoCalls'));
      let allowedParticipantIds = [user.uid];
      if (chatRoomIdToInvite) {
        const chatRoomSnapshot = await getDoc(doc(db, 'chatRooms', chatRoomIdToInvite));
        const chatParticipants = chatRoomSnapshot.data()?.participants;
        if (!chatRoomSnapshot.exists() || !Array.isArray(chatParticipants) || !chatParticipants.includes(user.uid)) {
          throw new Error('You are not a participant in this chat call.');
        }
        allowedParticipantIds = Array.from(new Set(chatParticipants));
      }
      if (sessionContextId) {
        const sessionSnapshot = await getDoc(doc(db, 'sessions', sessionContextId));
        const sessionData = sessionSnapshot.data();
        const isSessionParticipant = sessionData && [sessionData.teacherId, sessionData.learnerId].includes(user.uid);
        if (!sessionSnapshot.exists() || !isSessionParticipant || sessionData.status !== 'scheduled' || sessionData.scheduledAt.toDate().getTime() > Date.now()) {
          throw new Error('Only participants can join this scheduled session at its scheduled time.');
        }
        allowedParticipantIds = [sessionData.teacherId, sessionData.learnerId];
      }
      activeRoomIdRef.current = roomRef.id;
      setIsCreator(true);
      offerVersionRef.current = 0;
      lastRestartRequestRef.current = null;
      autoReconnectAttemptsRef.current = 0;

      const pc = await createPeerConnection(roomRef.id, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setDoc(roomRef, {
        creatorId: user.uid,
        participants: allowedParticipantIds,
        sessionId: sessionContextId || null,
        // Read by the callee's app-wide incoming call listener.
        chatRoomId: chatRoomIdToInvite || null,
        callType: mode,
        callerName: user.displayName || 'Someone',
        callerPhoto: user.photoUrl || '',
        offer: { type: offer.type, sdp: offer.sdp },
        createdAt: serverTimestamp(),
        endedAt: null,
        endedBy: null,
      });

      setCurrentRoomId(roomRef.id);
      setRoomId(roomRef.id);
      callStartedAtRef.current = Date.now();
      setCallStartedAt(callStartedAtRef.current);
      setEndedCallDuration(null);
      setStatus(chatRoomIdToInvite ? `${mode === 'audio' ? 'Audio' : 'Video'} call started. Sending invite...` : 'Call started. Waiting for the other user...');
      await startRingtone();

      if (chatRoomIdToInvite) {
        const joinParams = new URLSearchParams({ room: roomRef.id, chatRoomId: chatRoomIdToInvite, callType: mode });
        if (sessionContextId) {
          joinParams.set('sessionId', sessionContextId);
        }
        const joinUrl = `${window.location.origin}/video-call?${joinParams.toString()}`;
        await sendChatMessage(chatRoomIdToInvite, {
          senderId: user.uid,
          text: `Video call invite: ${joinUrl}`,
          linkUrl: joinUrl,
          linkTitle: 'Join video call',
          timestamp: new Date(),
          isRead: true,
        });
      }

      const answerListener = onSnapshot(roomRef, (snapshot) => {
        const data = snapshot.data();
        const pc = pcRef.current;
        if (!pc || !data) return;

        // The other side asked for a reconnect.
        const restartRequestedAt = data.restartRequestedAt?.toMillis?.() ?? null;
        if (restartRequestedAt && restartRequestedAt !== lastRestartRequestRef.current) {
          lastRestartRequestRef.current = restartRequestedAt;
          void reconnectRef.current();
        }

        if (!data.answer) return;
        hasPeerAnsweredRef.current = true;
        clearMissedCallTimeout();
        stopRingtone();
        // Only apply an answer to the offer currently waiting for one.
        if (pc.signalingState !== 'have-local-offer' || (data.answer.offerVersion ?? 0) !== offerVersionRef.current) return;
        pc.setRemoteDescription(new RTCSessionDescription({ type: data.answer.type, sdp: data.answer.sdp })).catch((snapshotError) => {
          console.error(snapshotError);
        });
      });
      unsubscribeRefs.current.push(answerListener);

      const answerCandidatesRef = collection(roomRef, 'answerCandidates');
      const answerCandidatesListener = onSnapshot(answerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && pcRef.current) {
            const candidate = new RTCIceCandidate(change.doc.data());
            pcRef.current.addIceCandidate(candidate).catch((candidateError) => console.error(candidateError));
          }
        });
      });
      unsubscribeRefs.current.push(answerCandidatesListener);
      watchRoomLifecycle(roomRef.id);

      if (chatRoomIdToInvite) {
        missedCallTimeoutRef.current = window.setTimeout(() => {
          void (async () => {
            if (hasPeerAnsweredRef.current) return;
            if (!activeRoomIdRef.current || activeRoomIdRef.current !== roomRef.id) return;

            isEndingRef.current = true;
            stopRingtone();

            try {
              await sendChatMessage(chatRoomIdToInvite, {
                senderId: user.uid,
                text: 'Missed call',
                timestamp: new Date(),
                isRead: true,
              });
            } catch (missedError) {
              console.error('Failed to send missed call message:', missedError);
            }

            await saveCallHistory('missed', '00:30');

            endCallLocally('No answer. Missed call logged.');

            try {
              await deleteDoc(roomRef);
            } catch {
              // ignore cleanup errors
            }

            isEndingRef.current = false;
          })();
        }, 30000);
      }
    } catch (createError) {
      console.error('Failed to create room:', createError);
      setError('Unable to create video room. Please try again.');
      setStatus('Ready to start a video call');
      stopRingtone();
      stopRtpConnection();
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoomById = async (roomToJoin: string, mode: 'audio' | 'video' = callMode) => {
    if (!user) return;

    const normalizedRoomId = roomToJoin.trim();
    if (!normalizedRoomId) {
      setError('Please enter a room ID to join.');
      return;
    }

    try {
      setIsJoining(true);
      await ensureLocalStream(mode);
      setError('');
      setStatus('Joining room...');
      stopRtpConnection();

      const roomRef = doc(db, 'videoCalls', normalizedRoomId);
      const roomSnapshot = await getDoc(roomRef);
      if (!roomSnapshot.exists()) {
        setError('Video room not found.');
        setStatus('Ready to start a video call');
        return;
      }

      const roomData = roomSnapshot.data();
      if (!roomData?.offer) {
        setError('Room does not contain an offer.');
        setStatus('Ready to start a video call');
        return;
      }
      if (!Array.isArray(roomData.participants) || !roomData.participants.includes(user.uid)) {
        setError('You are not an invited participant in this call. Ask the caller to invite you from your chat.');
        setStatus('Call access denied');
        return;
      }

      activeRoomIdRef.current = roomRef.id;
      setIsCreator(false);
      hasPeerAnsweredRef.current = true;
      setConnectionQuality('connecting');
      clearMissedCallTimeout();

      const pc = await createPeerConnection(roomRef.id, false);
      offerVersionRef.current = roomData.offerVersion ?? 0;
      await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(roomRef, {
        answer: { type: answer.type, sdp: answer.sdp, offerVersion: offerVersionRef.current },
      });

      // Answer each new offer the caller sends when restarting the connection.
      const offerListener = onSnapshot(roomRef, (snapshot) => {
        const data = snapshot.data();
        const currentPc = pcRef.current;
        const nextVersion = data?.offerVersion ?? 0;
        if (!currentPc || !data?.offer || nextVersion <= offerVersionRef.current) return;
        offerVersionRef.current = nextVersion;
        void (async () => {
          try {
            await currentPc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const restartAnswer = await currentPc.createAnswer();
            await currentPc.setLocalDescription(restartAnswer);
            await updateDoc(roomRef, {
              answer: { type: restartAnswer.type, sdp: restartAnswer.sdp, offerVersion: nextVersion },
            });
          } catch (restartError) {
            console.error('Failed to answer reconnect offer:', restartError);
          }
        })();
      });
      unsubscribeRefs.current.push(offerListener);

      setCurrentRoomId(roomRef.id);
      setRoomId(roomRef.id);
      callStartedAtRef.current = Date.now();
      setCallStartedAt(callStartedAtRef.current);
      setEndedCallDuration(null);
      stopRingtone();
      setStatus('Joined room. Waiting for the other user...');

      const offerCandidatesRef = collection(roomRef, 'offerCandidates');
      const offerCandidatesListener = onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && pcRef.current) {
            const candidate = new RTCIceCandidate(change.doc.data());
            pcRef.current.addIceCandidate(candidate).catch((candidateError) => console.error(candidateError));
          }
        });
      });
      unsubscribeRefs.current.push(offerCandidatesListener);
      watchRoomLifecycle(roomRef.id);
    } catch (joinError) {
      console.error('Failed to join room:', joinError);
      const errorName = (joinError as { name?: string })?.name;
      setError(errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
        ? getMediaErrorMessage(joinError)
        : 'Unable to join room. Check the room ID and your connection, then try again.');
      setStatus('Ready to start a video call');
      stopRingtone();
      stopRtpConnection();
    } finally {
      setIsJoining(false);
    }
  };

  const getVideoSender = () => {
    return pcRef.current?.getSenders().find((sender) => sender.track?.kind === 'video') || null;
  };

  const ensureCameraVideoTrack = async (): Promise<MediaStreamTrack | null> => {
    const activeTrack = localStreamRef.current?.getVideoTracks()[0];
    if (activeTrack && activeTrack.readyState === 'live') {
      return activeTrack;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacingMode } });
      const cameraTrack = cameraStream.getVideoTracks()[0] || null;
      if (!cameraTrack) return null;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }

      localStreamRef.current.getVideoTracks().forEach((track) => {
        localStreamRef.current?.removeTrack(track);
        track.stop();
      });
      localStreamRef.current.addTrack(cameraTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setIsCameraOff(!cameraTrack.enabled);
      return cameraTrack;
    } catch (cameraError) {
      console.error('Unable to restore camera track:', cameraError);
      return null;
    }
  };

  const replaceVideoSenderTrack = async (track: MediaStreamTrack): Promise<boolean> => {
    const sender = getVideoSender();
    if (!sender) return false;

    await sender.replaceTrack(track);
    return true;
  };

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current;
    const videoTrack = await ensureCameraVideoTrack();

    if (videoTrack && pcRef.current) {
      await replaceVideoSenderTrack(videoTrack).catch((trackError) => {
        console.error('Failed to restore camera track after screen share:', trackError);
      });
    }

    screenStream?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setIsSharingScreen(false);
    setError('');
    setStatus(currentRoomId ? 'Camera stream restored.' : status);

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      await stopScreenShare();
      return;
    }

    if (!pcRef.current || !localStreamRef.current) {
      setError('Start or join a call before sharing your screen.');
      return;
    }

    const supportIssue = getScreenShareSupportIssue(detectScreenShareEnvironment());
    if (supportIssue) {
      setError(supportIssue);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        screenStream.getTracks().forEach((track) => track.stop());
        setError('No screen was selected. Please try again.');
        return;
      }
      // Favour sharp text over smooth motion, which suits slides and documents.
      screenTrack.contentHint = 'detail';

      const senderReplaced = await replaceVideoSenderTrack(screenTrack);
      if (!senderReplaced) {
        screenStream.getTracks().forEach((track) => track.stop());
        setError('Screen sharing needs a video call. Hang up and start a video call to share your screen.');
        return;
      }

      screenTrack.onended = () => {
        stopScreenShare().catch((screenError) => console.error(screenError));
      };

      screenStreamRef.current = screenStream;
      setIsSharingScreen(true);
      setError('');
      setStatus('You are sharing your screen.');

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
    } catch (screenError) {
      console.error('Failed to start screen sharing:', screenError);
      const message = getScreenShareErrorMessage(screenError);
      if (message) setError(message);
    }
  };

  const getInviteLink = () => {
    if (!currentRoomId) return '';
    return buildCallInviteLink(window.location.origin, currentRoomId, chatRoomContextId, sessionContextId);
  };

  const getOtherNameFromRoom = (room: ChatRoom) => {
    const otherParticipantId = room.participants.find((participantId) => participantId !== user?.uid);
    if (!otherParticipantId) return 'Chat user';
    return room.participantNames?.[otherParticipantId] || 'Chat user';
  };

  const getOtherIdFromRoom = (room: ChatRoom) => {
    return room.participants.find((participantId) => participantId !== user?.uid) || null;
  };

  const setCallPartner = (id: string | null, name: string) => {
    callPartnerRef.current = { id, name };
    setDirectCallPartnerId(id);
    setDirectCallPartnerName(name);
  };

  const saveCallHistory = async (
    statusType: 'ended' | 'missed',
    finalDurationLabel?: string | null,
    startedAtMs: number | null = callStartedAtRef.current,
  ) => {
    if (!user || !startedAtMs) return;

    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const durationLabel = finalDurationLabel || formatDuration(durationSeconds);
    const otherUid = callPartnerRef.current.id;
    const participantNames: Record<string, string> = {
      [user.uid]: user.displayName || 'You',
    };

    if (otherUid) {
      participantNames[otherUid] = callPartnerRef.current.name || 'Call partner';
    }

    try {
      await createCallHistoryEntry({
        participants: otherUid ? [user.uid, otherUid] : [user.uid],
        participantNames,
        chatRoomId: chatRoomContextId || undefined,
        roomId: activeRoomIdRef.current || currentRoomId || undefined,
        startedAt: new Date(startedAtMs),
        endedAt,
        durationSeconds,
        durationLabel,
        status: statusType,
        endedBy: user.uid,
      });
    } catch (historyError) {
      console.error('Failed to save call history:', historyError);
    }
  };

  const startDirectCallFromVideoPage = async () => {
    const targetChatRoomId = selectedCallableRoomId.trim();
    if (!targetChatRoomId) {
      setError('Select a chat user to call.');
      return;
    }

    const room = callableRooms.find((item) => item.id === targetChatRoomId);
    if (room) {
      setCallPartner(getOtherIdFromRoom(room), getOtherNameFromRoom(room));
    }

    setDirectCallMode(true);
    setCallMode('video');
    setChatRoomContextId(targetChatRoomId);
    await createRoom(targetChatRoomId, 'video');
  };

  const startDirectAudioCallFromVideoPage = async () => {
    const targetChatRoomId = selectedCallableRoomId.trim();
    if (!targetChatRoomId) {
      setError('Select a chat user to call.');
      return;
    }
    const room = callableRooms.find((item) => item.id === targetChatRoomId);
    if (room) {
      setCallPartner(getOtherIdFromRoom(room), getOtherNameFromRoom(room));
    }
    setDirectCallMode(true);
    setCallMode('audio');
    setChatRoomContextId(targetChatRoomId);
    await createRoom(targetChatRoomId, 'audio');
  };

  const toggleMic = async () => {
    try {
      if (!localStreamRef.current) {
        await ensureLocalStream();
      }

      const audioTracks = localStreamRef.current?.getAudioTracks() || [];
      if (audioTracks.length === 0) {
        setError('No microphone track found. Check microphone permissions/device settings.');
        return;
      }

      const shouldEnable = !audioTracks.some((track) => track.enabled);
      audioTracks.forEach((track) => {
        track.enabled = shouldEnable;
      });

      // Keep sender track state in sync with local track state.
      const audioSender = pcRef.current?.getSenders().find((sender) => sender.track?.kind === 'audio');
      if (audioSender?.track) {
        audioSender.track.enabled = shouldEnable;
      }

      setIsMicMuted(!shouldEnable);
      setError('');
    } catch (micError) {
      console.error('Failed to toggle microphone:', micError);
      setError('Unable to access microphone. Please allow microphone access and try again.');
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  };

  const switchCamera = async () => {
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacingMode } });
      const nextTrack = cameraStream.getVideoTracks()[0];
      if (!nextTrack) return;
      const previousTrack = localStreamRef.current?.getVideoTracks()[0];
      if (localStreamRef.current) {
        if (previousTrack) {
          localStreamRef.current.removeTrack(previousTrack);
          previousTrack.stop();
        }
        localStreamRef.current.addTrack(nextTrack);
      }
      await replaceVideoSenderTrack(nextTrack);
      setCameraFacingMode(nextFacingMode);
      if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    } catch (cameraError) {
      setError(getMediaErrorMessage(cameraError));
    }
  };

  // Browsers cannot reliably pick an output device (and phones cannot switch to the
  // earpiece from the web), so the speaker button mutes and unmutes the partner's audio.
  const toggleSpeaker = () => {
    const nextEnabled = !speakerEnabled;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !nextEnabled;
    }
    setSpeakerEnabled(nextEnabled);
  };

  const sendCallChatMessage = async () => {
    const text = callChatMessage.trim();
    if (!text || !chatRoomContextId || !user) return;
    try {
      // The chat subscription below shows the sent message.
      await sendChatMessage(chatRoomContextId, { senderId: user.uid, text, timestamp: new Date(), isRead: false });
      setCallChatMessage('');
    } catch {
      setError('Unable to send your call message.');
    }
  };

  const hangUp = async () => {
    if (isEndingRef.current || isEndingCall) return;

    setIsEndingCall(true);
    const roomToDelete = activeRoomIdRef.current;
    const creatorSnapshot = isCreator;
    const finalDuration = getFinalDuration();
    const startedAtMs = callStartedAtRef.current;

    isEndingRef.current = true;
    clearMissedCallTimeout();

    if (roomToDelete && user) {
      try {
        await updateDoc(doc(db, 'videoCalls', roomToDelete), {
          endedAt: serverTimestamp(),
          endedBy: user.uid,
        });
      } catch {
        // ignore end-signal update failures
      }
    }

    endCallLocally('Call ended', finalDuration);

    await autoCompleteSessionCredits();

    await saveCallHistory('ended', finalDuration, startedAtMs);

    if (roomToDelete && chatRoomContextId && user) {
      try {
        await sendChatMessage(chatRoomContextId, {
          senderId: user.uid,
          text: finalDuration ? `Call ended (Duration: ${finalDuration})` : 'Call ended',
          timestamp: new Date(),
          isRead: true,
        });
      } catch {
        // ignore chat message failures
      }
    }

    if (creatorSnapshot && roomToDelete) {
      try {
        await deleteDoc(doc(db, 'videoCalls', roomToDelete));
      } catch {
        // ignore cleanup errors
      }
    }

    isEndingRef.current = false;
    setIsEndingCall(false);
  };

  // hangUp ends the call and returns to the Calls page (see returnToCallsLobby).
  const endCallAndCloseScreen = async () => {
    if (isEndingCall) return;
    await hangUp();
  };

  // Reconnect the existing call with an ICE restart rather than starting a new call.
  // Only the caller can send offers, so the other side asks the caller to restart.
  const retryConnection = async () => {
    const pc = pcRef.current;
    const roomId = activeRoomIdRef.current;
    if (!pc || !roomId || !user || isEndingRef.current) return;
    setError('');
    setConnectionQuality('connecting');
    setStatus('Reconnecting call...');
    const roomRef = doc(db, 'videoCalls', roomId);

    try {
      if (isCreator) {
        offerVersionRef.current += 1;
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        await updateDoc(roomRef, {
          offer: { type: offer.type, sdp: offer.sdp },
          offerVersion: offerVersionRef.current,
        });
      } else {
        await updateDoc(roomRef, { restartRequestedAt: serverTimestamp() });
      }
    } catch (reconnectError) {
      console.error('Failed to reconnect call:', reconnectError);
      setConnectionQuality('failed');
      setError('Unable to reconnect. Check your connection, or hang up and call again.');
    }
  };

  useEffect(() => {
    reconnectRef.current = retryConnection;
  });

  useEffect(() => {
    // callMode state is still the 'video' default here, so read the call type from the link.
    const initialMode = new URLSearchParams(location.search).get('callType') === 'audio' ? 'audio' : 'video';
    ensureLocalStream(initialMode).catch(() => {
      // handled by ensureLocalStream
    });

    return () => {
      // Use the latest hangUp: this cleanup was created on the first render, when there was no call yet.
      void hangUpRef.current();
      stopLocalMedia();
      stopRingtone();
    };
  // Media setup and teardown intentionally run once for the lifetime of this call screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    hangUpRef.current = hangUp;
  });

  // Closing or refreshing the tab skips React cleanup, so at least tell the other side the call ended.
  useEffect(() => {
    const handlePageHide = () => {
      const roomId = activeRoomIdRef.current;
      if (!roomId || !user || isEndingRef.current) return;
      void updateDoc(doc(db, 'videoCalls', roomId), { endedAt: serverTimestamp(), endedBy: user.uid }).catch(() => {
        // the page is closing; nothing more can be done
      });
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [user]);

  // Show both sides of the chat conversation during the call, from when this user joined.
  useEffect(() => {
    if (!user || !currentRoomId || !chatRoomContextId || !callStartedAt) return;
    return subscribeToChatMessages(chatRoomContextId, (messages) => {
      const callMessages = messages.filter((message) => (
        // Timestamps come from each sender's clock, so allow for devices that disagree.
        message.timestamp.getTime() >= callStartedAt - CLOCK_SKEW_GRACE_MS
        && !message.deletedAt
        && message.text
        && !extractCallInvite(message)
        && !IN_CALL_HIDDEN_MESSAGES.test(message.text)
      ));
      setCallChatMessages(callMessages.map((message) => ({
        id: message.id,
        author: message.senderId === user.uid ? 'You' : callTargetName,
        text: message.text,
        mine: message.senderId === user.uid,
      })));
      void markChatMessagesRead(chatRoomContextId, user.uid, callMessages).catch((readError) => {
        console.error('Failed to update read receipts during call:', readError);
      });
    });
  }, [user, currentRoomId, chatRoomContextId, callStartedAt, callTargetName]);

  // The lobby preview and the in-call picture-in-picture are different <video> elements,
  // so re-attach streams whenever the layout switches.
  useEffect(() => {
    const element = localVideoRef.current;
    if (!element) return;
    const stream = isSharingScreen && screenStreamRef.current ? screenStreamRef.current : localStreamRef.current;
    if (element.srcObject !== stream) element.srcObject = stream;
  }, [currentRoomId, isLocalMediaReady, isSharingScreen, isCameraOff, callMode]);

  useEffect(() => {
    const element = remoteVideoRef.current;
    if (!element || !remoteStream) return;
    if (element.srcObject !== remoteStream) element.srcObject = remoteStream;
    element.muted = !speakerEnabled;
  }, [remoteStream, currentRoomId, speakerEnabled]);

  useEffect(() => {
    if (!callStartedAt || !currentRoomId) {
      if (!endedCallDuration) {
        setCallDuration('00:00');
      }
      return undefined;
    }

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - callStartedAt) / 1000);
      setCallDuration(formatDuration(elapsedSeconds));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [callStartedAt, currentRoomId, endedCallDuration]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomFromLink = params.get('room');
    const chatRoomFromQuery = params.get('chatRoomId');
    const sessionIdFromQuery = params.get('sessionId');
    const autoStartFromQuery = params.get('autoStart') === '1';
    const callTypeFromQuery = params.get('callType') === 'audio' ? 'audio' : 'video';
    setCallMode(callTypeFromQuery);

    if (roomFromLink) {
      setPendingAutoJoinRoom(roomFromLink);
      setRoomId(roomFromLink);
      setStatus('Room ID loaded from invite link. Joining automatically...');
    }

    if (chatRoomFromQuery) {
      setChatRoomContextId(chatRoomFromQuery);
      // An invite link carries both room and chatRoomId: join that room instead of starting a new call.
      if (roomFromLink) {
        setDirectCallMode(true);
      } else {
        setPendingChatRoomInvite(chatRoomFromQuery);
        setPendingAutoStartCall(autoStartFromQuery);
        setDirectCallMode(autoStartFromQuery);
      }
    }

    if (sessionIdFromQuery) {
      setSessionContextId(sessionIdFromQuery);
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatRoomFromQuery = params.get('chatRoomId');

    if (!chatRoomFromQuery || !user) return;

    const loadChatContext = async () => {
      try {
        const chatRoomSnapshot = await getDoc(doc(db, 'chatRooms', chatRoomFromQuery));
        if (!chatRoomSnapshot.exists()) return;

        const chatRoomData = chatRoomSnapshot.data();
        const otherParticipantId = Array.isArray(chatRoomData.participants)
          ? chatRoomData.participants.find((participantId: string) => participantId !== user.uid)
          : null;

        if (!otherParticipantId) return;

        const otherUser = await getUser(otherParticipantId);
        setCallPartner(otherParticipantId, otherUser?.displayName || chatRoomData.participantNames?.[otherParticipantId] || 'Call partner');
        setDirectCallPartnerPhoto(otherUser?.photoUrl || chatRoomData.participantPhotos?.[otherParticipantId] || '');
      } catch (contextError) {
        console.error('Failed to load direct call context:', contextError);
      }
    };

    loadChatContext();
  }, [location.search, user]);

  useEffect(() => {
    if (!user) return;

    getChatRooms(user.uid)
      .then((rooms) => {
        const directRooms = rooms.filter((room) => room.participants.length >= 2);
        setCallableRooms(directRooms);

        if (chatRoomContextId) {
          setSelectedCallableRoomId(chatRoomContextId);
          return;
        }

        if (!selectedCallableRoomId && directRooms.length > 0) {
          setSelectedCallableRoomId(directRooms[0].id);
        }
      })
      .catch((loadError) => {
        console.error('Unable to load chat rooms for direct calling:', loadError);
      });
  }, [chatRoomContextId, selectedCallableRoomId, user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeCallHistory(user.uid, (entries) => {
      setCallHistory(entries);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeGroupCallRooms(user.uid, setGroupCallRooms);
  }, [user]);

  useEffect(() => {
    const runQueuedAction = async () => {
      if (!isLocalMediaReady || !localStreamRef.current) return;

      if (pendingAutoJoinRoom) {
        const roomToJoin = pendingAutoJoinRoom;
        setPendingAutoJoinRoom(null);
        await joinRoomById(roomToJoin);
        return;
      }

      if (pendingAutoStartCall || pendingChatRoomInvite) {
        await createRoom(pendingChatRoomInvite ?? undefined, callMode);
        setPendingChatRoomInvite(null);
        setPendingAutoStartCall(false);
      }
    };

    runQueuedAction().catch((queuedError) => {
      console.error('Failed to process queued video call action:', queuedError);
    });
  // Queue changes are the triggers; the call functions consume the latest refs and state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatRoomInvite, pendingAutoJoinRoom, pendingAutoStartCall, isLocalMediaReady]);

  const isVideoCall = callMode === 'video';
  const partnerMessageCount = callChatMessages.filter(message => !message.mine).length;
  const unreadChatCount = Math.max(0, partnerMessageCount - seenPartnerMessageCount);
  const showRemoteVideo = isVideoCall && Boolean(remoteStream);
  const partnerInitial = callTargetName.slice(0, 1).toUpperCase();
  const selfInitial = (user?.displayName || 'You').slice(0, 1).toUpperCase();
  const stageMessage = isRinging ? 'Ringing…' : remoteStream ? `${isVideoCall ? 'Video' : 'Audio'} call · ${callDuration}` : status;
  const lastCallNotice = !currentRoomId && (endedCallDuration || /ended|no answer|declined/i.test(status))
    ? `${status}${endedCallDuration ? ` · ${endedCallDuration}` : ''}`
    : null;

  const toggleChat = () => {
    setSeenPartnerMessageCount(partnerMessageCount);
    setIsChatOpen(open => !open);
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(getInviteLink());
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setError('Unable to copy the invite link.');
    }
  };

  const errorAlert = error && (
    <div className="vc-alert vc-alert-error" role="alert">
      <span>{error}</span>
      {currentRoomId && connectionQuality === 'failed' && (
        <button type="button" onClick={() => void retryConnection()}>Reconnect</button>
      )}
      {!currentRoomId && !localStreamRef.current && (
        <button type="button" onClick={() => void retryMediaAccess()}>Try again</button>
      )}
    </div>
  );
  const offlineAlert = !isOnline && <div className="vc-alert vc-alert-warning" role="status">You are offline. Calls resume when your connection returns.</div>;

  if (currentRoomId) {
    return (
      <div className="video-call-page in-call">
        <div className={`vc-stage ${isChatOpen && chatRoomContextId ? 'has-chat' : ''}`}>
          <div className="vc-stage-main">
            <header className="vc-stage-top">
              <div className="vc-peer">
                <span className="vc-avatar vc-avatar-sm">{directCallPartnerPhoto ? <img src={directCallPartnerPhoto} alt="" /> : partnerInitial}</span>
                <span className="vc-peer-text"><strong>{callTargetName}</strong><small>{isVideoCall ? 'Video call' : 'Audio call'} · {callDuration}</small></span>
              </div>
              <div className="vc-stage-top-actions">
                <span className={`vc-pill phase-${connectionPhase} quality-${connectionQuality}`} aria-live="polite"><span className="vc-dot" />{displayedConnectionLabel}</span>
                {!directCallMode && (
                  <button type="button" className="vc-pill vc-pill-button" onClick={() => void copyInviteLink()}>
                    <Link2 size={14} /> {inviteCopied ? 'Copied' : 'Copy invite'}
                  </button>
                )}
              </div>
            </header>

            <div className="vc-stage-body">
              <video ref={remoteVideoRef} autoPlay playsInline className={`vc-remote-video ${showRemoteVideo ? '' : 'is-hidden'}`} />
              {!showRemoteVideo && (
                <div className="vc-remote-placeholder">
                  <span className={`vc-avatar vc-avatar-xl ${isRinging || !remoteStream ? 'is-calling' : ''}`}>{directCallPartnerPhoto ? <img src={directCallPartnerPhoto} alt="" /> : partnerInitial}</span>
                  <h2>{callTargetName}</h2>
                  <p>{stageMessage}</p>
                </div>
              )}

              {isVideoCall && (
                <div className="vc-pip">
                  <video ref={localVideoRef} autoPlay muted playsInline className={isSharingScreen ? '' : 'mirrored'} />
                  {isCameraOff && !isSharingScreen && <div className="vc-pip-placeholder"><span className="vc-avatar vc-avatar-sm">{selfInitial}</span></div>}
                  <span className="vc-pip-label">{isSharingScreen ? 'Your screen' : 'You'}{isMicMuted ? ' · muted' : ''}</span>
                </div>
              )}

              <div className="vc-stage-alerts">
                {offlineAlert}
                {errorAlert}
                {!error && currentRoomId && connectionQuality === 'failed' && (
                  <div className="vc-alert vc-alert-error" role="status">
                    <span>The connection was lost.</span>
                    <button type="button" onClick={() => void retryConnection()}>Reconnect</button>
                  </div>
                )}
              </div>
            </div>

            <CallControls
              isVideoCall={isVideoCall}
              hasLocalStream={Boolean(localStreamRef.current)}
              hasRemoteStream={Boolean(remoteStream)}
              isEndingCall={isEndingCall}
              isMicMuted={isMicMuted}
              isCameraOff={isCameraOff}
              speakerEnabled={speakerEnabled}
              isSharingScreen={isSharingScreen}
              showChatButton={Boolean(chatRoomContextId)}
              isChatOpen={isChatOpen}
              unreadChatCount={unreadChatCount}
              onHangUp={() => void endCallAndCloseScreen()}
              onToggleMic={() => void toggleMic()}
              onToggleCamera={toggleCamera}
              onSwitchCamera={() => void switchCamera()}
              onToggleSpeaker={toggleSpeaker}
              onToggleScreenShare={() => void toggleScreenShare()}
              onToggleChat={toggleChat}
            />
          </div>

          {isChatOpen && chatRoomContextId && (
            <InCallChat
              messages={callChatMessages}
              draft={callChatMessage}
              onDraftChange={setCallChatMessage}
              onSend={() => void sendCallChatMessage()}
              onClose={toggleChat}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-page">
      <header className="vc-header">
        <h1>Calls</h1>
        <p>{directCallMode ? `Getting ready to call ${callTargetName}…` : 'Talk face to face with your study partners.'}</p>
      </header>

      {(offlineAlert || errorAlert) && <div className="vc-alerts">{offlineAlert}{errorAlert}</div>}

      <div className="vc-lobby">
        <div className="vc-lobby-main">
          <section className="vc-card vc-preview-card" aria-labelledby="vc-preview-title">
            <div className="vc-preview">
              <video ref={localVideoRef} autoPlay muted playsInline className="mirrored" />
              {(!isLocalMediaReady || isCameraOff) && (
                <div className="vc-preview-placeholder">
                  <span className="vc-avatar vc-avatar-lg">{user?.photoUrl ? <img src={user.photoUrl} alt="" /> : selfInitial}</span>
                  <span>{isLocalMediaReady ? 'Your camera is off' : 'Camera and microphone are off'}</span>
                </div>
              )}
              <span className={`vc-pill vc-preview-status ${isLocalMediaReady ? 'phase-connected' : 'phase-error'}`}><span className="vc-dot" />{isLocalMediaReady ? 'Devices ready' : 'Preview off'}</span>
              {isLocalMediaReady && (
                <div className="vc-preview-controls">
                  <button type="button" className={`vc-control vc-control-sm ${isMicMuted ? 'is-active' : ''}`} onClick={() => void toggleMic()} aria-pressed={isMicMuted} aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'} title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}>
                    {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button type="button" className={`vc-control vc-control-sm ${isCameraOff ? 'is-active' : ''}`} onClick={toggleCamera} aria-pressed={isCameraOff} aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
                    {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                  </button>
                </div>
              )}
            </div>
            <div className="vc-preview-footer">
              <div>
                <h2 id="vc-preview-title">Check your setup</h2>
                <p>{isLocalMediaReady ? 'Make sure you look and sound right before you call.' : 'Turn on the preview to check your camera and microphone. Starting a call turns them on too.'}</p>
              </div>
              <button type="button" className="vc-btn vc-btn-ghost" onClick={() => void retryMediaAccess()} disabled={isCreating || !isOnline}>
                {isLocalMediaReady ? 'Test again' : 'Turn on preview'}
              </button>
            </div>
          </section>

          <section className="vc-card vc-start-card" aria-labelledby="vc-start-title">
            <h2 id="vc-start-title">Start a call</h2>
            <p>Call anyone you have a conversation with in Chat.</p>
            <label className="vc-field">
              <span>Contact</span>
              <select
                value={selectedCallableRoomId}
                onChange={(e) => {
                  setSelectedCallableRoomId(e.target.value);
                  setError('');
                }}
                disabled={callableRooms.length === 0 || isCreating}
              >
                {callableRooms.length === 0 ? (
                  <option value="">No contacts yet</option>
                ) : (
                  callableRooms.map((room) => (
                    <option key={room.id} value={room.id}>{getOtherNameFromRoom(room)}</option>
                  ))
                )}
              </select>
            </label>
            <div className="vc-start-actions">
              <button
                type="button"
                className="vc-btn vc-btn-primary"
                onClick={startDirectCallFromVideoPage}
                disabled={!isOnline || !selectedCallableRoomId || isCreating}
              >
                <Video size={18} /> {isCreating && callMode === 'video' ? 'Calling…' : 'Video call'}
              </button>
              <button
                type="button"
                className="vc-btn vc-btn-secondary"
                onClick={startDirectAudioCallFromVideoPage}
                disabled={!isOnline || !selectedCallableRoomId || isCreating}
              >
                <Phone size={18} /> {isCreating && callMode === 'audio' ? 'Calling…' : 'Audio call'}
              </button>
            </div>
            {callableRooms.length === 0 && <p className="vc-hint">Start a conversation in Chat to see contacts here.</p>}
            {lastCallNotice && <p className="vc-hint vc-last-call"><History size={14} /> {lastCallNotice}</p>}
          </section>
        </div>

        <CallActivityPanel
          groupCallRooms={groupCallRooms}
          callHistory={callHistory}
          currentUserId={user?.uid}
          onStartGroupCall={() => navigate('/profile')}
          onJoinGroupCall={room => navigate(`/group-call?room=${encodeURIComponent(room.id)}&title=${encodeURIComponent(room.title)}`)}
        />
      </div>
    </div>
  );
}
