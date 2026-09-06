import React, { useState } from 'react';
import { useGame, type RelationshipType } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { Avatar, AvatarPicker, getAvatar } from '../components/AvatarPicker';
import { X, Copy, Check, RefreshCw, Share2, ChevronRight, Trophy, LogOut } from 'lucide-react';
import { sounds } from '../utils/audio';

interface ProfileScreenProps {
  onClose: () => void;
}

const RELATIONSHIP_OPTIONS: { type: RelationshipType; emoji: string }[] = [
  { type: 'bestfriend', emoji: '🤝' },
  { type: 'crush', emoji: '🥺' },
  { type: 'lover', emoji: '💖' },
  { type: 'spouse', emoji: '💍' },
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onClose }) => {
  const { profile, partner, setProfile, setPartner, t } = useGame();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [view, setView] = useState<'main' | 'edit' | 'addPartner' | 'editPartner'>('main');
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState(profile?.name ?? '');
  const [editAvatar, setEditAvatar] = useState(profile?.avatarId ?? 'sunny');

  // Add partner state
  const [partnerName, setPartnerName] = useState('');
  const [partnerAvatar, setPartnerAvatar] = useState('mochi');
  const [partnerRel, setPartnerRel] = useState<RelationshipType>('crush');
  const [partnerCode, setPartnerCode] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [copied, setCopied] = useState(false);

  if (!profile) return null;

  const partnerAvDef = partner ? getAvatar(partner.avatarId) : null;

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    setProfile({ ...profile, name: editName.trim(), avatarId: editAvatar });
    setView('main');
    sounds.playSuccess();
  };

  const handleSavePartner = () => {
    if (!partnerName.trim()) return;
    setPartner({
      name: partnerName.trim(),
      avatarId: partnerAvatar,
      relationshipType: partnerRel,
      code: partnerCode,
    });
    setView('main');
    sounds.playSuccess();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(partnerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Let's play KnotYet together! Use Partner Code: *#${partnerCode}* at https://knotyetapp.me`;
    if (navigator.share) {
      navigator.share({ title: 'KnotYet', text }).catch(console.error);
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const relLabel = (type: RelationshipType) => {
    const map: Record<RelationshipType, string> = {
      bestfriend: t.relBestFriend,
      crush: t.relCrush,
      lover: t.relLoving,
      spouse: t.relSpouse,
    };
    return map[type];
  };

  const relEmoji = (type: RelationshipType) => {
    const map: Record<RelationshipType, string> = {
      bestfriend: '🤝', crush: '🥺', lover: '💖', spouse: '💍',
    };
    return map[type];
  };

  // ---- MAIN VIEW ----
  if (view === 'main') return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(160deg, #7C3AED 0%, #4F46E5 60%, #06B6D4 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <h2 className="text-xl font-black text-white">{t.profileTitle}</h2>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-white/80"
          style={{ background: 'rgba(255,255,255,0.15)' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4 no-scrollbar">
        {/* Profile Card */}
        <div className="game-card p-5 flex items-center gap-4">
          <Avatar avatarId={profile.avatarId} size={64} />
          <div className="flex-1 min-w-0">
            <p className="text-xl font-black text-ink truncate">{profile.name}</p>
            <p className="text-xs text-ink-3 font-semibold capitalize">{profile.avatarId}</p>
          </div>
          <button onClick={() => setView('edit')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-brand border-2 border-brand/20 bg-surface-2">
            Edit
          </button>
        </div>

        {/* Heart Points */}
        <div className="game-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-black text-ink text-base">{t.myHearts}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-5xl font-black text-brand">{profile.heartPoints}</div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-ink-2">Heart Points</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="tag text-[10px]" style={{ background: '#D1FAE5', color: '#065F46' }}>+15 correct guess</span>
                <span className="tag text-[10px]" style={{ background: '#FEE2E2', color: '#991B1B' }}>-5 wrong guess</span>
                <span className="tag text-[10px]" style={{ background: '#E0E7FF', color: '#3730A3' }}>+10 deck done</span>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Section */}
        {partner ? (
          <div className="game-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-ink text-base">{t.partnerProfile}</span>
              <span className="tag" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                {relEmoji(partner.relationshipType)} {relLabel(partner.relationshipType)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Avatar avatarId={partner.avatarId} size={52} />
              <div>
                <p className="text-lg font-black text-ink">{partner.name}</p>
                <p className="text-xs text-ink-3 capitalize font-semibold">{partner.avatarId}</p>
              </div>
            </div>
            {/* Combined Heart Points Display */}
            <div className="flex items-center justify-center gap-4 p-3 rounded-2xl" style={{ background: '#FFF0F9' }}>
              <div className="text-center">
                <p className="text-xs text-ink-3 font-bold">{profile.name.split(' ')[0]}</p>
                <p className="text-2xl font-black text-brand">{profile.heartPoints}</p>
              </div>
              <div className="text-2xl">💗</div>
              <div className="text-center">
                <p className="text-xs text-ink-3 font-bold">{partner.name.split(' ')[0]}</p>
                <p className="text-2xl font-black" style={{ color: partnerAvDef?.border }}>{Math.floor(profile.heartPoints * 0.85)}</p>
              </div>
            </div>
            <button
              onClick={() => { setPartner(null); sounds.playFlip(); }}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-red-500 border-2 border-red-200 bg-red-50 active:scale-95 transition"
            >
              {t.unlinkPartner}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setView('addPartner')}
            className="game-card w-full p-5 flex items-center justify-between active:scale-98 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                style={{ background: '#EDE9FE' }}>
                💗
              </div>
              <div className="text-left">
                <p className="font-black text-ink text-sm">{t.addPartner}</p>
                <p className="text-xs text-ink-3 font-semibold">Link profiles & track shared Heart Points</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-3" />
          </button>
        )}

        {/* Sync / Login Section */}
        <div className="game-card p-5 space-y-3">
          <h3 className="font-black text-ink text-base">Cloud Sync</h3>
          {user ? (
            <>
              <div className="space-y-3">
                <p className="text-xs text-ink-3 font-semibold">Logged in as {user.email}</p>
                <button
                  onClick={() => setIsSignOutOpen(true)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl text-xs font-bold text-red-500 border-2 border-red-200 bg-red-50 active:scale-95 transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>

              {/* Sign Out Confirmation Modal */}
              {isSignOutOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-pop-in">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <LogOut className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-black text-ink mb-2">Sign Out?</h3>
                    <p className="text-sm text-ink-3 mb-6">Your progress is saved in the cloud. You can sign back in anytime to continue where you left off.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsSignOutOpen(false)}
                        className="flex-1 py-3 rounded-2xl font-bold text-ink border-2 border-stone-200 bg-white hover:bg-stone-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setIsSignOutOpen(false); signOut(); }}
                        className="flex-1 py-3 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-lg shadow-red-500/30"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-3 font-semibold">Sign in to save your answered cards and points to the cloud.</p>
              <button
                onClick={() => signInWithGoogle().catch(console.error)}
                className="w-full py-3 flex items-center justify-center gap-2 rounded-xl text-xs font-black text-ink border-2 border-gray-200 bg-white active:scale-95 transition"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Continue with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ---- EDIT PROFILE VIEW ----
  if (view === 'edit') return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-100">
        <button onClick={() => setView('main')} className="text-sm font-bold text-ink-3">← Back</button>
        <span className="font-black text-ink flex-1">Edit Profile</span>
        <button onClick={handleSaveEdit}
          className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-brand active:scale-95">Save</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
        {/* Current Avatar Preview */}
        <div className="flex justify-center">
          <Avatar avatarId={editAvatar} size={80} showName />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-black text-ink">{t.profileAvatar}</p>
          <AvatarPicker selected={editAvatar} onChange={setEditAvatar} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-black text-ink">{t.profileName}</label>
          <input type="text" maxLength={20} value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-[3px] outline-none text-base font-bold text-ink"
            style={{ borderColor: '#7C3AED', background: '#FAFAFA' }} />
        </div>
      </div>
    </div>
  );

  // ---- ADD PARTNER VIEW ----
  if (view === 'addPartner') return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-100">
        <button onClick={() => setView('main')} className="text-sm font-bold text-ink-3">← Back</button>
        <span className="font-black text-ink flex-1">{t.addPartner}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
        {/* Partner Code Share */}
        <div className="p-4 rounded-2xl space-y-2" style={{ background: '#EDE9FE' }}>
          <p className="text-xs font-bold text-brand">{t.partnerCode}</p>
          <div className="text-4xl font-black tracking-widest text-brand font-mono">#{partnerCode}</div>
          <div className="flex gap-2">
            <button onClick={handleCopyCode}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-brand">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t.roomCopied : t.roomCopy}
            </button>
            <button onClick={() => setPartnerCode(Math.floor(1000 + Math.random() * 9000).toString())}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-ink-3">
              <RefreshCw className="w-3 h-3" /> New
            </button>
            <button onClick={handleShareWhatsApp}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white ml-auto">
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </button>
          </div>
        </div>

        {/* Relationship type */}
        <div className="space-y-2">
          <p className="text-sm font-black text-ink">{t.relationshipType}</p>
          <div className="grid grid-cols-2 gap-2">
            {RELATIONSHIP_OPTIONS.map(({ type, emoji }) => (
              <button key={type} onClick={() => setPartnerRel(type)}
                className="p-3 rounded-2xl text-left transition active:scale-95"
                style={{
                  border: `3px solid ${partnerRel === type ? '#7C3AED' : '#E5E7EB'}`,
                  background: partnerRel === type ? '#EDE9FE' : 'white',
                }}>
                <div className="text-xl mb-1">{emoji}</div>
                <p className="text-xs font-black text-ink leading-tight">{relLabel(type)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Partner name */}
        <div className="space-y-2">
          <label className="text-sm font-black text-ink">Their nickname:</label>
          <input type="text" maxLength={20} value={partnerName}
            onChange={e => setPartnerName(e.target.value)}
            placeholder="e.g. Zaim"
            className="w-full px-4 py-3 rounded-2xl border-[3px] outline-none text-base font-bold text-ink"
            style={{ borderColor: partnerName ? '#7C3AED' : '#E5E7EB', background: '#FAFAFA' }} />
        </div>

        {/* Partner avatar */}
        <div className="space-y-2">
          <p className="text-sm font-black text-ink">Pick their character:</p>
          <AvatarPicker selected={partnerAvatar} onChange={setPartnerAvatar} />
        </div>

        <button onClick={handleSavePartner} disabled={!partnerName.trim()}
          className={`btn-chunky w-full text-sm ${partnerName.trim() ? 'btn-pink' : 'btn-white opacity-50'}`}>
          💗 Link {partnerName || 'Partner'}
        </button>
      </div>
    </div>
  );

  return null;
};
