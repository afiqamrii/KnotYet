import React from 'react';

export interface AvatarDef {
  id: string;
  name: string;
  bg: string;
  border: string;
  face: React.ReactNode;
  label: string;
}

const CharacterFace = ({ kind, color }: { kind: string; color: string }) => (
  <svg viewBox="0 0 64 64" className="player-glyph" aria-hidden="true" fill="none" style={{ width: '1.35em', height: '1.35em', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <g stroke="#241d35" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'sunny' ? <path d="M32 5L39 13L50 12L51 23L59 32L51 40L50 51L39 51L32 59L24 51L13 51L13 40L5 32L13 23L13 12L24 13Z" fill={color} />
      : kind === 'starry' ? <path d="M32 5L40 22L59 24L45 37L49 57L32 47L15 57L19 37L5 24L24 22Z" fill={color} />
      : kind === 'maple' ? <path d="M32 18C15-3-1 20 12 35L32 56L52 35C65 19 49-2 32 18Z" fill={color} />
      : kind === 'zigzag' ? <path d="M35 5L12 34L27 35L24 59L53 26L37 26Z" fill={color} />
      : kind === 'mochi' ? <path d="M32 12C44-4 58 9 51 23C69 29 59 48 46 47C46 63 23 64 20 48C2 52-6 28 13 23C5 7 23-2 32 12Z" fill={color} />
      : kind === 'coco' ? <path d="M12 49C-2 19 21 6 53 8C57 40 40 60 12 49Z" fill={color} />
      : kind === 'comet' ? <path d="M8 39C7 22 28 7 52 11L45 21L56 22C56 47 40 58 24 53C14 51 8 47 8 39Z" fill={color} />
      : <path d="M10 27C5 13 23 2 34 13C49 1 64 21 53 32C65 49 43 62 32 52C15 65-2 44 10 27Z" fill={color} />}
      <path d={kind === 'zigzag' ? 'M27 30v3M37 30v3' : 'M23 28v4M40 28v4'} />
      <path d={kind === 'zigzag' ? 'M28 39Q33 43 38 37' : 'M26 40Q32 46 38 40'} />
    </g>
  </svg>
);

export const AVATARS: AvatarDef[] = [
  ['sunny', 'Sunny', '#ffcd70', '#9c670f'], ['mochi', 'Mochi', '#ff9fb8', '#b04870'],
  ['bubbles', 'Bubbles', '#a9ddf5', '#286a86'], ['coco', 'Coco', '#d5f578', '#55791d'],
  ['zigzag', 'Zigzag', '#c7b4ff', '#6547a7'], ['starry', 'Starry', '#ffd4a4', '#a65b22'],
  ['maple', 'Maple', '#ff829e', '#a94061'], ['comet', 'Comet', '#93ded1', '#28766a'],
].map(([id, name, color, border]) => ({ id, name, label: name, bg: '#fffaf0', border, face: <CharacterFace kind={id} color={color} /> }));

export const getAvatar = (id: string): AvatarDef => AVATARS.find(avatar => avatar.id === id) ?? AVATARS[0];

export const Avatar = ({ avatarId, size = 40, className = '', showName = false }: { avatarId: string; size?: number; className?: string; showName?: boolean }) => {
  const avatar = getAvatar(avatarId);
  return <div className={`flex flex-col items-center gap-1 ${className}`}>
    <div style={{ width: size, height: size, fontSize: size * .59, background: avatar.bg, border: '1.5px solid #241d35', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{avatar.face}</div>
    {showName && <span className="text-[11px] font-bold text-ink-2">{avatar.label}</span>}
  </div>;
};

export const AvatarPicker = ({ selected, onChange }: { selected: string; onChange: (id: string) => void }) => (
  <div className="grid grid-cols-4 gap-2" role="group" aria-label="Choose your character">
    {AVATARS.map(avatar => <button type="button" key={avatar.id} onClick={() => onChange(avatar.id)} aria-pressed={selected === avatar.id}
      className="flex flex-col items-center gap-2 p-2 rounded-2xl transition-colors"
      style={{ background: selected === avatar.id ? '#e8dcff' : '#fffaf0', border: `2px solid ${selected === avatar.id ? '#241d35' : 'transparent'}` }}>
      <Avatar avatarId={avatar.id} size={44} /><span className="text-[11px] font-bold text-ink">{avatar.label}</span>
    </button>)}
  </div>
);
