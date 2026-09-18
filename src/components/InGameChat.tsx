import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MessageCircle, Send, X } from 'lucide-react';
import { useMultiplayer, ChatMessage } from '../store/MultiplayerContext';
import { Avatar } from './AvatarPicker';
import { useChatDialog } from './useChatDialog';
import { sounds } from '../utils/audio';
import '../styles/chat.css';

const QUICK_REPLIES = ['Love that', 'You know me so well!', 'Wait, what?!', 'My turn!', 'Good game!', 'One more round?'];

export const InGameChat: React.FC = () => {
  const { status, chatMessages, unreadChatCount, latestIncomingMessage, sendChatMessage, clearUnreadChatCount, remoteProfile } = useMultiplayer();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [activeToast, setActiveToast] = useState<ChatMessage | null>(null);
  const [error, setError] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const connected = status === 'connected';
  const closeChat = () => { setIsOpen(false); clearUnreadChatCount(); };
  const dialogRef = useChatDialog(isOpen, closeChat, triggerRef);
  const partnerName = remoteProfile?.name || 'Your person';
  const partnerAvatar = remoteProfile?.avatarId || 'sunny';

  useEffect(() => {
    if (!isOpen) return;
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    clearUnreadChatCount();
  }, [chatMessages.length, isOpen, clearUnreadChatCount]);

  useEffect(() => {
    if (isOpen || !latestIncomingMessage) return;
    setActiveToast(latestIncomingMessage);
    const timer = setTimeout(() => setActiveToast(null), 5000);
    return () => clearTimeout(timer);
  }, [latestIncomingMessage, isOpen]);

  const openChat = () => {
    setIsOpen(true); setActiveToast(null); clearUnreadChatCount(); sounds.playFlip();
  };
  const sendText = (text: string, quick = false) => {
    if (!text.trim()) return;
    setError('');
    if (!connected || !sendChatMessage(text.trim(), quick)) {
      setError('The room connection was interrupted. Your draft is still here. Reconnect to send it.');
      return;
    }
    if (!quick) setInputText('');
  };

  if (!connected && !isOpen) return null;

  return createPortal(<>
    {activeToast && !isOpen && <button className="chat-toast" onClick={openChat} aria-label={`New message from ${partnerName}: ${activeToast.text}`}><Avatar avatarId={partnerAvatar} size={39} /><div><strong>{partnerName} says...</strong><p>{activeToast.text}</p></div><MessageCircle size={19} /></button>}
    <button ref={triggerRef} hidden={isOpen} className="room-chat-trigger" onClick={openChat} aria-label={unreadChatCount ? `Open in-game chat, ${unreadChatCount} unread messages` : 'Open in-game chat'}><MessageCircle size={21} /><b>A little banter</b>{unreadChatCount > 0 && <span>{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>}</button>
    {isOpen && <div className="chat-overlay" onClick={closeChat}><div className="chat-window room-chat-window" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="room-chat-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className="chat-masthead"><div className="chat-masthead-title"><Avatar avatarId={partnerAvatar} size={43} /><div><h2 id="room-chat-title">A little banter</h2><p className={connected ? 'room-chat-status' : ''}>{connected ? `In the room with ${partnerName}` : 'Your room is disconnected'}</p></div></div><button className="chat-icon-button" onClick={closeChat} aria-label="Close in-game chat"><X /></button></header>
      {!connected && <div className="chat-linked-notice">Your person has left the room or the connection dropped. Reconnect to keep chatting.</div>}
      <div className="chat-feed" ref={feedRef} role="log" aria-live="polite" aria-label="In-game conversation">
        {chatMessages.length === 0 ? <div className="chat-welcome"><div className="chat-doodle" aria-hidden="true"><MessageCircle /><MessageCircle /><span /></div><h3>The game has a chat.<br />Make it a good one.</h3><p>A little teasing, a victory lap, or a sweet note for {partnerName}. Your messages are just for this room.</p></div>
        : chatMessages.map(message => {
          const mine = message.senderId === 'me';
          return <div className={`chat-message ${mine ? 'is-mine' : ''}`} key={message.id}>{!mine && <Avatar avatarId={message.senderAvatar} size={28} />}<div className="chat-message-body"><div className="chat-bubble">{message.text}</div><div className="chat-message-meta"><time dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{mine && <span><Check /> Sent</span>}</div></div></div>;
        })}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <div className="chat-quick-replies" aria-label="Quick replies">{QUICK_REPLIES.map(text => <button key={text} disabled={!connected} onClick={() => sendText(text, true)}>{text}</button>)}</div>
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); sendText(inputText); }}><input aria-label={`Message ${partnerName}`} value={inputText} onChange={event => setInputText(event.target.value)} placeholder={`Say something to ${partnerName}...`} maxLength={500} autoComplete="off" disabled={!connected} /><button type="submit" aria-label="Send message" disabled={!inputText.trim() || !connected}><Send /></button></form>
    </div></div>}
  </>, document.body);
};
