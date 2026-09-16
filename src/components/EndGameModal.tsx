import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface EndGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isMultiplayer?: boolean;
  gameTitle?: string;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isMultiplayer = false,
  gameTitle,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl animate-pop-in relative border border-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon in corner */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-ink-3 hover:bg-stone-100 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-3xl bg-rose-100 flex items-center justify-center mx-auto mb-4 border-2 border-rose-200 shadow-sm animate-bounce-soft">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-ink mb-2">
          End {gameTitle || 'Game'}?
        </h3>

        {/* Subtitle / Description */}
        <p className="text-xs sm:text-sm text-ink-3 mb-6 leading-relaxed">
          {isMultiplayer 
            ? 'Are you sure you want to end? You and your partner will return to the lobby and progress in this round will be reset.' 
            : 'Are you sure you want to end the game? Your current round progress will be reset.'}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl font-black text-sm text-ink-3 bg-stone-100 hover:bg-stone-200 active:scale-95 transition"
          >
            Keep Playing
          </button>
          <button 
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="flex-1 py-3.5 rounded-2xl font-black text-sm text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition shadow-lg shadow-rose-500/30"
          >
            Yes, End Game
          </button>
        </div>
      </div>
    </div>
  );
};
