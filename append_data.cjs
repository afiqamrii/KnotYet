const fs = require('fs');

const code = `
import taarufData from './taaruf_game_final.json';

const getTurn = (index: number): 'Lelaki' | 'Perempuan' | 'Dua-dua Serentak' => {
  const turns: ('Lelaki' | 'Perempuan' | 'Dua-dua Serentak')[] = ['Lelaki', 'Perempuan', 'Dua-dua Serentak'];
  return turns[index % 3];
};

const getTargetRole = (index: number): 'Lelaki' | 'Perempuan' => {
  return index % 2 === 0 ? 'Lelaki' : 'Perempuan';
};

export const SWIPE_CARDS: SwipeCardItem[] = [
  ...taarufData.teka_teki_bodoh.map((item, i) => ({
    id: \`tt-\${i}\`,
    category: 'teka-teki' as CardCategory,
    categoryLabel: '🤣 Teka-Teki Lawak',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Dua-dua Serentak' as const,
    question: item.soalan,
    flipContent: {
      title: 'Jawapan:',
      description: item.jawapan,
      type: 'answer' as const
    }
  })),
  ...taarufData.vibe_check.map((item, i) => ({
    id: \`vc-\${i}\`,
    category: 'vibe-check' as CardCategory,
    categoryLabel: '✨ Vibe Check',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: getTurn(i),
    question: item.soalan,
    flipContent: {
      title: 'Soalan Perangkap:',
      description: item.soalan_perangkap,
      type: 'trap' as const
    }
  })),
  ...Object.entries(taarufData.soalan_matang_prakahwinan).flatMap(([key, items], categoryIndex) => 
    items.map((item, i) => ({
      id: \`sm-\${categoryIndex}-\${i}\`,
      category: 'taaruf-realiti' as CardCategory,
      categoryLabel: '💍 Taaruf Realiti',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      turn: getTurn(i),
      question: item.soalan,
      flipContent: {
        title: 'Topik Matang:',
        description: 'Bincangkan topik ini dengan jujur. Tiada jawapan salah atau betul.',
        type: 'answer' as const
      }
    }))
  ),
  ...taarufData.bonus_challenges.map((item, i) => ({
    id: \`bc-\${i}\`,
    category: 'dare-santai' as CardCategory,
    categoryLabel: '🔥 Bonus Challenge',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: getTurn(i),
    question: item.cabaran,
    flipContent: {
      title: 'Cabaran:',
      description: item.denda || 'Lakukan cabaran ini sekarang!',
      type: 'dare' as const
    }
  }))
];

const cleanOption = (opt: string) => opt.replace(/^[A-D]\\.\\s*/, '');

export const GUESS_QUIZ_LIST: GuessQuizItem[] = taarufData.teka_hati_dia.map((item, i) => ({
  id: \`gq-\${i}\`,
  targetRole: getTargetRole(i),
  question: item.soalan,
  options: item.pilihan.map(cleanOption),
  vibeText: item.kategori || 'Uji kefahaman hati pasangan!'
}));

export const MATCH_QUESTIONS: MatchQuestion[] = taarufData.compatibility_match_check.map((item, i) => ({
  id: \`m-\${i}\`,
  question: item.soalan,
  options: item.pilihan.map(cleanOption),
  vibeText: item.tip_perbincangan || 'Match Score check!'
}));

export const WHEEL_SEGMENTS: WheelSegment[] = [
  {
    id: 'teka-teki',
    label: '🤣 Teka-Teki Lawak',
    icon: '🤣',
    color: '#f59e0b',
    textColor: '#ffffff',
    category: 'Teka-teki',
    prompts: ['Pilih kad Teka-Teki dan cuba teka bersama!']
  },
  {
    id: 'vibe-check',
    label: '✨ Vibe Check',
    icon: '✨',
    color: '#6366f1',
    textColor: '#ffffff',
    category: 'Vibe Check',
    prompts: ['Pilih kad Vibe Check untuk lihat reaksi pasangan!']
  },
  {
    id: 'taaruf-realiti',
    label: '💍 Taaruf Realiti',
    icon: '💍',
    color: '#10b981',
    textColor: '#ffffff',
    category: 'Taaruf Realiti',
    prompts: ['Pilih kad Taaruf Realiti untuk topik matang!']
  },
  {
    id: 'bonus-challenge',
    label: '🔥 Bonus Challenge',
    icon: '🔥',
    color: '#f43f5e',
    textColor: '#ffffff',
    category: 'Bonus Challenge',
    prompts: ['Lakukan satu Bonus Challenge berani mati!']
  }
];
`;

fs.appendFileSync('src/data/questions.ts', code);
