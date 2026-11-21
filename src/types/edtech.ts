export type NavTab = 'lessons' | 'speaking' | 'games' | 'studio' | 'materials' | 'analytics' | 'branding';

export type GameKind =
  | 'match'
  | 'mystery'
  | 'missing'
  | 'wheel'
  | 'maze'
  | 'race'
  | 'sorting'
  | 'spell'
  | 'taboo'
  | 'sentence'
  | 'escape'
  | 'memory'
  | 'bubble'
  | 'scramble'
  | 'team-race'
  | 'gimkit-escape'
  | 'survey-slam'
  | 'tile-puzzle'
  | 'aster-quiz';

export type AIModelId = 'gemini-3-flash-preview' | 'gemini-3-pro-preview' | 'gemini-2.5-flash';

export interface LessonDeck {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  createdAt: number;
  order: number;
}

export interface VocabCard {
  id: string;
  deckId: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  syllables?: string;
  imageDataUrl: string;
  audioDataUrl?: string;
  order: number;
  bestStars: number;
  createdAt: number;
  lastPracticedAt?: number;
  practiceCount?: number;
}

export interface BrandSettings {
  id: 'primary';
  brandTitle: string;
  classroomSubtitle: string;
  customLogoDataUrl: string | null;
  speechRate: number;
  voiceAccent: 'en-US' | 'en-GB';
  teamAName: string;
  teamBName: string;
  soundEffectsEnabled: boolean;
  activeAIModel?: AIModelId;
}

export interface SpeakingEvaluation {
  transcript: string;
  targetWord: string;
  stars: number;
  similarity: number;
  feedbackTitle: string;
  feedbackDetail: string;
  source: 'speech-api' | 'manual' | 'gemini-ai';
  timestamp: number;
  aiDetailedAdvice?: {
    endingSoundOk: boolean;
    vowelOk: boolean;
    stressOk: boolean;
    encouragingMessageVi: string;
    suggestedDrill: string;
  };
}

export interface ExportPackage {
  format: 'tieng-anh-thay-phuc-v1';
  exportedAt: string;
  brandSettings: BrandSettings;
  decks: LessonDeck[];
  cards: VocabCard[];
}

export interface StorageStats {
  deckCount: number;
  cardCount: number;
  customAudioCount: number;
  embeddedImageCount: number;
  estimatedBytes: number;
}

export interface SkillMasteryMetrics {
  listeningScore: number;
  speakingScore: number;
  readingScore: number;
  reflexScore: number;
  totalPractices: number;
  wordsMastered: number;
  wordsNeedingReview: number;
}
