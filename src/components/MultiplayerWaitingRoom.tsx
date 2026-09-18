import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Heart, Link2, Loader2, Share2, Sparkles, Users, X } from 'lucide-react';
import { BrandMark } from './ArcadeArt';
import { Avatar } from './AvatarPicker';
import type { UserProfile } from '../store/GameContext';
import { sounds } from '../utils/audio';
import '../styles/lobby.css';

interface MultiplayerWaitingRoomProps {
  status: 'hosting' | 'joining';
  roomCode: string | null;
  profile: UserProfile | null;
  onCancel: () => void;
}

export const MultiplayerWaitingRoom: React.FC<MultiplayerWaitingRoomProps> = ({ status, roomCode, profile, onCancel }) => {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number>();
  const isHost = status === 'hosting';
  const code = roomCode || '------';

  const copyCode = async () => {
    try { await navigator.clipboard?.writeText(code); } catch { return; }
    setCopied(true);
    sounds.playSuccess();
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const shareRoom = async () => {
    const text = `Join my KnotYet room with code ${code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Play KnotYet with me', text }).catch(() => undefined);
      return;
    }
    await copyCode();
  };

  return (
    <main className="waiting-screen">
      <section className="waiting-console" aria-labelledby="waiting-title">
        <header className="waiting-topbar">
          <div className="waiting-brand"><BrandMark />KnotYet</div>
          <div className="waiting-live"><span /> Live room</div>
          <button type="button" className="waiting-cancel" onClick={onCancel}><X aria-hidden="true" /> Cancel</button>
        </header>

        <div className="waiting-grid">
          <div className="waiting-art" aria-hidden="true">
            <span className="waiting-art-label">MADE FOR TWO</span>
            <div className="waiting-avatar-stack">
              <div className="waiting-avatar-card me"><Avatar avatarId={profile?.avatarId || 'sunny'} size={88} /><strong>{profile?.name || 'You'}</strong><small>Ready!</small></div>
              <Heart className="waiting-heart" fill="currentColor" />
              <div className="waiting-avatar-card them"><div className="waiting-mystery"><Users /></div><strong>Your person</strong><small>On the way...</small></div>
            </div>
            <div className="waiting-spark one"><Sparkles /></div><div className="waiting-spark two"><Sparkles /></div>
            <p>Good times are loading.</p>
          </div>

          <div className="waiting-copy">
            <div className="waiting-kicker"><Loader2 className="waiting-spinner" aria-hidden="true" /> {isHost ? 'ROOM IS OPEN' : 'FINDING YOUR PERSON'}</div>
            <h1 id="waiting-title">{isHost ? <>Your person is<br /><span>one code away.</span></> : <>Joining the<br /><span>fun now.</span></>}</h1>
            <p className="waiting-lead">{isHost ? 'Send the room code. We will bring you both into the same game as soon as they join.' : 'Keep this tab open while we connect you to the room.'}</p>

            {isHost ? (
              <div className="waiting-ticket">
                <span>YOUR ROOM CODE</span>
                <strong aria-label={`Room code ${code.split('').join(' ')}`}>{code}</strong>
                <div className="waiting-ticket-actions">
                  <button type="button" onClick={copyCode}>{copied ? <Check /> : <Copy />}{copied ? 'Copied!' : 'Copy code'}</button>
                  <button type="button" onClick={shareRoom}><Share2 /> Share invite</button>
                </div>
              </div>
            ) : (
              <div className="waiting-ticket joining">
                <span>CONNECTING TO</span><strong>{code}</strong>
                <div className="waiting-connection-line"><i /><i /><i /><i /></div>
              </div>
            )}

            <ol className="waiting-steps">
              <li className="done"><span><Check /></span><div><strong>Room created</strong><small>Your connection is ready.</small></div></li>
              <li className="active"><span><Link2 /></span><div><strong>{isHost ? 'Share with your person' : 'Connecting securely'}</strong><small>{isHost ? 'They can enter this code on Play Together.' : 'This usually takes just a moment.'}</small></div></li>
              <li><span>3</span><div><strong>Pick a game together</strong><small>Both screens stay in sync.</small></div></li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
};
