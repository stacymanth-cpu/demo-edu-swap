import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Loader2, FileText, Link2, FileDown, PhoneCall, Search, MoreVertical, Flag, Ban, X, MessageCircle } from 'lucide-react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { blockUser, deleteChatMessage, editChatMessage, getChatRooms, markChatMessagesRead, setChatTyping, submitReport, subscribeToChatRooms, subscribeToChatMessages, subscribeUserPresence, sendChatMessage, uploadChatDocument, getUser, getChatFileUrl, getChatFileContentType, CHAT_FILE_EXTENSIONS } from '../lib/firestoreService';
import { useAuth } from '../context/AuthContext';
import type { ChatRoom, ChatMessage as ChatMsg } from '../types';
import { formatLastSeen, getInitials, isValidUrl, messageMatchesSearch } from '../lib/chatUtils';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatRoomListItem } from '../components/chat/ChatRoomListItem';
import { ChatSharePanel } from '../components/chat/ChatSharePanel';
import './ChatPage.css';

export function ChatPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sharePanel, setSharePanel] = useState<'none' | 'link' | 'note'>('none');
  const [shareLinkUrl, setShareLinkUrl] = useState('');
  const [shareLinkTitle, setShareLinkTitle] = useState('');
  const [shareNoteTitle, setShareNoteTitle] = useState('');
  const [shareNoteBody, setShareNoteBody] = useState('');
  const [shareError, setShareError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [draggingFile, setDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<Date | null>(null);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, { isOnline: boolean; lastSeen: Date | null }>>({});
  const [messageSearch, setMessageSearch] = useState('');
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Load chat rooms and user presence for each room
  useEffect(() => {
    if (!user) return;
    setLoadError('');
    setLoading(true);

    const loadRoomStatuses = async (rooms: ChatRoom[]) => {
      const statuses: Record<string, { isOnline: boolean; lastSeen: Date | null }> = {};
      await Promise.all(rooms.map(async (room) => {
        const otherId = room.participants.find(p => p !== user.uid);
        if (!otherId) return;
        // Online status is a nice-to-have; never let it stop the conversation list loading.
        const other = await getUser(otherId).catch(() => null);
        statuses[room.id] = {
          isOnline: other?.isOnline ?? false,
          lastSeen: other?.lastSeen ?? null,
        };
      }));
      setRoomStatuses(statuses);
    };

    getChatRooms(user.uid)
      .then(async rooms => {
        const sorted = rooms.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
        setChatRooms(sorted);
        await loadRoomStatuses(sorted);

        const targetRoomId = (location.state as { selectedRoomId?: string })?.selectedRoomId;
        if (targetRoomId) {
          const targetRoom = sorted.find(r => r.id === targetRoomId);
          if (targetRoom) setSelectedRoom(targetRoom);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load chat rooms:', err);
        setLoadError('We could not load your conversations. Check your connection and try again.');
        setLoading(false);
      });
  }, [user, location.state]);

  useEffect(() => {
    if (!user) return;
    return subscribeToChatRooms(user.uid, rooms => {
      const sortedRooms = rooms.slice().sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
      setChatRooms(sortedRooms);
      setSelectedRoom(current => current ? sortedRooms.find(room => room.id === current.id) || null : current);
    });
  }, [user]);

  const clearChatSelection = () => {
    setSelectedRoom(null);
    setMessages([]);
    setOtherOnline(false);
    setOtherLastSeen(null);
    setShareError('');
    setUploadSuccess('');
    setUploadProgress(0);
    setMessageSearch('');
    setShowConversationSearch(false);
    setShowSafetyMenu(false);
  };

  // Subscribe to real-time messages when a room is selected
  useEffect(() => {
    if (!selectedRoom) return;
    const unsubscribe = subscribeToChatMessages(selectedRoom.id, (msgs) => {
      setMessages(msgs);
      if (user) void markChatMessagesRead(selectedRoom.id, user.uid, msgs).catch(error => console.error('Failed to update read receipts:', error));
    });
    return unsubscribe;
  }, [selectedRoom, user]);

  // Fetch other user's online status when room changes
  useEffect(() => {
    if (!selectedRoom || !user) return;
    const otherId = selectedRoom.participants.find(p => p !== user.uid);
    if (!otherId) return;
    return subscribeUserPresence(otherId, presence => {
      setOtherOnline(presence.isOnline);
      setOtherLastSeen(presence.lastSeen);
    });
  }, [selectedRoom, user]);

  useEffect(() => {
    const roomId = selectedRoom?.id;
    const userId = user?.uid;
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (roomId && userId) void setChatTyping(roomId, userId, false);
    };
  }, [selectedRoom?.id, user?.uid]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getOtherName = useCallback((room: ChatRoom) => {
    const otherId = room.participants.find(p => p !== user?.uid);
    return otherId ? room.participantNames[otherId] : 'Unknown';
  }, [user?.uid]);

  const getOtherId = (room: ChatRoom) => room.participants.find(participantId => participantId !== user?.uid) || '';

  // Incoming calls are announced app-wide by IncomingCallAlert.

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedRoom || !user) return;
    const msg: Omit<ChatMsg, 'id'> = {
      senderId: user.uid,
      text: newMessage.trim(),
      timestamp: new Date(),
      isRead: false,
    };
    setNewMessage('');
    setShareError('');
    try {
      await sendChatMessage(selectedRoom.id, msg);
    } catch (err) {
      console.error('Failed to send message:', err);
      setShareError('Failed to send message. Please try again.');
      setNewMessage(msg.text);
    }
  };

  const startEditingMessage = (message: ChatMsg) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text);
    setShareError('');
  };

  const saveEditedMessage = async () => {
    if (!selectedRoom || !editingMessageId) return;
    try {
      await editChatMessage(selectedRoom.id, editingMessageId, editingMessageText);
      setEditingMessageId(null);
      setEditingMessageText('');
      setShareError('');
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Unable to edit this message.');
    }
  };

  const removeMessage = async (message: ChatMsg) => {
    if (!selectedRoom || !window.confirm('Delete this message for everyone in the conversation?')) return;
    try {
      await deleteChatMessage(selectedRoom.id, message.id);
      setShareError('');
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Unable to delete this message.');
    }
  };

  const handleMessageInput = (value: string) => {
    setNewMessage(value);
    if (!selectedRoom || !user) return;
    void setChatTyping(selectedRoom.id, user.uid, Boolean(value.trim()));
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => void setChatTyping(selectedRoom.id, user.uid, false), 1800);
  };

  const handleReportConversation = async () => {
    if (!selectedRoom || !user) return;
    const otherId = getOtherId(selectedRoom);
    const reason = window.prompt('Briefly describe the problem in this conversation:')?.trim();
    if (!otherId || !reason) return;
    try {
      await submitReport({ reporterId: user.uid, targetUserId: otherId, type: 'content', reason, details: `Chat ${selectedRoom.id}: ${reason}` });
      setShowSafetyMenu(false);
      window.alert('Report submitted for review.');
    } catch (error) {
      console.error('Failed to report conversation:', error);
      setShareError('Unable to submit the report. Please try again.');
    }
  };

  const handleBlockConversation = async () => {
    if (!selectedRoom || !user) return;
    const otherId = getOtherId(selectedRoom);
    if (!otherId || !window.confirm(`Block ${getOtherName(selectedRoom)}? They will no longer appear in your recommendations.`)) return;
    try {
      const roomId = selectedRoom.id;
      await blockUser(user.uid, otherId);
      clearChatSelection();
      setChatRooms(previous => previous.filter(room => room.id !== roomId));
    } catch (error) {
      console.error('Failed to block user:', error);
      setShareError('Unable to block this user. Please try again.');
    }
  };

  const handleShareLink = async () => {
    if (!selectedRoom || !user) return;
    if (!shareLinkUrl.trim() || !isValidUrl(shareLinkUrl)) {
      setShareError('Please enter a valid URL.');
      return;
    }
    const msg: Omit<ChatMsg, 'id'> = {
      senderId: user.uid,
      text: shareLinkTitle.trim() || shareLinkUrl.trim(),
      linkUrl: shareLinkUrl.trim(),
      linkTitle: shareLinkTitle.trim() || undefined,
      timestamp: new Date(),
      isRead: false,
    };
    try {
      await sendChatMessage(selectedRoom.id, msg);
      setShareLinkUrl('');
      setShareLinkTitle('');
      setSharePanel('none');
      setShareError('');
    } catch (err) {
      console.error('Failed to send link:', err);
      setShareError('Failed to share link. Please try again.');
    }
  };

  const handleShareNote = async () => {
    if (!selectedRoom || !user) return;
    if (!shareNoteTitle.trim() && !shareNoteBody.trim()) {
      setShareError('Please add a note title or content.');
      return;
    }
    const msg: Omit<ChatMsg, 'id'> = {
      senderId: user.uid,
      text: shareNoteTitle.trim() || shareNoteBody.trim(),
      sharedNote: {
        title: shareNoteTitle.trim() || 'Shared note',
        content: shareNoteBody.trim(),
      },
      timestamp: new Date(),
      isRead: false,
    };
    try {
      await sendChatMessage(selectedRoom.id, msg);
      setShareNoteTitle('');
      setShareNoteBody('');
      setSharePanel('none');
      setShareError('');
    } catch (err) {
      console.error('Failed to send note:', err);
      setShareError('Failed to share note. Please try again.');
    }
  };

  // Files shared in chat are rebuilt from Firestore. PDFs, images and text open in a new tab;
  // Office files download with their original name, since browsers cannot show them.
  const openSharedFile = async (message: ChatMsg) => {
    if (!selectedRoom || !message.fileUrl) return;
    const viewable = /^(application\/pdf|image\/|text\/plain)/.test(getChatFileContentType(message.fileName || '') || '');
    // Open the tab now, while the click still counts as a user action, or popup blockers stop it.
    const viewer = viewable ? window.open('about:blank', '_blank') : null;
    if (viewer) viewer.opener = null;
    setOpeningFileId(message.id);
    setShareError('');
    try {
      const url = await getChatFileUrl(selectedRoom.id, message.fileUrl);
      if (viewer) {
        viewer.location.replace(url);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = message.fileName || 'file';
        link.click();
      }
    } catch (openError) {
      viewer?.close();
      console.error('Failed to open shared file:', openError);
      setShareError(openError instanceof Error ? openError.message : 'This file could not be opened.');
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRoom || !user) {
      setShareError('Please open a chat before uploading a document.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!getChatFileContentType(file.name)) {
      setShareError('Choose a PDF, document, presentation, spreadsheet, text file, or image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setShareError('Files must be 10 MB or smaller.');
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    setUploadSuccess('');
    setShareError('');

    const uploadResult = await uploadChatDocument(selectedRoom.id, file, progress => {
      setUploadProgress(progress);
    }).catch((err) => {
      console.error('File upload failed:', err);
      setShareError(err instanceof Error && err.message ? err.message : 'Failed to upload document. Please try again.');
      return null;
    });

    if (!uploadResult) {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const msg: Omit<ChatMsg, 'id'> = {
      senderId: user.uid,
      text: uploadResult.fileName,
      fileUrl: uploadResult.fileUrl,
      fileName: uploadResult.fileName,
      fileType: uploadResult.fileType,
      fileSize: uploadResult.fileSize,
      timestamp: new Date(),
      isRead: false,
    };

    const localMessage = {
      ...msg,
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    } as ChatMsg;

    setMessages(prev => [...prev, localMessage]);

    try {
      await sendChatMessage(selectedRoom.id, msg);
      setShareError('');
      setUploadSuccess('Document uploaded successfully.');
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err) {
      console.error('Sending document message failed:', err);
      setMessages(prev => prev.filter(item => item.id !== localMessage.id));
      setShareError('Failed to send document. Please try again.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDocumentClick = () => {
    if (uploadingFile) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingFile(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      await handleFileChange({
        ...({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>),
      });
    }
  };

  const selectRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
    setShareError('');
    setSharePanel('none');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const normalizedMessageSearch = messageSearch.trim().toLowerCase();
  const visibleMessages = normalizedMessageSearch ? messages.filter(message => messageMatchesSearch(message, normalizedMessageSearch)) : messages;
  const otherIsTyping = selectedRoom ? Boolean(selectedRoom.typingBy?.[getOtherId(selectedRoom)]) : false;


  if (loading) {
    return (
      <div className="chat-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  if (loadError) {
    return <div className="chat-page" role="alert"><div className="chat-empty-list"><p>{loadError}</p><button type="button" className="start-chat-link" onClick={() => window.location.reload()}>Try again</button></div></div>;
  }

  return (
    <div className="chat-page">
      {/* Chat List */}
      <div className={`chat-list ${selectedRoom ? 'chat-list-hidden-mobile' : ''}`}>
        <div className="chat-list-header">
          <h2>Messages</h2>
        </div>
        <div className="chat-rooms">
          {chatRooms.map(room => (
            <ChatRoomListItem
              key={room.id}
              room={room}
              otherName={getOtherName(room)}
              isActive={selectedRoom?.id === room.id}
              presence={roomStatuses[room.id]}
              unreadCount={room.unreadCount[user?.uid || ''] || 0}
              onSelect={selectRoom}
            />
          ))}
        </div>
        {chatRooms.length === 0 && (
          <div className="chat-empty-list">
            <p>No conversations yet</p>
            <Link to="/matches" className="start-chat-link">Accept a match to start chatting →</Link>
          </div>
        )}
      </div>

      {/* Chat Conversation */}
      <div
        className={`chat-conversation ${selectedRoom ? 'chat-conv-visible' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selectedRoom ? (
          <>
            <div className="chat-conv-header">
              <button className="back-btn-mobile" onClick={clearChatSelection}>
                <ArrowLeft size={20} />
              </button>
              <div className="chat-conv-avatar">
                <span>{getInitials(getOtherName(selectedRoom))}</span>
              </div>
              <div className="chat-conv-info">
                <h3>{getOtherName(selectedRoom)}</h3>
                <div className="chat-conv-status">
                  <span className={`chat-room-status-dot ${otherOnline ? 'online-dot' : 'offline-dot'}`} />
                  <span className={otherOnline ? 'online-status' : 'offline-status'}>
                    {otherOnline ? 'Online' : formatLastSeen(otherLastSeen)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="chat-video-call-btn"
                aria-label={`Start video call with ${getOtherName(selectedRoom)}`}
                onClick={() => {
                  const params = new URLSearchParams({
                    chatRoomId: selectedRoom.id,
                    autoStart: '1',
                  });
                  navigate(`/video-call?${params.toString()}`);
                }}
              >
                <PhoneCall size={16} />
                <span>Video Call</span>
              </button>
              <button
                type="button"
                className="chat-header-icon-btn"
                aria-label={`Start audio call with ${getOtherName(selectedRoom)}`}
                title="Audio call"
                onClick={() => {
                  const params = new URLSearchParams({ chatRoomId: selectedRoom.id, autoStart: '1', callType: 'audio' });
                  navigate(`/video-call?${params.toString()}`);
                }}
              >
                <PhoneCall size={17} />
              </button>
              <button type="button" className={`chat-header-icon-btn ${showConversationSearch ? 'active' : ''}`} onClick={() => setShowConversationSearch(open => !open)} aria-label="Search this conversation"><Search size={17} /></button>
              <div className="chat-safety-wrap">
                <button type="button" className="chat-header-icon-btn" onClick={() => setShowSafetyMenu(open => !open)} aria-label="Conversation options" aria-expanded={showSafetyMenu}><MoreVertical size={18} /></button>
                {showSafetyMenu && <div className="chat-safety-menu"><button type="button" onClick={() => void handleReportConversation()}><Flag size={15} /> Report conversation</button><button type="button" className="danger" onClick={() => void handleBlockConversation()}><Ban size={15} /> Block user</button></div>}
              </div>
            </div>

            {showConversationSearch && <div className="conversation-search"><Search size={16} /><input autoFocus type="search" value={messageSearch} onChange={event => setMessageSearch(event.target.value)} placeholder="Search messages, files, links, and notes" /><span>{visibleMessages.length} found</span><button type="button" onClick={() => { setMessageSearch(''); setShowConversationSearch(false); }} aria-label="Close search"><X size={16} /></button></div>}

            <div className="chat-messages">
              {visibleMessages.map(msg => (
                <ChatMessageBubble
                  key={msg.id}
                  msg={msg}
                  currentUserId={user?.uid}
                  isEditing={editingMessageId === msg.id}
                  editingText={editingMessageText}
                  onEditingTextChange={setEditingMessageText}
                  onStartEdit={startEditingMessage}
                  onSaveEdit={() => void saveEditedMessage()}
                  onCancelEdit={() => { setEditingMessageId(null); setEditingMessageText(''); }}
                  onDelete={message => void removeMessage(message)}
                  onOpenFile={message => void openSharedFile(message)}
                  isOpeningFile={openingFileId === msg.id}
                />
              ))}
              {visibleMessages.length === 0 && normalizedMessageSearch && <div className="message-search-empty">No messages match “{messageSearch}”.</div>}
              {otherIsTyping && <div className="typing-indicator" aria-label={`${getOtherName(selectedRoom)} is typing`}><span /><span /><span /><small>{getOtherName(selectedRoom)} is typing</small></div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-bar">
              <div className="chat-input-left-icons">
                <button
                  type="button"
                  className={`chat-share-btn ${sharePanel === 'link' ? 'active' : ''}`}
                  onClick={() => setSharePanel(prev => prev === 'link' ? 'none' : 'link')}
                  title="Share link"
                >
                  <Link2 size={18} />
                </button>
                <button
                  type="button"
                  className={`chat-share-btn ${sharePanel === 'note' ? 'active' : ''}`}
                  onClick={() => setSharePanel(prev => prev === 'note' ? 'none' : 'note')}
                  title="Share note"
                >
                  <FileText size={18} />
                </button>
                <button
                  type="button"
                  className="chat-attach-btn"
                  disabled={uploadingFile}
                  onClick={handleDocumentClick}
                  title={uploadingFile ? 'Uploading document...' : 'Upload document'}
                >
                  <FileDown size={18} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={CHAT_FILE_EXTENSIONS.map(extension => `.${extension}`).join(',')}
                  onChange={handleFileChange}
                  className="chat-file-input"
                  disabled={uploadingFile}
                />
              </div>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={e => handleMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                id="chat-input"
              />
              <button
                type="button"
                className="send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim()}
                id="btn-send-msg"
              >
                <Send size={18} />
              </button>
            </div>
            {uploadingFile && (
              <div className="chat-upload-status">
                Uploading document… {uploadProgress}%
                <div className="chat-upload-progress">
                  <div className="chat-upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
            {uploadSuccess && <div className="chat-upload-success">{uploadSuccess}</div>}
            {shareError && <div className="chat-input-error">{shareError}</div>}
            {draggingFile && (
              <div className="chat-drop-hint">
                Drop file here to upload
              </div>
            )}
            {sharePanel !== 'none' && (
              <ChatSharePanel
                mode={sharePanel}
                linkUrl={shareLinkUrl}
                linkTitle={shareLinkTitle}
                noteTitle={shareNoteTitle}
                noteBody={shareNoteBody}
                error={shareError}
                onLinkUrlChange={setShareLinkUrl}
                onLinkTitleChange={setShareLinkTitle}
                onNoteTitleChange={setShareNoteTitle}
                onNoteBodyChange={setShareNoteBody}
                onSendLink={handleShareLink}
                onSendNote={handleShareNote}
              />
            )}
          </>
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon"><MessageCircle size={28} /></div>
            <h3>Select a conversation</h3>
            <p>Choose a chat from the list to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
