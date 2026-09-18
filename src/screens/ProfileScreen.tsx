import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Copy, Gamepad2, Heart, Link2, LogOut, MessageCircle, Pencil, Share2, ShieldCheck, Star, Users, X } from 'lucide-react';
import { useGame, HEART_POINTS, type RelationshipType } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useFriends } from '../store/FriendsContext';
import { supabase } from '../lib/supabase';
import { Avatar, AvatarPicker, getAvatar } from '../components/AvatarPicker';
import { UiSymbol } from '../components/GameCardDesign';
import { useChatDialog } from '../components/useChatDialog';
import { sounds } from '../utils/audio';
import '../styles/profile.css';

interface ProfileScreenProps {
  onClose: () => void;
  onOpenFriends?: () => void;
}

type ProfileView = 'main' | 'edit' | 'invite' | 'waiting' | 'signOut' | 'unlink';
const RELATIONSHIPS: { type: RelationshipType; icon: 'together' | 'smile' | 'heart' | 'ring' }[] = [
  { type: 'bestfriend', icon: 'together' }, { type: 'crush', icon: 'smile' },
  { type: 'lover', icon: 'heart' }, { type: 'spouse', icon: 'ring' },
];
export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onClose, onOpenFriends }) => {
  const { profile, partner, setProfile, setPartner, t } = useGame();
  const { friends, unreadTotal, createInviteLink } = useFriends();
  const { user, couple, signOut, refreshCouple } = useAuth();
  const [view, setView] = useState<ProfileView>('main');
  const [editName, setEditName] = useState(profile?.name ?? '');
  const [editAvatar, setEditAvatar] = useState(profile?.avatarId ?? 'sunny');
  const [partnerRel, setPartnerRel] = useState<RelationshipType>('lover');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const invitedFrom = useRef(new Set<string>());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useChatDialog(true, () => { if (!busy) view === 'main' ? onClose() : changeView('main'); });
  const [inviteLink, setInviteLink] = useState('');

  function changeView(next: ProfileView) {
    setError('');
    setNotice('');
    setView(next);
  }

  useEffect(() => {
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
  }, [dialogRef, view]);
  useEffect(() => {
    if (view !== 'waiting' && view !== 'invite') return;
    if (inviteLink) return;
    let current = true;
    setBusy(true);
    setInviteLink('');
    void createInviteLink(partnerRel)
      .then(link => { if (current) setInviteLink(link); })
      .catch(() => { if (current) setError('Your secure invite could not be created. Please try again.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [createInviteLink, partnerRel, view]);
  useEffect(() => {
    if (view !== 'waiting' && view !== 'invite') return;
    const accepted = friends.find(friend => friend.linked && !invitedFrom.current.has(friend.id) && friend.relationshipType === partnerRel);
    if (accepted) {
      setNotice(`You're connected with ${accepted.name}. Let the good times begin!`);
      setView('main');
    }
  }, [friends, partnerRel, view]);

  if (!profile) return null;

  const relLabel = (type: RelationshipType) => ({ bestfriend: t.relBestFriend, crush: t.relCrush, lover: t.relLoving, spouse: t.relSpouse })[type];
  const openEdit = () => {
    setEditName(profile.name);
    setEditAvatar(profile.avatarId);
    changeView('edit');
  };
  const openInvite = () => {
    invitedFrom.current = new Set(friends.map(friend => friend.id));
    changeView('invite');
  };
  const openFriends = () => { onClose(); onOpenFriends?.(); };
  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editName.trim()) return;
    setProfile({ ...profile, name: editName.trim(), avatarId: editAvatar });
    changeView('main');
    setNotice('Profile updated. Looking good!');
    sounds.playSuccess();
  };
  const copyInvite = async () => {
    setError('');
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice('Link copied! Send it to your person.');
      sounds.playFlip();
    } catch {
      setError('Copy was unavailable. Select the invite link below and copy it manually.');
    }
  };
  const shareInvite = async () => {
    setError('');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'A little play, just us two.', text: 'Join me on KnotYet for our next game night.', url: inviteLink });
      } else {
        const text = `Join me on KnotYet for our next game night! ${inviteLink}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      }
      changeView('waiting');
    } catch (reason) {
      if (!(reason instanceof Error && reason.name === 'AbortError')) setError('Sharing did not open. You can copy the invite link instead.');
    }
  };
  const unlinkPartner = async () => {
    setBusy(true);
    setError('');
    try {
      if (couple && user) {
        const partnerId = couple.user1_id === user.id ? couple.user2_id : couple.user1_id;
        const { error: unlinkError } = await supabase.from('couples').delete().eq('id', couple.id);
        if (unlinkError) throw unlinkError;
        const channel = supabase.channel(`partner_link_${partnerId}`);
        try { await channel.send({ type: 'broadcast', event: 'partner_unlinked', payload: {} }); }
        finally { void supabase.removeChannel(channel); }
        await refreshCouple();
      }
      setPartner(null);
      changeView('main');
      setNotice('Partner profile unlinked.');
      sounds.playFlip();
    } catch { setError('We could not unlink your profiles. Please try again.'); }
    finally { setBusy(false); }
  };
  const leaveAccount = async () => {
    setBusy(true);
    try { await signOut(); onClose(); }
    catch { setError('Sign out did not finish. Please try again.'); setBusy(false); }
  };
  const titles: Record<ProfileView, string> = {
    main: t.profileTitle, edit: 'Make it yours.', invite: 'Better as a duo.', waiting: 'Invite ready. Game on.', signOut: 'Heading out?', unlink: 'Unlink your person?',
  };

  return createPortal(
    <div className="profile-page" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex={-1}>
      <div className={`profile-shell profile-view-${view}`}>
        <header className="profile-header">
          <div>
            <span className="profile-eyebrow"><Gamepad2 size={15} aria-hidden="true" /> YOUR LITTLE CORNER OF KNOTYET</span>
            <h1 id="profile-title" ref={titleRef} tabIndex={-1}>{titles[view]}</h1>
          </div>
          <button type="button" className="profile-button profile-back" aria-label={view === 'main' ? 'Back to games' : 'Back to my profile'} disabled={busy} onClick={() => view === 'main' ? onClose() : changeView('main')}>
            <ArrowLeft size={17} aria-hidden="true" /><span>{view === 'main' ? 'Back to games' : 'My profile'}</span>
          </button>
        </header>

        {view === 'main' && <>
          <div className="profile-dashboard">
            <section className="profile-player-pass" aria-label="Your player card">
              <div className="profile-pass-top"><span>PLAYER ONE</span><Gamepad2 size={22} aria-hidden="true" /></div>
              <div className="profile-avatar-stage">
                <Star className="profile-avatar-star" aria-hidden="true" />
                <Avatar avatarId={profile.avatarId} size={120} />
                <span className="profile-ready-stamp"><Check size={13} aria-hidden="true" /> READY TO PLAY</span>
              </div>
              <h2>{profile.name}</h2>
              <p>Here for the good times.</p>
              <div className="profile-pass-bottom">
                <div><span>YOUR CHARACTER</span><strong>{getAvatar(profile.avatarId).name}</strong></div>
                <button type="button" className="profile-button" onClick={openEdit}><Pencil size={15} aria-hidden="true" /> Edit profile</button>
              </div>
            </section>

            <section className="profile-hearts" aria-labelledby="profile-hearts-title">
              <div className="profile-section-heading"><h2 id="profile-hearts-title">{t.myHearts}</h2><Heart size={23} aria-hidden="true" /></div>
              <div className="profile-heart-total"><strong>{profile.heartPoints.toLocaleString()}</strong><div><span>little reasons to</span><b>play one more round.</b></div></div>
              <dl className="profile-score-guide">
                <div><dt>Correct guess</dt><dd>+{HEART_POINTS.CORRECT_GUESS}</dd></div>
                <div><dt>Missed guess</dt><dd>{HEART_POINTS.WRONG_GUESS}</dd></div>
                <div><dt>Deck finished</dt><dd>+{HEART_POINTS.COMPLETE_DECK}</dd></div>
              </dl>
            </section>

            <section className="profile-person" aria-labelledby="profile-person-title">
              <div className="profile-section-heading"><span className="profile-tile-icon"><Heart aria-hidden="true" /></span><span className="profile-eyebrow">THE TWO OF YOU</span></div>
              {partner ? <>
                <div className="profile-partner-name"><Avatar avatarId={partner.avatarId} size={44} /><div><h2 id="profile-person-title">{partner.name}</h2><p>{relLabel(partner.relationshipType)}</p></div></div>
                <p className="profile-tile-copy">{couple ? `${couple.couple_points.toLocaleString()} shared heart points. Keep making memories.` : 'Your favourite teammate. One more round together?'}</p>
                <div className="profile-partner-actions">{onOpenFriends && <button type="button" className="profile-text-button" onClick={openFriends}>Open chat <ArrowRight size={16} aria-hidden="true" /></button>}<button type="button" className="profile-unlink" onClick={() => changeView('unlink')}>Unlink</button></div>
              </> : <>
                <h2 id="profile-person-title">Add your person.</h2>
                <p className="profile-tile-copy">Every player one deserves a player two.</p>
                <button type="button" className="profile-text-button" onClick={openInvite}>Invite your person <ArrowRight size={16} aria-hidden="true" /></button>
              </>}
            </section>

            <section className="profile-circle" aria-labelledby="profile-circle-title">
              <div className="profile-section-heading"><span className="profile-tile-icon"><MessageCircle aria-hidden="true" /></span><span className="profile-circle-count">{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</span></div>
              <h2 id="profile-circle-title">Your kind of people.</h2>
              <p className="profile-tile-copy">A quick hello. A little catch-up. Your next game night.</p>
              {onOpenFriends && <button type="button" className="profile-text-button" onClick={openFriends}>Friends & chat {unreadTotal > 0 && <span className="profile-unread" aria-label={`${unreadTotal} unread messages`}>{unreadTotal}</span>}<ArrowRight size={16} aria-hidden="true" /></button>}
            </section>
          </div>
          <section className="profile-account" aria-label="Your account">
            <span className="profile-account-icon"><ShieldCheck aria-hidden="true" /></span>
            <div className="profile-account-copy"><h2>Your connected account</h2><p>{user?.email}</p></div>
            <div className="profile-account-actions">
              {user && <button type="button" className="profile-signout" onClick={() => changeView('signOut')}><LogOut size={16} aria-hidden="true" /> Sign out</button>}
            </div>
          </section>
        </>}

        {view === 'edit' && <form className="profile-edit-layout" onSubmit={saveProfile}>
          <section className="profile-edit-preview" aria-label="Character preview">
            <span className="profile-eyebrow">MEET YOUR GAME-NIGHT SELF</span>
            <Avatar avatarId={editAvatar} size={150} />
            <h2>{editName.trim() || 'Your name here'}</h2>
            <span className="profile-character-tag">Team {getAvatar(editAvatar).name}</span>
            <p>A little character.<br />A whole lot of you.</p>
          </section>
          <div className="profile-edit-fields">
            <div className="profile-name-field"><label htmlFor="profile-name">{t.profileName}</label><input id="profile-name" name="displayName" autoComplete="nickname" maxLength={20} required value={editName} onChange={event => setEditName(event.target.value)} aria-describedby="profile-name-help" /><span id="profile-name-help">The name your person sees. <span>{editName.length}/20</span></span></div>
            <div className="profile-character-field"><h2>{t.profileAvatar}</h2><p>Pick your little sidekick.</p><AvatarPicker selected={editAvatar} onChange={id => { setEditAvatar(id); sounds.playFlip(); }} /></div>
            <div className="profile-form-actions"><button type="button" className="profile-button" onClick={() => changeView('main')}>Cancel</button><button type="submit" className="profile-button profile-primary" disabled={!editName.trim()}><Check size={17} aria-hidden="true" /> Save profile</button></div>
          </div>
        </form>}

        {(view === 'invite' || view === 'waiting') && <div className="profile-invite-layout">
          <div className="profile-invite-art">
            <span className="profile-eyebrow">GOOD TIMES COME IN TWOS</span>
            <div className="profile-duo-art" aria-hidden="true"><Avatar avatarId={profile.avatarId} size={120} /><span><Heart size={30} /></span><Avatar avatarId="maple" size={120} /></div>
            <h2>Your person.<br />{' '}Your next adventure.</h2>
            <p>Send a link. Say hello.<br />Make a little memory.</p>
          </div>
          <div className="profile-invite-form">
            {view === 'invite' ? <>
              <h2>Who is your player two?</h2><p>A bestie, a crush, your favourite human.</p>
              <div className="profile-relationships" role="group" aria-label="Your relationship">{RELATIONSHIPS.map(option => <button type="button" key={option.type} aria-pressed={partnerRel === option.type} onClick={() => { setPartnerRel(option.type); setInviteLink(''); setNotice(''); }}><UiSymbol kind={option.icon} /><span>{relLabel(option.type)}</span>{partnerRel === option.type && <Check size={15} aria-hidden="true" />}</button>)}</div>
            </> : <>
              <span className="profile-wait-icon"><Link2 size={28} aria-hidden="true" /></span><h2>A little hello is on its way.</h2><p>Once your person opens the link and accepts, you'll find each other in Friends & chat.</p>
            </>}
            <div className="profile-invite-actions"><button type="button" className="profile-button profile-primary" disabled={busy || !inviteLink} onClick={shareInvite}><Share2 size={17} aria-hidden="true" /> {view === 'waiting' ? 'Share again' : 'Share invite'}</button><button type="button" className="profile-button" disabled={busy || !inviteLink} onClick={copyInvite}><Copy size={17} aria-hidden="true" /> Copy link</button></div>
            <label className="profile-link-label" htmlFor="profile-invite-link">Your invite link</label><input id="profile-invite-link" className="profile-invite-link" value={inviteLink} readOnly onFocus={event => event.target.select()} />
            <p className="profile-invite-note"><Users size={16} aria-hidden="true" /> Keep both apps open while connecting.</p>
            {view === 'waiting' && <button type="button" className="profile-text-button" onClick={() => changeView('main')}>Back to my profile <ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
        </div>}

        {(view === 'signOut' || view === 'unlink') && <div className="profile-confirm">
          <span className="profile-confirm-icon">{view === 'signOut' ? <LogOut aria-hidden="true" /> : <Heart aria-hidden="true" />}</span>
          <h2>{view === 'signOut' ? 'Same time, next game?' : `Unlink from ${partner?.name ?? 'your partner'}?`}</h2>
          <p>{view === 'signOut' ? 'You can sign back in with the same account when you are ready to play again.' : (couple ? 'This disconnects your partner profiles and resets your shared couple points.' : 'This removes the partner from your profile. Your saved chats stay in Friends.')}</p>
          <div className="profile-form-actions"><button type="button" className="profile-button" disabled={busy} onClick={() => changeView('main')}>Cancel</button><button type="button" className="profile-button profile-danger" disabled={busy} onClick={view === 'signOut' ? leaveAccount : unlinkPartner}>{busy ? 'Please wait...' : view === 'signOut' ? 'Sign out' : 'Unlink partner'}<ArrowRight size={17} aria-hidden="true" /></button></div>
        </div>}

        {notice && <p className="profile-feedback" role="status"><Check size={16} aria-hidden="true" /> {notice}</p>}
        {error && <p className="profile-feedback profile-error" role="alert"><X size={16} aria-hidden="true" /> {error}</p>}
        <footer className="profile-footer"><Heart size={13} aria-hidden="true" /> A little play. A little closer.</footer>
      </div>
    </div>, document.body,
  );
};





