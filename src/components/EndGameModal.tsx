import React, { useEffect, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="completion-overlay">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-game-title"
        aria-describedby="end-game-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key !== 'Tab') return;
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
          if (!buttons?.length) return;
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        className="completion-sheet completion-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon in corner */}
        <button 
          onClick={onClose}
          className="completion-close"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="completion-symbol completion-symbol-pink">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>

        {/* Title */}
        <h3 id="end-game-title" className="completion-title">
          End {gameTitle || 'Game'}?
        </h3>

        {/* Subtitle / Description */}
        <p id="end-game-description" className="completion-description">
          {isMultiplayer 
            ? 'Are you sure you want to end? You and your partner will return to the lobby and progress in this round will be reset.' 
            : 'Are you sure you want to end the game? Your current round progress will be reset.'}
        </p>

        {/* Action Buttons */}
        <div className="completion-actions completion-actions-row">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            className="completion-button completion-button-secondary"
          >
            Keep Playing
          </button>
          <button 
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="completion-button completion-button-danger"
          >
            Yes, End Game
          </button>
        </div>
      </div>
    </div>
  );
};
