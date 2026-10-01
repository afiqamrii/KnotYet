export type CardCategory = 'teka-teki' | 'vibe-check' | 'taaruf-realiti' | 'dare-santai';

export { WOULD_YOU_RATHER, type WouldYouRatherQuestion } from './englishChoices';

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


import { englishQuestionBank as taarufData } from './englishQuestions';

const getBonusQuestion = (item: { cabaran: string }) => item.cabaran;
const getBonusDescription = (item: { deskripsi: string }) => item.deskripsi;

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
const excludedBonusIds = new Set<string>();

export const SWIPE_CARDS: SwipeCardItem[] = uniqueByText([
  ...taarufData.teka_teki_bodoh.map((item, i) => ({
    id: `tt-en2-${i}`,
    category: 'teka-teki' as CardCategory,
    categoryLabel: 'Riddles',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Dua-dua Serentak' as const,
    question: item.soalan,
    flipContent: {
      title: 'The answer',
      description: item.jawapan,
      type: 'answer' as const
    }
  })),
  ...taarufData.vibe_check.map((item, i) => ({
    id: `vc-en2-${i}`,
    category: 'vibe-check' as CardCategory,
    categoryLabel: 'Vibe Check',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: getTurn(i),
    question: item.soalan,
    flipContent: {
      title: 'Go a little further',
      description: item.soalan_perangkap,
      type: 'trap' as const
    }
  })),
  ...Object.entries(taarufData.soalan_matang_prakahwinan).flatMap(([_key, items], categoryIndex) =>
    items.map((item, i) => ({
      id: `sm-en2-${categoryIndex}-${i}`,
      category: 'taaruf-realiti' as CardCategory,
      categoryLabel: 'Real Talk',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      turn: getTurn(i),
      question: item.soalan,
      flipContent: {
        title: 'Make room for an honest answer',
        description: 'Take your time. Different answers are a reason to be curious, not a verdict on your relationship.',
        greenFlag: item.green_flag,
        redFlag: item.red_flag,
        type: 'answer' as const
      }
    }))
  ),
  ...taarufData.uncomfortable_topics.map((item, i) => ({
    id: `ut-en2-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'A Little Deeper',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i), question: item.soalan,
    flipContent: { title: 'Take it at your own pace', description: item.sebab_penting, greenFlag: item.green_flag, redFlag: item.red_flag, type: 'answer' as const }
  })),
  ...taarufData.random_deep_questions.map((item, i) => ({
    id: `rd-en2-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Deep Talk',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i), question: item.soalan,
    flipContent: { title: 'Stay with that thought', description: item.tujuan, type: 'answer' as const }
  })),
  ...taarufData.soalan_realiti_pasangan.map((item, i) => ({
    id: `rp-en2-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Everyday Us',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i), question: item.soalan,
    flipContent: { title: 'A little more to explore', description: item.tujuan, type: 'answer' as const }
  })),
  ...taarufData.unspoken_rules_malaysia.map((item, i) => ({
    id: `ur-en2-${i}`, category: 'taaruf-realiti' as CardCategory, categoryLabel: 'Unwritten Rules',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', turn: getTurn(i),
    question: `What do you think about this expectation: ${item.aturan}?`,
    flipContent: { title: 'Compare your perspectives', description: item.huraian, type: 'answer' as const }
  })),
  ...taarufData.bonus_challenges.map((item, i) => ({
    id: `bc-en2-${i}`,
    category: 'dare-santai' as CardCategory,
    categoryLabel: 'Bonus Challenge',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Dua-dua Serentak' as const,
    question: getBonusQuestion(item),
    flipContent: {
      title: 'Give it a go',
      description: getBonusDescription(item),
      type: 'dare' as const
    }
  })).filter(card =>
    !excludedBonusIds.has(card.id) &&
    !/^(?:Cabaran Komunikasi Pasangan|Cabaran Pasangan Interaktif)$/i.test(card.question)
  )
], card => card.question);

const cleanOption = (opt: string) => opt.replace(/^[A-D]\.\s*/, '');

export const GUESS_QUIZ_LIST: GuessQuizItem[] = uniqueByText(taarufData.teka_hati_dia.map((item, i) => ({
  id: `gq-en2-${i}`,
  targetRole: getTargetRole(i),
  question: item.soalan,
  options: item.pilihan.map(cleanOption),
  vibeText: item.kategori || 'How well do you know their everyday preferences?'
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
    id: `m-en2-${i}`,
    question: item.soalan,
    options: item.pilihan.map(cleanOption),
    vibeText: item.tip_perbincangan || 'What is the story behind your choice?',
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
  return uniqueByText(questions.map((item, index) => ({ id: `sm-en2-${categoryIndex}-${index}`, text: item.soalan })), item => item.text);
};

const BASE_WHEEL_SEGMENTS: Omit<WheelSegment, 'promptIds'>[] = [
  {
    id: 'masa-depan',
    label: 'The Future',
    icon: '',
    color: '#cbeafa', // blue
    textColor: '#241d35',
    category: 'The Future',
    prompts: [
      'What is a big dream you have not had the chance to pursue yet?',
      'Where do you see yourself in five years?',
      'If money were no obstacle, what work would you choose?'
    ]
  },
  {
    id: 'zaman-kanak',
    label: 'Memories',
    icon: '',
    color: '#ffe5a0', // amber
    textColor: '#241d35',
    category: 'Growing Up',
    prompts: [
      'What is your funniest childhood memory?',
      'Who was your first school crush? Share only what you feel like sharing.',
      'What bit of childhood mischief still makes you laugh?'
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
      'What is a fear you feel comfortable talking about today?',
      'When did something last move you to tears? You can keep the details private.',
      'What is one of the most useful lessons life has taught you?'
    ]
  },
  {
    id: 'romantik',
    label: 'Connection',
    icon: '',
    color: '#ffb4c6', // pink
    textColor: '#241d35',
    category: 'Connection',
    prompts: [
      'What kind of affection makes you feel most cared for?',
      'How can you tell when you are falling for someone?',
      'What small thing can someone do to brighten your day?'
    ]
  },
  {
    id: 'spontan',
    label: 'Wildcard',
    icon: '',
    color: '#d5f578', // emerald
    textColor: '#241d35',
    category: 'Wildcard',
    prompts: [
      'If you could choose a superpower, what would you pick?',
      'Which song is your reliable shower performance?',
      'If you were stranded on an island, which three things would you want?'
    ]
  },
  {
    id: 'kewangan',
    label: 'Money',
    icon: '',
    color: '#ffd4a4', // rose
    textColor: '#241d35',
    category: 'Money',
    prompts: [
      'How do you usually manage your monthly spending?',
      'Do you enjoy saving money or spending it more?',
      'What expensive purchase have you never regretted?'
    ]
  }
];

const vibeWheelPrompts = uniqueByText(taarufData.vibe_check.map((item, index) => ({ id: `vc-en2-${index}`, text: item.soalan })), item => item.text);
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
      promptIds: [...segment.prompts.map((_, index) => `wheel:en2:${segment.id}:${index}`), ...extra.map(prompt => prompt.id)],
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
