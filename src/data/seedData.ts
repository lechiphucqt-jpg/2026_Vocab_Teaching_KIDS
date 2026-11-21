import type { BrandSettings, LessonDeck, VocabCard } from '../types/edtech';

export const SAMPLE_TEXTBOOK_PAGE_URL =
  '/src/assets/images/textbook_sample_page_1795179437853.jpg';

export interface SampleTextbookRegion {
  id: string;
  label: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  /** Normalized coordinates 0..1 on the sample textbook page */
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SAMPLE_TEXTBOOK_REGIONS: SampleTextbookRegion[] = [
  {
    id: 'box-1',
    label: 'Khung 1 — Bicycle',
    word: 'Bicycle',
    phonetic: '/ˈbaɪ.sɪ.kəl/',
    meaning: 'Xe đạp',
    example: 'I ride my red bicycle to the park.',
    x: 0.145,
    y: 0.145,
    w: 0.335,
    h: 0.355,
  },
  {
    id: 'box-2',
    label: 'Khung 2 — Umbrella',
    word: 'Umbrella',
    phonetic: '/ʌmˈbrel.ə/',
    meaning: 'Cái ô (dù)',
    example: 'Take a yellow umbrella when it rains.',
    x: 0.535,
    y: 0.145,
    w: 0.335,
    h: 0.355,
  },
  {
    id: 'box-3',
    label: 'Khung 3 — Sunflower',
    word: 'Sunflower',
    phonetic: '/ˈsʌn.flaʊ.ər/',
    meaning: 'Hoa hướng dương',
    example: 'The bright sunflower faces the sun.',
    x: 0.145,
    y: 0.525,
    w: 0.335,
    h: 0.355,
  },
  {
    id: 'box-4',
    label: 'Khung 4 — School Bus',
    word: 'School Bus',
    phonetic: '/skuːl bʌs/',
    meaning: 'Xe buýt trường học',
    example: 'The friendly school bus arrives at seven.',
    x: 0.535,
    y: 0.525,
    w: 0.335,
    h: 0.355,
  },
];

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  id: 'primary',
  brandTitle: 'Tiếng Anh Thầy Phúc',
  classroomSubtitle: 'Hệ thống Giảng dạy Tương tác Ngoại tuyến cho Trẻ em',
  customLogoDataUrl: null,
  speechRate: 0.85,
  voiceAccent: 'en-US',
  teamAName: 'Đội Xanh',
  teamBName: 'Đội Cam',
  teamAAvatar: '🦁',
  teamBAvatar: '🐯',
  showVietnameseInGames: true,
  soundEffectsEnabled: true,
};

export const INITIAL_DECKS: LessonDeck[] = [
  {
    id: 'deck-animals',
    title: 'Unit 1: Thế giới Động vật',
    subtitle: 'Animals Around Us',
    level: 'Starters · 6–9 tuổi',
    createdAt: 1730000000000,
    order: 0,
  },
  {
    id: 'deck-daily',
    title: 'Unit 2: Trái cây & Lớp học',
    subtitle: 'Fruits & Classroom',
    level: 'Starters · 6–9 tuổi',
    createdAt: 1730000100000,
    order: 1,
  },
];

export const INITIAL_CARDS: VocabCard[] = [
  {
    id: 'card-elephant',
    deckId: 'deck-animals',
    word: 'Elephant',
    phonetic: '/ˈel.ɪ.fənt/',
    syllables: 'El · e · phant',
    meaning: 'Con voi',
    example: 'The friendly baby elephant plays with water.',
    imageDataUrl: '/src/assets/images/vocab_elephant_1795179437408.jpg',
    order: 0,
    bestStars: 4,
    createdAt: 1730000001000,
  },
  {
    id: 'card-lion',
    deckId: 'deck-animals',
    word: 'Lion',
    phonetic: '/ˈlaɪ.ən/',
    syllables: 'Li · on',
    meaning: 'Con sư tử',
    example: 'The golden lion sits on the green hill.',
    imageDataUrl: '/src/assets/images/vocab_lion_1795179437485.jpg',
    order: 1,
    bestStars: 5,
    createdAt: 1730000002000,
  },
  {
    id: 'card-penguin',
    deckId: 'deck-animals',
    word: 'Penguin',
    phonetic: '/ˈpeŋ.ɡwɪn/',
    syllables: 'Pen · guin',
    meaning: 'Chim cánh cụt',
    example: 'The little penguin wears a warm scarf.',
    imageDataUrl: '/src/assets/images/vocab_penguin_1795179436467.jpg',
    order: 2,
    bestStars: 3,
    createdAt: 1730000003000,
  },
  {
    id: 'card-giraffe',
    deckId: 'deck-animals',
    word: 'Giraffe',
    phonetic: '/dʒɪˈrɑːf/',
    syllables: 'Gi · raffe',
    meaning: 'Hươu cao cổ',
    example: 'The tall giraffe eats green leaves.',
    imageDataUrl: '/src/assets/images/vocab_giraffe_1795179437295.jpg',
    order: 3,
    bestStars: 0,
    createdAt: 1730000004000,
  },
  {
    id: 'card-apple',
    deckId: 'deck-daily',
    word: 'Apple',
    phonetic: '/ˈæp.əl/',
    syllables: 'Ap · ple',
    meaning: 'Quả táo',
    example: 'This red apple is crisp and sweet.',
    imageDataUrl: '/src/assets/images/vocab_apple_1795179437123.jpg',
    order: 0,
    bestStars: 5,
    createdAt: 1730000101000,
  },
  {
    id: 'card-strawberry',
    deckId: 'deck-daily',
    word: 'Strawberry',
    phonetic: '/ˈstrɔː.bər.i/',
    syllables: 'Straw · ber · ry',
    meaning: 'Quả dâu tây',
    example: 'We picked fresh strawberries in a basket.',
    imageDataUrl: '/src/assets/images/vocab_strawberry_1795179436433.jpg',
    order: 1,
    bestStars: 4,
    createdAt: 1730000102000,
  },
  {
    id: 'card-backpack',
    deckId: 'deck-daily',
    word: 'Backpack',
    phonetic: '/ˈbæk.pæk/',
    syllables: 'Back · pack',
    meaning: 'Ba lô đi học',
    example: 'My blue backpack holds pencils and books.',
    imageDataUrl: '/src/assets/images/vocab_backpack_1795179437329.jpg',
    order: 2,
    bestStars: 0,
    createdAt: 1730000103000,
  },
];
