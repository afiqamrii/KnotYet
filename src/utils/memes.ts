export const STATIC_MEMES = {
  money: [
    'https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.gif',
    'https://media.giphy.com/media/3o6gDWzmAzrpi5DQU8/giphy.gif',
    'https://media.giphy.com/media/l0Ex6kAKAoFRsFh6M/giphy.gif',
    'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.gif',
    'https://media.giphy.com/media/3o751XDbTvZw958ZYk/giphy.gif',
    'https://media.giphy.com/media/ND6xkVPaj8tHO/giphy.gif'
  ],
  love: [
    'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif',
    'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
    'https://media.giphy.com/media/Y4P943aTJRCYfperyN/giphy.gif',
    'https://media.giphy.com/media/3o7TKoWXm3okO1kgHC/giphy.gif',
    'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif'
  ],
  fight: [
    'https://media.giphy.com/media/l0Iy8hSJalxmgTOF2/giphy.gif',
    'https://media.giphy.com/media/3o7TKr3nzbh5WgCFxe/giphy.gif',
    'https://media.giphy.com/media/11tTNkNy1SdXGg/giphy.gif'
  ],
  food: [
    'https://media.giphy.com/media/3o7TKWpu2WClyXy3q8/giphy.gif',
    'https://media.giphy.com/media/3o85xwxr06YNoFdSbm/giphy.gif',
    'https://media.giphy.com/media/v0eHX3n28wvoQ/giphy.gif'
  ],
  defaultMatch: [
    'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif', 
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    'https://media.giphy.com/media/l0amJzVHIAfl7jMDos/giphy.gif',
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    'https://media.giphy.com/media/jJQC2puVZpTMO4vUs0/giphy.gif',
    'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif'
  ],
  defaultMismatch: [
    'https://media.giphy.com/media/3xz2BLBOt13X9AgjEA/giphy.gif', 
    'https://media.giphy.com/media/V80llXf734WzK/giphy.gif',
    'https://media.giphy.com/media/xT0GqgeTVaAdWZD1uw/giphy.gif',
    'https://media.giphy.com/media/l41YkxvU8c7J7Bba0/giphy.gif',
    'https://media.giphy.com/media/qQdL532ZANbjy/giphy.gif',
    'https://media.giphy.com/media/tLRifcvQNJIic/giphy.gif',
    'https://media.giphy.com/media/HteV6g0QTNxp6/giphy.gif'
  ],
  win: [
    'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', // Drake clapping
    'https://media.giphy.com/media/l0amJzVHIAfl7jMDos/giphy.gif', // Confetti celebration
    'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif', // Yes!
    'https://media.giphy.com/media/nxxZv20hxZwru/giphy.gif', // Minions cheering
    'https://media.giphy.com/media/d20PG6M6SAFqtmce9r/giphy.gif', // Let's go
    'https://media.giphy.com/media/YRuFixSNWFVcXhqQJ/giphy.gif', // Leonardo DiCaprio toast
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' // SpongeBob celebration
  ],
  higher: [
    'https://media.giphy.com/media/l41lFptE0LsKVZ61O/giphy.gif', // Going up
    'https://media.giphy.com/media/Zdg7kl9bnyqXrPH2jq/giphy.gif', // Higher!
    'https://media.giphy.com/media/3oKIPa2TdahY8LAAxy/giphy.gif', // Mind blown upwards
    'https://media.giphy.com/media/26FPCXdkvDbKBbgOI/giphy.gif' // Pointing up
  ],
  lower: [
    'https://media.giphy.com/media/l2Je0oOcT4cioSIfu/giphy.gif', // Going down
    'https://media.giphy.com/media/3o6UBil4zn1Tt03PI4/giphy.gif', // Pointing down
    'https://media.giphy.com/media/4cuyucPeVWbNS/giphy.gif', // Look down
    'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif' // Thumbs down
  ]
};

export async function getContextualMeme(questionText: string, isMatch: boolean): Promise<string> {
  const q = questionText.toLowerCase();
  let pool: string[] = [];

  if (q.includes('duit') || q.includes('belanja') || q.includes('kaya') || q.includes('bayar') || q.includes('miskin') || q.includes('kerja')) {
    pool = STATIC_MEMES.money;
  } else if (q.includes('cinta') || q.includes('sayang') || q.includes('rindu') || q.includes('hati') || q.includes('romantik')) {
    pool = STATIC_MEMES.love;
  } else if (q.includes('gaduh') || q.includes('marah') || q.includes('merajuk') || q.includes('benci') || q.includes('cemburu') || q.includes('pujuk')) {
    pool = STATIC_MEMES.fight;
  } else if (q.includes('makan') || q.includes('lapar') || q.includes('gemuk') || q.includes('masak') || q.includes('diet') || q.includes('restoran')) {
    pool = STATIC_MEMES.food;
  }

  if (pool.length === 0) {
    pool = isMatch ? STATIC_MEMES.defaultMatch : STATIC_MEMES.defaultMismatch;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export async function getWinMeme(): Promise<string> {
  const pool = STATIC_MEMES.win;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function getHintMeme(hint: 'higher' | 'lower'): Promise<string> {
  const pool = STATIC_MEMES[hint];
  return pool[Math.floor(Math.random() * pool.length)];
}
