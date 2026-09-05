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

export const SWIPE_CARDS: SwipeCardItem[] = [
  // 🤣 LEVEL 1: TEKI-TEKI BODOH & LAWAK KAMPUS
  {
    id: 'tt-1',
    category: 'teka-teki',
    categoryLabel: '🤣 Teki-Teki Bodoh',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Dua-dua Serentak',
    question: 'Pintu apa yang walaupun ada 10 orang sado tolak, tetap tak boleh buka langsung?',
    flipContent: {
      title: 'Jawapan:',
      description: 'Pintu yang ada tulisan "TARIK"! Sebab kena tarik, bukan tolak lah wei! 😂',
      type: 'answer'
    }
  },
  {
    id: 'tt-2',
    category: 'teka-teki',
    categoryLabel: '🤣 Teki-Teki Bodoh',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Perempuan',
    question: 'Banyak-banyak mi, mi apa yang kalau makan langsung tak boleh kenyang tapi buat happy?',
    flipContent: {
      title: 'Jawapan:',
      description: 'Mi-liki awak selamanya lah! (Ecewah, pickupline zaman batu tapi menjadi kan? 😉)',
      type: 'answer'
    }
  },
  {
    id: 'tt-3',
    category: 'teka-teki',
    categoryLabel: '🤣 Teki-Teki Bodoh',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Lelaki',
    question: 'Dalam banyak-banyak ikan, ikan apa yang pemalu gila sampai tak nak keluar?',
    flipContent: {
      title: 'Jawapan:',
      description: 'Ikan Celup Tepung... sebab dia tutup aurat penuh pakai tepung! 🐟',
      type: 'answer'
    }
  },
  {
    id: 'tt-4',
    category: 'teka-teki',
    categoryLabel: '🤣 Teki-Teki Bodoh',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Dua-dua Serentak',
    question: 'Kucing apa yang paling kaya dalam dunia sampai boleh beli shopping mall?',
    flipContent: {
      title: 'Jawapan:',
      description: 'Kucing billionaire? Salah! Kucing "Kucing-in" duit dalam bank! 🐱💰',
      type: 'answer'
    }
  },
  {
    id: 'tt-5',
    category: 'teka-teki',
    categoryLabel: '🤣 Teki-Teki Bodoh',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    turn: 'Perempuan',
    question: 'Kenapa superman kalau terbang selalu pakai baju ketat melekat?',
    flipContent: {
      title: 'Jawapan:',
      description: 'Sebab kalau pakai baju saiz XL nanti terbang melayang-layang macam kelambu! 🦸‍♂️',
      type: 'answer'
    }
  },

  // ⚡ LEVEL 2: GEN-Z VIBE CHECK (TO KNOW HIM / TO KNOW HER)
  {
    id: 'vc-1',
    category: 'vibe-check',
    categoryLabel: '⚡ Vibe Check Gen-Z',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: 'Lelaki',
    question: 'Kalau kita keluar lepak berdua, apa satu tabiat orang lain di cafe/kedai makan yang buat awak cepat irritated (pet peeve)?',
    flipContent: {
      title: 'Soalan Perangkap:',
      description: 'Kalau awak sendiri yang buat tabiat tu masa tak sengaja, macam mana nak tegur tanpa awak merajuk?',
      type: 'trap'
    }
  },
  {
    id: 'vc-2',
    category: 'vibe-check',
    categoryLabel: '⚡ Vibe Check Gen-Z',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: 'Perempuan',
    question: 'Bila awak tengah terlampau stres atau moody, awak jenis suka orang pujuk terus atau awak perlukan "me-time" dulu?',
    flipContent: {
      title: 'Panduan Pasangan:',
      description: 'Ketahui bahasa emosi pasangan awal-awal supaya bila bergaduh, tak ada yang rasa diabaikan atau ditekan.',
      type: 'trap'
    }
  },
  {
    id: 'vc-3',
    category: 'vibe-check',
    categoryLabel: '⚡ Vibe Check Gen-Z',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: 'Dua-dua Serentak',
    question: 'Berapa lama awak boleh bertahan tanpa pegang telefon bila kita tengah bersembang face-to-face?',
    flipContent: {
      title: 'Cabaran Spontan:',
      description: 'Letak telefon telangkup atas meja sekarang! Siapa yang tersentuh telefon dulu kena belanja aiskrim/kopi!',
      type: 'dare'
    }
  },
  {
    id: 'vc-4',
    category: 'vibe-check',
    categoryLabel: '⚡ Vibe Check Gen-Z',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: 'Lelaki',
    question: 'Apa definisi "Rehat / Weekend Healing" yang ideal untuk awak? Tidur seharian di bilik, lepak luar, atau main game?',
    flipContent: {
      title: 'Soalan Susulan:',
      description: 'Kalau pasangan jenis aktif nak keluar setiap weekend tapi awak nak duduk rumah, macam mana nak kompromi?',
      type: 'trap'
    }
  },
  {
    id: 'vc-5',
    category: 'vibe-check',
    categoryLabel: '⚡ Vibe Check Gen-Z',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    turn: 'Perempuan',
    question: 'Bila ada masalah kecil antara kita, awak jenis suka luah direct masa tu juga atau pendam sampai meletup nanti?',
    flipContent: {
      title: 'Vibe Check:',
      description: 'Komunikasi pasif-agresif ("Takde pape!") adalah punca nombor 1 burnout dalam hubungan.',
      type: 'trap'
    }
  },

  // 🌶️ LEVEL 3: REALITI TAARUF (DUIT, MERTUA, RUMAH, EMOSI)
  {
    id: 'tr-1',
    category: 'taaruf-realiti',
    categoryLabel: '🌶️ Realiti Taaruf',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Dua-dua Serentak',
    question: 'Lepas nikah nanti, rancang nak duduk mana? Rumah sewa sendiri, beli rumah, atau duduk sekali dengan mertua/keluarga?',
    flipContent: {
      title: 'Analisis Matang:',
      description: 'Duduk berasingan dari awal (walaupun bilik sewa kecil) selalunya mengurangkan 90% drama campur tangan mertua.',
      type: 'green-red-flag',
      greenFlag: 'Ada pelan realistik bajet sewa sendiri demi privasi isteri.',
      redFlag: 'Wajibkan duduk dengan mak ayah tanpa tempoh had & tolak bincang privasi.'
    }
  },
  {
    id: 'tr-2',
    category: 'taaruf-realiti',
    categoryLabel: '🌶️ Realiti Taaruf',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Lelaki',
    question: 'Macam mana perancangan kewangan rumahtangga kita? Adakah suami tanggung 100% keperluan asas, atau harapkan bahagi 50/50?',
    flipContent: {
      title: 'Isu Nafkah & Realiti:',
      description: 'Hukum syarak meletakkan nafkah asas atas suami. Bantuan isteri yang bekerja adalah ehsan, bukan kewajipan paksa.',
      type: 'green-red-flag',
      greenFlag: 'Suami sedar tanggungjawab nafkah asas dan telus tentang kemampuan.',
      redFlag: 'Anggap duit isteri adalah hak milik suami atau tuntut gaji isteri diserah bulat-bulat.'
    }
  },
  {
    id: 'tr-3',
    category: 'taaruf-realiti',
    categoryLabel: '🌶️ Realiti Taaruf',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Perempuan',
    question: 'Berapa komitmen bulanan (hutang pinjaman, kad kredit, elaun bulanan mak ayah) yang awak bayar setiap bulan sekarang?',
    flipContent: {
      title: 'Ketelusan Finansial:',
      description: 'Jangan rahsiakan hutang! Ramai pasangan bercerai bukan sebab tak cinta, tapi sebab terkejut hutang pasangan menimbun.',
      type: 'green-red-flag',
      greenFlag: 'Buka secara telus rekod CCRIS/CTOS tanpa defensif.',
      redFlag: 'Merahsiakan pinjaman peribadi atau pinjaman online/scam.'
    }
  },
  {
    id: 'tr-4',
    category: 'taaruf-realiti',
    categoryLabel: '🌶️ Realiti Taaruf',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Dua-dua Serentak',
    question: 'Kalau berlaku perselisihan faham antara mertua dan pasangan, di mana pendirian awak? Akan dengar sebelah pihak atau jadi pendamai adil?',
    flipContent: {
      title: 'Sempadan Keluarga:',
      description: 'Ketaatan pada ibu bapa tidak bermaksud membiarkan pasangan dizalimi. Kebijaksanaan suami/isteri mengurus batas adalah kunci aman.',
      type: 'green-red-flag',
      greenFlag: 'Tegas mempertahankan maruah pasangan secara beradab dan diplomasi.',
      redFlag: '"Mama saya tak pernah salah, awak kena ikut je."'
    }
  },
  {
    id: 'tr-5',
    category: 'taaruf-realiti',
    categoryLabel: '🌶️ Realiti Taaruf',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    turn: 'Lelaki',
    question: 'Bagaimana pembahagian kerja rumah (memasak, membasuh, buang sampah, jaga anak)? Adakah awak anggap ini 100% kerja isteri?',
    flipContent: {
      title: 'Sunnah Rumahtangga:',
      description: 'Nabi Muhammad SAW sendiri menjahit pakaiannya dan membantu urusan rumahtangga keluarga baginda di rumah.',
      type: 'green-red-flag',
      greenFlag: 'Faham konsep partnership — sama-sama buat kerja rumah.',
      redFlag: 'Duduk goyang kaki anggap kerja rumah semata-mata tugas orang perempuan.'
    }
  }
];

