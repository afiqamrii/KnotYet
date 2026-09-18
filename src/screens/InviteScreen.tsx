import '../styles/invite.css';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useGame } from '../store/GameContext';
import { Avatar } from '../components/AvatarPicker';
import { BrandMark } from '../components/ArcadeArt';
import { ACCEPTED_INVITE_KEY, PENDING_INVITE_KEY, getChatIdentity, parseFriendInvite, type FriendInvite } from '../utils/friendInvites';
import { sounds } from '../utils/audio';

export const InviteScreen: React.FC = () => {
  const { user, signInWithGoogle, signInAsGuest, isLoading } = useAuth();
  const { setProfile } = useGame();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invite] = useState<FriendInvite | null>(() => {
    const fromLink = parseFriendInvite(location.search);
    if (fromLink) { sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(fromLink)); return fromLink; }
    if (location.search) return null;
    try { return JSON.parse(sessionStorage.getItem(PENDING_INVITE_KEY) || 'null'); } catch { return null; }
  });
  const accept = async (google = false) => {
    if (!invite || busy) return;
    if (user && getChatIdentity(user.id).id === invite.id) { setError('This is your own invite. Send it to your person instead.'); return; }
    setError('');
    sessionStorage.setItem(ACCEPTED_INVITE_KEY, JSON.stringify(invite));
    if (google) {
      setBusy(true);
      try { await signInWithGoogle(); } catch { setError('Sign-in could not start. Try again or continue as a guest.'); setBusy(false); }
      return;
    }
    if (!user) {
      signInAsGuest();
      setProfile({ name: 'Guest Player', avatarId: 'sunny', heartPoints: 320 });
    }
    sounds.playSuccess();
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    navigate('/play');
  };
  return (
    <main className="invite-page">
      <Link to="/" className="invite-brand"><BrandMark /><span>KnotYet</span></Link>
      <section className="invite-sheet" aria-labelledby="invite-title">
        {isLoading ? <p>Getting your invitation ready...</p> : !invite ? <>
          <div className="invite-icon"><MessageCircle size={36} /></div>
          <h1 id="invite-title">A fresh invite, please.</h1>
          <p>This link is missing its connection details. Ask your friend to copy a new invite from Friends & loved ones.</p>
          <Link to="/" className="btn-chunky btn-purple">Back to KnotYet <ArrowRight size={18} /></Link>
        </> : <>
          <span className="invite-eyebrow">A LITTLE MORE US</span>
          <div className="invite-duo"><Avatar avatarId={invite.avatar} size={84} /><span className="invite-plus">+</span><div className="invite-you"><Users size={34} /></div></div>
          <h1 id="invite-title">{invite.name} saved you a spot.</h1>
          <p>Accept their invite and make room for more chats, more games, and more good times together.</p>
          <div className="invite-perks"><span><Check size={18} /> Add each other to your circle</span><span><Check size={18} /> Chat and send game invites</span></div>
          <p className="invite-note">Keep KnotYet open on both devices to connect. Chats are saved in this browser.</p>
          {error && <p role="alert" className="invite-error">{error}</p>}
          <button className="btn-chunky btn-purple" disabled={busy} onClick={() => void accept()}>{user ? 'Accept & connect' : 'Accept as a guest'}<ArrowRight size={18} /></button>
          {!user && <button className="invite-google" disabled={busy} onClick={() => void accept(true)}>{busy ? 'Opening sign-in...' : 'Or sign in with Google'}</button>}
        </>}
      </section>
    </main>
  );
};
