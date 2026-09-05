import React from 'react';
import { Heart, RefreshCw, Share2, Sparkles, CheckCircle2 } from 'lucide-react';
import { sounds } from '../utils/audio';

interface SummaryModalProps {
  isOpen: boolean;
  answeredCount: number;
  skippedCount: number;
  categoryLabel: string;
  onRestart: () => void;
  onSelectCategory: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  answeredCount,
  skippedCount,
  categoryLabel,
  onRestart,
  onSelectCategory
}) => {
  if (!isOpen) return null;

  const handleShareStory = () => {
    sounds.playSuccess();
    const text = encodeURIComponent(
      `Kami dah habis bincang ${answeredCount} soalan dalam ${categoryLabel} kat JodohDeck! Korang berani tak test kejujuran pasangan korang? 🔥`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <Heart className="w-8 h-8 fill-rose-500" />
        </div>

        <div>
          <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">Tahniah Korang!</span>
          <h2 className="text-2xl font-extrabold text-stone-800 mt-1">Deck Selesai Diteroka!</h2>
          <p className="text-xs text-stone-500 mt-1">
            Kategori: <strong className="text-stone-700">{categoryLabel}</strong>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs font-bold mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Berjaya Jawab
            </div>
            <div className="text-2xl font-black text-emerald-800">{answeredCount}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200 text-center">
            <div className="text-stone-500 text-xs font-bold mb-0.5">
              Di-Skip Dulu
            </div>
            <div className="text-2xl font-black text-stone-700">{skippedCount}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 text-xs text-stone-700 text-left space-y-1">
          <div className="font-bold flex items-center gap-1 text-rose-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Vibe Hubungan:
          </div>
          <p className="text-[11px] leading-relaxed">
            Korang selangkah lebih matang dan jujur dalam memahami pasangan. Komunikasi terbuka macam ni la rahsia rumahtangga bahagia!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleShareStory}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-200 active:scale-98"
          >
            <Share2 className="w-4 h-4" /> Kongsi Kejayaan ke WhatsApp
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 rounded-2xl bg-stone-900 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Ulang Deck Ini
          </button>

          <button
            onClick={onSelectCategory}
            className="w-full py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-semibold"
          >
            Tukar Kategori Lain
          </button>
        </div>
      </div>
    </div>
  );
};