export const GUESS_QUIZ_LIST: GuessQuizItem[] = [
  {
    id: 'gq-1',
    targetRole: 'Lelaki',
    question: 'Bila si dia lapar teruk tengah malam (craving pukul 12 malam), apa pilihan utama dia?',
    options: ['Burger Ramly Special Tepi Jalan', 'Maggi Kari Telur Mata Sebiji', 'Drive-thru McD / Ayam Goreng', 'Tidur je, tahan lapar'],
    vibeText: 'Uji sama ada korang faham selera makan pasangan waktu malam!'
  },
  {
    id: 'gq-2',
    targetRole: 'Perempuan',
    question: 'Bila dia tengah serabut atau merajuk, apa cara paling berkesan nak neutralkan emosi dia?',
    options: ['Beli makanan manis / Matcha / Boba', 'Bagi dia bersendirian (silent mode) kejap', 'Minta maaf terus & dengar luahan tanpa defend diri', 'Bawa jalan-jalan cuci mata di mall'],
    vibeText: 'Kunci keamanan perhubungan jangka panjang!'
  },
  {
    id: 'gq-3',
    targetRole: 'Lelaki',
    question: 'Kalau dia dapat duit terpijak RM5,000 sekarang, apa benda pertama dia nak beli?',
    options: ['Upgrade part PC / Gadget / PS5', 'Simpan terus dalam ASB / Tabung Haji', 'Tukar tayar / Servis & aksesori kereta/motor', 'Belanja pasangan makan buffet hotel mewah'],
    vibeText: 'Tengok sama ada si dia jenis boros atau praktikal!'
  },
  {
    id: 'gq-4',
    targetRole: 'Perempuan',
    question: 'Kalau kena pilih destinasi bercuti / honeymoon idaman dia:',
    options: ['Sejuk & Santai (Kundasang / Cameron Highlands)', 'Pantai & Sunset (Pulau Redang / Langkawi)', 'Vibe Luar Negara Sejuk (Jepun / Switzerland)', 'Staycation santai hotel ada bathtub'],
    vibeText: 'Jom tengok impian cuti korang sehaluan atau tak!'
  },
  {
    id: 'gq-5',
    targetRole: 'Lelaki',
    question: 'Bila berlaku tayar kereta pancit tepi highway, apa reaksi spontan dia?',
    options: ['Bertenang, buka bonet & tukar tayar spare sendiri', 'Call insurans / towing / abang pomen terus', 'Stress & termenung tengok tayar 10 minit', 'Suruh pasangan tolong tengok tutorial YouTube'],
    vibeText: 'Tahap survival si dia bila menghadapi situasi cemas!'
  }
];

