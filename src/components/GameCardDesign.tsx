import '../styles/game-cards.css';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Dices, Flag, Gamepad2, Heart, HeartCrack, HeartHandshake, Layers3, Leaf, Link2, LockKeyhole, Mail, MessageCircle, Puzzle, RefreshCw, Smile, Star, Trophy, Type, Users, Zap } from 'lucide-react';

const SYMBOLS = { heart: Heart, broken: HeartCrack, together: HeartHandshake, ring: Link2, smile: Smile, star: Star, game: Gamepad2, message: MessageCircle, mail: Mail, zap: Zap, type: Type, dice: Dices, trophy: Trophy, cards: Layers3, lock: LockKeyhole, check: Check, flag: Flag, puzzle: Puzzle, leaf: Leaf, users: Users, flip: RefreshCw, next: ArrowRight, back: ArrowLeft, higher: ArrowUp, lower: ArrowDown };
export const UiSymbol = ({ kind = 'heart', className = '' }: { kind?: keyof typeof SYMBOLS; className?: string }) => {
  const Icon = SYMBOLS[kind];
  return <Icon className={`ui-symbol ${className}`} aria-hidden="true" />;
};
export const RoundLabel = ({ title, detail, kind = 'cards' }: { title: string; detail: string; kind?: keyof typeof SYMBOLS }) => (
  <div className="round-label"><span><UiSymbol kind={kind} /> {title}</span><span>{detail}</span></div>
);
export const ResultArt = ({ kind = 'trophy' }: { kind?: 'trophy' | 'heart' | 'together' | 'higher' | 'lower' | 'smile' | 'users' }) => (
  <div className={`result-art result-art-${kind}`} aria-hidden="true"><span className="result-art-disc"><UiSymbol kind={kind} /></span><span className="result-art-token"><UiSymbol kind={kind === 'trophy' ? 'star' : 'heart'} /></span><i /><i /></div>
);

