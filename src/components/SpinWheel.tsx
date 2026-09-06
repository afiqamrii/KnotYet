import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Dices, RotateCcw, X } from 'lucide-react';
import { WHEEL_SEGMENTS, WheelSegment } from '../data/questions';
import { sounds } from '../utils/audio';
import { useGame, HEART_POINTS } from '../store/GameContext';
import { useAuth } from '../store/AuthContext';
import { useMultiplayer, MultiplayerMessage } from '../store/MultiplayerContext';

export const SpinWheel: React.FC = () => {
  const { t, addHeartPoints } = useGame();
  const { checkLimit, incrementPlayCount } = useAuth();
  const multiplayer = useMultiplayer();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<WheelSegment | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  const numSegments = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / numSegments;

  React.useEffect(() => {
    if (multiplayer.status === 'connected') {
      multiplayer.messageListener.current = (msg: MultiplayerMessage) => {
        if (msg.type === 'SPIN_WHEEL') {
          executeSpin(msg.payload.rotation, msg.payload.segmentIndex, msg.payload.promptIndex);
        } else if (msg.type === 'WHEEL_SUBMIT') {
          setPartnerAnswer(msg.payload);
        }
      };
    }
  }, [multiplayer.status, multiplayer.messageListener]);

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

    setTimeout(() => {
      setSpinning(false);
      const landed = WHEEL_SEGMENTS[segmentIdx];
      setSelectedSegment(landed);
      setActivePrompt(landed.prompts[promptIdx]);
      setShowModal(true);
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
    
    const extraRotations = 360 * (5 + Math.floor(Math.random() * 4));
    const randomSegmentIndex = Math.floor(Math.random() * numSegments);
    const targetDegree = 360 - (randomSegmentIndex * segmentAngle + segmentAngle / 2);
    const newRotation = rotation + extraRotations + (targetDegree - (rotation % 360));
    
    const landed = WHEEL_SEGMENTS[randomSegmentIndex];
    const promptIndex = Math.floor(Math.random() * landed.prompts.length);

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

  return (
    <div className="game-card w-full max-w-sm mx-auto p-6 flex flex-col items-center justify-between min-h-[510px]">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black text-white"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316, #FF2D9B)', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}>
          <Sparkles className="w-3.5 h-3.5" /> Date Night Mode
        </div>
        <h2 className="text-2xl font-black text-ink">{t.wheelTitle}</h2>
        <p className="text-[11px] text-ink-3 font-medium">{t.wheelSub}</p>
      </div>

      {/* Wheel */}
      <div className="relative my-4" style={{ width: 272, height: 272 }}>
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0"
            style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '22px solid #FF2D9B', filter: 'drop-shadow(0 2px 4px rgba(255,45,155,0.5))' }} />
        </div>

        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: '4px solid white', boxShadow: '0 0 0 4px rgba(124,58,237,0.2), 0 12px 40px rgba(0,0,0,0.18)' }} />

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
                <path d={pathData} fill={seg.color} stroke="white" strokeWidth="3" />
                <text x={tx} y={ty} fill={seg.textColor} fontSize="11" fontWeight="900"
                  textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${startAngle + segmentAngle / 2}, ${tx}, ${ty})`}>
                  {seg.icon} {seg.label.replace(/^[^\s]+\s/, '')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Center button */}
        <button onClick={spinTheWheel} disabled={spinning}
          className="absolute z-10 flex flex-col items-center justify-center font-black text-[10px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition text-white"
          style={{
            width: 64, height: 64, borderRadius: '50%',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, #FF2D9B, #7C3AED)',
            border: '4px solid white',
            boxShadow: '0 4px 0 rgba(0,0,0,0.2), 0 8px 20px rgba(255,45,155,0.4)',
          }}>
          <Dices className={`w-5 h-5 mb-0.5 ${spinning ? 'animate-spin' : ''}`} />
          {spinning ? '...' : 'SPIN!'}
        </button>
      </div>

      {/* Spin button */}
      <div className="w-full space-y-2">
        <button onClick={spinTheWheel} disabled={spinning}
          className="btn-chunky btn-amber w-full text-sm disabled:opacity-60">
          <Dices className="w-4 h-4" />
          {spinning ? t.wheelSpinning + ' 🎡' : t.wheelSpin + ' 🎡'}
        </button>
        <p className="text-[10px] text-center text-ink-3 font-semibold">{t.wheelTip}</p>
      </div>

      {/* Result Modal */}
      {showModal && selectedSegment && (
        <div className="modal-overlay centered" onClick={() => setShowModal(false)}>
          <div className="game-card w-full max-w-xs p-6 text-center space-y-4 animate-pop-in relative"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: `0 0 0 4px ${selectedSegment.color}30, 0 20px 60px rgba(0,0,0,0.25)` }}>

            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-ink-3 hover:bg-stone-100">
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-3xl animate-float"
              style={{ background: `${selectedSegment.color}18`, border: `3px solid ${selectedSegment.color}40`, boxShadow: `0 8px 24px ${selectedSegment.color}35` }}>
              {selectedSegment.icon}
            </div>

            <div>
              <span className="tag text-xs" style={{ background: `${selectedSegment.color}15`, color: selectedSegment.color, border: `2px solid ${selectedSegment.color}30` }}>
                {selectedSegment.label}
              </span>
              <h3 className="text-base font-black text-ink mt-2.5 leading-snug">{activePrompt}</h3>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-ink-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              +{HEART_POINTS.COMPLETE_WHEEL} Heart Points earned!
            </div>

            {multiplayer.status === 'connected' ? (
              <div className="space-y-3 mt-4">
                {partnerAnswer && !myAnswer && (
                  <p className="text-xs text-brand font-bold animate-pulse">Partner is ready! Waiting for you...</p>
                )}
                {!partnerAnswer && myAnswer && (
                  <p className="text-xs text-brand font-bold animate-pulse">Waiting for partner...</p>
                )}
                
                {partnerAnswer && myAnswer ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-left mb-4">
                       <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                         <p className="text-[10px] uppercase font-black text-indigo-400 mb-1">You</p>
                         <p className="text-sm font-bold text-ink break-words">{myAnswer}</p>
                       </div>
                       <div className="bg-pink-50 p-2.5 rounded-xl border border-pink-100">
                         <p className="text-[10px] uppercase font-black text-pink-400 mb-1">{multiplayer.remoteProfile?.name}</p>
                         <p className="text-sm font-bold text-ink break-words">{partnerAnswer}</p>
                       </div>
                    </div>
                    <button onClick={() => setShowModal(false)}
                      className="btn-chunky btn-green w-full text-xs" style={{ borderRadius: '12px' }}>
                      ✅ Continue
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
                <button onClick={() => { setShowModal(false); sounds.playSuccess(); }}
                  className="btn-chunky btn-green w-full text-xs" style={{ borderRadius: '12px' }}>
                  ✅ {t.wheelDone}
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
  );
};
