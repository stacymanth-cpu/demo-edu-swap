interface ChatSharePanelProps {
  mode: 'link' | 'note';
  linkUrl: string;
  linkTitle: string;
  noteTitle: string;
  noteBody: string;
  error: string;
  onLinkUrlChange: (value: string) => void;
  onLinkTitleChange: (value: string) => void;
  onNoteTitleChange: (value: string) => void;
  onNoteBodyChange: (value: string) => void;
  onSendLink: () => void;
  onSendNote: () => void;
}

export function ChatSharePanel({
  mode, linkUrl, linkTitle, noteTitle, noteBody, error,
  onLinkUrlChange, onLinkTitleChange, onNoteTitleChange, onNoteBodyChange, onSendLink, onSendNote,
}: ChatSharePanelProps) {
  return (
    <div className="chat-share-panel">
      {mode === 'link' ? (
        <>
          <input
            type="text"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={e => onLinkUrlChange(e.target.value)}
            className="share-input"
          />
          <input
            type="text"
            placeholder="Optional title"
            value={linkTitle}
            onChange={e => onLinkTitleChange(e.target.value)}
            className="share-input"
          />
          <button type="button" className="share-action-btn" onClick={onSendLink}>
            Send link
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Note title"
            value={noteTitle}
            onChange={e => onNoteTitleChange(e.target.value)}
            className="share-input"
          />
          <textarea
            placeholder="Write your note here..."
            value={noteBody}
            onChange={e => onNoteBodyChange(e.target.value)}
            className="share-textarea"
          />
          <button type="button" className="share-action-btn" onClick={onSendNote}>
            Send note
          </button>
        </>
      )}
      {error && <div className="share-error">{error}</div>}
    </div>
  );
}
