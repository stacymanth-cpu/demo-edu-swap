import { format } from 'date-fns';
import { Check, FileText, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { formatFileSize, getMessageStatus, isPlainTextMessage } from '../../lib/chatUtils';
import { isChatFileReference } from '../../lib/firestore/chat';
import type { ChatMessage } from '../../types';

interface ChatMessageBubbleProps {
  msg: ChatMessage;
  currentUserId: string | undefined;
  isEditing: boolean;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onStartEdit: (msg: ChatMessage) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (msg: ChatMessage) => void;
  /** Opens a file stored in Firestore (fileUrl is an internal "eduswap-file:" reference). */
  onOpenFile: (msg: ChatMessage) => void;
  isOpeningFile: boolean;
}

const STATUS_LABELS = { read: 'Read', delivered: 'Delivered', sent: 'Sent' } as const;

export function ChatMessageBubble({
  msg, currentUserId, isEditing, editingText,
  onEditingTextChange, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onOpenFile, isOpeningFile,
}: ChatMessageBubbleProps) {
  const isOwn = msg.senderId === currentUserId;
  const status = getMessageStatus(msg, currentUserId);
  // Show "PDF" or "DOCX" rather than a long MIME type.
  const fileTypeLabel = msg.fileName?.includes('.') ? msg.fileName.split('.').pop()!.toUpperCase() : 'File';

  return (
    <div className={`chat-bubble ${isOwn ? 'sent' : 'received'}`}>
      {msg.deletedAt ? <p className="deleted-message">This message was deleted</p> : isEditing ? (
        <div className="message-edit-form"><textarea value={editingText} maxLength={5000} onChange={event => onEditingTextChange(event.target.value)} aria-label="Edit message" /><div><button type="button" onClick={onSaveEdit} disabled={!editingText.trim()}><Check size={14} /> Save</button><button type="button" onClick={onCancelEdit}><X size={14} /> Cancel</button></div></div>
      ) : <>
      {msg.linkUrl ? (
        <div className="message-card link-card">
          <span className="message-card-label">Link</span>
          <a href={msg.linkUrl} target="_blank" rel="noreferrer" className="message-link-title">
            {msg.linkTitle || msg.linkUrl}
          </a>
          <span className="message-link-url">{msg.linkUrl}</span>
        </div>
      ) : null}
      {msg.fileUrl ? (
        <div className="message-card file-card">
          <div className="message-card-header">
            <span className="message-card-label">Document</span>
            <span className="message-file-size">{msg.fileSize ? formatFileSize(msg.fileSize) : ''}</span>
          </div>
          {isChatFileReference(msg.fileUrl) ? (
            <button type="button" className="message-file-link" onClick={() => onOpenFile(msg)} disabled={isOpeningFile} aria-label={`Open ${msg.fileName}`}>
              <span className="file-icon">{isOpeningFile ? <Loader2 size={20} className="spinner" /> : <FileText size={20} />}</span>
              <span className="file-meta">
                <strong>{msg.fileName}</strong>
                <span>{isOpeningFile ? 'Opening…' : fileTypeLabel}</span>
              </span>
            </button>
          ) : (
            <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="message-file-link">
              <span className="file-icon"><FileText size={20} /></span>
              <span className="file-meta">
                <strong>{msg.fileName}</strong>
                <span>{fileTypeLabel}</span>
              </span>
            </a>
          )}
        </div>
      ) : null}
      {msg.sharedNote ? (
        <div className="message-card note-card">
          <span className="message-card-label">Note</span>
          <strong className="message-note-title">{msg.sharedNote.title}</strong>
          <p className="message-note-content">{msg.sharedNote.content}</p>
        </div>
      ) : null}
      {isPlainTextMessage(msg) ? <p>{msg.text}</p> : null}
      {msg.editedAt && <span className="message-edited-label">Edited</span>}
      {isOwn && (
        <div className="message-actions">
          {isPlainTextMessage(msg) && <button type="button" onClick={() => onStartEdit(msg)} aria-label="Edit message" title="Edit message"><Pencil size={13} /></button>}
          <button type="button" onClick={() => onDelete(msg)} aria-label="Delete message" title="Delete message"><Trash2 size={13} /></button>
        </div>
      )}
      </>}
      <div className="bubble-meta">
        <span className="bubble-time">{format(msg.timestamp, 'h:mm a')}</span>
        {status && (
          <span className={`message-status ${status}`} aria-label={STATUS_LABELS[status]} title={STATUS_LABELS[status]}>
            {status === 'sent' ? '✓' : '✓✓'} <span>{STATUS_LABELS[status]}</span>
          </span>
        )}
      </div>
    </div>
  );
}
