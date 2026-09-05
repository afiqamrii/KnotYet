import React, { useState } from 'react';
import { Users, Copy, Check, Share2, Sparkles, X, KeyRound, Play, Loader2 } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useGame } from '../store/GameContext';
import { useMultiplayer } from '../store/MultiplayerContext';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose }) => {
  const { t, profile } = useGame();
  const { hostRoom, joinRoom, status, error, isHost } = useMultiplayer();
  const [roomCode] = useState<string>(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(() => {
    return (error && !isHost) ? 'join' : 'create';
  });

  if (!isOpen || !profile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    sounds.playFlip();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToWhatsApp = () => {
    sounds.playSuccess();
    const text = encodeURIComponent(`Let's play JodohDeck together! Room Code: *#${roomCode}* → ${window.location.origin}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCreate = () => {
    sounds.playSuccess();
    hostRoom(roomCode, profile);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim().length >= 4) {
      sounds.playSuccess();
      joinRoom(inputCode.trim(), profile);
    }
  };

  return (
    <div className="modal-overlay centered" onClick={onClose}>
      <div className="game-card w-full max-w-sm p-6 space-y-5 animate-pop-in relative"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-ink-3 hover:bg-stone-100">
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 animate-float"
            style={{ background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)', boxShadow: '0 8px 20px rgba(255,45,155,0.4)' }}>
            <Users className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-black text-ink">{t.roomTitle}</h3>
          <p className="text-[11px] text-ink-3">{t.roomSub}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 text-xs font-bold rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-2xl gap-1" style={{ background: '#F3F4F6' }}>
          <button onClick={() => setActiveTab('create')}
            className={`py-2 rounded-xl text-xs font-black transition active:scale-95 ${activeTab === 'create' ? 'text-white' : 'text-ink-3'}`}
            style={activeTab === 'create' ? { background: '#FF2D9B', boxShadow: '0 3px 0 #C41D77' } : {}}>
            {t.roomCreate}
          </button>
          <button onClick={() => setActiveTab('join')}
            className={`py-2 rounded-xl text-xs font-black transition active:scale-95 ${activeTab === 'join' ? 'text-white' : 'text-ink-3'}`}
            style={activeTab === 'join' ? { background: '#06B6D4', boxShadow: '0 3px 0 #0E7490' } : {}}>
            {t.roomJoin}
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl text-center space-y-2" style={{ background: '#EDE9FE', border: '2px solid #DDD6FE' }}>
              <p className="text-[11px] font-bold text-brand uppercase tracking-wider">{t.roomCode}</p>
              <div className="text-4xl font-black tracking-widest font-mono text-ink">#{roomCode}</div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? t.roomCopied : t.roomCopy}
                </button>
              </div>
            </div>
            <button onClick={shareToWhatsApp}
              className="btn-chunky btn-green w-full text-xs">
              <Share2 className="w-4 h-4" /> {t.roomWhatsapp}
            </button>
            <button onClick={handleCreate} disabled={status === 'hosting'}
              className="btn-chunky btn-white w-full text-xs disabled:opacity-70">
              {status === 'hosting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} 
              {status === 'hosting' ? 'Waiting for partner...' : 'Host Room'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-ink">{t.roomInputLabel}</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input type="text" maxLength={4} value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  placeholder={t.roomInputPlaceholder}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-[3px] outline-none text-center text-xl font-black font-mono tracking-widest text-ink transition"
                  style={{ borderColor: inputCode.length === 4 ? '#7C3AED' : '#E5E7EB', background: '#FAFAFA' }} />
              </div>
            </div>
            <button type="submit" disabled={inputCode.length < 4 || status === 'joining'}
              className="btn-chunky btn-pink w-full text-sm disabled:opacity-50">
              {status === 'joining' ? <Loader2 className="w-4 h-4 animate-spin" /> : t.roomStart}
            </button>
          </form>
        )}

        <div className="p-3 rounded-xl text-center text-[10px] flex items-center justify-center gap-1.5 font-medium"
          style={{ background: '#FFFBEB', border: '2px solid #FDE68A', color: '#92400E' }}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {t.roomFreeNote}
        </div>
      </div>
    </div>
  );
};
