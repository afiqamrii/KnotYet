import React from 'react';

// ============================================================
// AVATAR DEFINITIONS
// 8 cute characters — each with unique color + emoji face
// ============================================================

export interface AvatarDef {
  id: string;
  name: string;
  bg: string;         // background gradient
  border: string;     // border color
  face: string;       // emoji face
  label: string;      // display name
}

export const AVATARS: AvatarDef[] = [
  {
    id: 'sunny',
    name: 'Sunny',
    bg: 'linear-gradient(135deg, #FDE68A, #F59E0B)',
    border: '#F59E0B',
    face: '☀️',
    label: 'Sunny',
  },
  {
    id: 'mochi',
    name: 'Mochi',
    bg: 'linear-gradient(135deg, #FBC8D4, #FF2D9B)',
    border: '#FF2D9B',
    face: '🌸',
    label: 'Mochi',
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    bg: 'linear-gradient(135deg, #BAE6FD, #0EA5E9)',
    border: '#0EA5E9',
    face: '🫧',
    label: 'Bubbles',
  },
  {
    id: 'coco',
    name: 'Coco',
    bg: 'linear-gradient(135deg, #D1FAE5, #10B981)',
    border: '#10B981',
    face: '🌿',
    label: 'Coco',
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    bg: 'linear-gradient(135deg, #DDD6FE, #7C3AED)',
    border: '#7C3AED',
    face: '⚡',
    label: 'Zigzag',
  },
  {
    id: 'starry',
    name: 'Starry',
    bg: 'linear-gradient(135deg, #FED7AA, #F97316)',
    border: '#F97316',
    face: '⭐',
    label: 'Starry',
  },
  {
    id: 'maple',
    name: 'Maple',
    bg: 'linear-gradient(135deg, #FCE7F3, #EC4899)',
    border: '#EC4899',
    face: '🍓',
    label: 'Maple',
  },
  {
    id: 'comet',
    name: 'Comet',
    bg: 'linear-gradient(135deg, #CFFAFE, #06B6D4)',
    border: '#06B6D4',
    face: '🌊',
    label: 'Comet',
  },
];

export const getAvatar = (id: string): AvatarDef =>
  AVATARS.find(a => a.id === id) ?? AVATARS[0];

// ============================================================
// AVATAR DISPLAY COMPONENT
// ============================================================

interface AvatarProps {
  avatarId: string;
  size?: number;     // px
  className?: string;
  showName?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ avatarId, size = 40, className = '', showName = false }) => {
  const avatar = getAvatar(avatarId);
  const fontSize = Math.round(size * 0.42);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div
        className="flex items-center justify-center rounded-full border-[3px] shadow-md flex-shrink-0"
        style={{
          width: size,
          height: size,
          background: avatar.bg,
          borderColor: 'white',
          fontSize,
          lineHeight: 1,
          boxShadow: `0 4px 12px ${avatar.border}40`,
        }}
      >
        {avatar.face}
      </div>
      {showName && (
        <span className="text-[10px] font-bold text-white/80 leading-none">{avatar.label}</span>
      )}
    </div>
  );
};

// ============================================================
// AVATAR PICKER GRID
// ============================================================

interface AvatarPickerProps {
  selected: string;
  onChange: (id: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ selected, onChange }) => {
  return (
    <div className="grid grid-cols-4 gap-3">
      {AVATARS.map((avatar) => {
        const isSelected = avatar.id === selected;
        return (
          <button
            key={avatar.id}
            onClick={() => onChange(avatar.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all active:scale-90"
            style={{
              background: isSelected ? `${avatar.border}18` : 'rgba(255,255,255,0.6)',
              border: isSelected ? `3px solid ${avatar.border}` : '3px solid transparent',
              boxShadow: isSelected ? `0 4px 16px ${avatar.border}35` : '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md"
              style={{
                background: avatar.bg,
                border: '3px solid white',
              }}
            >
              {avatar.face}
            </div>
            <span
              className="text-[11px] font-black leading-none"
              style={{ color: isSelected ? avatar.border : '#57534E' }}
            >
              {avatar.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
