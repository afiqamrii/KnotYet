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
  promptIds: string[];
}


import { questionBank as taarufData, bonusTitle as getBonusQuestion, bonusDescription as getBonusDescription } from './questionBank';

const getTurn = (index: number): 'Lelaki' | 'Perempuan' | 'Dua-dua Serentak' => {
  const turns: ('Lelaki' | 'Perempuan' | 'Dua-dua Serentak')[] = ['Lelaki', 'Perempuan', 'Dua-dua Serentak'];
  return turns[index % 3];
};

const getTargetRole = (index: number): 'Lelaki' | 'Perempuan' => {
  return index % 2 === 0 ? 'Lelaki' : 'Perempuan';
};

const uniqueByText = <T,>(items: T[], text: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = text(item).trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Repeated roleplays and challenges that require private access, a purchase, or
// disruptive/unsafe real-world actions do not make useful playable cards.
const excludedBonusIds = new Set([
  'bc-3', 'bc-4', 'bc-6', 'bc-8', 'bc-9', 'bc-10', 'bc-12',
  'bc-24', 'bc-27', 'bc-30', 'bc-31', 'bc-32',
]);

export const SWIPE_CARDS: SwipeCardItem[] = uniqueByText([
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
  ...Object.entries(taarufData.soalan_matang_prakahwinan).flatMap(([_key, items], categoryIndex) =>
    items.map((item, i) => ({
      id: `sm-${categoryIndex}-${i}`,
      category: 'taaruf-realiti' as CardCategory,
      categoryLabel: 'Taaruf',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      turn: getTurn(i),
      question: item.soalan,
      flipContent: {
        title: 'Topik Matang:',
        description: 'Bincangkan topik ini dengan jujur. Tiada jawapan salah atau betul.',
        greenFlag: item.green_flag,
        redFlag: item.red_flag,
        type: 'answer' as const
      }
    }))
  ),
  ...taarufData.uncomfortable_topics.map((item, i) => ({
    id: `ut-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Topik Sensitif',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i), question: item.soalan,
    flipContent: { title: 'Kenapa bincang ini?', description: item.sebab_penting, greenFlag: item.green_flag, redFlag: item.red_flag, type: 'answer' as const }
  })),
  ...taarufData.random_deep_questions.map((item, i) => ({
    id: `rd-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Deep Talk',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i), question: item.soalan,
    flipContent: { title: 'Untuk dibincangkan:', description: item.tujuan, type: 'answer' as const }
  })),
  ...taarufData.soalan_realiti_pasangan.map((item, i) => ({
    id: `rp-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Realiti Pasangan',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i), question: item.soalan,
    flipContent: { title: 'Untuk dibincangkan:', description: item.tujuan, type: 'answer' as const }
  })),
  ...taarufData.unspoken_rules_malaysia.map((item, i) => ({
    id: `ur-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Aturan Tak Tertulis',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i),
    question: `Apa pendapat awak tentang: ${item.aturan}?`,
    flipContent: { title: 'Bahan perbincangan:', description: item.huraian, type: 'answer' as const }
  })),
  ...taarufData.bonus_challenges.map((item, i) => ({
    id: `bc-${i}`,
    category: 'dare-santai' as CardCategory,
    categoryLabel: 'Bonus Challenge',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Dua-dua Serentak' as const,
    question: getBonusQuestion(item),
    flipContent: {
      title: 'Cara main:',
      description: getBonusDescription(item),
      type: 'dare' as const
    }
  })).filter(card =>
    !excludedBonusIds.has(card.id) &&
    !/^(?:Cabaran Komunikasi Pasangan Seri [0-9]+|Cabaran Pasangan Interaktif #[0-9]+)$/i.test(card.question)
  )
], card => card.question);

const cleanOption = (opt: string) => opt.replace(/^[A-D]\.\s*/, '');

export const GUESS_QUIZ_LIST: GuessQuizItem[] = uniqueByText(taarufData.teka_hati_dia.map((item, i) => ({
  id: `gq-${i}`,
  targetRole: getTargetRole(i),
  question: item.soalan,
  options: item.pilihan.map(cleanOption),
  vibeText: item.kategori || 'Uji kefahaman hati pasangan!'
})), item => item.question);

export interface MatchQuestion {
  id: string;
  question: string;
  options: string[];
  vibeText: string;
  kind: 'compatibility' | 'spotlight';
  targetPlayer?: 'host' | 'partner';
}

// Keep the gq-* IDs when these prompts appear in Couple Match. Shared IDs mean
// playing a question here also removes it from future Guess My Heart decks.
export const MATCH_QUESTIONS: MatchQuestion[] = uniqueByText([
  ...taarufData.compatibility_match_check.map((item, i) => ({
    id: `m-${i}`,
    question: item.soalan,
    options: item.pilihan.map(cleanOption),
    vibeText: item.tip_perbincangan || 'Match Score check!',
    kind: 'compatibility' as const
  })),
  ...GUESS_QUIZ_LIST.map((item, i) => ({
    id: item.id,
    question: item.question,
    options: item.options,
    vibeText: item.vibeText,
    kind: 'spotlight' as const,
    targetPlayer: (i % 2 === 0 ? 'host' : 'partner') as 'host' | 'partner'
  }))
], item => item.question);

const matureQuestionGroups = Object.entries(taarufData.soalan_matang_prakahwinan);

const matureWheelPrompts = (categoryIndex: number) => {
  const [, questions] = matureQuestionGroups[categoryIndex];
  return uniqueByText(questions.map((item, index) => ({ id: `sm-${categoryIndex}-${index}`, text: item.soalan })), item => item.text);
};

const BASE_WHEEL_SEGMENTS: Omit<WheelSegment, 'promptIds'>[] = [
  {
    id: 'masa-depan',
    label: 'Masa Depan',
    icon: '',
    color: '#cbeafa', // blue
    textColor: '#241d35',
    category: 'Masa Depan',
    prompts: [
      'Apa impian terbesar awak yang belum tercapai?',
      'Di mana awak nampak diri awak dalam masa 5 tahun?',
      'Jika duit bukan masalah, apa kerja yang awak nak buat?'
    ]
  },
  {
    id: 'zaman-kanak',
    label: 'Kenangan',
    icon: '',
    color: '#ffe5a0', // amber
    textColor: '#241d35',
    category: 'Zaman Kanak-Kanak',
    prompts: [
      'Apa kenangan paling kelakar masa awak kecil?',
      'Siapa crush pertama awak masa sekolah?',
      'Apa benda paling nakal awak pernah buat masa kecil?'
    ]
  },
  {
    id: 'deep-talk',
    label: 'Deep Talk',
    icon: '',
    color: '#c7b4ff', // indigo
    textColor: '#241d35',
    category: 'Deep Talk',
    prompts: [
      'Apa satu perkara yang paling awak takutkan dalam hidup?',
      'Bila kali terakhir awak menangis dan kenapa?',
      'Apa satu pengajaran terbesar yang kehidupan pernah ajar awak?'
    ]
  },
  {
    id: 'romantik',
    label: 'Romantik',
    icon: '',
    color: '#ffb4c6', // pink
    textColor: '#241d35',
    category: 'Romantik',
    prompts: [
      'Apakah love language awak?',
      'Macam mana awak tahu awak dah jatuh cinta?',
      'Apa perkara kecil yang seseorang boleh buat untuk buat awak gembira?'
    ]
  },
  {
    id: 'spontan',
    label: 'Spontan',
    icon: '',
    color: '#d5f578', // emerald
    textColor: '#241d35',
    category: 'Spontan',
    prompts: [
      'Kalau awak ada kuasa super, apa kuasa yang awak nak?',
      'Apa lagu yang awak suka sangat nyanyi dalam bilik mandi?',
      'Kalau terdampar di pulau, apa 3 benda awak nak bawa?'
    ]
  },
  {
    id: 'kewangan',
    label: 'Kewangan',
    icon: '',
    color: '#ffd4a4', // rose
    textColor: '#241d35',
    category: 'Kewangan',
    prompts: [
      'Macam mana awak uruskan perbelanjaan bulanan?',
      'Awak jenis suka simpan duit atau berbelanja?',
      'Apa benda paling mahal awak pernah beli dan tak menyesal?'
    ]
  }
];

const vibeWheelPrompts = uniqueByText(taarufData.vibe_check.map((item, index) => ({ id: `vc-${index}`, text: item.soalan })), item => item.text);
const extraWheelPrompts: Record<string, { id: string; text: string }[]> = {
  'masa-depan': [...matureWheelPrompts(2), ...matureWheelPrompts(3)],
  'deep-talk': matureWheelPrompts(1),
  kewangan: matureWheelPrompts(0),
};

export const WHEEL_SEGMENTS: WheelSegment[] = [
  ...BASE_WHEEL_SEGMENTS.map(segment => {
    const extra = extraWheelPrompts[segment.id] || [];
    return {
      ...segment,
      prompts: [...segment.prompts, ...extra.map(prompt => prompt.text)],
      promptIds: [...segment.prompts.map((_, index) => `wheel:${segment.id}:${index}`), ...extra.map(prompt => prompt.id)],
    };
  }),
  {
    id: 'vibe-check',
    label: 'Vibe Check',
    icon: '',
    color: '#b8f1df',
    textColor: '#241d35',
    category: 'Vibe Check',
    prompts: vibeWheelPrompts.map(prompt => prompt.text),
    promptIds: vibeWheelPrompts.map(prompt => prompt.id),
  },
];
