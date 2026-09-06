export type CardCategory = 'teka-teki' | 'vibe-check' | 'taaruf-realiti' | 'dare-santai';

export interface SwipeCardItem {
  id: string;
  category: CardCategory;
  categoryLabel: string;
  badgeColor: string;
  turn: 'Lelaki' | 'Perempuan' | 'Dua-dua Serentak';
  question: string;
  flipContent: {
    title: string;
    description: string;
    type: 'answer' | 'trap' | 'green-red-flag' | 'dare';
    greenFlag?: string;
    redFlag?: string;
  };
}

export interface GuessQuizItem {
  id: string;
  targetRole: 'Lelaki' | 'Perempuan'; // Who is being guessed
  question: string;
  options: string[];
  vibeText: string;
}

export interface WheelSegment {
  id: string;
  label: string;
  icon: string;
  color: string;
  textColor: string;
  category: string;
  prompts: string[];
}


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
    id: `tt-${i}`,
    category: 'teka-teki' as CardCategory,
    categoryLabel: 'Riddles',
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
    id: `vc-${i}`,
    category: 'vibe-check' as CardCategory,
    categoryLabel: 'Vibe Check',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: getTurn(i),
    question: item.soalan,
    flipContent: {
      title: 'Soalan Perangkap:',
      description: item.soalan_perangkap,
      type: 'trap' as const
    }
  })),
  ...Object.entries(taarufData.soalan_matang_prakahwinan).flatMap(([_key, items]: [string, any], categoryIndex) => 
    items.map((item: any, i: number) => ({
      id: `sm-${categoryIndex}-${i}`,
      category: 'taaruf-realiti' as CardCategory,
      categoryLabel: 'Taaruf',
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
  ...taarufData.bonus_challenges.map((item: any, i) => ({
    id: `bc-${i}`,
    category: 'dare-santai' as CardCategory,
    categoryLabel: 'Bonus Challenge',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: getTurn(i),
    question: item.cabaran || item.cabaran_tajuk || item.tajuk || '',
    flipContent: {
      title: 'Cabaran:',
      description: item.denda || item.deskripsi || item.arahan_game || 'Lakukan cabaran ini sekarang!',
      type: 'dare' as const
    }
  }))
];

const cleanOption = (opt: string) => opt.replace(/^[A-D]\.\s*/, '');

export const GUESS_QUIZ_LIST: GuessQuizItem[] = taarufData.teka_hati_dia.map((item, i) => ({
  id: `gq-${i}`,
  targetRole: getTargetRole(i),
  question: item.soalan,
  options: item.pilihan.map(cleanOption),
  vibeText: item.kategori || 'Uji kefahaman hati pasangan!'
}));

export interface MatchQuestion {
  id: string;
  question: string;
  options: string[];
  vibeText: string;
}

export const MATCH_QUESTIONS: MatchQuestion[] = taarufData.compatibility_match_check.map((item, i) => ({
  id: `m-${i}`,
  question: item.soalan,
  options: item.pilihan.map(cleanOption),
  vibeText: item.tip_perbincangan || 'Match Score check!'
}));

export const WHEEL_SEGMENTS: WheelSegment[] = [
  {
    id: 'masa-depan',
    label: '🚀 Masa Depan',
    icon: '🚀',
    color: '#3b82f6', // blue
    textColor: '#ffffff',
    category: 'Masa Depan',
    prompts: [
      'Apa impian terbesar awak yang belum tercapai?',
      'Di mana awak nampak diri awak dalam masa 5 tahun?',
      'Jika duit bukan masalah, apa kerja yang awak nak buat?'
    ]
  },
  {
    id: 'zaman-kanak',
    label: '🧸 Kenangan',
    icon: '🧸',
    color: '#f59e0b', // amber
    textColor: '#ffffff',
    category: 'Zaman Kanak-Kanak',
    prompts: [
      'Apa kenangan paling kelakar masa awak kecil?',
      'Siapa crush pertama awak masa sekolah?',
      'Apa benda paling nakal awak pernah buat masa kecil?'
    ]
  },
  {
    id: 'deep-talk',
    label: '💭 Deep Talk',
    icon: '💭',
    color: '#6366f1', // indigo
    textColor: '#ffffff',
    category: 'Deep Talk',
    prompts: [
      'Apa satu perkara yang paling awak takutkan dalam hidup?',
      'Bila kali terakhir awak menangis dan kenapa?',
      'Apa satu pengajaran terbesar yang kehidupan pernah ajar awak?'
    ]
  },
  {
    id: 'romantik',
    label: '❤️ Romantik',
    icon: '❤️',
    color: '#ec4899', // pink
    textColor: '#ffffff',
    category: 'Romantik',
    prompts: [
      'Apakah love language awak?',
      'Macam mana awak tahu awak dah jatuh cinta?',
      'Apa perkara kecil yang seseorang boleh buat untuk buat awak gembira?'
    ]
  },
  {
    id: 'spontan',
    label: '🤪 Spontan',
    icon: '🤪',
    color: '#10b981', // emerald
    textColor: '#ffffff',
    category: 'Spontan',
    prompts: [
      'Kalau awak ada kuasa super, apa kuasa yang awak nak?',
      'Apa lagu yang awak suka sangat nyanyi dalam bilik mandi?',
      'Kalau terdampar di pulau, apa 3 benda awak nak bawa?'
    ]
  },
  {
    id: 'kewangan',
    label: '💰 Kewangan',
    icon: '💰',
    color: '#f43f5e', // rose
    textColor: '#ffffff',
    category: 'Kewangan',
    prompts: [
      'Macam mana awak uruskan perbelanjaan bulanan?',
      'Awak jenis suka simpan duit atau berbelanja?',
      'Apa benda paling mahal awak pernah beli dan tak menyesal?'
    ]
  }
];
