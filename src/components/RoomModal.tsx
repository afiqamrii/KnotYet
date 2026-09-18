import React, { useState, useEffect, useRef } from 'react';
import { Users, Copy, Check, Share2, Sparkles, X, KeyRound, Play, Loader2, Heart, ArrowRight, Plus } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useGame } from '../store/GameContext';
import { useMultiplayer } from '../store/MultiplayerContext';
import { Avatar } from './AvatarPicker';
import '../styles/onboarding.css';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose }) => {
  const { t, profile, lang } = useGame();
  const { hostRoom, joinRoom, status, error, isHost, roomCode: currentRoomCode } = useMultiplayer();
  const [newRoomCode] = useState<string>(() => Math.floor(1000 + Math.random() * 9000).toString());
  const roomCode = isHost && currentRoomCode ? currentRoomCode : newRoomCode;
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(() => (sessionStorage.getItem('knotyet_openRoom') === 'true' || (error && !isHost)) ? 'join' : 'create');
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number>();
  const onCloseRef = useRef(onClose);
  const hasProfile = Boolean(profile);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const isMalay = lang === 'my';

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!isOpen || !hasProfile) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, hasProfile]);

  if (!isOpen || !profile) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      sounds.playFlip();
      setCopyError(false);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  const shareToWhatsApp = () => {
    sounds.playSuccess();
    const inviteUrl = new URL('/', window.location.origin);
    inviteUrl.searchParams.set('room', roomCode);
    const text = `Let's play KnotYet together! Room Code: #${roomCode} — ${inviteUrl.toString()}`;
    if (navigator.share) {
      navigator.share({ title: 'KnotYet Room', text }).catch(() => undefined);
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCreate = () => {
    sounds.playSuccess();
    hostRoom(roomCode, profile);
  };

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputCode.length === 4 && status !== 'joining') {
      sounds.playSuccess();
      joinRoom(inputCode, profile);
    }
  };

  return (
    <div className="room-arcade-overlay" onClick={onClose}>
      <div className="room-arcade-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="room-dialog-title" aria-describedby="room-dialog-description" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="room-arcade-close" aria-label={isMalay ? 'Tutup bilik' : 'Close room dialog'}><X size={20} /></button>
        <div className="room-arcade-banner">
          <span className="room-banner-kicker"><Users size={15} /> {isMalay ? 'MASA UNTUK BERDUA' : 'BETTER WITH YOUR +1'}</span>
          <div className="room-player-duo" aria-hidden="true"><span><Avatar avatarId={profile.avatarId} size={55} /></span><Heart size={22} fill="currentColor" /><span className="room-partner-placeholder"><Plus size={28} /></span></div>
          <h2 id="room-dialog-title">{t.roomTitle}</h2>
          <p id="room-dialog-description">{t.roomSub}</p>
        </div>

        <div className="room-arcade-body">
          {error && <p className="room-arcade-error" role="alert">{error}</p>}
          <div className="room-arcade-tabs" role="group" aria-label={isMalay ? 'Pilih cara bermain' : 'Choose how to connect'}>
            <button type="button" onClick={() => setActiveTab('create')} aria-pressed={activeTab === 'create'} className={activeTab === 'create' ? 'is-active' : ''}><Plus size={17} />{t.roomCreate}</button>
            <button type="button" onClick={() => setActiveTab('join')} aria-pressed={activeTab === 'join'} className={activeTab === 'join' ? 'is-active' : ''}><KeyRound size={17} />{t.roomJoin}</button>
          </div>

          {activeTab === 'create' ? (
            <div className="room-create-content">
              {status === 'hosting' ? (
                <>
                  <div className="room-code-ticket">
                    <span>{t.roomCode}</span><strong>{roomCode}</strong>
                    <button type="button" onClick={handleCopy} className="room-copy-button">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t.roomCopied : t.roomCopy}</button>
                    <span className="room-copy-feedback" role="status">{copyError ? (isMalay ? 'Salin kod di atas secara manual.' : 'Please copy the code above manually.') : copied ? (isMalay ? 'Kod disalin!' : 'Room code copied!') : ''}</span>
                  </div>
                  <button type="button" onClick={shareToWhatsApp} className="setup-button room-share-button"><Share2 size={18} />{t.roomWhatsapp}</button>
                  <p className="room-waiting" role="status"><Loader2 size={16} className="room-spinner" />{isMalay ? 'Menunggu pasangan anda...' : 'Waiting for your favorite player...'}</p>
                </>
              ) : (
                <>
                  <div className="room-host-prompt"><span className="room-host-icon"><GamepadIcon /></span><h3>{isMalay ? 'Satu jemputan. Banyak kenangan.' : 'One invite. So many good times.'}</h3><p>{isMalay ? 'Cipta bilik dan kongsi kod dengan pasangan anda. Biar permainan bermula!' : 'Create a room, send your partner the code, and let the good times begin.'}</p></div>
                  <button type="button" onClick={handleCreate} className="setup-button setup-button-primary"><Play size={18} fill="currentColor" />{isMalay ? 'Cipta bilik permainan' : 'Host a game room'}<ArrowRight size={18} /></button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleJoin} className="room-join-form">
              <p className="room-join-description">{isMalay ? 'Pasangan anda sudah sedia? Masukkan kod mereka untuk bermain bersama.' : 'Your partner is ready? Pop in their code and join the fun.'}</p>
              <label className="setup-field-label" htmlFor="partner-room-code">{t.roomInputLabel}</label>
              <div className="room-code-input-wrap"><KeyRound size={21} /><input id="partner-room-code" className="setup-input room-code-input" type="text" inputMode="numeric" pattern="[0-9]{4}" autoComplete="off" maxLength={4} value={inputCode} onChange={event => setInputCode(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" required /></div>
              <button type="submit" disabled={inputCode.length !== 4 || status === 'joining'} className="setup-button setup-button-primary">{status === 'joining' ? <><Loader2 size={18} className="room-spinner" />{isMalay ? 'Menyambung...' : 'Joining your partner...'}</> : <>{t.roomStart}<ArrowRight size={18} /></>}</button>
            </form>
          )}
          <p className="room-free-note"><Sparkles size={15} />{t.roomFreeNote}</p>
        </div>
      </div>
    </div>
  );
};

const GamepadIcon = () => <><Users size={27} /><span><Heart size={13} fill="currentColor" /></span></>;
