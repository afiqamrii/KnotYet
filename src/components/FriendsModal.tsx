import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, CheckCheck, Clock3, Copy, Link2, MessageCircle, Play, Send, Share2, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useFriends, Friend, DirectMessage } from '../store/FriendsContext';
import { useGame, RelationshipType } from '../store/GameContext';
import { useMultiplayer } from '../store/MultiplayerContext';
import { Avatar } from './AvatarPicker';
import { UiSymbol } from './GameCardDesign';
import { useChatDialog } from './useChatDialog';
import { sounds } from '../utils/audio';
import '../styles/chat.css';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchMultiplayer?: (roomCode: string) => void;
}

type Relationship = RelationshipType | 'friend';
const RELATIONSHIPS: { type: Relationship; label: string; icon: React.ReactNode }[] = [
  { type: 'lover', label: 'Partner', icon: <UiSymbol kind="heart" /> },
  { type: 'spouse', label: 'Spouse', icon: <UiSymbol kind="ring" /> },
  { type: 'crush', label: 'Crush', icon: <UiSymbol kind="smile" /> },
  { type: 'bestfriend', label: 'Best friend', icon: <UiSymbol kind="together" /> },
  { type: 'friend', label: 'Friend', icon: <UiSymbol kind="star" /> },
];
const QUICK_REPLIES = ['Hey, you!', 'Ready to play?', 'Thinking of you', 'You know me so well!', 'One more round?'];
const timeOf = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const relationshipLabel = (type: string) => RELATIONSHIPS.find(item => item.type === type)?.label ?? 'Friend';

const ChatDoodle = () => <div className="chat-doodle" aria-hidden="true"><MessageCircle /><MessageCircle /><span /></div>;

