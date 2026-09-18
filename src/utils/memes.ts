export type ReactionMood = 'match' | 'miss' | 'win' | 'higher' | 'lower';

// Small, visually checked GIPHY collection. Using known media avoids API keys and
// unmoderated search results in the middle of a game.
const REACTIONS: Record<ReactionMood, readonly { id: string; alt: string }[]> = {
  match: [
    { id: '11sBLVxNs7v6WA', alt: 'Minions cheering together' },
    { id: 'artj92V8o75VPL7AeQ', alt: 'A joyful confetti celebration' },
    { id: 'l0amJzVHIAfl7jMDos', alt: 'Michael Scott doing a happy dance' },
  ],
  miss: [
    { id: '3xz2BLBOt13X9AgjEA', alt: 'Batman reacting with a playful facepalm' },
    { id: 'V80llXf734WzK', alt: 'A surprised reaction to an unexpected answer' },
    { id: '4cuyucPeVWbNS', alt: 'Michael Scott reacting to a surprising answer' },
  ],
  win: [
    { id: 'artj92V8o75VPL7AeQ', alt: 'A joyful confetti celebration' },
    { id: '11sBLVxNs7v6WA', alt: 'Minions cheering for the winner' },
    { id: 'l0amJzVHIAfl7jMDos', alt: 'Michael Scott doing a victory dance' },
  ],
  higher: [{ id: 'V80llXf734WzK', alt: 'A surprised reaction: try a higher number' }],
  lower: [{ id: '4cuyucPeVWbNS', alt: 'A playful reaction: try a lower number' }],
};

const CAPTIONS: Record<ReactionMood, readonly string[]> = {
  match: [
    'Same brain cell. Shared custody.',
    'Okay telepathy, calm down.',
    'Suspiciously accurate. We love to see it.',
  ],
  miss: [
    'Plot twist: the relationship lore just expanded.',
    'Different answers, premium entertainment.',
    'Relationship patch notes updated.',
  ],
  win: [
    'Main-character couple energy unlocked.',
    'Tiny game. Ridiculously big victory.',
    'The crowd goes wild. The crowd is also you two.',
  ],
  higher: [
    'The number said: take the elevator.',
    'Aim higher, brave mathematician.',
  ],
  lower: [
    'Bring it down a floor, number genius.',
    'Too spicy. Dial that number down.',
  ],
};

const hashSeed = (seed: string) => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
};

export function getReaction(mood: ReactionMood, seed: string) {
  const pool = REACTIONS[mood];
  return pool[hashSeed(seed) % pool.length];
}

export function getReactionCaption(mood: ReactionMood, seed: string) {
  const pool = CAPTIONS[mood];
  return pool[hashSeed(`${seed}:caption`) % pool.length];
}
