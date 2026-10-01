import { useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';

export interface InCallChatMessage {
  id: string;
  author: string;
  text: string;
  mine: boolean;
}

interface InCallChatProps {
  messages: InCallChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}

/** Chat drawer shown beside the call; messages are the linked chat conversation. */
export function InCallChat({ messages, draft, onDraftChange, onSend, onClose }: InCallChatProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <aside className="vc-chat" aria-label="In-call chat">
      <header className="vc-chat-header">
        <strong>In-call chat</strong>
        <button type="button" onClick={onClose} aria-label="Close chat"><X size={18} /></button>
      </header>
      <div ref={listRef} className="vc-chat-messages" aria-live="polite">
        {messages.length ? messages.map(message => (
          <div key={message.id} className={`vc-chat-message ${message.mine ? 'mine' : 'theirs'}`}>
            {!message.mine && <span className="vc-chat-author">{message.author}</span>}
            <p>{message.text}</p>
          </div>
        )) : <p className="vc-chat-empty">Messages sent here also appear in your chat.</p>}
      </div>
      <form className="vc-chat-compose" onSubmit={event => { event.preventDefault(); onSend(); }}>
        <input value={draft} onChange={event => onDraftChange(event.target.value)} placeholder="Send a message" aria-label="In-call message" />
        <button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={16} /></button>
      </form>
    </aside>
  );
}
