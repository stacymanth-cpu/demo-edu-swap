import { formatChatTime, formatLastSeen, getInitials } from '../../lib/chatUtils';
import type { ChatRoom } from '../../types';

interface ChatRoomListItemProps {
  room: ChatRoom;
  otherName: string;
  isActive: boolean;
  presence?: { isOnline: boolean; lastSeen: Date | null };
  unreadCount: number;
  onSelect: (room: ChatRoom) => void;
}

export function ChatRoomListItem({ room, otherName, isActive, presence, unreadCount, onSelect }: ChatRoomListItemProps) {
  const isOnline = Boolean(presence?.isOnline);
  return (
    <button
      className={`chat-room-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(room)}
      id={`chat-room-${room.id}`}
    >
      <div className="chat-room-avatar">
        <span>{getInitials(otherName)}</span>
      </div>
      <div className="chat-room-info">
        <div className="chat-room-top">
          <span className="chat-room-name">{otherName}</span>
          <span className="chat-room-time">{formatChatTime(room.lastMessageAt)}</span>
        </div>
        <div className="chat-room-status-row">
          <span className={`chat-room-status-dot ${isOnline ? 'online-dot' : 'offline-dot'}`} />
          <span className={`chat-room-status ${isOnline ? 'online-status' : 'offline-status'}`}>
            {isOnline ? 'Online' : formatLastSeen(presence?.lastSeen ?? null)}
          </span>
        </div>
        <div className="chat-room-bottom">
          <span className="chat-room-msg">{room.lastMessage}</span>
          {unreadCount > 0 && <span className="chat-unread">{unreadCount}</span>}
        </div>
      </div>
    </button>
  );
}
