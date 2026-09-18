import { Heart, Sparkles } from 'lucide-react';
import '../styles/arcade-art.css';

export const BrandMark = () => (
  <span className="knot-mark" aria-hidden="true"><Heart /><Heart /></span>
);

/** Small, resolution-independent illustrations keep the arcade crisp on every screen. */
export const GameArtwork = ({ kind, compact = false }: { kind: 'cards' | 'heart' | 'wheel' | 'number' | 'letter' | 'match'; compact?: boolean }) => (
  <div className={`game-art game-art-${kind}${compact ? ' game-art-compact' : ''}`} aria-hidden="true">
    <span className="art-spark art-spark-one">✦</span><span className="art-spark art-spark-two">✧</span>
    {kind === 'cards' && <div className="art-card-fan"><div /><div /><div><Heart fill="currentColor" /><span>let’s talk</span></div></div>}
    {kind === 'heart' && <div className="art-hearts"><div className="art-chat art-chat-back"><span>you?</span></div><div className="art-chat"><Heart fill="currentColor" /><span>me!</span></div></div>}
    {kind === 'wheel' && <div className="art-wheel"><div className="art-wheel-disc" /><span className="art-wheel-center"><Heart fill="currentColor" /></span><i /></div>}
    {kind === 'number' && <div className="art-numbers"><span>7</span><span>?</span><span>3</span></div>}
    {kind === 'letter' && <div className="art-letters"><span>A</span><span>B</span><span>GO!</span></div>}
    {kind === 'match' && <div className="art-match"><span><Heart fill="currentColor" /></span><span><Heart fill="currentColor" /></span><Sparkles /></div>}
  </div>
);

export const DuoMascot = () => (
  <svg className="duo-mascot" viewBox="0 0 250 155" fill="none" aria-hidden="true">
    <ellipse cx="127" cy="141" rx="106" ry="9" fill="#241d35" opacity=".09" />
    <g stroke="#241d35" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M56 115L46 139H29M91 117L95 142H111" />
      <path d="M36 78C17 73 21 53 11 53M108 78C123 70 129 73 131 86" />
      <rect x="30" y="25" width="82" height="98" rx="35" fill="#d5f578" transform="rotate(-9 30 25)" />
      <path d="M148 118L141 142H126M186 116L194 140H211M207 75C226 70 229 57 235 53" />
      <path d="M169 33C141 3 106 37 126 65L170 122C175 128 181 127 186 121L222 66C242 33 203 7 181 34L175 42L169 33Z" fill="#ff829e" />
      <path d="M61 70V76M80 66V72M64 88Q75 98 87 84M155 64V70M178 63V69M158 84Q168 93 180 80" />
      <path d="M116 83Q122 69 134 85" />
      <path d="M116 13V4M103 20L97 14M133 16L140 8" stroke="#7650e8" />
    </g>
    <ellipse cx="52" cy="86" rx="6" ry="3.5" fill="#ff829e" /><ellipse cx="92" cy="79" rx="6" ry="3.5" fill="#ff829e" />
    <ellipse cx="146" cy="80" rx="6" ry="3.5" fill="#e6547b" /><ellipse cx="190" cy="77" rx="6" ry="3.5" fill="#e6547b" />
  </svg>
);
