import { UiSymbol, RoundLabel } from './GameCardDesign';
import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Dices, RotateCcw } from 'lucide-react';
import { WHEEL_SEGMENTS, WheelSegment } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';
import { getRandomUnseenWheelSelection, getWheelPromptId, markQuestionAsSeen } from '../utils/questionManager';

export interface Props {
  onEndGame?: () => void;
  reservedQuestionIds?: string[];
}

export const SpinWheel: React.FC<Props> = ({ onEndGame, reservedQuestionIds = [] }) => {
  const { t, partner, addHeartPoints, recordAnsweredQuestion } = useGame();
  const { checkLimit, incrementPlayCount, progress } = useAuth();
  const multiplayer = useMultiplayer();
  const partnerName = multiplayer.remoteProfile?.name || partner?.name || 'Partner';
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<WheelSegment | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [allPromptsSeen, setAllPromptsSeen] = useState(false);
  const tickIntervalRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
  const lastRemoteSpinRef = useRef<string | null>(null);
  React.useEffect(() => () => {
    if (tickIntervalRef.current !== null) window.clearTimeout(tickIntervalRef.current);
    if (spinTimeoutRef.current !== null) window.clearTimeout(spinTimeoutRef.current);
  }, []);

  const numSegments = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / numSegments;

  React.useEffect(() => {
    if (multiplayer.status === 'connected') {
      return multiplayer.subscribeMessage((msg: MultiplayerMessage) => {
        if (msg.type === 'SPIN_WHEEL') {
          lastRemoteSpinRef.current = JSON.stringify(msg.payload);
          executeSpin(msg.payload.rotation, msg.payload.segmentIndex, msg.payload.promptIndex);
        } else if (msg.type === 'WHEEL_SUBMIT') {
          setPartnerAnswer(msg.payload);
        }
      });
    }
  }, [multiplayer.status, multiplayer.subscribeMessage]);
  React.useEffect(() => {
    if (multiplayer.status !== 'connected' || multiplayer.isHost || !multiplayer.wheelSpin) return;
    const key = JSON.stringify(multiplayer.wheelSpin);
    if (lastRemoteSpinRef.current === key) return;
    lastRemoteSpinRef.current = key;
    executeSpin(multiplayer.wheelSpin.rotation, multiplayer.wheelSpin.segmentIndex, multiplayer.wheelSpin.promptIndex);
  }, [multiplayer.status, multiplayer.isHost, multiplayer.wheelSpin]);

  const executeSpin = (targetRotation: number, segmentIdx: number, promptIdx: number) => {
    setSpinning(true);
    setShowModal(false);
    setMyAnswer(null);
    setPartnerAnswer(null);
    setRotation(targetRotation);
    sounds.playSwipe();

    let tickCount = 0;
    const maxTicks = 25;
    const playNextTick = () => {
      if (tickCount < maxTicks) {
        sounds.playTick();
        tickCount++;
        const delay = 60 + Math.pow(tickCount / maxTicks, 2) * 260;
        tickIntervalRef.current = window.setTimeout(playNextTick, delay);
      }
    };
    playNextTick();

    spinTimeoutRef.current = window.setTimeout(() => {
      setSpinning(false);
      const landed = WHEEL_SEGMENTS[segmentIdx];
      const questionId = getWheelPromptId(landed.id, promptIdx);
      setSelectedSegment(landed);
      setActivePrompt(landed.prompts[promptIdx]);
      setShowModal(true);
      markQuestionAsSeen(questionId);
      recordAnsweredQuestion(questionId);
      if (multiplayer.status !== 'connected') {
        incrementPlayCount('solo');
      }
      addHeartPoints(HEART_POINTS.COMPLETE_WHEEL, multiplayer.status === 'connected');
      sounds.playSuccess();
      confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 }, colors: ['#FF2D9B', '#7C3AED', '#06B6D4', '#10B981', '#FACC15', '#F97316'] });
    }, 4000);
  };

  const spinTheWheel = () => {
    if (spinning) return;
    
    if (multiplayer.status !== 'connected' && !checkLimit('solo')) {
      return;
    }
    
    // Icebreaker keeps its next deck ready while this game is open. Keep those
    // queued cards out of the wheel so switching games cannot repeat a prompt.
    const selection = getRandomUnseenWheelSelection([...(progress?.answered_questions || []), ...reservedQuestionIds]);
    if (!selection) {
      setAllPromptsSeen(true);
      return;
    }
    setAllPromptsSeen(false);
    const extraRotations = 360 * (5 + Math.floor(Math.random() * 4));
    const randomSegmentIndex = selection.segmentIndex;
    const targetDegree = 360 - (randomSegmentIndex * segmentAngle + segmentAngle / 2);
    const newRotation = rotation + extraRotations + (targetDegree - (rotation % 360));
    
    const promptIndex = selection.promptIndex;

    if (multiplayer.status === 'connected') {
      setMyAnswer(null);
      setPartnerAnswer(null);
      multiplayer.sendMessage({ 
        type: 'SPIN_WHEEL', 
        payload: { rotation: newRotation, segmentIndex: randomSegmentIndex, promptIndex } 
      });
    }
    
    executeSpin(newRotation, randomSegmentIndex, promptIndex);
  };

  const handleEndGame = () => {
    if (onEndGame) {
      onEndGame();
    }
  };

  // Desktop keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      // Open dialogs own the keyboard; native controls keep their activation keys.
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      if (showModal) return;
      if (target?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="link"], [role="dialog"], [role="alertdialog"]')) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        spinTheWheel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, spinning, rotation, multiplayer.status]);

  return (
    <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex-1 flex flex-col justify-between h-full animate-fade-in space-y-2 mx-auto">
      {/* Standardized Game Header Bar */}
      <div className="game-toolbar w-full flex items-center justify-between px-3 py-2 rounded-2xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}>
            <Dices className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-black text-white text-sm leading-tight drop-shadow-sm">Anti-Awkward Wheel</h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
              <span>Date Night Mode</span>
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-500/80 text-white text-[9px] font-black">
                Spin & Ask
              </span>
            </div>
          </div>
        </div>
        <button onClick={handleEndGame} className="game-end-button text-xs font-bold transition px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95">
          End Game
        </button>
      </div>

      {/* Main Game Card - Full Height Flexible */}
      <div className="game-card activity-card wheel-board w-full flex-1 flex flex-col items-center justify-between p-3.5 sm:p-5 overflow-hidden relative animate-pop-in">
        {/* Header inside Card */}
        <div className="text-center space-y-0.5 shrink-0">
          <h3 className="text-base sm:text-xl font-black text-ink">{t.wheelTitle}</h3>
          <p className="text-[10px] sm:text-[11px] text-ink-3 font-medium">{t.wheelSub}</p>
        </div>

        {/* Wheel */}
        <div className="relative my-auto py-1 shrink-0 w-[220px] h-[220px] sm:w-[270px] sm:h-[270px] md:w-[320px] md:h-[320px] lg:w-[360px] lg:h-[360px]">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0"
            style={{ borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '20px solid #241d35' }} />
        </div>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: '3px solid #241d35', boxShadow: '5px 6px 0 #241d35' }} />

        {/* SVG Wheel */}
        <svg viewBox="0 0 300 300" style={{
          width: '100%', height: '100%', borderRadius: '50%',
          transform: `rotate(${rotation}deg)`,
          transitionDuration: spinning ? '4000ms' : '0ms',
          transitionTimingFunction: 'cubic-bezier(0.15, 0.95, 0.35, 1)',
        }}>
          {WHEEL_SEGMENTS.map((seg, idx) => {
            const startAngle = idx * segmentAngle;
            const endAngle = startAngle + segmentAngle;
            const startRad = ((startAngle - 90) * Math.PI) / 180;
            const endRad = ((endAngle - 90) * Math.PI) / 180;
            const x1 = 150 + 145 * Math.cos(startRad);
            const y1 = 150 + 145 * Math.sin(startRad);
            const x2 = 150 + 145 * Math.cos(endRad);
            const y2 = 150 + 145 * Math.sin(endRad);
            const pathData = `M 150 150 L ${x1} ${y1} A 145 145 0 0 1 ${x2} ${y2} Z`;
            const midRad = ((startAngle + segmentAngle / 2 - 90) * Math.PI) / 180;
            const tx = 150 + 95 * Math.cos(midRad);
            const ty = 150 + 95 * Math.sin(midRad);
            return (
              <g key={seg.id}>
                <path d={pathData} fill={seg.color} stroke="#241d35" strokeWidth="1.5" />
                <text x={tx} y={ty} fill={seg.textColor} fontSize="10" fontWeight="600" fontFamily="Outfit, sans-serif"
                  textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${startAngle + segmentAngle / 2}, ${tx}, ${ty})`}>
                  {seg.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Center button */}
        <button onClick={spinTheWheel} disabled={spinning || allPromptsSeen}
          className="absolute z-10 flex flex-col items-center justify-center font-black text-[10px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition text-white"
          style={{
            width: 64, height: 64, borderRadius: '50%',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#7650e8',
            border: '4px solid white',
            boxShadow: '0 4px 0 rgba(0,0,0,0.2), 0 8px 20px rgba(255,45,155,0.4)',
          }}>
          <Dices className={`w-5 h-5 mb-0.5 ${spinning ? 'animate-spin' : ''}`} />
          {spinning ? '...' : allPromptsSeen ? 'DONE' : 'SPIN!'}
        </button>
      </div>

      <RoundLabel title="LEAVE IT TO LUCK" detail="SPIN & TALK" kind="dice" />
      {/* Spin button */}
      <div className="w-full space-y-2">
        <button onClick={spinTheWheel} disabled={spinning || allPromptsSeen}
          className="btn-chunky btn-amber w-full text-sm disabled:opacity-60">
          <Dices className="w-4 h-4" />
          {spinning ? t.wheelSpinning : allPromptsSeen ? 'All prompts explored' : t.wheelSpin}
        </button>
        <p className="text-[10px] text-center text-ink-3 font-semibold">{allPromptsSeen ? 'You have seen every wheel prompt. Try another game together!' : t.wheelTip}</p>
      </div>

      {/* Result Modal */}
      {showModal && selectedSegment && (
        <div className="modal-overlay centered" role="dialog" aria-modal="true" aria-label="Wheel result">
          <div className="game-card activity-card wheel-prompt w-full max-w-xs sm:max-w-md p-6 text-center space-y-4 animate-pop-in relative"
            style={{ boxShadow: `0 0 0 4px ${selectedSegment.color}30, 0 20px 60px rgba(0,0,0,0.25)` }}>

            <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-3xl animate-float"
              style={{ background: `${selectedSegment.color}18`, border: `3px solid ${selectedSegment.color}40`, boxShadow: `0 8px 24px ${selectedSegment.color}35` }}>
              <UiSymbol kind="dice" />
            </div>

            <div>
              <span className="tag text-xs" style={{ background: `${selectedSegment.color}15`, color: '#241d35', border: '1.5px solid #241d35' }}>
                {selectedSegment.label}
              </span>
              <h3 className={`question-text ${(activePrompt?.length ?? 0) > 140 ? 'question-long' : ''}`}>{activePrompt}</h3>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-ink-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              +{HEART_POINTS.COMPLETE_WHEEL} Heart Points earned!
            </div>

            {multiplayer.status === 'connected' ? (
              <div className="space-y-3 mt-4">
                {partnerAnswer && !myAnswer && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-200 text-center animate-bounce-soft">
                    <p className="text-xs text-amber-800 font-black flex items-center justify-center gap-1.5">
                      <span><UiSymbol kind="zap" /></span> {partnerName} has already answered! Waiting for your reaction...
                    </p>
                  </div>
                )}
                {!partnerAnswer && myAnswer && (
                  <div className="p-3 rounded-xl bg-purple-50 border-2 border-purple-200 text-center space-y-1.5 animate-slide-up">
                    <p className="text-[10px] font-bold text-purple-600">
                      ✓ You submitted: <span className="font-black text-ink">"{myAnswer}"</span>
                    </p>
                    <p className="text-xs text-brand font-black animate-pulse flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                      Waiting for {partnerName} to submit...
                    </p>
                  </div>
                )}
                
                {partnerAnswer && myAnswer ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-left mb-4">
                       <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                         <p className="text-[10px] uppercase font-black text-indigo-400 mb-1">You</p>
                         <p className="text-sm font-bold text-ink break-words">{myAnswer}</p>
                       </div>
                       <div className="bg-pink-50 p-2.5 rounded-xl border border-pink-100">
                         <p className="text-[10px] uppercase font-black text-pink-400 mb-1">{partnerName}</p>
                         <p className="text-sm font-bold text-ink break-words">{partnerAnswer}</p>
                       </div>
                    </div>
                    <button onClick={() => setShowModal(false)}
                      className="btn-chunky btn-green w-full text-xs" style={{ borderRadius: '12px' }}>
                      <UiSymbol kind="check" /> Continue
                    </button>
                  </>
                ) : !myAnswer ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const val = new FormData(e.currentTarget).get('ans') as string;
                    if (!val) return;
                    setMyAnswer(val);
                    multiplayer.sendMessage({ type: 'WHEEL_SUBMIT', payload: val });
                    sounds.playSuccess();
                  }}>
                    <input
                      type="text"
                      name="ans"
                      aria-label="Your answer or reaction"
                      autoComplete="off"
                      placeholder="Type answer or reaction..."
                      className="w-full bg-stone-100 border-2 border-stone-200 p-3 rounded-xl text-sm font-semibold focus:border-brand outline-none mb-2"
                    />
                    <button type="submit" className="btn-chunky btn-pink w-full text-xs" style={{ borderRadius: '12px' }}>
                      Submit & Reveal
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => { setShowModal(false); sounds.playFlip(); }}
                  className="btn-chunky btn-green w-full text-xs" style={{ borderRadius: '12px' }}>
                  <UiSymbol kind="check" /> {t.wheelDone}
                </button>
                <button onClick={() => { setShowModal(false); spinTheWheel(); }}
                  className="btn-chunky btn-white w-full text-xs flex items-center justify-center gap-1.5" style={{ borderRadius: '12px' }}>
                  <RotateCcw className="w-3.5 h-3.5" /> {t.wheelAgain}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
  );
};
