import '../styles/invite.css';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { Avatar } from '../components/AvatarPicker';
import { BrandMark } from '../components/ArcadeArt';
import { PENDING_INVITE_KEY, parseFriendInvite, type FriendInvite } from '../utils/friendInvites';
import { supabase } from '../lib/supabase';
import { sounds } from '../utils/audio';

export const InviteScreen: React.FC = () => {
  const { user, signInWithGoogle, isLoading, refreshCouple } = useAuth();
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
  const accept = async () => {
    if (!invite || busy) return;
    setError('');
    if (!user) {
      setBusy(true);
      try { await signInWithGoogle('/invite'); } catch { setError('Sign-in could not start. Please try again.'); setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      const { error: acceptError } = await supabase.rpc('accept_chat_invite', { invite_token: invite.token });
      if (acceptError) throw acceptError;
      sounds.playSuccess();
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      await refreshCouple();
      navigate('/play');
    } catch {
      setError('This invite is invalid, expired, or was already used. Ask for a new link.');
      setBusy(false);
    }
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
          <p className="invite-note">Your connection and chat history are securely saved to your account.</p>
          {error && <p role="alert" className="invite-error">{error}</p>}
          <button className="btn-chunky btn-purple" disabled={busy} onClick={() => void accept()}>{busy ? 'Opening Google sign-inâ€¦' : user ? 'Accept & connect' : 'Sign in & accept invite'}<ArrowRight size={18} /></button>
          {!user && <p className="invite-note">An account is required so your friendship and messages stay connected.</p>}
        </>}
      </section>
    </main>
  );
};






