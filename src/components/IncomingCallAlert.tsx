import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { declineIncomingCall, sendChatMessage, subscribeIncomingCalls, type IncomingCall } from '../lib/firestoreService';
import { useRingtone } from '../hooks/useRingtone';
import './IncomingCallAlert.css';

// Slightly longer than the caller's 30 second missed-call timeout.
const INCOMING_CALL_RING_MS = 35_000;

/** App-wide incoming call prompt, so calls reach the user on any page. */
export function IncomingCallAlert() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<IncomingCall[]>([]);
  const [handledRoomIds, setHandledRoomIds] = useState<Set<string>>(() => new Set());
  const { startRingtone, stopRingtone } = useRingtone();

  const markHandled = (roomId: string) => {
    setHandledRoomIds(previous => new Set(previous).add(roomId));
  };

  useEffect(() => {
    if (!user) return;
    return subscribeIncomingCalls(user.uid, setCalls);
  }, [user]);

  // The call screen is already starting or joining a call when its link names a room or a chat.
  const params = new URLSearchParams(location.search);
  const onActiveCallScreen = location.pathname === '/video-call' && ['room', 'autoStart', 'chatRoomId'].some(key => params.has(key));
  const call = onActiveCallScreen ? null : calls.find(item => !handledRoomIds.has(item.roomId)) || null;
  const activeRoomId = call?.roomId ?? null;
  const activeCreatedAt = call?.createdAt.getTime() ?? 0;

  useEffect(() => {
    if (!activeRoomId) {
      stopRingtone();
      return;
    }
    void startRingtone();
    // Stop ringing if the caller disappears without ending the call (for example, a closed tab).
    const remainingMs = Math.max(0, activeCreatedAt + INCOMING_CALL_RING_MS - new Date().getTime());
    const expireTimer = window.setTimeout(() => {
      setHandledRoomIds(previous => new Set(previous).add(activeRoomId));
    }, remainingMs);
    return () => {
      window.clearTimeout(expireTimer);
      stopRingtone();
    };
  }, [activeRoomId, activeCreatedAt, startRingtone, stopRingtone]);

  if (!user || !call) return null;

  const handleAccept = () => {
    markHandled(call.roomId);
    const joinParams = new URLSearchParams({ room: call.roomId, callType: call.callType });
    if (call.chatRoomId) joinParams.set('chatRoomId', call.chatRoomId);
    if (call.sessionId) joinParams.set('sessionId', call.sessionId);
    navigate(`/video-call?${joinParams.toString()}`);
  };

  const handleDecline = async () => {
    markHandled(call.roomId);
    try {
      await declineIncomingCall(call.roomId, user.uid);
    } catch (declineError) {
      console.error('Failed to decline call:', declineError);
    }
    if (call.chatRoomId) {
      try {
        await sendChatMessage(call.chatRoomId, { senderId: user.uid, text: 'Call declined', timestamp: new Date(), isRead: false });
      } catch (messageError) {
        console.error('Failed to send declined call notice:', messageError);
      }
    }
  };

  const callLabel = call.callType === 'audio' ? 'audio' : 'video';

  return (
    <div className="incoming-call-alert" role="alertdialog" aria-labelledby="incoming-call-title" aria-describedby="incoming-call-type">
      <div className="incoming-call-avatar">
        {call.callerPhoto ? <img src={call.callerPhoto} alt="" /> : <span>{call.callerName.slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="incoming-call-text">
        <strong id="incoming-call-title">{call.callerName}</strong>
        <span id="incoming-call-type">Incoming {callLabel} call</span>
      </div>
      <div className="incoming-call-actions">
        <button type="button" className="incoming-call-decline" onClick={() => void handleDecline()} aria-label={`Decline ${callLabel} call from ${call.callerName}`}>
          <PhoneOff size={18} />
        </button>
        <button type="button" className="incoming-call-accept" onClick={handleAccept} aria-label={`Accept ${callLabel} call from ${call.callerName}`}>
          {call.callType === 'audio' ? <Phone size={18} /> : <Video size={18} />}
        </button>
      </div>
    </div>
  );
}
