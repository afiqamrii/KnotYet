import React, { useState } from 'react';
import { Users, Copy, Check, Share2, Sparkles, X, KeyRound, Play, RefreshCw } from 'lucide-react';
import { sounds } from '../utils/audio';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRoom: (code: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onStartRoom }) => {
  const [roomCode, setRoomCode] = useState<string>(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    sounds.playFlip();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = () => {
    sounds.playFlip();
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  };

  const shareToWhatsApp = () => {
    sounds.playSuccess();
    const text = encodeURIComponent(
      `Jom main game Taaruf & Teka-Teki ni berdua! Masukkan Kod Bilik: *#${roomCode}* sekarang di: ${window.location.origin}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim().length >= 4) {
      sounds.playSuccess();
      onStartRoom(inputCode.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:bg-stone-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2 border border-rose-100">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold text-stone-800">Mod Main Bersama (Online)</h3>
          <p className="text-[11px] text-stone-400">
            Sesuai untuk pasangan LDR atau tengah bersembang di WhatsApp!
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-100 border border-stone-200 text-xs font-bold text-stone-600">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2 rounded-xl transition ${activeTab === 'create' ? 'bg-white text-rose-600 shadow-xs' : ''}`}
          >
            Cipta Bilik Baru
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`py-2 rounded-xl transition ${activeTab === 'join' ? 'bg-white text-rose-600 shadow-xs' : ''}`}
          >
            Sertai Bilik
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-center space-y-2">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Kod Bilik Anda:</span>
              <div className="text-4xl font-extrabold text-stone-900 tracking-widest font-mono">
                #{roomCode}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-semibold hover:underline"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Berjaya Disalin!' : 'Salin Kod'}
                </button>
                <span className="text-stone-300">•</span>
                <button
                  onClick={handleRegenerateCode}
                  className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 font-semibold"
                  title="Tukar Kod Lain"
                >
                  <RefreshCw className="w-3 h-3" /> Tukar Kod
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={shareToWhatsApp}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-200 active:scale-98"
              >
                <Share2 className="w-4 h-4" /> Jemput Pasangan di WhatsApp
              </button>

              <button
                onClick={() => {
                  onStartRoom(roomCode);
                  onClose();
                }}
                className="w-full py-2.5 rounded-2xl bg-stone-900 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                <Play className="w-3.5 h-3.5" /> Masuk Bilik Sekarang
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700">Masukkan 4-Digit Kod Bilik:</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={4}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Contoh: 7482"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-hidden text-center text-xl font-bold font-mono tracking-widest text-stone-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={inputCode.length < 4}
              className="w-full py-3 rounded-2xl bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-700 transition disabled:opacity-50 shadow-md shadow-rose-200 active:scale-98"
            >
              Masuk & Mula Main
            </button>
          </form>
        )}

        {/* Free Token Notice */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center text-[10px] text-amber-800 flex items-center justify-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Percuma 3 sesi multiplayer setiap hari tanpa langganan!
        </div>
      </div>
    </div>
  );
};
