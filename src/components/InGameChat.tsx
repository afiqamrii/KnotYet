import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MessageCircle, PanelRightClose, Send } from 'lucide-react';
import { useMultiplayer, type ChatMessage } from '../store/MultiplayerContext';
import { Avatar } from './AvatarPicker';
import { sounds } from '../utils/audio';
import '../styles/chat.css';

const QUICK_REPLIES = ['Love that', 'You know me so well!', 'Wait, what?!', 'My turn!', 'Good game!', 'One more round?'];
const DESKTOP_CHAT = '(min-width: 1440px)';

export const InGameChat: React.FC = () => {
  const { status, chatMessages, unreadChatCount, latestIncomingMessage, sendChatMessage, clearUnreadChatCount, remoteProfile } = useMultiplayer();
  const [isOpen, setIsOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_CHAT).matches);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_CHAT).matches);
  const [inputText, setInputText] = useState('');
  const [activeToast, setActiveToast] = useState<ChatMessage | null>(null);
  const [error, setError] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);
  const wasConnected = useRef(false);
  const connected = status === 'connected';
  const partnerName = remoteProfile?.name || 'Your person';
  const partnerAvatar = remoteProfile?.avatarId || 'sunny';

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_CHAT);
    const update = () => setIsDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (connected && !wasConnected.current && window.matchMedia(DESKTOP_CHAT).matches) setIsOpen(true);
    wasConnected.current = connected;
    if (!connected) setIsOpen(false);
  }, [connected]);

  useEffect(() => {
    const docked = connected && isOpen && isDesktop;
    document.documentElement.classList.toggle('room-chat-docked', docked);
    return () => document.documentElement.classList.remove('room-chat-docked');
  }, [connected, isDesktop, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
    clearUnreadChatCount();
  }, [chatMessages.length, isOpen, clearUnreadChatCount]);

  useEffect(() => {
    if (isOpen || !latestIncomingMessage) return;
    setActiveToast(latestIncomingMessage);
    const timer = window.setTimeout(() => setActiveToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [latestIncomingMessage, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const openChat = () => {
    setIsOpen(true);
    setActiveToast(null);
    clearUnreadChatCount();
    sounds.playFlip();
  };

  const sendText = (text: string, quick = false) => {
    if (!text.trim()) return;
    setError('');
    if (!connected || !sendChatMessage(text.trim(), quick)) {
      setError('The room connection paused. Your message is still here—try again in a moment.');
      return;
    }
    if (!quick) setInputText('');
  };

  if (!connected) return null;

  return createPortal(<>
    {activeToast && !isOpen && <button type="button" className="chat-toast" onClick={openChat} aria-label={`New message from ${partnerName}: ${activeToast.text}`}><Avatar avatarId={partnerAvatar} size={39} /><div><strong>{partnerName} says...</strong><p>{activeToast.text}</p></div><MessageCircle size={19} /></button>}
    <button type="button" hidden={isOpen} className="room-chat-trigger" onClick={openChat} aria-label={unreadChatCount ? `Open room chat, ${unreadChatCount} unread messages` : 'Open room chat'}><MessageCircle size={21} /><b>Room chat</b>{unreadChatCount > 0 && <span>{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>}</button>
    {isOpen && <aside className="chat-window room-chat-dock" aria-labelledby="room-chat-title">
      <header className="chat-masthead">
        <div className="chat-masthead-title"><Avatar avatarId={partnerAvatar} size={43} /><div><span className="room-chat-eyebrow">PLAYING TOGETHER</span><h2 id="room-chat-title">Chat with {partnerName}</h2><p className="room-chat-status">Live in your room</p></div></div>
        <button type="button" className="chat-icon-button" onClick={() => setIsOpen(false)} aria-label="Minimize room chat" title="Minimize chat"><PanelRightClose /></button>
      </header>
      <div className="chat-feed" ref={feedRef} role="log" aria-live="polite" aria-label="Room conversation">
        {chatMessages.length === 0 ? <div className="chat-welcome"><div className="chat-doodle" aria-hidden="true"><MessageCircle /><MessageCircle /><span /></div><h3>Talk while<br />you play.</h3><p>Tease a guess, celebrate a win, or send a sweet note. This chat stays beside your game.</p></div>
        : chatMessages.map(message => {
          const mine = message.senderId === 'me';
          return <div className={`chat-message ${mine ? 'is-mine' : ''}`} key={message.id}>{!mine && <Avatar avatarId={message.senderAvatar} size={28} />}<div className="chat-message-body"><div className="chat-bubble">{message.text}</div><div className="chat-message-meta"><time dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{mine && <span><Check /> Sent</span>}</div></div></div>;
        })}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <div className="chat-quick-replies" aria-label="Quick replies">{QUICK_REPLIES.map(text => <button type="button" key={text} onClick={() => sendText(text, true)}>{text}</button>)}</div>
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); sendText(inputText); }}><input aria-label={`Message ${partnerName}`} value={inputText} onChange={event => setInputText(event.target.value)} placeholder={`Message ${partnerName}...`} maxLength={500} autoComplete="off" /><button type="submit" aria-label="Send message" disabled={!inputText.trim()}><Send /></button></form>
    </aside>}
  </>, document.body);
};