export const WHEEL_SEGMENTS: WheelSegment[] = [
  {
    id: 'pedas',
    label: '🌶️ Soalan Pedas',
    icon: '🌶️',
    color: '#e11d48',
    textColor: '#ffffff',
    category: 'Deep & Taboo',
    prompts: [
      'Pernah tak awak rasa ragu-ragu dengan hubungan kita sebelum ni?',
      'Berapa jumlah simpanan kecemasan awak sekarang? Jujur!',
      'Kalau ada kawan berlainan jantina text mesra, apa batasan awak?'
    ]
  },
  {
    id: 'lawak',
    label: '🤣 Teki-Teki',
    icon: '🤣',
    color: '#f59e0b',
    textColor: '#ffffff',
    category: 'Pecah Ais',
    prompts: [
      'Gajah lalu titi patah, lepas tu kambing lalu apa pula yang patah? (Patah balik lah, kan titi dah patah! 😂)',
      'Kereta apa yang tayarnya warna putih? (Kereta sorong bawa simen lah!)',
      'Katak apa yang tak reti lompat? (Katak bawah tempurung!)'
    ]
  },
  {
    id: 'denda',
    label: '🙈 Denda Comel',
    icon: '🙈',
    color: '#8b5cf6',
    textColor: '#ffffff',
    category: 'Dare Santai',
    prompts: [
      'Tunjuk gambar paling kelakar atau gambar zaman sekolah dalam gallery telefon!',
      'Yang kena denda wajib belanja dessert atau minuman lepak harini!',
      'Buat pickupline spontan dalam 10 saat tanpa ketawa!'
    ]
  },
  {
    id: 'jiwa',
    label: '💭 Sembang Jiwa',
    icon: '💭',
    color: '#06b6d4',
    textColor: '#ffffff',
    category: 'Emosi & Hati',
    prompts: [
      'Bila kali terakhir awak rasa bangga gila dengan diri sendiri?',
      'Apa satu nasihat mak ayah yang awak paling pegang sampai mati?',
      'Benda apa yang paling awak takut berlaku dalam hidup?'
    ]
  },
  {
    id: 'speed',
    label: '⚡ Spontan 5s',
    icon: '⚡',
    color: '#10b981',
    textColor: '#ffffff',
    category: 'Quickfire Rapid',
    prompts: [
      'Dalam 5 saat: Sebut 3 makanan kegemaran saya sekarang!',
      'Dalam 5 saat: Sebut 1 tabiat saya yang awak rasa comel!',
      'Dalam 5 saat: Pilih: Sambal belacan vs Sambal kicap?'
    ]
  },
  {
    id: 'rahsia',
    label: '🤫 Rahsia Kecil',
    icon: '🤫',
    color: '#ec4899',
    textColor: '#ffffff',
    category: 'Confession',
    prompts: [
      'Apa first impression sebenar awak masa mula-mula kenal saya dulu?',
      'Lagu apa yang bila dengar je automatik teringat saya?',
      'Benda pelik apa yang awak buat bila duduk seorang diri dalam bilik?'
    ]
  }
];
