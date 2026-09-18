import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { useGame } from '../store/GameContext';
import { AVATARS, Avatar } from '../components/AvatarPicker';
import { ArrowLeft, ArrowRight, Check, Dices, Gamepad2, Heart, Layers, Sparkles, Users } from 'lucide-react';
import '../styles/onboarding.css';

interface WelcomeScreenProps {
  onComplete: () => void;
}

const GAMES_INFO = [
  { icon: Layers, title: 'Break the ice', desc: 'Little questions. Big conversations.', color: 'pink' },
  { icon: Heart, title: 'Read their mind', desc: 'How well do you really know each other?', color: 'lime' },
  { icon: Dices, title: 'Take a chance', desc: 'Let the wheel pick your next adventure.', color: 'sky' },
  { icon: Users, title: 'Close, from anywhere', desc: 'One room. Two players. Your kind of fun.', color: 'lilac' },
] as const;

const SETUP_STEPS = ['The good stuff', 'Your character', 'Your name'];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { setProfile } = useGame();
  const [step, setStep] = useState<'welcome' | 'avatar' | 'name' | 'creating'>('welcome');
  const [name, setName] = useState(user?.user_metadata?.full_name?.split(' ')[0] || '');
  const [avatarId, setAvatarId] = useState('sunny');

  useEffect(() => {
    if (step !== 'creating') return;
    const timer = window.setTimeout(() => {
      setProfile({ name: name.trim(), avatarId, heartPoints: 0 });
      onComplete();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [step, name, avatarId, setProfile, onComplete]);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'player one';
  const activeStep = step === 'welcome' ? 0 : step === 'avatar' ? 1 : 2;

  const handleFinish = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim()) setStep('creating');
  };

  return (
    <main className="player-setup">
      <header className="setup-topbar">
        <span className="setup-wordmark"><span><Heart size={20} fill="currentColor" /></span>KnotYet<span className="setup-wordmark-dot">.</span></span>
        <span className="setup-topbar-note"><Gamepad2 size={16} /> Player setup</span>
      </header>

      <div className="setup-layout">
        <aside className="setup-story">
          <span className="setup-sticker"><Sparkles size={15} /> A little play. A lot closer.</span>
          <h2>Good company.<br /><span>Great games.</span></h2>
          <p>Your next favorite memory starts with a little friendly competition.</p>
          <div className="setup-duo" aria-hidden="true">
            <span className="setup-spark setup-spark-one">✦</span>
            <span className="setup-spark setup-spark-two">✧</span>
            <div className="setup-character setup-character-one"><span className="setup-character-eyes"><i /><i /></span><span className="setup-character-smile" /><span className="setup-character-tag">YOU</span></div>
            <div className="setup-character setup-character-two"><span className="setup-character-eyes"><i /><i /></span><span className="setup-character-smile" /><span className="setup-character-tag">YOUR PERSON</span></div>
            <span className="setup-duo-heart"><Heart fill="currentColor" size={28} /></span>
          </div>
          <div className="setup-ticket"><Users size={24} /><div><strong>Made for your favorite +1</strong><span>Side by side or miles apart.</span></div></div>
        </aside>

        <section className="setup-panel" aria-label="Set up your player profile">
          <ol className="setup-progress" aria-label="Setup progress">
            {SETUP_STEPS.map((label, index) => (
              <li key={label} className={index <= activeStep ? 'is-active' : ''} aria-current={activeStep === index ? 'step' : undefined}>
                <span>{index < activeStep ? <Check size={14} /> : `0${index + 1}`}</span><small>{label}</small>
              </li>
            ))}
          </ol>

          <div className="setup-step" key={step}>
            {step === 'welcome' && (
              <>
                <span className="setup-eyebrow">PLAYER ONE HAS ENTERED</span>
                <h1>Hey, <span>{firstName}!</span></h1>
                <p className="setup-description">Less small talk. More <strong>“one more round.”</strong> Let's make you a player profile.</p>
                <div className="setup-game-grid">
                  {GAMES_INFO.map(({ icon: Icon, title, desc, color }) => (
                    <div className={`setup-game-tile setup-tile-${color}`} key={title}>
                      <Icon size={23} strokeWidth={2.2} aria-hidden="true" />
                      <h3>{title}</h3><p>{desc}</p>
                    </div>
                  ))}
                </div>
                <button type="button" className="setup-button setup-button-primary" onClick={() => setStep('avatar')}>Let's make it you <ArrowRight size={19} /></button>
                <p className="setup-bottom-note">A name, a character, and you're in.</p>
              </>
            )}

            {step === 'avatar' && (
              <>
                <button type="button" className="setup-back" onClick={() => setStep('welcome')}><ArrowLeft size={16} /> Back</button>
                <span className="setup-eyebrow">PICK YOUR PLAYER</span>
                <h1>Who's <span>playing?</span></h1>
                <p className="setup-description">Find your little alter ego. This is who your partner will see in the game.</p>
                <div className="setup-avatar-grid" role="group" aria-label="Choose your character">
                  {AVATARS.map(avatar => (
                    <button type="button" key={avatar.id} className={`setup-avatar-option ${avatarId === avatar.id ? 'is-selected' : ''}`} aria-pressed={avatarId === avatar.id} onClick={() => setAvatarId(avatar.id)}>
                      <Avatar avatarId={avatar.id} size={44} />
                      <span>{avatar.label}</span>
                      {avatarId === avatar.id && <Check className="setup-avatar-check" size={14} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <div className="setup-player-preview"><Avatar avatarId={avatarId} size={52} /><div><span>Your character, ready to play</span><strong>{AVATARS.find(avatar => avatar.id === avatarId)?.label}</strong></div><Sparkles size={23} /></div>
                <button type="button" className="setup-button setup-button-primary" onClick={() => setStep('name')}>That's my character <ArrowRight size={19} /></button>
              </>
            )}

            {step === 'name' && (
              <form onSubmit={handleFinish}>
                <button type="button" className="setup-back" onClick={() => setStep('avatar')}><ArrowLeft size={16} /> Back</button>
                <span className="setup-eyebrow">ONE LAST LITTLE THING</span>
                <h1>Make a <span>name for yourself.</span></h1>
                <p className="setup-description">A real name, a nickname, an inside joke. You do you.</p>
                <div className="setup-name-preview"><Avatar avatarId={avatarId} size={70} /><span>{name.trim() || 'Player one'}</span><small>READY FOR GOOD TIMES</small></div>
                <label className="setup-field-label" htmlFor="setup-player-name">Your player name</label>
                <input id="setup-player-name" className="setup-input" type="text" autoComplete="nickname" maxLength={20} value={name} onChange={event => setName(event.target.value)} placeholder="What should we call you?" autoFocus required aria-describedby="setup-name-hint" />
                <p className="setup-field-hint" id="setup-name-hint">Up to 20 characters. Make it yours.</p>
                <div className="setup-points-note"><Heart size={20} /><p>Start at <strong>0 Heart Points.</strong> Play together and watch your connection grow.</p></div>
                <button type="submit" className="setup-button setup-button-primary" disabled={!name.trim()}>Let's play <Gamepad2 size={20} /></button>
              </form>
            )}

            {step === 'creating' && (
              <div className="setup-creating" role="status" aria-live="polite">
                <div className="setup-ready-avatar"><Avatar avatarId={avatarId} size={100} /><span><Check size={25} /></span></div>
                <span className="setup-eyebrow">YOUR NEXT GOOD TIME IS LOADING</span>
                <h1>You're in, <span>{name.trim()}!</span></h1>
                <p className="setup-description">Getting your game room ready.</p>
                <div className="setup-loading-track" aria-hidden="true"><span /></div>
              </div>
            )}
          </div>
        </section>
      </div>
      <footer className="setup-footer"><Heart size={13} /> A little closer, one game at a time.</footer>
    </main>
  );
};