function DeliveryStatus({ message, retry }: { message: DirectMessage; retry: () => void }) {
  if (message.status === 'read') return <span className="is-read"><CheckCheck /> Read</span>;
  if (message.status === 'delivered' || message.status === 'sent') return <span><Check /> Sent</span>;
  if (message.status === 'failed') return <><span className="is-failed" title={message.error}>Not delivered</span><button className="chat-retry" onClick={retry}>Retry</button></>;
  if (message.status === 'sending') return <span><Clock3 /> Sending</span>;
  return <span><Clock3 /> Waiting for partner</span>;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({ isOpen, onClose, onLaunchMultiplayer }) => {
  const { friends, removeFriend, getConversation, sendDirectMessage, retryDirectMessage, createInviteLink,
    activeChatFriendId, setActiveChatFriendId, myChatId, connectionStatus, connectionError } = useFriends();
  const { profile } = useGame();
  const multiplayer = useMultiplayer();
  const [view, setView] = useState<'list' | 'add' | 'chat'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [friendRel, setFriendRel] = useState<Relationship>('lover');
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const selectedFriend = friends.find(friend => friend.id === selectedId) ?? null;
  const chatMessages = selectedFriend ? getConversation(selectedFriend.id) : [];
  const closeModal = () => { setActiveChatFriendId(null); setView('list'); onClose(); };
  const dialogRef = useChatDialog(isOpen, closeModal);

  useEffect(() => {
    if (isOpen && activeChatFriendId) {
      setSelectedId(activeChatFriendId);
      setView('chat');
    }
  }, [isOpen, activeChatFriendId]);

  useEffect(() => {
    if (isOpen && view === 'chat' && messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [isOpen, view, selectedId, chatMessages.length]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);
  useEffect(() => { setError(''); setInputText(''); setConfirmRemove(false); }, [selectedId, view]);

  if (!isOpen || !profile) return null;

  const openChat = (friend: Friend) => {
    setSelectedId(friend.id);
    setActiveChatFriendId(friend.id);
    setView('chat');
    sounds.playFlip();
  };
  const openAdd = () => { setView('add'); setActiveChatFriendId(null); setError(''); };
  const backToList = () => { setView('list'); setActiveChatFriendId(null); };
  const sendText = async (text: string, quick = false) => {
    if (!text.trim() || !selectedFriend || sending) return;
    setError(''); setSending(true);
    try {
      const result = await sendDirectMessage(selectedFriend.id, text.trim(), quick);
      if (result.ok) { if (!quick) setInputText(''); }
      else setError(result.error || 'Your message could not be sent. Please try again.');
    } catch { setError('Your message could not be sent. Your draft is still here.'); }
    finally { setSending(false); }
  };
  const retry = async (message: DirectMessage) => {
    setError('');
    try {
      const result = await retryDirectMessage(message.friendId, message.id);
      if (!result.ok) setError(result.error || 'Please try again when your connection returns.');
    } catch { setError('Please try again when your connection returns.'); }
  };
  const launchRoom = (roomCode: string) => {
    if (multiplayer.roomCode === roomCode && (multiplayer.status === 'hosting' || multiplayer.status === 'connected')) { closeModal(); return; }
    setActiveChatFriendId(null);
    if (onLaunchMultiplayer) onLaunchMultiplayer(roomCode);
    else { multiplayer.hostRoom(roomCode, profile); closeModal(); }
  };
  const createGameInvite = async (friend: Friend) => {
    if (sending) return;
    const roomCode = multiplayer.isHost && multiplayer.roomCode && ['hosting', 'connected'].includes(multiplayer.status)
      ? multiplayer.roomCode : Math.floor(1000 + Math.random() * 9000).toString();
    setSending(true); setError('');
    try {
      const result = await sendDirectMessage(friend.id, 'Your next good time starts here. Come play with me!', false, { roomCode, gameTitle: 'KnotYet Room' });
      if (result.ok) launchRoom(roomCode);
      else setError(result.error || 'The invitation could not be sent. Please try again.');
    } catch { setError('The invitation could not be sent. Please try again.'); }
    finally { setSending(false); }
  };
  const shareLink = async (share: boolean) => {
    setError('');
    try {
      const url = await createInviteLink(friendRel);
      setInviteUrl(url);
      if (share && navigator.share) {
        await navigator.share({ title: 'Join my KnotYet circle', text: 'A little chat. A little play. Just us.', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopiedLink(false), 2500);
      }
      sounds.playSuccess();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError('Could not share automatically. You can select and copy the invite link below.');
    }
  };
  const removeSelectedFriend = async () => {
    if (!selectedFriend) return;
    setError('');
    try { await removeFriend(selectedFriend.id); setSelectedId(null); backToList(); }
    catch { setError('This chat could not be removed from your account. Please try again.'); }
  };

  return createPortal(
    <div className="chat-overlay" onClick={closeModal}>
      <div className="chat-window" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="friends-dialog-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
        <header className="chat-masthead">
          <div className="chat-masthead-title"><span className="chat-logo-tile"><Users size={23} /></span><div><h2 id="friends-dialog-title">Your little circle</h2><p>Good chats. Better company.</p></div></div>
          <button className="chat-icon-button" onClick={closeModal} aria-label="Close friends and messages"><X /></button>
        </header>
        <div className="chat-layout" data-view={view}>
          <aside className="chat-sidebar" aria-label="Friends">
            <button className="chat-add-button" onClick={openAdd}><UserPlus size={18} /> Invite your person</button>
            <div className="chat-section-label"><span>Your people</span><span>{friends.length}</span></div>
            {friends.length === 0 ? <div className="chat-welcome"><ChatDoodle /><h3>Better with two.</h3><p>Your circle starts with one invite. Bring your favourite person along.</p><button className="chat-secondary" onClick={openAdd}>Get an invite link <Link2 /></button></div>
            : <div className="chat-friend-list">{friends.map(friend => <button key={friend.id} className="chat-friend" aria-current={view === 'chat' && selectedId === friend.id ? 'true' : undefined} onClick={() => openChat(friend)}>
                <Avatar avatarId={friend.avatarId} size={43} /><span className="chat-friend-copy"><strong>{friend.name}</strong><small>{friend.lastMessage || (friend.linked ? 'Say a little hello' : 'Saved profile · invite to connect')}</small></span>{(friend.unreadCount || 0) > 0 ? <span className="chat-unread" aria-label={`${friend.unreadCount} unread messages`}>{friend.unreadCount! > 99 ? '99+' : friend.unreadCount}</span> : <span className={`chat-friend-label ${friend.linked && friend.isOnline ? 'is-linked' : ''}`} title={friend.linked ? friend.isOnline ? 'Online' : 'Offline' : 'Saved on this device'} />}
              </button>)}</div>}
            <p className="chat-sidebar-note">Messages sync securely to your account.<br />Come back anytime on this device.</p>
          </aside>
          <section className="chat-main">
            {view === 'list' && <div className="chat-welcome"><ChatDoodle /><h3>A little closer, even from afar.</h3><p>{friends.length ? 'Pick someone from your circle to say hello, swap a little banter, or invite them to a game.' : 'Send an invite, connect your accounts, and let the good conversations begin.'}</p><button className="chat-primary" onClick={openAdd}><UserPlus /> Invite someone</button><div className="chat-steps"><span><b>1</b>Share your link</span><span><b>2</b>They accept</span><span><b>3</b>Chat & play</span></div></div>}
            {view === 'add' && <>
              <div className="chat-thread-header"><div className="chat-person"><button className="chat-icon-button chat-back" onClick={backToList} aria-label="Back to friends"><ArrowLeft /></button><h3>Make room for your person.</h3></div></div>
              <div className="chat-add-view"><p>Send them a link. Once they accept, you will appear in each other’s circle.</p>
                <div className="chat-invite-box"><h4><Link2 size={19} /> A link for the two of you</h4><p>Choose how you know each other, then share your invitation in your favourite messaging app.</p>
                  <fieldset className="chat-fieldset"><legend>They are my...</legend><div className="chat-relationships">{RELATIONSHIPS.map(item => <button key={item.type} type="button" aria-pressed={friendRel === item.type} onClick={() => { setFriendRel(item.type); setInviteUrl(''); setCopiedLink(false); }}>{item.icon} {item.label}</button>)}</div></fieldset>
                  <div className="chat-invite-actions"><button className="chat-primary" onClick={() => void shareLink(true)}><Share2 /> Share invite</button><button className="chat-secondary" onClick={() => void shareLink(false)}>{copiedLink ? <Check /> : <Copy />}{copiedLink ? 'Copied' : 'Copy link'}</button></div>
                  {inviteUrl && <div className="chat-link-preview" aria-label="Your invite link">{inviteUrl}</div>}
                  <p>Invite links are single-use and expire automatically for your safety.</p>
                </div>
                <div className="chat-steps"><span><b>1</b>Copy or share</span><span><b>2</b>They open & accept</span><span><b>3</b>Say hello here</span></div>
                
              </div>
            </>}
            {view === 'chat' && selectedFriend && <>
              <div className="chat-thread-header"><div className="chat-person"><button className="chat-icon-button chat-back" onClick={backToList} aria-label="Back to friends"><ArrowLeft /></button><Avatar avatarId={selectedFriend.avatarId} size={40} /><div><h3>{selectedFriend.name}</h3><p>{relationshipLabel(selectedFriend.relationshipType)} · {selectedFriend.linked ? selectedFriend.isOnline ? 'Here with you' : 'Away right now' : 'Saved on this device'}</p></div></div><div className="chat-thread-actions"><button className="chat-primary" onClick={() => void createGameInvite(selectedFriend)} disabled={!selectedFriend.linked || sending} aria-label={`Invite ${selectedFriend.name} to play`}><Play /><span>Let’s play</span></button><button className="chat-icon-button" onClick={() => setConfirmRemove(true)} aria-label={`Remove ${selectedFriend.name} from your circle`} title="Remove from your circle"><Trash2 /></button></div></div>
              {confirmRemove && <div className="chat-remove-confirm"><p>Remove {selectedFriend.name} and this chat from your account?</p><div><button className="chat-secondary" onClick={() => setConfirmRemove(false)}>Keep them</button><button className="chat-secondary" onClick={() => void removeSelectedFriend()}>Remove chat</button></div></div>}
              {!selectedFriend.linked ? <div className="chat-linked-notice"><Link2 /><span>This profile is saved on your device. Share an invite to connect your accounts and chat.</span></div>
              : connectionStatus !== 'online' ? <div className="chat-linked-notice"><Clock3 /><span>{connectionStatus === 'connecting' ? 'Connecting your chat. Messages will wait here until you are connected.' : connectionError || 'Chat is reconnecting. Your messages will wait here.'}</span></div>
              : !selectedFriend.isOnline && <div className="chat-linked-notice"><Clock3 /><span>They are away. Your message will be waiting in their account.</span></div>}
              <div className="chat-feed" ref={messagesRef} role="log" aria-live="polite" aria-label={`Conversation with ${selectedFriend.name}`}>
                {chatMessages.length === 0 ? <div className="chat-welcome"><ChatDoodle /><h3>{selectedFriend.linked ? `Hey, ${selectedFriend.name}.` : 'One invite away.'}</h3><p>{selectedFriend.linked ? 'A sweet hello, a little banter, or “one more round?” Make the first move.' : 'A name and avatar do not connect two devices. Send your person an invite link to start chatting.'}</p>{!selectedFriend.linked && <button className="chat-primary" onClick={openAdd}><Link2 /> Get an invite link</button>}</div>
                : chatMessages.map(message => {
                  const mine = message.senderId === myChatId;
                  return <div className={`chat-message ${mine ? 'is-mine' : ''}`} key={message.id}>{!mine && <Avatar avatarId={message.senderAvatar} size={28} />}<div className="chat-message-body">
                    {message.gameInvite ? <div className="chat-game-invite"><span><UiSymbol kind="game" /> Your next good time</span><strong>#{message.gameInvite.roomCode}</strong><p>{message.text}</p><button className="chat-primary" onClick={() => { if (mine) launchRoom(message.gameInvite!.roomCode); else { multiplayer.joinRoom(message.gameInvite!.roomCode, profile); closeModal(); } }}><Play />{mine ? 'Open your room' : 'Join their room'}</button></div> : <div className="chat-bubble">{message.text}</div>}
                    <div className="chat-message-meta"><time dateTime={new Date(message.timestamp).toISOString()}>{timeOf(message.timestamp)}</time>{mine && <DeliveryStatus message={message} retry={() => void retry(message)} />}</div>
                  </div></div>;
                })}
              </div>
              {selectedFriend.linked && <><div className="chat-quick-replies" aria-label="Quick replies">{QUICK_REPLIES.map(text => <button key={text} disabled={sending} onClick={() => void sendText(text, true)}>{text}</button>)}</div><form className="chat-composer" onSubmit={event => { event.preventDefault(); void sendText(inputText); }}><input aria-label={`Message ${selectedFriend.name}`} value={inputText} onChange={event => setInputText(event.target.value)} placeholder={`A little note for ${selectedFriend.name}...`} maxLength={500} autoComplete="off" /><button type="submit" disabled={!inputText.trim() || sending} aria-label="Send message"><Send /></button></form></>}
            </>}
            {error && <p className="chat-error" role="alert">{error}</p>}
          </section>
        </div>
      </div>
    </div>, document.body,
  );
};



