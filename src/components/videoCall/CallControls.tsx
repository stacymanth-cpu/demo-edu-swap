import type { ReactNode } from 'react';
import { detectScreenShareEnvironment, getScreenShareSupportIssue } from '../../lib/callUtils';
import { MessageSquare, Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';

interface CallControlsProps {
  isVideoCall: boolean;
  hasLocalStream: boolean;
  hasRemoteStream: boolean;
  isEndingCall: boolean;
  isMicMuted: boolean;
  isCameraOff: boolean;
  speakerEnabled: boolean;
  isSharingScreen: boolean;
  showChatButton: boolean;
  isChatOpen: boolean;
  unreadChatCount: number;
  onHangUp: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onToggleSpeaker: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
}

function ControlButton({ label, active = false, danger = false, disabled = false, unavailable = false, pressed, onClick, children, badge }: {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  unavailable?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      className={`vc-control ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''} ${unavailable ? 'is-unavailable' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
    >
      {children}
      {badge ? <span className="vc-control-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span> : null}
      <span className="vc-control-label">{label}</span>
    </button>
  );
}

/** Round in-call control bar: media toggles, chat and hang up. */
export function CallControls({
  isVideoCall, hasLocalStream, hasRemoteStream, isEndingCall, isMicMuted, isCameraOff, speakerEnabled, isSharingScreen,
  showChatButton, isChatOpen, unreadChatCount,
  onHangUp, onToggleMic, onToggleCamera, onSwitchCamera, onToggleSpeaker, onToggleScreenShare, onToggleChat,
}: CallControlsProps) {
  const canShareScreen = getScreenShareSupportIssue(detectScreenShareEnvironment()) === null;

  return (
    <div className="vc-controls" role="toolbar" aria-label="Call controls">
      <ControlButton label={isMicMuted ? 'Unmute' : 'Mute'} active={isMicMuted} pressed={isMicMuted} disabled={!hasLocalStream} onClick={onToggleMic}>
        {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </ControlButton>
      {isVideoCall && (
        <ControlButton label={isCameraOff ? 'Turn camera on' : 'Turn camera off'} active={isCameraOff} pressed={isCameraOff} disabled={!hasLocalStream} onClick={onToggleCamera}>
          {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
        </ControlButton>
      )}
      {isVideoCall && (
        <ControlButton label="Switch camera" disabled={!hasLocalStream || isCameraOff} onClick={onSwitchCamera}>
          <SwitchCamera size={20} />
        </ControlButton>
      )}
      {/* Shown even where unsupported (phones), so pressing it can explain why instead of the button vanishing. */}
      {isVideoCall && (
        <ControlButton
          label={isSharingScreen ? 'Stop sharing' : canShareScreen ? 'Share screen' : 'Share screen (unavailable here)'}
          active={isSharingScreen}
          pressed={isSharingScreen}
          unavailable={!canShareScreen}
          onClick={onToggleScreenShare}
        >
          {isSharingScreen ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
        </ControlButton>
      )}
      <ControlButton label={speakerEnabled ? 'Mute speaker' : 'Unmute speaker'} active={!speakerEnabled} pressed={!speakerEnabled} disabled={!hasRemoteStream} onClick={onToggleSpeaker}>
        {speakerEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </ControlButton>
      {showChatButton && (
        <ControlButton label={isChatOpen ? 'Hide chat' : 'Show chat'} active={isChatOpen} pressed={isChatOpen} onClick={onToggleChat} badge={isChatOpen ? 0 : unreadChatCount}>
          <MessageSquare size={20} />
        </ControlButton>
      )}
      <ControlButton label={isEndingCall ? 'Ending call' : 'End call'} danger disabled={isEndingCall} onClick={onHangUp}>
        <PhoneOff size={22} />
      </ControlButton>
    </div>
  );
}
