import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Dices, RotateCcw, X } from 'lucide-react';
import { WHEEL_SEGMENTS, WheelSegment } from '../data/questions';
import { sounds } from '../utils/audio';

export const SpinWheel: React.FC = () => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<WheelSegment | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const numSegments = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / numSegments;
  const tickIntervalRef = useRef<number | null>(null);

  const spinTheWheel = () => {
    if (spinning) return;

    setSpinning(true);
    setShowModal(false);

    // Play initial whoosh
    sounds.playSwipe();

    // Random extra spins between 5 and 9 full rotations (1800 - 3240 deg)
    const extraRotations = 360 * (5 + Math.floor(Math.random() * 4));
    const randomSegmentIndex = Math.floor(Math.random() * numSegments);

    // Calculate landing angle so the arrow (at top, 270° or 90°) points directly to the center of the segment
    const targetDegree = 360 - (randomSegmentIndex * segmentAngle + segmentAngle / 2);
    const newRotation = rotation + extraRotations + (targetDegree - (rotation % 360));

    setRotation(newRotation);

    // Sound ticking effect while spinning
    let tickCount = 0;
    const maxTicks = 25;
    const playNextTick = () => {
      if (tickCount < maxTicks) {
        sounds.playTick();
        tickCount++;
        const delay = 60 + Math.pow(tickCount / maxTicks, 2) * 260; // easing out
        tickIntervalRef.current = window.setTimeout(playNextTick, delay);
      }
    };
    playNextTick();

    // Once spin animation completes (4s)
    setTimeout(() => {
      setSpinning(false);
      const landed = WHEEL_SEGMENTS[randomSegmentIndex];
      setSelectedSegment(landed);

      // Pick a random prompt from that segment
      const randomPrompt = landed.prompts[Math.floor(Math.random() * landed.prompts.length)];
      setActivePrompt(randomPrompt);
      setShowModal(true);

      sounds.playSuccess();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }, 4000);
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-3xl p-6 shadow-xl border border-rose-100 flex flex-col items-center justify-between min-h-[500px]">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Mod Date Night & Lepak Cafe
        </div>
        <h2 className="text-xl font-extrabold text-stone-800">Roda Jodoh: Anti-Kekok</h2>
        <p className="text-[11px] text-stone-400">
          Tengah mati kutu tak tahu nak sembang apa? Putar roda ni sekarang!
        </p>
      </div>

      {/* Wheel Area */}
      <div className="relative w-64 h-64 my-6 flex items-center justify-center">
        {/* Top Indicator Arrow */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-rose-600 filter drop-shadow-md" />
        </div>

        {/* Outer Ring Glow */}
        <div className="absolute inset-0 rounded-full border-4 border-amber-200 shadow-xl pointer-events-none" />

        {/* SVG Spinning Wheel */}
        <svg
          viewBox="0 0 300 300"
          className="w-full h-full rounded-full transition-transform ease-out"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: spinning ? '4000ms' : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.15, 0.95, 0.35, 1)'
          }}
        >
          {WHEEL_SEGMENTS.map((seg, idx) => {
            const startAngle = idx * segmentAngle;
            const endAngle = startAngle + segmentAngle;

            // Polar to Cartesian for SVG path arc
            const startRad = ((startAngle - 90) * Math.PI) / 180;
            const endRad = ((endAngle - 90) * Math.PI) / 180;

            const x1 = 150 + 145 * Math.cos(startRad);
            const y1 = 150 + 145 * Math.sin(startRad);
            const x2 = 150 + 145 * Math.cos(endRad);
            const y2 = 150 + 145 * Math.sin(endRad);

            const pathData = `M 150 150 L ${x1} ${y1} A 145 145 0 0 1 ${x2} ${y2} Z`;

            // Text coordinates along the angle bisector
            const midRad = ((startAngle + segmentAngle / 2 - 90) * Math.PI) / 180;
            const tx = 150 + 95 * Math.cos(midRad);
            const ty = 150 + 95 * Math.sin(midRad);
            const textRotation = startAngle + segmentAngle / 2;

            return (
              <g key={seg.id}>
                <path d={pathData} fill={seg.color} stroke="#ffffff" strokeWidth="2.5" />
                <text
                  x={tx}
                  y={ty}
                  fill={seg.textColor}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                >
                  {seg.icon} {seg.label.replace(/^[^\s]+\s/, '')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Center Spin Button Knob */}
        <button
          onClick={spinTheWheel}
          disabled={spinning}
          className="absolute z-10 w-16 h-16 rounded-full bg-white border-4 border-rose-500 shadow-xl flex flex-col items-center justify-center text-stone-800 font-extrabold text-[10px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition disabled:opacity-80"
        >
          <Dices className={`w-5 h-5 text-rose-500 mb-0.5 ${spinning ? 'animate-spin' : ''}`} />
          {spinning ? 'PUTAR...' : 'PUTAR!'}
        </button>
      </div>

      {/* Action Button */}
      <div className="w-full space-y-2">
        <button
          onClick={spinTheWheel}
          disabled={spinning}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-200 hover:opacity-95 transition active:scale-98 disabled:opacity-70"
        >
          <Dices className="w-4 h-4" />
          {spinning ? 'Roda Sedang Berputar...' : 'Putar Roda Sekarang 🎡'}
        </button>

        <p className="text-[10px] text-center text-stone-400">
          Tip: Letak telefon di tengah meja cafe, ambil giliran putar!
        </p>
      </div>

      {/* RESULT MODAL OVERLAY */}
      {showModal && selectedSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 text-center space-y-4 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:bg-stone-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-sm"
              style={{ backgroundColor: `${selectedSegment.color}20`, color: selectedSegment.color }}
            >
              {selectedSegment.icon}
            </div>

            <div>
              <span
                className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${selectedSegment.color}20`, color: selectedSegment.color }}
              >
                {selectedSegment.label}
              </span>
              <h3 className="text-base font-extrabold text-stone-800 mt-2 leading-snug">
                "{activePrompt}"
              </h3>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  sounds.playSuccess();
                }}
                className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-rose-600 transition"
              >
                ✅ Dah Jawab / Selesai!
              </button>

              <button
                onClick={() => {
                  setShowModal(false);
                  spinTheWheel();
                }}
                className="w-full py-2 rounded-xl bg-stone-100 text-stone-600 font-semibold text-xs hover:bg-stone-200 transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Putar Sekali Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
