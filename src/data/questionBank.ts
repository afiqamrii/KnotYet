import previous from '../../taaruf_game_final.json';
import latestData from '../../taaruf_game_final-v7.json';

const mapText = <T,>(value: T, transform: (text: string) => string): T => {
  if (typeof value === 'string') return transform(value) as T;
  if (Array.isArray(value)) return value.map(item => mapText(item, transform)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapText(item, transform)])) as T;
  }
  return value;
};

const removeSourceNotes = (text: string) => text.replace(/\s*\[cite:\s*[\d,\s]+\]/g, '');
const removeNumbering = (text: string) => text
  .replace(/^(?:Vibe Check Soalan|Teka Hati Soalan|Soalan Matang[^#:]*|Soalan Random & Deep|Isu Uncomfortable Topics|Match Check Scenario|Aturan Tidak Bertulis Rumahtangga Malaysia)\s*#?\d+\s*:\s*/i, '')
  .replace(/\s*\((?:Siri|Seri)\s*#?\d+\)\s*$/i, '');

const latest = mapText(latestData, removeSourceNotes);

// Keep old positions because saved progress and multiplayer use index-based IDs.
const merge = <T extends object>(oldItems: T[], newItems: T[], text: (item: T) => string): T[] => {
  const key = (item: T) => text(item).trim().toLocaleLowerCase();
  const updates = new Map(newItems.map(item => [key(item), item]));
  const oldKeys = new Set(oldItems.map(key));
  const addedKeys = new Set<string>();
  return [
    ...oldItems.map(item => updates.get(key(item)) ?? item),
    ...newItems.filter(item => {
      const value = key(item);
      if (oldKeys.has(value) || addedKeys.has(value)) return false;
      addedKeys.add(value);
      return true;
    }),
  ];
};

export type BonusChallenge = {
  cabaran?: string;
  cabaran_tajuk?: string;
  tajuk?: string;
  denda?: string;
  deskripsi?: string;
  arahan_game?: string;
  cara_bermain?: string;
  peraturan?: string;
};

export const bonusTitle = (item: BonusChallenge) => item.cabaran || item.cabaran_tajuk || item.tajuk || '';
export const bonusDescription = (item: BonusChallenge) => {
  const instruction = item.denda || item.deskripsi || item.arahan_game || item.cara_bermain || 'Lakukan cabaran ini sekarang!';
  return [instruction, item.peraturan].filter(Boolean).join(' ')
    .replace(/Aplikasi akan memberikan senarai rawak 5 barangan dapur yang perlu dicari dalam masa 5 minit\./i, 'Pilih bersama 5 barangan dapur untuk dicari dalam masa 5 minit.')
    .replace(/Di akhir minit, aplikasi akan memberikan plot twist mencabar!/i, 'Di akhir minit, beri pasangan satu plot twist untuk dijawab!')
    .replace(/Aplikasi akan memaparkan situasi:/i, 'Situasi:')
    .replace(/sambil aplikasi memasang audio simulasi kesesakan lalu lintas yang dipenuhi dengan bunyi hon and orang menjerit kasar/i, 'dan bayangkan terperangkap dalam kesesakan lalu lintas')
    .replace(/Selepas lakonan selesai, buka kad 'Plot Twist':/i, 'Selepas lakonan, tambah plot twist:')
    .replace(/Setiap orang diberikan bajet RM30 and senarai 3 barang masakan rahsia\./i, 'Tetapkan bajet RM30 seorang dan pilih 3 bahan masakan secara rahsia.')
    .replace(/Aplikasi membacakan 5 soalan pantas;/i, 'Bergilir tanya 5 soalan pantas tentang diri masing-masing;')
    .replace(/Semasa memandu, setiap pemain perlu/i, 'Semasa duduk bersama, setiap pemain perlu');
};

export const questionBank = mapText({
  teka_teki_bodoh: merge(previous.teka_teki_bodoh, latest.teka_teki_bodoh, item => item.soalan),
  vibe_check: merge(previous.vibe_check, latest.vibe_check, item => item.soalan),
  soalan_matang_prakahwinan: {
    pengurusan_duit_dan_hutang: merge(previous.soalan_matang_prakahwinan.pengurusan_duit_dan_hutang, latest.soalan_matang_prakahwinan.pengurusan_duit_dan_hutang, item => item.soalan),
    batasan_keluarga_dan_mertua: merge(previous.soalan_matang_prakahwinan.batasan_keluarga_dan_mertua, latest.soalan_matang_prakahwinan.batasan_keluarga_dan_mertua, item => item.soalan),
    pembahagian_tugas_dan_kerjaya: merge(previous.soalan_matang_prakahwinan.pembahagian_tugas_dan_kerjaya, latest.soalan_matang_prakahwinan.pembahagian_tugas_dan_kerjaya, item => item.soalan),
    perancangan_zuriat_dan_emosi: merge(previous.soalan_matang_prakahwinan.perancangan_zuriat_dan_emosi, latest.soalan_matang_prakahwinan.perancangan_zuriat_dan_emosi, item => item.soalan),
  },
  teka_hati_dia: merge(previous.teka_hati_dia, latest.teka_hati_dia, item => item.soalan),
  compatibility_match_check: merge(previous.compatibility_match_check, latest.compatibility_match_check, item => item.soalan),
  bonus_challenges: merge<BonusChallenge>(previous.bonus_challenges, latest.bonus_challenges, bonusTitle),
  uncomfortable_topics: latest.uncomfortable_topics,
  random_deep_questions: latest.random_deep_questions,
  soalan_realiti_pasangan: latest.soalan_realiti_pasangan,
  unspoken_rules_malaysia: latest.unspoken_rules_malaysia,
}, removeNumbering);
