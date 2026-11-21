import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Sparkles,
  Gift,
  EyeOff,
  Key,
  CheckCircle2,
  Disc,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Grid,
  SlidersHorizontal,
  Maximize,
  Minimize,
  Rocket,
  Zap,
  RotateCw,
  X,
} from 'lucide-react';
import type { BrandSettings, GameKind, LessonDeck, VocabCard } from '../types/edtech';
import { playClassroomSfx, speakVocabulary } from '../utils/mediaUtils';
import { triggerCelebration } from '../utils/celebration';
import { ResilientImage } from './ResilientImage';

interface ClassroomGamesProps {
  decks: LessonDeck[];
  cards: VocabCard[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  settings: BrandSettings;
  onUpdateSettings: (partial: Partial<BrandSettings>) => void;
}

type TeamKey = 'A' | 'B';

interface MemoryTile {
  uid: string;
  cardId: string;
  kind: 'image' | 'word';
  label: string;
  imageUrl: string;
  audioDataUrl?: string;
  matchedBy: TeamKey | null;
}

interface ScrambleLetter {
  id: string;
  char: string;
  used: boolean;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTabooWordsForCard(card: VocabCard): string[] {
  const words = new Set<string>();
  const cleanWord = card.word.toLowerCase();
  if (cleanWord.includes('elephant')) {
    words.add('Big'); words.add('Trunk'); words.add('Gray');
  } else if (cleanWord.includes('giraffe')) {
    words.add('Tall'); words.add('Neck'); words.add('Spots');
  } else if (cleanWord.includes('lion')) {
    words.add('King'); words.add('Roar'); words.add('Jungle');
  } else if (cleanWord.includes('penguin')) {
    words.add('Ice'); words.add('Bird'); words.add('Swim');
  } else if (cleanWord.includes('bike') || cleanWord.includes('bicycle')) {
    words.add('Ride'); words.add('Wheel'); words.add('Pedal');
  } else if (cleanWord.includes('bus')) {
    words.add('Drive'); words.add('School'); words.add('Yellow');
  } else if (cleanWord.includes('umbrella')) {
    words.add('Rain'); words.add('Wet'); words.add('Open');
  } else if (cleanWord.includes('sunflower') || cleanWord.includes('flower')) {
    words.add('Yellow'); words.add('Garden'); words.add('Sun');
  } else {
    const meaningWords = card.meaning.split(/[\s,]+/);
    words.add(meaningWords[0] || 'Object');
    words.add('Color');
    words.add('Look');
  }
  return Array.from(words).slice(0, 3);
}

const AVATAR_PRESETS = [
  '🦁', '🐯', '🚀', '🦄', '🐼', '🦊',
  '⚡', '🌟', '🏎️', '🦖', '🐬', '🦅',
  '👑', '🔥', '🐶', '🐱', '🐰', '🐸',
];

export function ClassroomGames({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  settings,
  onUpdateSettings,
}: ClassroomGamesProps) {
  const [gameKind, setGameKind] = useState<GameKind>('bubble');
  const [useAllDecks, setUseAllDecks] = useState(true);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [activeTeam, setActiveTeam] = useState<TeamKey>('A');
  const [bannerText, setBannerText] = useState('Chào mừng các bé đến với Sân đấu trò chơi từ vựng!');
  const [isFinished, setIsFinished] = useState(false);
  const [gameMenuMode, setGameMenuMode] = useState<'slider' | 'grid'>('slider');

  // Custom Team Names & Avatars for all 19 games
  const [teamAName, setTeamAName] = useState(settings.teamAName || 'Đội Xanh');
  const [teamBName, setTeamBName] = useState(settings.teamBName || 'Đội Cam');
  const [teamAAvatar, setTeamAAvatar] = useState(settings.teamAAvatar || '🦁');
  const [teamBAvatar, setTeamBAvatar] = useState(settings.teamBAvatar || '🐯');
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [tempNameA, setTempNameA] = useState(settings.teamAName || 'Đội Xanh');
  const [tempNameB, setTempNameB] = useState(settings.teamBName || 'Đội Cam');
  const [tempAvatarA, setTempAvatarA] = useState(settings.teamAAvatar || '🦁');
  const [tempAvatarB, setTempAvatarB] = useState(settings.teamBAvatar || '🐯');

  // Global Vietnamese Meaning Toggle for all 19 games
  const [showVietnamese, setShowVietnamese] = useState<boolean>(
    settings.showVietnameseInGames !== undefined ? settings.showVietnameseInGames : true
  );

  // Bubble Pop Letters Toggle
  const [showBubbleLetters, setShowBubbleLetters] = useState(false);

  useEffect(() => {
    if (settings.teamAName) {
      setTeamAName(settings.teamAName);
      setTempNameA(settings.teamAName);
    }
    if (settings.teamBName) {
      setTeamBName(settings.teamBName);
      setTempNameB(settings.teamBName);
    }
    if (settings.teamAAvatar) {
      setTeamAAvatar(settings.teamAAvatar);
      setTempAvatarA(settings.teamAAvatar);
    }
    if (settings.teamBAvatar) {
      setTeamBAvatar(settings.teamBAvatar);
      setTempAvatarB(settings.teamBAvatar);
    }
    if (settings.showVietnameseInGames !== undefined) {
      setShowVietnamese(settings.showVietnameseInGames);
    }
  }, [settings.teamAName, settings.teamBName, settings.teamAAvatar, settings.teamBAvatar, settings.showVietnameseInGames]);

  const handleSaveTeams = (newTeamA: string, newAvatarA: string, newTeamB: string, newAvatarB: string) => {
    const finalA = newTeamA.trim() || 'Đội Xanh';
    const finalB = newTeamB.trim() || 'Đội Cam';
    setTeamAName(finalA);
    setTeamAAvatar(newAvatarA);
    setTeamBName(finalB);
    setTeamBAvatar(newAvatarB);
    onUpdateSettings({
      teamAName: finalA,
      teamAAvatar: newAvatarA,
      teamBName: finalB,
      teamBAvatar: newAvatarB,
    });
    setIsTeamModalOpen(false);
  };

  const handleToggleVietnamese = () => {
    const next = !showVietnamese;
    setShowVietnamese(next);
    onUpdateSettings({ showVietnameseInGames: next });
  };

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (gameContainerRef.current?.requestFullscreen) {
        gameContainerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const scrollNavRef = useRef<HTMLDivElement>(null);

  const scrollNav = (direction: 'left' | 'right') => {
    if (!scrollNavRef.current) return;
    const distance = 280;
    scrollNavRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const poolCards = useMemo(() => {
    const list = useAllDecks ? cards : cards.filter((c) => c.deckId === selectedDeckId);
    return list.length > 0 ? list : cards;
  }, [cards, selectedDeckId, useAllDecks]);

  // ---------------- 1. BUBBLE POP / TRÁI CÂY ----------------
  const [bubbleQueue, setBubbleQueue] = useState<VocabCard[]>([]);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const [bubbleChoices, setBubbleChoices] = useState<VocabCard[]>([]);
  const [poppedIds, setPoppedIds] = useState<string[]>([]);
  const [bubbleTheme, setBubbleTheme] = useState<'bubble' | 'fruit'>('bubble');

  // ---------------- 2. GRAND PRIX RACE ----------------
  const [racePosA, setRacePosA] = useState(0);
  const [racePosB, setRacePosB] = useState(0);
  const [raceQueue, setRaceQueue] = useState<VocabCard[]>([]);
  const [raceIdx, setRaceIdx] = useState(0);
  const [raceChoices, setRaceChoices] = useState<VocabCard[]>([]);

  // ---------------- 3. SCRAMBLE GHÉP CHỮ ----------------
  const [scrambleQueue, setScrambleQueue] = useState<VocabCard[]>([]);
  const [scrambleIdx, setScrambleIdx] = useState(0);
  const [scrambleLetters, setScrambleLetters] = useState<ScrambleLetter[]>([]);
  const [scrambleBuilt, setScrambleBuilt] = useState<ScrambleLetter[]>([]);
  const [scrambleFeedback, setScrambleFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // ---------------- 4. PICTURE MATCHING ----------------
  const [matchLeftCards, setMatchLeftCards] = useState<VocabCard[]>([]);
  const [matchRightCards, setMatchRightCards] = useState<VocabCard[]>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedCardTeams, setMatchedCardTeams] = useState<Record<string, TeamKey>>({});
  const [wrongPairFlash, setWrongPairFlash] = useState<string | null>(null);

  // ---------------- 5. MYSTERY BOX ----------------
  interface MysteryBoxItem {
    id: number;
    card: VocabCard;
    isOpened: boolean;
    prizeLabel: string;
    prizePoints: number;
    options: VocabCard[];
  }
  const [mysteryBoxes, setMysteryBoxes] = useState<MysteryBoxItem[]>([]);
  const [activeMysteryBox, setActiveMysteryBox] = useState<MysteryBoxItem | null>(null);

  // ---------------- 6. WHAT'S MISSING? ----------------
  const [missingCards, setMissingCards] = useState<VocabCard[]>([]);
  const [missingTargetCard, setMissingTargetCard] = useState<VocabCard | null>(null);
  const [missingPhase, setMissingPhase] = useState<'remember' | 'guess' | 'revealed'>('remember');
  const [missingCountdown, setMissingCountdown] = useState(5);
  const [missingOptions, setMissingOptions] = useState<VocabCard[]>([]);

  // ---------------- 7. SPIN THE WHEEL ----------------
  const WHEEL_PRIZES = useMemo(() => [
    { label: '+10 Điểm', points: 10, color: '#10B981' },
    { label: '+20 Điểm', points: 20, color: '#0284C7' },
    { label: '+30 Điểm', points: 30, color: '#8B5CF6' },
    { label: '🌟 Lucky +50', points: 50, color: '#F43F5E' },
    { label: '+15 Điểm', points: 15, color: '#14B8A6' },
    { label: '+25 Điểm', points: 25, color: '#F59E0B' },
    { label: '⚡ Nhân đôi x2', points: 40, color: '#EC4899' },
    { label: '🍀 Thần kỳ +35', points: 35, color: '#6366F1' },
  ], []);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [wheelWonPrize, setWheelWonPrize] = useState<typeof WHEEL_PRIZES[0] | null>(null);
  const [wheelCurrentCard, setWheelCurrentCard] = useState<VocabCard | null>(null);
  const [wheelOptions, setWheelOptions] = useState<VocabCard[]>([]);
  const [wheelSpinSpeed, setWheelSpinSpeed] = useState<'fast' | 'normal'>('fast');
  const [wheelSpinDuration, setWheelSpinDuration] = useState<number>(900);

  // ---------------- 8. WORD MAZE ----------------
  const [mazeStep, setMazeStep] = useState(0);
  const [mazeQueue, setMazeQueue] = useState<VocabCard[]>([]);
  const [mazeOptions, setMazeOptions] = useState<VocabCard[]>([]);

  // ---------------- 9. WORD SORTING ----------------
  const [sortQueue, setSortQueue] = useState<VocabCard[]>([]);
  const [sortIdx, setSortIdx] = useState(0);
  const [sortedBasketA, setSortedBasketA] = useState<VocabCard[]>([]);
  const [sortedBasketB, setSortedBasketB] = useState<VocabCard[]>([]);
  const [basketAName, setBasketAName] = useState('Giỏ Chữ Cái A – M');
  const [basketBName, setBasketBName] = useState('Giỏ Chữ Cái N – Z');
  const [sortRule, setSortRule] = useState<'alpha' | 'free'>('alpha');

  // ---------------- 10. SPELL IT! ----------------
  const [spellQueue, setSpellQueue] = useState<VocabCard[]>([]);
  const [spellIdx, setSpellIdx] = useState(0);
  const [spellLetters, setSpellLetters] = useState<ScrambleLetter[]>([]);
  const [spellBuilt, setSpellBuilt] = useState<ScrambleLetter[]>([]);
  const [spellFeedback, setSpellFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // ---------------- 11. TABOO WORDS ----------------
  const [tabooQueue, setTabooQueue] = useState<VocabCard[]>([]);
  const [tabooIdx, setTabooIdx] = useState(0);
  const [tabooTimer, setTabooTimer] = useState(30);
  const [isTabooTimerRunning, setIsTabooTimerRunning] = useState(false);

  // ---------------- 12. BUILD A SENTENCE ----------------
  interface SentenceWord {
    id: string;
    text: string;
    used: boolean;
  }
  const [sentenceQueue, setSentenceQueue] = useState<VocabCard[]>([]);
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [sentenceWords, setSentenceWords] = useState<SentenceWord[]>([]);
  const [builtSentence, setBuiltSentence] = useState<SentenceWord[]>([]);
  const [sentenceFeedback, setSentenceFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // ---------------- 13. ESCAPE ROOM ----------------
  const [escapeRoomLevel, setEscapeRoomLevel] = useState(1);
  const [escapeCard, setEscapeCard] = useState<VocabCard | null>(null);
  const [escapeOptions, setEscapeOptions] = useState<VocabCard[]>([]);

  // ---------------- 14. MEMORY FLIP ----------------
  const [memoryTiles, setMemoryTiles] = useState<MemoryTile[]>([]);
  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [lockBoard, setLockBoard] = useState(false);

  // ---------------- 15. QUIZLET LIVE - TEAM RACE ----------------
  interface AnimalSquad {
    id: string;
    name: string;
    avatar: string;
    color: string;
    barColor: string;
    score: number;
  }
  const DEFAULT_SQUADS: AnimalSquad[] = useMemo(() => [
    { id: 'lions', name: 'Lions', avatar: '🦁', color: '#8B5CF6', barColor: 'bg-purple-600', score: 0 },
    { id: 'penguins', name: 'Penguins', avatar: '🐧', color: '#EAB308', barColor: 'bg-yellow-500', score: 0 },
    { id: 'frogs', name: 'Frogs', avatar: '🐸', color: '#F97316', barColor: 'bg-orange-500', score: 0 },
    { id: 'chameleons', name: 'Chameleons', avatar: '🦎', color: '#64748B', barColor: 'bg-slate-500', score: 0 },
    { id: 'hedgehogs', name: 'Hedgehogs', avatar: '🦔', color: '#10B981', barColor: 'bg-emerald-600', score: 0 },
    { id: 'orcas', name: 'Orcas', avatar: '🐋', color: '#EF4444', barColor: 'bg-red-500', score: 0 },
    { id: 'oxen', name: 'Oxen', avatar: '🐂', color: '#0284C7', barColor: 'bg-sky-500', score: 0 },
    { id: 'alligators', name: 'Alligators', avatar: '🐊', color: '#4F46E5', barColor: 'bg-indigo-600', score: 0 },
  ], []);
  const [teamRaceSquads, setTeamRaceSquads] = useState<AnimalSquad[]>(DEFAULT_SQUADS);
  const [teamRaceSquadCount, setTeamRaceSquadCount] = useState<number>(4);
  const [activeSquadIdx, setActiveSquadIdx] = useState(0);
  const [teamRaceCurrentCard, setTeamRaceCurrentCard] = useState<VocabCard | null>(null);
  const [teamRaceChoices, setTeamRaceChoices] = useState<VocabCard[]>([]);

  // ---------------- 16. GIMKIT - ONE WAY OUT ----------------
  const [gimkitEnergy, setGimkitEnergy] = useState(0);
  const [gimkitKeys, setGimkitKeys] = useState(0);
  const [gimkitRoomIndex, setGimkitRoomIndex] = useState(0);
  const [gimkitShield, setGimkitShield] = useState(100);
  const [gimkitCurrentCard, setGimkitCurrentCard] = useState<VocabCard | null>(null);
  const [gimkitChoices, setGimkitChoices] = useState<VocabCard[]>([]);

  // ---------------- 17. SURVEY GAME SHOW (FAMILY FEUD STYLE) ----------------
  interface SurveyTeam {
    id: string;
    name: string;
    avatar: string;
    color: string;
    accentBg: string;
    accentBorder: string;
    accentText: string;
    score: number;
  }

  interface SurveyAnswerSlot {
    id: string;
    rank: number;
    points: number;
    card: VocabCard;
    isRevealed: boolean;
  }

  const DEFAULT_SURVEY_PRESETS = [
    'Name something you can find in a classroom.',
    'Name an animal you might see at the zoo or at home.',
    'Name a fruit or vegetable that is healthy and delicious.',
    'Name an essential item you pack when going on a trip.',
    'Name an activity or routine you do every morning.',
    'Name a vehicle or transport you see on the street.',
  ];

  const DEFAULT_SURVEY_TEAMS: SurveyTeam[] = [
    { id: 'survey-team-1', name: 'Đội Sư Tử (Lions)', avatar: '🦁', color: 'sky', accentBg: 'bg-sky-500', accentBorder: 'border-sky-400', accentText: 'text-sky-400', score: 0 },
    { id: 'survey-team-2', name: 'Đội Hổ Vàng (Tigers)', avatar: '🐯', color: 'amber', accentBg: 'bg-amber-500', accentBorder: 'border-amber-400', accentText: 'text-amber-400', score: 0 },
    { id: 'survey-team-3', name: 'Đội Đại Bàng (Eagles)', avatar: '🦅', color: 'emerald', accentBg: 'bg-emerald-500', accentBorder: 'border-emerald-400', accentText: 'text-emerald-400', score: 0 },
    { id: 'survey-team-4', name: 'Đội Cá Heo (Dolphins)', avatar: '🐬', color: 'purple', accentBg: 'bg-purple-500', accentBorder: 'border-purple-400', accentText: 'text-purple-400', score: 0 },
  ];

  const [surveyTeamCount, setSurveyTeamCount] = useState<number>(2);
  const [surveyTeams, setSurveyTeams] = useState<SurveyTeam[]>(DEFAULT_SURVEY_TEAMS);
  const [surveyActiveTeamIdx, setSurveyActiveTeamIdx] = useState<number>(0);
  const [surveyOriginalTeamIdx, setSurveyOriginalTeamIdx] = useState<number>(0);
  const [surveySlots, setSurveySlots] = useState<SurveyAnswerSlot[]>([]);
  const [surveyRoundBank, setSurveyRoundBank] = useState<number>(0);
  const [surveyStrikes, setSurveyStrikes] = useState<number>(0);
  const [surveyStealMode, setSurveyStealMode] = useState<boolean>(false);
  const [surveyRoundNumber, setSurveyRoundNumber] = useState<number>(1);
  const [surveyQuestion, setSurveyQuestion] = useState<string>(DEFAULT_SURVEY_PRESETS[0]);
  const [isEditingSurveyQuestion, setIsEditingSurveyQuestion] = useState<boolean>(false);
  const [editingSurveyTeamIdx, setEditingSurveyTeamIdx] = useState<number | null>(null);
  const [surveyStrikeFlash, setSurveyStrikeFlash] = useState<number | null>(null);
  const [surveyModalCard, setSurveyModalCard] = useState<VocabCard | null>(null);
  const [surveyRoundWinner, setSurveyRoundWinner] = useState<string | null>(null);
  const [isSurveyGameOver, setIsSurveyGameOver] = useState<boolean>(false);

  // ---------------- 18. FLIPPITY - TILE PUZZLE ----------------
  interface PuzzleTileItem {
    id: string;
    card: VocabCard;
    rotation: number;
    position: number;
    solved: boolean;
  }
  const [puzzleTiles, setPuzzleTiles] = useState<PuzzleTileItem[]>([]);
  const [selectedPuzzleIdx, setSelectedPuzzleIdx] = useState<number | null>(null);

  // ---------------- 19. EDUCAPLAY - ASTERQUIZ ----------------
  const [asterPosA, setAsterPosA] = useState(0);
  const [asterPosB, setAsterPosB] = useState(0);
  const [asterCurrentCard, setAsterCurrentCard] = useState<VocabCard | null>(null);
  const [asterChoices, setAsterChoices] = useState<VocabCard[]>([]);
  const [asterLaserActive, setAsterLaserActive] = useState<TeamKey | null>(null);

  const awardPoints = (team: TeamKey, pts: number) => {
    if (team === 'A') setScoreA((s) => s + pts);
    else setScoreB((s) => s + pts);
  };

  const nextTeamName = (t: TeamKey) =>
    t === 'A' ? `${teamAAvatar} ${teamAName}` : `${teamBAvatar} ${teamBName}`;

  const buildOptionsForCard = useCallback((targetCard: VocabCard, all: VocabCard[], count = 4): VocabCard[] => {
    const distractors = all.filter((c) => c.id !== targetCard.id);
    const chosenDistractors = shuffleArray(distractors).slice(0, count - 1);
    return shuffleArray([targetCard, ...chosenDistractors]);
  }, []);

  const buildScrambleForCard = useCallback((card: VocabCard | undefined) => {
    if (!card) {
      setScrambleLetters([]);
      setScrambleBuilt([]);
      return;
    }
    const cleanWord = card.word.replace(/[^A-Za-z]/g, '').toUpperCase();
    const letters: ScrambleLetter[] = cleanWord.split('').map((char, i) => ({
      id: `${card.id}-${i}-${char}`,
      char,
      used: false,
    }));
    setScrambleLetters(shuffleArray(letters));
    setScrambleBuilt([]);
    setScrambleFeedback('idle');
  }, []);

  const buildSentenceForCard = useCallback((card: VocabCard | undefined) => {
    if (!card) {
      setSentenceWords([]);
      setBuiltSentence([]);
      return;
    }
    const rawSentence = card.example.trim() || `This is a friendly ${card.word}.`;
    const cleanWords = rawSentence
      .replace(/[.,!?;:"'()]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const wordsObj: SentenceWord[] = cleanWords.map((w, i) => ({
      id: `word-${i}-${w}`,
      text: w,
      used: false,
    }));
    setSentenceWords(shuffleArray(wordsObj));
    setBuiltSentence([]);
    setSentenceFeedback('idle');
  }, []);

  // MASTER GAME RESET
  const resetCurrentGame = useCallback(() => {
    setScoreA(0);
    setScoreB(0);
    setActiveTeam('A');
    setIsFinished(false);

    if (poolCards.length === 0) return;

    if (gameKind === 'bubble') {
      const shuffled = shuffleArray(poolCards);
      setBubbleQueue(shuffled);
      setBubbleIdx(0);
      setPoppedIds([]);
      if (shuffled[0]) {
        setBubbleChoices(buildOptionsForCard(shuffled[0], poolCards, 4));
        speakVocabulary(shuffled[0].word, {
          audioDataUrl: shuffled[0].audioDataUrl,
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
      }
      setBannerText(`Lượt của ${nextTeamName('A')}: Lắng nghe loa phát âm và bấm trúng bong bóng đang bay!`);
    } else if (gameKind === 'race') {
      setRacePosA(0);
      setRacePosB(0);
      const shuffled = shuffleArray(poolCards);
      setRaceQueue(shuffled);
      setRaceIdx(0);
      if (shuffled[0]) {
        setRaceChoices(buildOptionsForCard(shuffled[0], poolCards, 4));
      }
      setBannerText(`Lượt của ${nextTeamName('A')}: Nghe hoặc nhìn hình chọn đúng để xe rồ ga về đích (+15 điểm)!`);
    } else if (gameKind === 'scramble') {
      const shuffled = shuffleArray(poolCards);
      setScrambleQueue(shuffled);
      setScrambleIdx(0);
      buildScrambleForCard(shuffled[0]);
      setBannerText(`Lượt của ${nextTeamName('A')}: Nhìn hình và bấm các chữ cái xáo trộn để ghép thành từ đúng.`);
    } else if (gameKind === 'match') {
      const subset = poolCards.slice(0, 6);
      setMatchLeftCards(shuffleArray(subset));
      setMatchRightCards(shuffleArray(subset));
      setSelectedLeftId(null);
      setMatchedCardTeams({});
      setWrongPairFlash(null);
      setBannerText(`Lượt của ${nextTeamName('A')}: Chọn 1 tranh bên trái rồi nối với từ tiếng Anh bên phải.`);
    } else if (gameKind === 'mystery') {
      const PRIZES = [
        { label: '🌟 Hộp Vàng (+25 điểm)', points: 25 },
        { label: '🎁 Hộp Bạc (+20 điểm)', points: 20 },
        { label: '💎 Kim Cương (+30 điểm)', points: 30 },
        { label: '⚡ Siêu Tốc (+15 điểm)', points: 15 },
        { label: '🍀 May Mắn (+20 điểm)', points: 20 },
        { label: '🏆 Quán Quân (+35 điểm)', points: 35 },
      ];
      const shuffledCards = shuffleArray(poolCards);
      const boxes: MysteryBoxItem[] = PRIZES.map((prize, idx) => {
        const card = shuffledCards[idx % shuffledCards.length] || poolCards[0];
        return {
          id: idx + 1,
          card,
          isOpened: false,
          prizeLabel: prize.label,
          prizePoints: prize.points,
          options: buildOptionsForCard(card, poolCards, 3),
        };
      });
      setMysteryBoxes(boxes);
      setActiveMysteryBox(null);
      setBannerText(`Lượt của ${nextTeamName('A')}: Chọn 1 chiếc hộp bí mật để mở ra câu đố và điểm thưởng!`);
    } else if (gameKind === 'missing') {
      const subset = shuffleArray(poolCards).slice(0, 4);
      setMissingCards(subset);
      const chosenTarget = subset[Math.floor(Math.random() * subset.length)];
      setMissingTargetCard(chosenTarget);
      setMissingPhase('remember');
      setMissingCountdown(5);
      setMissingOptions(buildOptionsForCard(chosenTarget, poolCards, 4));
      setBannerText(`Ghi nhớ thật kỹ các bức tranh nhé! Đếm ngược 5 giây bắt đầu.`);
    } else if (gameKind === 'wheel') {
      setWheelWonPrize(null);
      setWheelCurrentCard(null);
      setWheelOptions([]);
      setIsWheelSpinning(false);
      setBannerText(`Lượt của ${nextTeamName('A')}: Bấm nút "QUAY BÁNH XE" để xác định số điểm thử thách!`);
    } else if (gameKind === 'maze') {
      setMazeStep(0);
      const shuffled = shuffleArray(poolCards);
      setMazeQueue(shuffled);
      if (shuffled[0]) {
        setMazeOptions(buildOptionsForCard(shuffled[0], poolCards, 3));
      }
      setBannerText(`Lượt của ${nextTeamName('A')}: Dẫn đường cho bạn Thỏ 🐰 qua 5 trạm để về đích nhận cà rốt 🥕!`);
    } else if (gameKind === 'sorting') {
      const shuffled = shuffleArray(poolCards);
      setSortQueue(shuffled);
      setSortIdx(0);
      setSortedBasketA([]);
      setSortedBasketB([]);
      setBannerText(`Lượt của ${nextTeamName('A')}: Phân loại từ vào Giỏ chữ cái A–M hoặc Giỏ N–Z!`);
    } else if (gameKind === 'spell') {
      const shuffled = shuffleArray(poolCards);
      setSpellQueue(shuffled);
      setSpellIdx(0);
      buildScrambleForCard(shuffled[0]);
      setBannerText(`Lượt của ${nextTeamName('A')}: Bấm từng chữ cái theo đúng thứ tự để đánh vần từ vựng!`);
    } else if (gameKind === 'taboo') {
      const shuffled = shuffleArray(poolCards);
      setTabooQueue(shuffled);
      setTabooIdx(0);
      setTabooTimer(30);
      setIsTabooTimerRunning(false);
      setBannerText(`Lượt của ${nextTeamName('A')}: Mô tả từ khóa cho đồng đội đoán mà KHÔNG ĐƯỢC nói 3 từ cấm!`);
    } else if (gameKind === 'sentence') {
      const shuffled = shuffleArray(poolCards);
      setSentenceQueue(shuffled);
      setSentenceIdx(0);
      buildSentenceForCard(shuffled[0]);
      setBannerText(`Lượt của ${nextTeamName('A')}: Sắp xếp các từ bị xáo trộn thành câu tiếng Anh hoàn chỉnh!`);
    } else if (gameKind === 'escape') {
      setEscapeRoomLevel(1);
      const shuffled = shuffleArray(poolCards);
      const c = shuffled[0] || poolCards[0];
      setEscapeCard(c);
      setEscapeOptions(buildOptionsForCard(c, poolCards, 3));
      setBannerText(`Lượt của ${nextTeamName('A')}: Căn phòng số 1 đang khóa! Giải mã từ vựng để mở cửa thoát hiểm!`);
    } else if (gameKind === 'memory') {
      const pairSource = poolCards.slice(0, 6);
      const rawTiles: MemoryTile[] = [];
      for (const card of pairSource) {
        rawTiles.push({
          uid: `img-${card.id}`,
          cardId: card.id,
          kind: 'image',
          label: card.word,
          imageUrl: card.imageDataUrl,
          audioDataUrl: card.audioDataUrl,
          matchedBy: null,
        });
        rawTiles.push({
          uid: `txt-${card.id}`,
          cardId: card.id,
          kind: 'word',
          label: card.word,
          imageUrl: card.imageDataUrl,
          audioDataUrl: card.audioDataUrl,
          matchedBy: null,
        });
      }
      setMemoryTiles(shuffleArray(rawTiles));
      setFlippedUids([]);
      setLockBoard(false);
      setBannerText(`Lượt của ${nextTeamName('A')}: Lật 1 thẻ hình và 1 thẻ chữ tiếng Anh khớp nhau.`);
    } else if (gameKind === 'team-race') {
      const resetSquads = DEFAULT_SQUADS.map((s) => ({ ...s, score: 0 }));
      setTeamRaceSquads(resetSquads);
      setActiveSquadIdx(0);
      const shuffled = shuffleArray(poolCards);
      const target = shuffled[0] || poolCards[0];
      setTeamRaceCurrentCard(target);
      if (target) {
        setTeamRaceChoices(buildOptionsForCard(target, poolCards, 4));
        speakVocabulary(target.word, {
          audioDataUrl: target.audioDataUrl,
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
      }
      setBannerText(`Quizlet Live Race: Nhóm ${resetSquads[0].name} ${resetSquads[0].avatar} đang thi đấu! Nhóm nào chạm mốc 10 điểm trước sẽ vô địch!`);
    } else if (gameKind === 'gimkit-escape') {
      setGimkitEnergy(0);
      setGimkitKeys(0);
      setGimkitRoomIndex(0);
      setGimkitShield(100);
      const shuffled = shuffleArray(poolCards);
      const target = shuffled[0] || poolCards[0];
      setGimkitCurrentCard(target);
      if (target) {
        setGimkitChoices(buildOptionsForCard(target, poolCards, 4));
      }
      setBannerText('Gimkit One Way Out: Cả lớp cùng nạp năng lượng ⚡ và tìm 3 chìa khóa 🔑 mở cổng thoát hiểm cứu tàu!');
    } else if (gameKind === 'survey-slam') {
      setSurveyStrikes(0);
      setSurveyRoundBank(0);
      setSurveyStealMode(false);
      setSurveyRoundWinner(null);
      setSurveyStrikeFlash(null);
      setSurveyModalCard(null);
      setIsSurveyGameOver(false);
      setSurveyActiveTeamIdx(0);
      setSurveyOriginalTeamIdx(0);
      setSurveyRoundNumber(1);
      setSurveyTeams(DEFAULT_SURVEY_TEAMS.map((t) => ({ ...t, score: 0 })));

      const shuffled = shuffleArray(poolCards);
      const POINTS = [35, 25, 18, 12, 8, 5];
      const slots: SurveyAnswerSlot[] = [];
      for (let i = 0; i < 6; i++) {
        const card = shuffled[i] || poolCards[i % Math.max(1, poolCards.length)] || {
          id: `survey-fallback-${i}`,
          word: `Word ${i + 1}`,
          meaning: `Nghĩa từ ${i + 1}`,
          category: 'Vocabulary',
        };
        slots.push({
          id: `survey-slot-${i}`,
          rank: i + 1,
          points: POINTS[i],
          card,
          isRevealed: false,
        });
      }
      setSurveySlots(slots);
      setSurveyQuestion(DEFAULT_SURVEY_PRESETS[0]);
      setBannerText(`Survey Game Show - Vòng 1: Lượt của ${DEFAULT_SURVEY_TEAMS[0].name}. Hãy đoán các từ vựng ẩn trên bảng!`);
    } else if (gameKind === 'tile-puzzle') {
      setSelectedPuzzleIdx(null);
      const subset = shuffleArray(poolCards).slice(0, 4);
      const ROTATIONS = [0, 90, 180, 270];
      const pTiles: PuzzleTileItem[] = subset.map((c, i) => ({
        id: `tile-${c.id}-${i}`,
        card: c,
        rotation: ROTATIONS[Math.floor(Math.random() * 3) + 1],
        position: i,
        solved: false,
      }));
      setPuzzleTiles(pTiles);
      setBannerText(`Lượt của ${nextTeamName('A')}: Bấm nút xoay ⟳ để đưa các ô vuông về đúng hướng khớp từ vựng!`);
    } else if (gameKind === 'aster-quiz') {
      setAsterPosA(0);
      setAsterPosB(0);
      setAsterLaserActive(null);
      const shuffled = shuffleArray(poolCards);
      const target = shuffled[0] || poolCards[0];
      setAsterCurrentCard(target);
      if (target) {
        setAsterChoices(buildOptionsForCard(target, poolCards, 3));
        speakVocabulary(target.word, {
          audioDataUrl: target.audioDataUrl,
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
      }
      setBannerText(`Lượt của ${nextTeamName('A')}: Nghe từ vựng và bắn thiên thạch để tàu không gian bứt phá về trạm!`);
    }
  }, [
    DEFAULT_SQUADS,
    buildOptionsForCard,
    buildScrambleForCard,
    buildSentenceForCard,
    gameKind,
    poolCards,
    settings.speechRate,
    settings.teamAName,
    settings.voiceAccent,
  ]);

  useEffect(() => {
    resetCurrentGame();
  }, [resetCurrentGame]);

  // Taboo Timer
  useEffect(() => {
    if (gameKind !== 'taboo' || !isTabooTimerRunning) return;
    if (tabooTimer <= 0) {
      setIsTabooTimerRunning(false);
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Hết giờ rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
      return;
    }
    const timer = setInterval(() => setTabooTimer((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [gameKind, isTabooTimerRunning, tabooTimer, activeTeam, settings.soundEffectsEnabled]);

  // What's Missing Countdown
  useEffect(() => {
    if (gameKind !== 'missing' || missingPhase !== 'remember') return;
    if (missingCountdown <= 0) {
      setMissingPhase('guess');
      playClassroomSfx('flip', settings.soundEffectsEnabled);
      setBannerText(`Nhắm mắt lại nào! Bức tranh nào vừa biến mất? Hãy chọn đáp án đúng!`);
      return;
    }
    const timer = setInterval(() => setMissingCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [gameKind, missingCountdown, missingPhase, settings.soundEffectsEnabled]);

  // ---------------- 1. BUBBLE POP HANDLER ----------------
  const currentBubbleTarget = bubbleQueue[bubbleIdx];

  const handleBubbleClick = (clickedCard: VocabCard) => {
    if (!currentBubbleTarget || isFinished || poppedIds.includes(clickedCard.id)) return;

    if (clickedCard.id === currentBubbleTarget.id) {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      setPoppedIds((prev) => [...prev, clickedCard.id]);
      awardPoints(activeTeam, 10);
      triggerCelebration();

      setTimeout(() => {
        const nextIdx = bubbleIdx + 1;
        if (nextIdx < bubbleQueue.length) {
          setBubbleIdx(nextIdx);
          setPoppedIds([]);
          setBubbleChoices(buildOptionsForCard(bubbleQueue[nextIdx], poolCards, 4));
          speakVocabulary(bubbleQueue[nextIdx].word, {
            audioDataUrl: bubbleQueue[nextIdx].audioDataUrl,
            rate: settings.speechRate,
            accent: settings.voiceAccent,
          });
          setBannerText(`Bùm! ${nextTeamName(activeTeam)} bắn trúng bóng "${currentBubbleTarget.word}" (+10 điểm)!`);
        } else {
          setIsFinished(true);
          triggerCelebration();
          playClassroomSfx('victory', settings.soundEffectsEnabled);
          setBannerText('Tuyệt đỉnh! Đã bắn nổ toàn bộ bóng từ vựng!');
        }
      }, 700);
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Bắn nhầm bóng rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  const handlePlayCurrentBubbleAudio = () => {
    if (!currentBubbleTarget) return;
    speakVocabulary(currentBubbleTarget.word, {
      audioDataUrl: currentBubbleTarget.audioDataUrl,
      rate: settings.speechRate,
      accent: settings.voiceAccent,
    });
  };

  // ---------------- 2. GRAND PRIX RACE HANDLER ----------------
  const currentRaceTarget = raceQueue[raceIdx];

  const handleRaceAnswer = (chosenCard: VocabCard) => {
    if (!currentRaceTarget || isFinished) return;

    if (chosenCard.id === currentRaceTarget.id) {
      playClassroomSfx('star', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });

      let won = false;
      if (activeTeam === 'A') {
        const nextPos = racePosA + 1;
        setRacePosA(nextPos);
        awardPoints('A', 15);
        if (nextPos >= 5) won = true;
      } else {
        const nextPos = racePosB + 1;
        setRacePosB(nextPos);
        awardPoints('B', 15);
        if (nextPos >= 5) won = true;
      }

      if (won) {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        setBannerText(`🏆 ${nextTeamName(activeTeam)} đã cán đích đầu tiên và giành cúp vô địch Grand Prix!`);
      } else {
        const nextIdx = (raceIdx + 1) % raceQueue.length;
        setRaceIdx(nextIdx);
        setRaceChoices(buildOptionsForCard(raceQueue[nextIdx], poolCards, 4));
        setBannerText(`Rồ ga thành công! Xe ${nextTeamName(activeTeam)} tiến thêm 1 trạm (+15 điểm)!`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Chưa đúng! Xe bị khựng lại, chuyển lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 3. SCRAMBLE HANDLER ----------------
  const currentScrambleCard = scrambleQueue[scrambleIdx];

  const handlePickScrambleLetter = (letter: ScrambleLetter) => {
    if (letter.used || scrambleFeedback !== 'idle' || !currentScrambleCard) return;

    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setScrambleLetters((prev) => prev.map((l) => (l.id === letter.id ? { ...l, used: true } : l)));
    const nextBuilt = [...scrambleBuilt, letter];
    setScrambleBuilt(nextBuilt);

    const cleanTarget = currentScrambleCard.word.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (nextBuilt.length === cleanTarget.length) {
      const assembled = nextBuilt.map((l) => l.char).join('');
      if (assembled === cleanTarget) {
        setScrambleFeedback('correct');
        playClassroomSfx('match', settings.soundEffectsEnabled);
        speakVocabulary(currentScrambleCard.word, {
          audioDataUrl: currentScrambleCard.audioDataUrl,
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
        awardPoints(activeTeam, 15);

        setTimeout(() => {
          const nextIdx = scrambleIdx + 1;
          if (nextIdx < scrambleQueue.length) {
            setScrambleIdx(nextIdx);
            buildScrambleForCard(scrambleQueue[nextIdx]);
            setBannerText(`Chính xác! Ghép thành công "${currentScrambleCard.word}" (+15 điểm).`);
          } else {
            setIsFinished(true);
            triggerCelebration();
            playClassroomSfx('victory', settings.soundEffectsEnabled);
            setBannerText('Chúc mừng! Đã ghép xong tất cả các từ trong bài học!');
          }
        }, 1100);
      } else {
        setScrambleFeedback('wrong');
        playClassroomSfx('wrong', settings.soundEffectsEnabled);
        setTimeout(() => {
          setScrambleBuilt([]);
          setScrambleLetters((prev) => prev.map((l) => ({ ...l, used: false })));
          setScrambleFeedback('idle');
          const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
          setActiveTeam(nextTeam);
          setBannerText(`Ghép chưa đúng! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
        }, 900);
      }
    }
  };

  // ---------------- 4. PICTURE MATCHING HANDLER ----------------
  const handleMatchLeftClick = (card: VocabCard) => {
    if (matchedCardTeams[card.id]) return;
    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setSelectedLeftId(card.id);
  };

  const handleMatchRightClick = (rightCard: VocabCard) => {
    if (!selectedLeftId || matchedCardTeams[rightCard.id]) return;

    if (selectedLeftId === rightCard.id) {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      speakVocabulary(rightCard.word, {
        audioDataUrl: rightCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, 10);
      const updated = { ...matchedCardTeams, [rightCard.id]: activeTeam };
      setMatchedCardTeams(updated);
      setSelectedLeftId(null);

      const remaining = matchLeftCards.filter((c) => !updated[c.id]);
      if (remaining.length === 0) {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        setBannerText('Xuất sắc! Đã nối toàn bộ từ vựng.');
      } else {
        setBannerText(`Chính xác! ${nextTeamName(activeTeam)} được +10 điểm!`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      setWrongPairFlash(rightCard.id);
      setTimeout(() => setWrongPairFlash(null), 600);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setSelectedLeftId(null);
      setBannerText(`Chưa đúng rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 5. MYSTERY BOX HANDLER ----------------
  const handleOpenMysteryBox = (box: MysteryBoxItem) => {
    if (box.isOpened) return;
    playClassroomSfx('star', settings.soundEffectsEnabled);
    setActiveMysteryBox(box);
  };

  const handleAnswerMysteryBox = (chosenCard: VocabCard) => {
    if (!activeMysteryBox) return;

    if (chosenCard.id === activeMysteryBox.card.id) {
      playClassroomSfx('victory', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, activeMysteryBox.prizePoints);
      triggerCelebration();

      setMysteryBoxes((prev) =>
        prev.map((b) => (b.id === activeMysteryBox.id ? { ...b, isOpened: true } : b))
      );
      setBannerText(`🎉 Chúc mừng ${nextTeamName(activeTeam)} mở được ${activeMysteryBox.prizeLabel}!`);
      setActiveMysteryBox(null);

      const remainingUnopened = mysteryBoxes.filter((b) => b.id !== activeMysteryBox.id && !b.isOpened);
      if (remainingUnopened.length === 0) {
        setIsFinished(true);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Chưa chính xác! Hộp chưa được mở, nhường lượt sang ${nextTeamName(nextTeam)}.`);
      setActiveMysteryBox(null);
    }
  };

  // ---------------- 6. WHAT'S MISSING HANDLER ----------------
  const handleMissingAnswer = (chosenCard: VocabCard) => {
    if (!missingTargetCard || missingPhase !== 'guess') return;

    if (chosenCard.id === missingTargetCard.id) {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, 15);
      setMissingPhase('revealed');
      triggerCelebration();
      setBannerText(`✨ Tuyệt vời! ${nextTeamName(activeTeam)} đã tìm ra tranh bị biến mất: "${chosenCard.word}" (+15 điểm)!`);

      setTimeout(() => {
        const subset = shuffleArray(poolCards).slice(0, 4);
        setMissingCards(subset);
        const chosenTarget = subset[Math.floor(Math.random() * subset.length)];
        setMissingTargetCard(chosenTarget);
        setMissingPhase('remember');
        setMissingCountdown(5);
        setMissingOptions(buildOptionsForCard(chosenTarget, poolCards, 4));
      }, 2500);
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Chưa đúng rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 7. SPIN THE WHEEL HANDLER ----------------
  const handleSpinWheel = (speed: 'fast' | 'normal' = wheelSpinSpeed) => {
    if (isWheelSpinning) return;
    setIsWheelSpinning(true);
    setWheelWonPrize(null);
    setWheelCurrentCard(null);
    playClassroomSfx('flip', settings.soundEffectsEnabled);

    const segmentCount = WHEEL_PRIZES.length;
    const randomIdx = Math.floor(Math.random() * segmentCount);
    const chosenPrize = WHEEL_PRIZES[randomIdx];

    const segmentAngle = 360 / segmentCount;
    const isFast = speed === 'fast';
    const extraSpins = isFast ? 12 * 360 : 5 * 360;
    const durationMs = isFast ? 900 : 2500;
    setWheelSpinDuration(durationMs);

    const targetAngle = extraSpins + (segmentCount - 1 - randomIdx) * segmentAngle + segmentAngle / 2;
    const finalRotation = wheelRotation + targetAngle;
    setWheelRotation(finalRotation);

    setTimeout(() => {
      setIsWheelSpinning(false);
      setWheelWonPrize(chosenPrize);
      playClassroomSfx('star', settings.soundEffectsEnabled);

      const randomCard = poolCards[Math.floor(Math.random() * poolCards.length)];
      setWheelCurrentCard(randomCard);
      setWheelOptions(buildOptionsForCard(randomCard, poolCards, 4));
      setBannerText(`Vòng quay dừng ở: ${chosenPrize.label}! Hãy trả lời câu hỏi để rinh điểm.`);
    }, durationMs);
  };

  const handleAnswerWheelQuestion = (chosenCard: VocabCard) => {
    if (!wheelCurrentCard || !wheelWonPrize) return;

    if (chosenCard.id === wheelCurrentCard.id) {
      playClassroomSfx('victory', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, wheelWonPrize.points);
      triggerCelebration();
      setBannerText(`🎉 Xuất sắc! ${nextTeamName(activeTeam)} nhận trọn vẹn ${wheelWonPrize.label}!`);
      setWheelCurrentCard(null);
      setWheelWonPrize(null);
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Tiếc quá, chưa đúng! Đổi lượt quay cho ${nextTeamName(nextTeam)}.`);
      setWheelCurrentCard(null);
      setWheelWonPrize(null);
    }
  };

  // ---------------- 8. WORD MAZE HANDLER ----------------
  const currentMazeCard = mazeQueue[mazeStep];

  const handleMazeAnswer = (chosenCard: VocabCard) => {
    if (!currentMazeCard || isFinished) return;

    if (chosenCard.id === currentMazeCard.id) {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, 10);
      const nextStep = mazeStep + 1;
      setMazeStep(nextStep);

      if (nextStep >= 5 || nextStep >= mazeQueue.length) {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        setBannerText(`🏆 Bạn Thỏ đã về đến Ngôi nhà cà rốt an toàn! ${nextTeamName(activeTeam)} chiến thắng!`);
      } else {
        setMazeOptions(buildOptionsForCard(mazeQueue[nextStep], poolCards, 3));
        setBannerText(`🐰 Thỏ nhảy thêm 1 bước! Tiến đến trạm ${nextStep + 1}/5 (+10 điểm).`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Gặp chướng ngại vật rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 9. WORD SORTING HANDLER ----------------
  const currentSortCard = sortQueue[sortIdx];

  const handleSortIntoBasket = (basket: 'A' | 'B') => {
    if (!currentSortCard || isFinished) return;

    let isCorrect = true;
    if (sortRule === 'alpha') {
      const firstLetter = currentSortCard.word.trim().toUpperCase()[0];
      const isFirstHalf = firstLetter >= 'A' && firstLetter <= 'M';
      isCorrect = (basket === 'A' && isFirstHalf) || (basket === 'B' && !isFirstHalf);
    } else {
      // Free classroom discussion mode: teacher & students sort words freely
      isCorrect = true;
    }

    if (isCorrect) {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      speakVocabulary(currentSortCard.word, {
        audioDataUrl: currentSortCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, 10);
      if (basket === 'A') setSortedBasketA((prev) => [...prev, currentSortCard]);
      else setSortedBasketB((prev) => [...prev, currentSortCard]);

      const nextIdx = sortIdx + 1;
      if (nextIdx >= sortQueue.length) {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        setBannerText(`🎉 Tuyệt đỉnh! Đã phân loại thành công toàn bộ kho từ vựng!`);
      } else {
        setSortIdx(nextIdx);
        const targetName = basket === 'A' ? basketAName : basketBName;
        setBannerText(`Đã đưa vào "${targetName}"! +10 điểm cho ${nextTeamName(activeTeam)}.`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      const firstLetter = currentSortCard.word.trim().toUpperCase()[0];
      setBannerText(`Nhầm giỏ rồi! Từ "${currentSortCard.word}" bắt đầu bằng chữ "${firstLetter}". Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 10. SPELL IT HANDLER ----------------
  const currentSpellCard = spellQueue[spellIdx];

  const handlePickSpellLetter = (letter: ScrambleLetter) => {
    if (letter.used || spellFeedback !== 'idle' || !currentSpellCard) return;

    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setSpellLetters((prev) => prev.map((l) => (l.id === letter.id ? { ...l, used: true } : l)));
    const nextBuilt = [...spellBuilt, letter];
    setSpellBuilt(nextBuilt);

    const cleanTarget = currentSpellCard.word.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (nextBuilt.length === cleanTarget.length) {
      const assembled = nextBuilt.map((l) => l.char).join('');
      if (assembled === cleanTarget) {
        setSpellFeedback('correct');
        playClassroomSfx('match', settings.soundEffectsEnabled);
        speakVocabulary(currentSpellCard.word, {
          audioDataUrl: currentSpellCard.audioDataUrl,
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
        awardPoints(activeTeam, 15);

        setTimeout(() => {
          const nextIdx = spellIdx + 1;
          if (nextIdx < spellQueue.length) {
            setSpellIdx(nextIdx);
            buildScrambleForCard(spellQueue[nextIdx]);
            setBannerText(`Chính xác! Đánh vần hoàn hảo: "${currentSpellCard.word}" (+15 điểm).`);
          } else {
            setIsFinished(true);
            triggerCelebration();
            playClassroomSfx('victory', settings.soundEffectsEnabled);
            setBannerText('Xuất sắc! Bé đã đánh vần đúng tất cả từ vựng!');
          }
        }, 1100);
      } else {
        setSpellFeedback('wrong');
        playClassroomSfx('wrong', settings.soundEffectsEnabled);
        setTimeout(() => {
          setSpellBuilt([]);
          setSpellLetters((prev) => prev.map((l) => ({ ...l, used: false })));
          setSpellFeedback('idle');
          const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
          setActiveTeam(nextTeam);
          setBannerText(`Chưa đúng trật tự! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
        }, 900);
      }
    }
  };

  // ---------------- 11. TABOO WORDS HANDLER ----------------
  const currentTabooCard = tabooQueue[tabooIdx];

  const handleTabooSuccess = () => {
    playClassroomSfx('victory', settings.soundEffectsEnabled);
    if (currentTabooCard) {
      speakVocabulary(currentTabooCard.word, {
        audioDataUrl: currentTabooCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
    }
    awardPoints(activeTeam, 20);
    triggerCelebration();

    const nextIdx = (tabooIdx + 1) % tabooQueue.length;
    setTabooIdx(nextIdx);
    setTabooTimer(30);
    setIsTabooTimerRunning(false);
    setBannerText(`🎉 Chúc mừng ${nextTeamName(activeTeam)} đoán đúng từ khóa (+20 điểm)!`);
  };

  const handleTabooSkip = () => {
    playClassroomSfx('wrong', settings.soundEffectsEnabled);
    const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
    setActiveTeam(nextTeam);
    const nextIdx = (tabooIdx + 1) % tabooQueue.length;
    setTabooIdx(nextIdx);
    setTabooTimer(30);
    setIsTabooTimerRunning(false);
    setBannerText(`Đã bỏ qua! Chuyển lượt sang ${nextTeamName(nextTeam)}.`);
  };

  // ---------------- 12. BUILD A SENTENCE HANDLER ----------------
  const currentSentenceCard = sentenceQueue[sentenceIdx];

  const handlePickSentenceWord = (wordObj: SentenceWord) => {
    if (wordObj.used || sentenceFeedback !== 'idle' || !currentSentenceCard) return;

    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setSentenceWords((prev) => prev.map((w) => (w.id === wordObj.id ? { ...w, used: true } : w)));
    const nextBuilt = [...builtSentence, wordObj];
    setBuiltSentence(nextBuilt);

    const rawSentence = currentSentenceCard.example.trim() || `This is a friendly ${currentSentenceCard.word}.`;
    const cleanTargetWords = rawSentence
      .replace(/[.,!?;:"'()]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    if (nextBuilt.length === cleanTargetWords.length) {
      const assembled = nextBuilt.map((w) => w.text.toLowerCase()).join(' ');
      const targetAssembled = cleanTargetWords.map((w) => w.toLowerCase()).join(' ');

      if (assembled === targetAssembled) {
        setSentenceFeedback('correct');
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        speakVocabulary(rawSentence, {
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
        awardPoints(activeTeam, 20);

        setTimeout(() => {
          const nextIdx = sentenceIdx + 1;
          if (nextIdx < sentenceQueue.length) {
            setSentenceIdx(nextIdx);
            buildSentenceForCard(sentenceQueue[nextIdx]);
            setBannerText(`Tuyệt đỉnh! Hoàn thành câu đúng ngữ pháp (+20 điểm).`);
          } else {
            setIsFinished(true);
            triggerCelebration();
            playClassroomSfx('victory', settings.soundEffectsEnabled);
            setBannerText('Chúc mừng! Đã ghép xong toàn bộ các câu trong bài học!');
          }
        }, 1400);
      } else {
        setSentenceFeedback('wrong');
        playClassroomSfx('wrong', settings.soundEffectsEnabled);
        setTimeout(() => {
          setBuiltSentence([]);
          setSentenceWords((prev) => prev.map((w) => ({ ...w, used: false })));
          setSentenceFeedback('idle');
          const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
          setActiveTeam(nextTeam);
          setBannerText(`Thứ tự từ chưa chính xác! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
        }, 1000);
      }
    }
  };

  // ---------------- 13. ESCAPE ROOM HANDLER ----------------
  const handleEscapeRoomAnswer = (chosenCard: VocabCard) => {
    if (!escapeCard || isFinished) return;

    if (chosenCard.id === escapeCard.id) {
      playClassroomSfx('star', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, 15);

      if (escapeRoomLevel === 1) {
        setEscapeRoomLevel(2);
        const nextCard = poolCards[1 % poolCards.length];
        setEscapeCard(nextCard);
        setEscapeOptions(buildOptionsForCard(nextCard, poolCards, 3));
        setBannerText(`🔓 Cửa 1 mở! Vào Phòng Mật Mã số 2: Giải mã tiếp để mở khóa!`);
      } else if (escapeRoomLevel === 2) {
        setEscapeRoomLevel(3);
        const nextCard = poolCards[2 % poolCards.length];
        setEscapeCard(nextCard);
        setEscapeOptions(buildOptionsForCard(nextCard, poolCards, 3));
        setBannerText(`🔓 Cửa 2 mở! Bước vào Phòng Kho Báu cuối cùng: Giành Chìa Khóa Vàng 🗝️!`);
      } else {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        awardPoints(activeTeam, 30);
        setBannerText(`🏆 CHIẾN THẮNG ESCAPE ROOM! ${nextTeamName(activeTeam)} đã mở toang Kho Báu Cúp Vàng!`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Mật mã sai! Cửa chưa mở, đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 14. MEMORY FLIP HANDLER ----------------
  const handleMemoryTileClick = (tile: MemoryTile) => {
    if (lockBoard || tile.matchedBy || flippedUids.includes(tile.uid)) return;

    playClassroomSfx('flip', settings.soundEffectsEnabled);
    if (tile.kind === 'word') {
      speakVocabulary(tile.label, {
        audioDataUrl: tile.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
    }

    const nextFlipped = [...flippedUids, tile.uid];
    setFlippedUids(nextFlipped);

    if (nextFlipped.length === 2) {
      setLockBoard(true);
      const first = memoryTiles.find((t) => t.uid === nextFlipped[0]);
      const second = memoryTiles.find((t) => t.uid === nextFlipped[1]);

      if (first && second && first.cardId === second.cardId && first.kind !== second.kind) {
        playClassroomSfx('match', settings.soundEffectsEnabled);
        awardPoints(activeTeam, 10);
        setMemoryTiles((prev) =>
          prev.map((t) =>
            t.uid === first.uid || t.uid === second.uid ? { ...t, matchedBy: activeTeam } : t
          )
        );
        setFlippedUids([]);
        setLockBoard(false);

        const remaining = memoryTiles.filter(
          (t) => t.uid !== first.uid && t.uid !== second.uid && !t.matchedBy
        );
        if (remaining.length === 0) {
          setIsFinished(true);
          triggerCelebration();
          playClassroomSfx('victory', settings.soundEffectsEnabled);
          setBannerText('Tuyệt vời! Đã lật mở toàn bộ các cặp bài.');
        } else {
          setBannerText(`Khớp chính xác! +10 điểm cho ${nextTeamName(activeTeam)}.`);
        }
      } else {
        playClassroomSfx('wrong', settings.soundEffectsEnabled);
        setTimeout(() => {
          setFlippedUids([]);
          setLockBoard(false);
          const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
          setActiveTeam(nextTeam);
          setBannerText(`Chưa khớp rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
        }, 900);
      }
    }
  };

  // ---------------- 15. QUIZLET LIVE HANDLER ----------------
  const handleTeamRaceAnswer = (chosenCard: VocabCard) => {
    if (!teamRaceCurrentCard || isFinished) return;
    const currentSquad = teamRaceSquads[activeSquadIdx];
    if (chosenCard.id === teamRaceCurrentCard.id) {
      playClassroomSfx('star', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      const newScore = currentSquad.score + 1;
      const updated = teamRaceSquads.map((s, idx) => (idx === activeSquadIdx ? { ...s, score: newScore } : s));
      setTeamRaceSquads(updated);
      awardPoints(activeTeam, 10);

      if (newScore >= 10) {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        setBannerText(`🏆 ĐỘI ${currentSquad.name.toUpperCase()} ${currentSquad.avatar} ĐÃ ĐẠT 10 ĐIỂM VÀ GIÀNH CHIẾN THẮNG CHUNG CUỘC!`);
      } else {
        const nextSquadIdx = (activeSquadIdx + 1) % teamRaceSquadCount;
        setActiveSquadIdx(nextSquadIdx);
        const shuffled = shuffleArray(poolCards);
        const nextTarget = shuffled[0] || poolCards[0];
        setTeamRaceCurrentCard(nextTarget);
        if (nextTarget) {
          setTeamRaceChoices(buildOptionsForCard(nextTarget, poolCards, 4));
        }
        setBannerText(`Chính xác! ${currentSquad.name} tiến thêm 1 bước (+10 điểm). Tiếp theo: ${updated[nextSquadIdx].name} ${updated[nextSquadIdx].avatar}!`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const updated = teamRaceSquads.map((s, idx) => (idx === activeSquadIdx ? { ...s, score: Math.max(0, s.score - 1) } : s));
      setTeamRaceSquads(updated);
      const nextSquadIdx = (activeSquadIdx + 1) % teamRaceSquads.length;
      setActiveSquadIdx(nextSquadIdx);
      setBannerText(`Chưa đúng! ${currentSquad.name} bị chững lại. Lượt tiếp theo chuyển sang ${updated[nextSquadIdx].name}!`);
    }
  };

  // ---------------- 16. GIMKIT HANDLER ----------------
  const handleGimkitAnswer = (chosenCard: VocabCard) => {
    if (!gimkitCurrentCard || isFinished) return;
    if (chosenCard.id === gimkitCurrentCard.id) {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      awardPoints(activeTeam, 20);
      const nextEnergy = gimkitEnergy + 25;
      if (nextEnergy >= 100) {
        const nextKeys = gimkitKeys + 1;
        setGimkitKeys(nextKeys);
        setGimkitEnergy(0);
        if (nextKeys >= 3) {
          setIsFinished(true);
          triggerCelebration();
          playClassroomSfx('victory', settings.soundEffectsEnabled);
          setBannerText('🚀 CẢ LỚP ĐÃ MỞ KHÓA THÀNH CÔNG KHOANG THOÁT HIỂM ESCAPE POD VÀ THOÁT KHỎI TÀU VŨ TRỤ AN TOÀN!');
          return;
        } else {
          setGimkitRoomIndex((r) => Math.min(3, r + 1));
          setBannerText(`Năng lượng đạt 100%! Nhận được 1 Chìa khóa cứu hộ 🔑 (${nextKeys}/3 chìa)! Tiến vào khoang tiếp theo.`);
        }
      } else {
        setGimkitEnergy(nextEnergy);
        setBannerText(`Chính xác! Tàu nạp thêm +25% năng lượng ⚡ (Hiện tại: ${nextEnergy}%).`);
      }
      const shuffled = shuffleArray(poolCards);
      const nextTarget = shuffled[0] || poolCards[0];
      setGimkitCurrentCard(nextTarget);
      if (nextTarget) {
        setGimkitChoices(buildOptionsForCard(nextTarget, poolCards, 4));
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      setGimkitShield((s) => Math.max(20, s - 20));
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Cảnh báo! Sinh vật lạ tấn công, khiên chắn giảm 20%! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- 17. SURVEY GAME SHOW (FAMILY FEUD) HANDLERS ----------------
  const triggerSurveyStrikeFlash = (strikeNum: number) => {
    setSurveyStrikeFlash(strikeNum);
    setTimeout(() => {
      setSurveyStrikeFlash(null);
    }, 900);
  };

  const handleRevealSurveySlot = (slot: SurveyAnswerSlot) => {
    if (slot.isRevealed) {
      setSurveyModalCard(slot.card);
      speakVocabulary(slot.card.word, {
        audioDataUrl: slot.card.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      return;
    }

    playClassroomSfx('star', settings.soundEffectsEnabled);
    speakVocabulary(slot.card.word, {
      audioDataUrl: slot.card.audioDataUrl,
      rate: settings.speechRate,
      accent: settings.voiceAccent,
    });

    const newBank = surveyRoundBank + slot.points;
    setSurveyRoundBank(newBank);

    const updatedSlots = surveySlots.map((s) => (s.id === slot.id ? { ...s, isRevealed: true } : s));
    setSurveySlots(updatedSlots);

    // Case 1: In STEAL MODE -> opponent guessed correctly!
    if (surveyStealMode) {
      playClassroomSfx('victory', settings.soundEffectsEnabled);
      triggerCelebration();
      const currentActiveTeam = surveyTeams[surveyActiveTeamIdx];
      setSurveyTeams((prev) =>
        prev.map((t, idx) => (idx === surveyActiveTeamIdx ? { ...t, score: t.score + newBank } : t))
      );
      setSurveyRoundWinner(
        `🎉 CƯỚP ĐIỂM THÀNH CÔNG! ${currentActiveTeam.name} đã đoán trúng #${slot.rank} (${slot.card.word}) và giành trọn +${newBank} điểm!`
      );
      setBannerText(
        `🎉 CƯỚP ĐIỂM THÀNH CÔNG! ${currentActiveTeam.name} giành trọn ${newBank} điểm! Bấm "Vòng Tiếp Theo" để sang vòng mới.`
      );
      return;
    }

    // Case 2: Normal Play -> check if all 6 slats are revealed
    const unrevealed = updatedSlots.filter((s) => !s.isRevealed);
    if (unrevealed.length === 0) {
      playClassroomSfx('victory', settings.soundEffectsEnabled);
      triggerCelebration();
      const currentActiveTeam = surveyTeams[surveyActiveTeamIdx];
      setSurveyTeams((prev) =>
        prev.map((t, idx) => (idx === surveyActiveTeamIdx ? { ...t, score: t.score + newBank } : t))
      );
      setSurveyRoundWinner(
        `🌟 XUẤT SẮC! Bảng khảo sát đã mở hết 6 đáp án! ${currentActiveTeam.name} giành trọn +${newBank} điểm!`
      );
      setBannerText(
        `Chúc mừng ${currentActiveTeam.name} mở trọn vẹn 6 đáp án (+${newBank}đ)! Bấm "Vòng Tiếp Theo" để tiếp tục.`
      );
      return;
    }

    // Rotate turn to next team
    const nextIdx = (surveyActiveTeamIdx + 1) % surveyTeamCount;
    setSurveyActiveTeamIdx(nextIdx);
    setBannerText(
      `Chính xác: #${slot.rank} ${slot.card.word} (+${slot.points}đ). Quỹ thưởng vòng: ${newBank}đ. Đến lượt ${surveyTeams[nextIdx]?.name} trả lời!`
    );
  };

  const handleSurveyStrike = () => {
    playClassroomSfx('wrong', settings.soundEffectsEnabled);

    // If already in STEAL mode: Opponent missed their 1 chance!
    if (surveyStealMode) {
      triggerSurveyStrikeFlash(3);
      playClassroomSfx('victory', settings.soundEffectsEnabled);
      const originalTeam = surveyTeams[surveyOriginalTeamIdx];
      // Original team keeps the bank!
      setSurveyTeams((prev) =>
        prev.map((t, idx) => (idx === surveyOriginalTeamIdx ? { ...t, score: t.score + surveyRoundBank } : t))
      );
      setSurveyRoundWinner(
        `❌ CƯỚP ĐIỂM THẤT BẠI! ${surveyTeams[surveyActiveTeamIdx]?.name} đoán chưa trúng. ${originalTeam.name} bảo toàn trọn vẹn +${surveyRoundBank} điểm!`
      );
      setBannerText(
        `Cướp điểm thất bại! ${originalTeam.name} giữ toàn bộ ${surveyRoundBank} điểm vòng này. Bấm "Vòng Tiếp Theo" để tiếp tục!`
      );
      return;
    }

    // Normal play: increment strike
    const nextStrikes = surveyStrikes + 1;
    setSurveyStrikes(nextStrikes);
    triggerSurveyStrikeFlash(nextStrikes);

    if (nextStrikes >= 3) {
      setSurveyStealMode(true);
      setSurveyOriginalTeamIdx(surveyActiveTeamIdx);
      const opponentIdx = (surveyActiveTeamIdx + 1) % surveyTeamCount;
      setSurveyActiveTeamIdx(opponentIdx);
      setBannerText(
        `🚨 ĐÃ ĐẠT 3 LỖI! Cơ hội cướp điểm (STEAL) DUY NHẤT cho ${surveyTeams[opponentIdx]?.name}! Hãy đoán 1 đáp án còn ẩn trên bảng!`
      );
    } else {
      const nextIdx = (surveyActiveTeamIdx + 1) % surveyTeamCount;
      setSurveyActiveTeamIdx(nextIdx);
      setBannerText(
        `❌ Báo lỗi (Strike ${nextStrikes}/3)! Chuyển lượt trả lời sang ${surveyTeams[nextIdx]?.name}!`
      );
    }
  };

  const handleNextSurveyRound = () => {
    const nextRound = surveyRoundNumber + 1;
    setSurveyRoundNumber(nextRound);
    setSurveyStrikes(0);
    setSurveyRoundBank(0);
    setSurveyStealMode(false);
    setSurveyRoundWinner(null);
    setSurveyStrikeFlash(null);
    setSurveyModalCard(null);

    const nextStartTeamIdx = (nextRound - 1) % surveyTeamCount;
    setSurveyActiveTeamIdx(nextStartTeamIdx);
    setSurveyOriginalTeamIdx(nextStartTeamIdx);

    const shuffled = shuffleArray(poolCards);
    const POINTS = [35, 25, 18, 12, 8, 5];
    const slots: SurveyAnswerSlot[] = [];
    for (let i = 0; i < 6; i++) {
      const card = shuffled[i] || poolCards[i % Math.max(1, poolCards.length)] || {
        id: `survey-fallback-${nextRound}-${i}`,
        word: `Word ${i + 1}`,
        meaning: `Nghĩa từ ${i + 1}`,
        category: 'Vocabulary',
      };
      slots.push({
        id: `survey-slot-${nextRound}-${i}`,
        rank: i + 1,
        points: POINTS[i],
        card,
        isRevealed: false,
      });
    }
    setSurveySlots(slots);
    const nextPreset = DEFAULT_SURVEY_PRESETS[(nextRound - 1) % DEFAULT_SURVEY_PRESETS.length];
    setSurveyQuestion(nextPreset);
    setBannerText(`Survey Game Show - Vòng ${nextRound}: Lượt mở màn của ${surveyTeams[nextStartTeamIdx]?.name}!`);
  };

  const handleRevealAllSurveySlots = () => {
    playClassroomSfx('star', settings.soundEffectsEnabled);
    setSurveySlots((prev) => prev.map((s) => ({ ...s, isRevealed: true })));
    setBannerText('Đã lật mở toàn bộ 6 đáp án! Thầy cô và cả lớp cùng luyện đọc và ôn từ vựng.');
  };

  const handleManualAdjustSurveyScore = (teamIdx: number, delta: number) => {
    setSurveyTeams((prev) =>
      prev.map((t, idx) => (idx === teamIdx ? { ...t, score: Math.max(0, t.score + delta) } : t))
    );
  };

  const handleUpdateSurveyTeamName = (teamIdx: number, newName: string) => {
    setSurveyTeams((prev) =>
      prev.map((t, idx) => (idx === teamIdx ? { ...t, name: newName.trim() || t.name } : t))
    );
    setEditingSurveyTeamIdx(null);
  };

  // ---------------- 18. TILE PUZZLE HANDLERS ----------------
  const handleRotatePuzzleTile = (idx: number) => {
    playClassroomSfx('flip', settings.soundEffectsEnabled);
    const updated = puzzleTiles.map((tile, i) => {
      if (i === idx) {
        const nextRot = (tile.rotation + 90) % 360;
        return { ...tile, rotation: nextRot };
      }
      return tile;
    });
    setPuzzleTiles(updated);

    const allAligned = updated.every((t) => t.rotation === 0);
    if (allAligned) {
      setIsFinished(true);
      triggerCelebration();
      playClassroomSfx('victory', settings.soundEffectsEnabled);
      awardPoints(activeTeam, 30);
      setBannerText(`Ghép mảnh hoàn hảo! Cả 4 ô vuông đã khớp đúng góc 0° (+30 điểm cho ${nextTeamName(activeTeam)})!`);
    }
  };

  const handleSwapPuzzleTile = (idx: number) => {
    if (selectedPuzzleIdx === null) {
      setSelectedPuzzleIdx(idx);
      playClassroomSfx('flip', settings.soundEffectsEnabled);
    } else if (selectedPuzzleIdx === idx) {
      setSelectedPuzzleIdx(null);
    } else {
      playClassroomSfx('match', settings.soundEffectsEnabled);
      const updated = [...puzzleTiles];
      const temp = updated[selectedPuzzleIdx];
      updated[selectedPuzzleIdx] = updated[idx];
      updated[idx] = temp;
      setPuzzleTiles(updated);
      setSelectedPuzzleIdx(null);
      setBannerText('Đã hoán đổi vị trí 2 mảnh ghép!');
    }
  };

  // ---------------- 19. ASTERQUIZ HANDLER ----------------
  const handleAsterQuizAnswer = (chosenCard: VocabCard) => {
    if (!asterCurrentCard || isFinished) return;
    if (chosenCard.id === asterCurrentCard.id) {
      playClassroomSfx('pop', settings.soundEffectsEnabled);
      speakVocabulary(chosenCard.word, {
        audioDataUrl: chosenCard.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
      setAsterLaserActive(activeTeam);
      setTimeout(() => setAsterLaserActive(null), 600);

      let won = false;
      if (activeTeam === 'A') {
        const nextPos = asterPosA + 1;
        setAsterPosA(nextPos);
        awardPoints('A', 20);
        if (nextPos >= 5) won = true;
      } else {
        const nextPos = asterPosB + 1;
        setAsterPosB(nextPos);
        awardPoints('B', 20);
        if (nextPos >= 5) won = true;
      }

      if (won) {
        setIsFinished(true);
        triggerCelebration();
        playClassroomSfx('victory', settings.soundEffectsEnabled);
        setBannerText(`🚀 PHI THUYỀN ${nextTeamName(activeTeam).toUpperCase()} ĐÃ PHÁ VỠ MỌI THIÊN THẠCH VÀ ĐÁP XUỐNG TRẠM KHÔNG GIAN ĐẦU TIÊN!`);
      } else {
        const shuffled = shuffleArray(poolCards);
        const nextTarget = shuffled[0] || poolCards[0];
        setAsterCurrentCard(nextTarget);
        if (nextTarget) {
          setAsterChoices(buildOptionsForCard(nextTarget, poolCards, 3));
        }
        setBannerText(`Bắn hạ thiên thạch thành công! Phi thuyền ${nextTeamName(activeTeam)} tăng tốc tiến về phía trước (+20 điểm)!`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Bắn trượt thiên thạch! Chuyển quyền điều khiển phi thuyền sang ${nextTeamName(nextTeam)}.`);
    }
  };

  const ALL_GAMES: { id: GameKind; number: string; title: string; subtitle: string; icon: string }[] = [
    { id: 'bubble', number: '1', title: 'Bubble Pop', subtitle: 'Bắn Bong Bóng / Trái Cây', icon: '🎈' },
    { id: 'race', number: '2', title: 'Grand Prix', subtitle: 'Đua Xe Đội A vs Đội B', icon: '🏎️' },
    { id: 'scramble', number: '3', title: 'Scramble', subtitle: 'Ghép Chữ Xáo Trộn', icon: '🧩' },
    { id: 'match', number: '4', title: 'Picture Matching', subtitle: 'Nối Tranh Siêu Tốc', icon: '🖼️' },
    { id: 'mystery', number: '5', title: 'Mystery Box', subtitle: 'Hộp Quà Bí Mật', icon: '🎁' },
    { id: 'missing', number: '6', title: "What's Missing?", subtitle: 'Bức Tranh Biến Mất', icon: '❓' },
    { id: 'wheel', number: '7', title: 'Spin the Wheel', subtitle: 'Vòng Quay May Mắn', icon: '🎡' },
    { id: 'maze', number: '8', title: 'Word Maze', subtitle: 'Mê Cung Từ Vựng', icon: '🐰' },
    { id: 'sorting', number: '9', title: 'Word Sorting', subtitle: 'Phân Loại Từ Vựng', icon: '🧺' },
    { id: 'spell', number: '10', title: 'Spell It!', subtitle: 'Thử Tài Đánh Vần', icon: '🔤' },
    { id: 'taboo', number: '11', title: 'Taboo Words', subtitle: 'Đoán Từ Cấm', icon: '🚫' },
    { id: 'sentence', number: '12', title: 'Build Sentence', subtitle: 'Xếp Từ Thành Câu', icon: '📝' },
    { id: 'escape', number: '13', title: 'Escape Room', subtitle: 'Phòng Thoát Hiểm', icon: '🗝️' },
    { id: 'memory', number: '14', title: 'Memory Cards', subtitle: 'Lật Bài Trí Nhớ', icon: '🃏' },
    { id: 'team-race', number: '15', title: 'Quizlet Live Race', subtitle: 'Đua Đội Thú Cưng', icon: '🏁' },
    { id: 'gimkit-escape', number: '16', title: 'Gimkit One Way Out', subtitle: 'Tàu Vũ Trụ Sinh Tồn', icon: '👾' },
    { id: 'survey-slam', number: '17', title: 'Survey Game Show', subtitle: 'Đấu Trường Gameshow', icon: '📺' },
    { id: 'tile-puzzle', number: '18', title: 'Tile Puzzle', subtitle: 'Mảnh Ghép Xoay', icon: '🔲' },
    { id: 'aster-quiz', number: '19', title: 'AsterQuiz Space', subtitle: 'Bắn Thiên Thạch', icon: '🚀' },
  ];

  return (
    <div
      ref={gameContainerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-900 text-slate-100 p-4 md:p-8 space-y-6 backdrop-blur-xl'
          : 'space-y-6'
      }
    >
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500 font-medium">
            Bộ 19 Trò Chơi Tương Tác Lớp Học (Versus Mode) · Thi Đấu Hai Đội Trên Màn Hình Máy Chiếu
          </p>
          <h1 className="mt-1 font-display font-bold text-3xl lg:text-4xl tracking-tight text-slate-900">
            Sân Đấu Trò Chơi Từ Vựng
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Deck select */}
          <select
            value={useAllDecks ? 'ALL' : selectedDeckId}
            onChange={(e) => {
              if (e.target.value === 'ALL') setUseAllDecks(true);
              else {
                setUseAllDecks(false);
                onSelectDeck(e.target.value);
              }
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">🌟 Tất cả chủ đề ({cards.length} từ)</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({cards.filter((c) => c.deckId === d.id).length} từ)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onUpdateSettings({ soundEffectsEnabled: !settings.soundEffectsEnabled })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            {settings.soundEffectsEnabled ? (
              <Volume2 className="w-4 h-4 text-[#15803d]" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            {settings.soundEffectsEnabled ? 'Âm thanh: Bật' : 'Tắt âm'}
          </button>

          <button
            type="button"
            onClick={resetCurrentGame}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Chơi lại
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs ${
              isFullscreen
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black ring-2 ring-amber-300'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            title={isFullscreen ? 'Thoát toàn màn hình (ESC)' : 'Mở toàn màn hình sân đấu cho máy chiếu'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-4 h-4" />
                <span>✕ Thu nhỏ (ESC)</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4 text-emerald-700" />
                <span>⛶ Toàn màn hình</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* GAME SELECTOR: SLIDER / GRID VIEW WITH SMOOTH SCROLL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Danh sách 19 Trò chơi lớp học (Đang chọn: {ALL_GAMES.find((g) => g.id === gameKind)?.title}):
          </span>

          <div className="flex items-center gap-1.5">
            {/* Scroll Navigation Buttons for Slider Mode */}
            {gameMenuMode === 'slider' && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  type="button"
                  onClick={() => scrollNav('left')}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs cursor-pointer"
                  title="Cuộn sang trái"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollNav('right')}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-2xs cursor-pointer"
                  title="Cuộn sang phải"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Toggle View Mode Button */}
            <button
              type="button"
              onClick={() => setGameMenuMode(gameMenuMode === 'slider' ? 'grid' : 'slider')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs cursor-pointer"
            >
              {gameMenuMode === 'slider' ? (
                <>
                  <Grid className="w-3.5 h-3.5 text-emerald-700" />
                  <span>⊞ Mở tất cả (Dạng lưới)</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                  <span>↔️ Dạng thanh trượt</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* View Mode 1: SLIDER WITH VISIBLE STYLED SCROLLBAR */}
        {gameMenuMode === 'slider' ? (
          <div className="relative p-2.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
            <div
              ref={scrollNavRef}
              className="flex items-center gap-2 overflow-x-auto pb-2 scroll-smooth cursor-grab active:cursor-grabbing"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#10B981 #E2E8F0',
              }}
            >
              {ALL_GAMES.map((tab) => {
                const isActive = gameKind === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGameKind(tab.id)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xs scale-102 ring-2 ring-emerald-500/30'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <span className="text-base">{tab.icon}</span>
                    <div className="text-left">
                      <div className="leading-tight">{tab.number}. {tab.title}</div>
                      <div className={`text-[10px] font-normal ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {tab.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* View Mode 2: EXPANDED GRID VIEW (ALL 14 GAMES VISIBLE AT ONCE) */
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2.5">
              {ALL_GAMES.map((tab) => {
                const isActive = gameKind === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setGameKind(tab.id);
                      setGameMenuMode('slider');
                    }}
                    className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer shadow-2xs border ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{tab.icon}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        #{tab.number}
                      </span>
                    </div>
                    <div>
                      <div className="font-extrabold text-xs leading-snug">{tab.title}</div>
                      <div className={`text-[10px] line-clamp-1 ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {tab.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Versus Scoreboard */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 lg:p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Team A Card */}
          <button
            type="button"
            onClick={() => setActiveTeam('A')}
            className={`md:col-span-4 p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer group relative ${
              activeTeam === 'A'
                ? 'border-[#0284C7] bg-[#0284C7]/10 ring-2 ring-[#0284C7]/20 shadow-md'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 border-2 border-sky-300 flex items-center justify-center text-3xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                {teamAAvatar}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#0284C7] truncate">
                    {teamAName}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTeamModalOpen(true);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-[#0284C7] hover:bg-white/80 transition-colors shrink-0"
                    title="Đổi tên & Avatar Đội A"
                  >
                    ✏️
                  </button>
                </div>
                {activeTeam === 'A' ? (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] bg-[#0284C7] text-white font-bold animate-pulse">
                    ⭐ Đang đến lượt!
                  </span>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">Bấm để chọn lượt</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-display font-black text-3xl lg:text-4xl text-[#0284C7] tabular-nums">
                {scoreA}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1">đ</span>
            </div>
          </button>

          {/* VS Center Banner & Controls */}
          <div className="md:col-span-4 text-center px-2 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black tracking-widest shadow-2xs">
                <span>⚔️ VERSUS MODE ⚔️</span>
              </div>

              {/* Toggle Vietnamese Meaning for ALL 19 Games */}
              <button
                type="button"
                onClick={handleToggleVietnamese}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer ${
                  showVietnamese
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
                title="Bật/Tắt hiển thị nghĩa tiếng Việt trong từ vựng của tất cả 19 trò chơi"
              >
                <span>🇻🇳</span>
                <span>Tiếng Việt: {showVietnamese ? 'BẬT' : 'TẮT'}</span>
              </button>

              {/* Quick Edit Both Teams Button */}
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(true)}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Tự đặt tên & ảnh đại diện (Avatar) cho 2 đội"
              >
                <span>👥</span>
                <span>Đổi 2 Đội</span>
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer shadow-2xs"
                title={isFullscreen ? 'Thu nhỏ (ESC)' : 'Mở toàn màn hình sân đấu'}
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-600" /> : <Maximize className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>

            <p className="text-xs font-medium text-slate-700 line-clamp-2 min-h-[30px] flex items-center justify-center">
              {bannerText}
            </p>
          </div>

          {/* Team B Card */}
          <button
            type="button"
            onClick={() => setActiveTeam('B')}
            className={`md:col-span-4 p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer group relative ${
              activeTeam === 'B'
                ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20 shadow-md'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border-2 border-rose-300 flex items-center justify-center text-3xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                {teamBAvatar}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-rose-600 truncate">
                    {teamBName}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTeamModalOpen(true);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-white/80 transition-colors shrink-0"
                    title="Đổi tên & Avatar Đội B"
                  >
                    ✏️
                  </button>
                </div>
                {activeTeam === 'B' ? (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                    ⭐ Đang đến lượt!
                  </span>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">Bấm để chọn lượt</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-display font-black text-3xl lg:text-4xl text-rose-600 tabular-nums">
                {scoreB}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1">đ</span>
            </div>
          </button>
        </div>
      </section>

      {/* Team Customization Modal */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl border-4 border-indigo-500 p-6 max-w-xl w-full text-slate-900 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setIsTeamModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
              title="Đóng (✕)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                ⚙️ Cài Đặt Đội Thi Đấu
              </span>
              <h3 className="font-display font-black text-2xl text-slate-900">
                Tự Đặt Tên Đội & Chọn Ảnh Đại Diện
              </h3>
              <p className="text-xs text-slate-500">
                Tùy chỉnh tên và biểu tượng đại diện áp dụng đồng bộ cho toàn bộ 19 trò chơi
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Team A Setup */}
              <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-300 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl p-1 rounded-xl bg-white shadow-2xs">{tempAvatarA}</span>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-700">Đội A (Xanh)</span>
                    <h4 className="font-extrabold text-sm text-slate-900 truncate">{tempNameA}</h4>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Tên Đội A:</label>
                  <input
                    type="text"
                    value={tempNameA}
                    onChange={(e) => setTempNameA(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-sky-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="VD: Đội Sư Tử, Team Blue..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Chọn Avatar Đội A:</label>
                  <div className="grid grid-cols-6 gap-1.5 bg-white/80 p-2 rounded-xl border border-sky-200">
                    {AVATAR_PRESETS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setTempAvatarA(av)}
                        className={`text-xl p-1.5 rounded-lg transition-transform cursor-pointer flex items-center justify-center ${
                          tempAvatarA === av
                            ? 'bg-sky-500 text-white shadow-md scale-110 ring-2 ring-sky-300'
                            : 'hover:bg-sky-100 hover:scale-105'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Team B Setup */}
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl p-1 rounded-xl bg-white shadow-2xs">{tempAvatarB}</span>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">Đội B (Cam/Đỏ)</span>
                    <h4 className="font-extrabold text-sm text-slate-900 truncate">{tempNameB}</h4>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Tên Đội B:</label>
                  <input
                    type="text"
                    value={tempNameB}
                    onChange={(e) => setTempNameB(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-rose-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="VD: Đội Hổ Vàng, Team Red..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Chọn Avatar Đội B:</label>
                  <div className="grid grid-cols-6 gap-1.5 bg-white/80 p-2 rounded-xl border border-rose-200">
                    {AVATAR_PRESETS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setTempAvatarB(av)}
                        className={`text-xl p-1.5 rounded-lg transition-transform cursor-pointer flex items-center justify-center ${
                          tempAvatarB === av
                            ? 'bg-rose-500 text-white shadow-md scale-110 ring-2 ring-rose-300'
                            : 'hover:bg-rose-100 hover:scale-105'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSaveTeams(tempNameA, tempAvatarA, tempNameB, tempAvatarB)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu Cấu Hình 2 Đội</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME ARENA */}
      <main className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[440px] flex flex-col justify-center">

        {/* ---------------- 1. BUBBLE POP / THU HOẠCH TRÁI CÂY ---------------- */}
        {gameKind === 'bubble' && currentBubbleTarget && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {/* Top Bar with Audio, Word Letters Toggle & Theme Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-pink-50/80 border border-pink-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePlayCurrentBubbleAudio}
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 animate-bounce" />
                  <span>🔊 Bấm để nghe lại phát âm</span>
                </button>
                <span className="text-xs font-bold text-pink-950">
                  Từ #{bubbleIdx + 1}/{bubbleQueue.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Letters Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowBubbleLetters(!showBubbleLetters)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ${
                    showBubbleLetters
                      ? 'bg-pink-600 text-white hover:bg-pink-700'
                      : 'bg-white border border-pink-300 text-pink-700 hover:bg-pink-50'
                  }`}
                  title="Bật/Tắt hiển thị chữ tiếng Anh dưới ảnh trong bong bóng"
                >
                  <span>🔤</span>
                  <span>Chữ từ vựng: {showBubbleLetters ? 'BẬT' : 'TẮT'}</span>
                </button>

                {/* Theme Toggle: Bong bóng hồng vs Trái cây */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-white border border-pink-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setBubbleTheme('bubble')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      bubbleTheme === 'bubble' ? 'bg-pink-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    🎈 Bong bóng hồng
                  </button>
                  <button
                    type="button"
                    onClick={() => setBubbleTheme('fruit')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      bubbleTheme === 'fruit' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    🍎 Thu hoạch trái cây
                  </button>
                </div>
              </div>
            </div>

            {/* Floating Pink Spherical Bubbles / Fruits Stage */}
            <div className="relative min-h-[340px] sm:min-h-[400px] rounded-3xl bg-gradient-to-b from-pink-100/70 via-rose-50/50 to-indigo-50/60 border-2 border-pink-200 p-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8 overflow-hidden shadow-inner">
              {/* Floating ambient decorative particles */}
              <div className="absolute top-6 left-8 w-12 h-12 rounded-full bg-pink-300/25 border border-pink-300/40 pointer-events-none animate-pulse" />
              <div className="absolute bottom-8 right-12 w-16 h-16 rounded-full bg-rose-300/25 border border-rose-300/40 pointer-events-none animate-bounce" style={{ animationDuration: '4s' }} />
              <div className="absolute top-1/2 left-1/4 w-8 h-8 rounded-full bg-pink-200/30 pointer-events-none" />

              {bubbleChoices.map((card, i) => {
                const isPopped = poppedIds.includes(card.id);
                const floatDelays = ['0s', '0.4s', '0.8s', '1.2s', '0.6s'];
                const fruits = ['🍎', '🍊', '🍓', '🍇', '🍉'];
                const fruitEmoji = fruits[i % fruits.length];

                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={isPopped}
                    onClick={() => handleBubbleClick(card)}
                    className={`relative rounded-full transition-all flex flex-col items-center justify-center cursor-pointer shadow-lg group select-none ${
                      isPopped
                        ? 'scale-0 opacity-0 transition-all duration-300 pointer-events-none'
                        : bubbleTheme === 'bubble'
                        ? 'w-40 h-40 sm:w-48 sm:h-48 bg-gradient-to-tr from-pink-500/80 via-rose-200/90 to-pink-300/80 border-4 border-pink-300 shadow-[0_12px_30px_rgba(244,114,182,0.45),inset_0_0_25px_rgba(255,255,255,0.9)] hover:scale-110 hover:shadow-[0_16px_40px_rgba(244,114,182,0.65),inset_0_0_30px_rgba(255,255,255,0.95)] active:scale-95'
                        : 'w-40 h-40 sm:w-48 sm:h-48 bg-gradient-to-tr from-emerald-100 via-white to-amber-100 border-4 border-emerald-300 shadow-[0_10px_25px_rgba(16,185,129,0.35),inset_0_0_20px_rgba(255,255,255,0.8)] hover:scale-110 active:scale-95'
                    }`}
                    style={{
                      animation: isPopped ? 'none' : `bounce 2.8s ease-in-out infinite alternate ${floatDelays[i % floatDelays.length]}`,
                    }}
                    title={card.word}
                  >
                    {/* Pink Bubble Specular Glass Reflections */}
                    {bubbleTheme === 'bubble' && (
                      <>
                        <div className="absolute top-4 left-5 w-8 h-4 rounded-full bg-white/80 rotate-[-30deg] pointer-events-none shadow-xs" />
                        <div className="absolute bottom-4 right-6 w-4 h-2 rounded-full bg-white/40 rotate-[45deg] pointer-events-none" />
                      </>
                    )}

                    {bubbleTheme === 'fruit' && (
                      <span className="text-xl sm:text-2xl mb-1">{fruitEmoji}</span>
                    )}

                    {/* Image Container inside spherical bubble */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/95 p-2 flex items-center justify-center overflow-hidden border border-pink-200/70 shadow-inner group-hover:scale-105 transition-transform">
                      <ResilientImage
                        src={card.imageDataUrl}
                        alt={card.word}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* English Word (Letters) - ONLY rendered when showBubbleLetters is ON */}
                    {showBubbleLetters && (
                      <span className="mt-1 px-3 py-0.5 rounded-full text-xs font-black bg-white/95 text-pink-700 shadow-xs uppercase tracking-wide truncate max-w-[85%] border border-pink-200">
                        {card.word}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- 2. GRAND PRIX RACE ARENA ---------------- */}
        {gameKind === 'race' && currentRaceTarget && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {/* Dual Racetrack */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-4 shadow-md">
              {/* Lane A */}
              <div>
                <div className="flex justify-between text-xs font-bold text-sky-300 mb-1">
                  <span>🏎️ {teamAAvatar} {teamAName}</span>
                  <span>{racePosA * 20}% Về đích</span>
                </div>
                <div className="h-10 bg-slate-800 rounded-xl relative overflow-hidden flex items-center px-2 border border-slate-700">
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-repeating-linear-gradient-45 from-white from-[0] to-black to-[10px] opacity-40" />
                  <div
                    className="absolute transition-all duration-500 ease-out flex items-center gap-1"
                    style={{ left: `calc(${racePosA * 18}% + 4px)` }}
                  >
                    <span className="text-2xl sm:text-3xl">{teamAAvatar}</span>
                    <span className="text-[10px] font-bold bg-[#0284C7] px-1.5 py-0.5 rounded text-white shadow">
                      A
                    </span>
                  </div>
                </div>
              </div>

              {/* Lane B */}
              <div>
                <div className="flex justify-between text-xs font-bold text-rose-300 mb-1">
                  <span>🏎️ {teamBAvatar} {teamBName}</span>
                  <span>{racePosB * 20}% Về đích</span>
                </div>
                <div className="h-10 bg-slate-800 rounded-xl relative overflow-hidden flex items-center px-2 border border-slate-700">
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-repeating-linear-gradient-45 from-white from-[0] to-black to-[10px] opacity-40" />
                  <div
                    className="absolute transition-all duration-500 ease-out flex items-center gap-1"
                    style={{ left: `calc(${racePosB * 18}% + 4px)` }}
                  >
                    <span className="text-2xl sm:text-3xl">{teamBAvatar}</span>
                    <span className="text-[10px] font-bold bg-rose-600 px-1.5 py-0.5 rounded text-white shadow">
                      B
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Question Card: Nhìn hình HOẶC nghe phát âm */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col items-center gap-2">
                <div className="w-40 h-32 rounded-xl bg-white border border-slate-200 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                  <ResilientImage
                    src={currentRaceTarget.imageDataUrl}
                    alt={currentRaceTarget.word}
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    speakVocabulary(currentRaceTarget.word, {
                      audioDataUrl: currentRaceTarget.audioDataUrl,
                      rate: settings.speechRate,
                      accent: settings.voiceAccent,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Nghe phát âm
                </button>
              </div>

              <div className="flex-1 space-y-3 w-full">
                <p className="text-xs font-bold text-slate-700">
                  Nhìn hình hoặc nghe phát âm, chọn từ tiếng Anh đúng để rồ ga tăng tốc (+15 điểm):
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {raceChoices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleRaceAnswer(c)}
                      className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50 font-bold text-sm text-slate-800 transition-colors shadow-2xs cursor-pointer text-center"
                    >
                      {c.word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 3. SCRAMBLE GHÉP CHỮ ARENA ---------------- */}
        {gameKind === 'scramble' && currentScrambleCard && (
          <div className="max-w-xl mx-auto w-full space-y-6 text-center">
            {/* Clue Card */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-44 h-36 rounded-2xl border border-slate-200 bg-slate-50 p-2 flex items-center justify-center shadow-xs">
                <ResilientImage
                  src={currentScrambleCard.imageDataUrl}
                  alt={currentScrambleCard.word}
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  speakVocabulary(currentScrambleCard.word, {
                    audioDataUrl: currentScrambleCard.audioDataUrl,
                    rate: settings.speechRate,
                    accent: settings.voiceAccent,
                  })
                }
                className="px-3 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Nghe phát âm từ này
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              {showVietnamese && (
                <>
                  Nghĩa tiếng Việt: <strong className="text-slate-800">{currentScrambleCard.meaning}</strong> ·{' '}
                </>
              )}
              Phiên âm: <span className="font-mono">{currentScrambleCard.phonetic}</span>
            </p>

            {/* Built Slots */}
            <div className="flex flex-wrap items-center justify-center gap-2 min-h-[52px]">
              {scrambleBuilt.map((l) => (
                <div
                  key={l.id}
                  className={`w-11 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-xl shadow-xs border-2 ${
                    scrambleFeedback === 'correct'
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                      : scrambleFeedback === 'wrong'
                      ? 'border-rose-500 bg-rose-100 text-rose-800'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {l.char}
                </div>
              ))}
              {Array.from({ length: Math.max(0, currentScrambleCard.word.replace(/[^A-Za-z]/g, '').length - scrambleBuilt.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-11 h-12 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-slate-400"
                >
                  _
                </div>
              ))}
            </div>

            {/* Letter Tiles to click */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {scrambleLetters.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={l.used || scrambleFeedback !== 'idle'}
                  onClick={() => handlePickScrambleLetter(l)}
                  className={`w-11 h-12 rounded-xl font-display font-extrabold text-lg transition-all flex items-center justify-center cursor-pointer ${
                    l.used
                      ? 'border border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-2 border-emerald-500 bg-white hover:bg-emerald-50 text-slate-800 shadow-xs hover:scale-105'
                  }`}
                >
                  {l.char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- 4. PICTURE MATCHING ARENA ---------------- */}
        {gameKind === 'match' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto w-full">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                1. Chọn Tranh minh họa:
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {matchLeftCards.map((card) => {
                  const isMatched = !!matchedCardTeams[card.id];
                  const isSelected = selectedLeftId === card.id;
                  const matchedTeam = matchedCardTeams[card.id];
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={isMatched}
                      onClick={() => handleMatchLeftClick(card)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all p-1 flex items-center justify-center cursor-pointer ${
                        isMatched
                          ? matchedTeam === 'A'
                            ? 'border-[#0284C7] bg-[#0284C7]/10 opacity-75 ring-2 ring-[#0284C7]/40'
                            : 'border-rose-500 bg-rose-50 opacity-75 ring-2 ring-rose-500/40'
                          : isSelected
                          ? 'border-emerald-500 ring-4 ring-emerald-500/20 shadow-md scale-102'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-xs bg-white'
                      }`}
                    >
                      <ResilientImage
                        src={card.imageDataUrl}
                        alt="Flashcard target"
                        className="w-full h-full object-contain"
                      />
                      {isMatched && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center">
                          <CheckCircle2
                            className={`w-7 h-7 ${matchedTeam === 'A' ? 'text-[#0284C7]' : 'text-rose-500'}`}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                2. Nối với Từ tiếng Anh:
              </h3>
              <div className="space-y-2.5">
                {matchRightCards.map((card) => {
                  const isMatched = !!matchedCardTeams[card.id];
                  const matchedTeam = matchedCardTeams[card.id];
                  const isFlashing = wrongPairFlash === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={isMatched}
                      onClick={() => handleMatchRightClick(card)}
                      className={`w-full py-3.5 px-5 rounded-xl border-2 font-display font-bold text-base transition-all flex items-center justify-between cursor-pointer ${
                        isMatched
                          ? matchedTeam === 'A'
                            ? 'border-[#0284C7] bg-[#0284C7]/15 text-[#0284C7] opacity-80'
                            : 'border-rose-500 bg-rose-100 text-rose-700 opacity-80'
                          : isFlashing
                          ? 'border-rose-400 bg-rose-50 text-rose-600 animate-shake'
                          : 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-800'
                      }`}
                    >
                      <span>{card.word}</span>
                      <span className="text-xs font-normal text-slate-500 font-mono">
                        {card.phonetic}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 5. MYSTERY BOX ARENA ---------------- */}
        {gameKind === 'mystery' && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
              {mysteryBoxes.map((box) => (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => handleOpenMysteryBox(box)}
                  disabled={box.isOpened}
                  className={`aspect-[4/3] rounded-2xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                    box.isOpened
                      ? 'border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed'
                      : 'border-amber-400 bg-gradient-to-b from-amber-50 to-orange-50 hover:scale-104 hover:shadow-md ring-2 ring-amber-400/20'
                  }`}
                >
                  <Gift className={`w-10 h-10 ${box.isOpened ? 'text-slate-400' : 'text-amber-500 animate-bounce'}`} />
                  <span className="font-display font-extrabold text-base text-slate-800">
                    {box.isOpened ? 'Đã Mở' : `Hộp Bí Mật #${box.id}`}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700">
                    {box.isOpened ? box.prizeLabel : 'Bấm để mở hộp!'}
                  </span>
                </button>
              ))}
            </div>

            {activeMysteryBox && (
              <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-4 animate-fade-in shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-base text-amber-950">
                      Thử thách mở Hộp Bí Mật #{activeMysteryBox.id}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 font-bold text-xs">
                    Phần thưởng: {activeMysteryBox.prizeLabel}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-48 h-36 rounded-xl border border-amber-200 bg-white p-2 flex items-center justify-center shrink-0">
                    <ResilientImage
                      src={activeMysteryBox.card.imageDataUrl}
                      alt="Mystery clue"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <p className="text-xs font-bold text-slate-600">
                      Hình trên là gì? Chọn đáp án đúng để nhận điểm:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {activeMysteryBox.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleAnswerMysteryBox(opt)}
                          className="py-3 px-4 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/70 font-bold text-sm text-slate-800 transition-colors shadow-2xs cursor-pointer text-center"
                        >
                          <div>{opt.word}</div>
                          {showVietnamese && (
                            <div className="text-[11px] font-normal text-slate-500 mt-0.5">({opt.meaning})</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 6. WHAT'S MISSING? ARENA ---------------- */}
        {gameKind === 'missing' && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold">
              <span>
                {missingPhase === 'remember' && (
                  <span className="text-amber-700 flex items-center gap-1.5">
                    <EyeOff className="w-4 h-4 text-amber-600 animate-pulse" />
                    Hãy nhớ kỹ 4 bức tranh này! Đếm ngược: {missingCountdown} giây...
                  </span>
                )}
                {missingPhase === 'guess' && (
                  <span className="text-rose-700 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-rose-600 animate-bounce" />
                    Bức tranh nào đã biến mất? Chọn đáp án đúng bên dưới!
                  </span>
                )}
                {missingPhase === 'revealed' && (
                  <span className="text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Chính xác! Tranh "{missingTargetCard?.word}" đã được tìm thấy!
                  </span>
                )}
              </span>
              {missingPhase === 'remember' && (
                <button
                  type="button"
                  onClick={() => setMissingCountdown(0)}
                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Bé nhớ rồi! Đố ngay
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {missingCards.map((card) => {
                const isTarget = card.id === missingTargetCard?.id;
                const isHidden = isTarget && missingPhase === 'guess';

                return (
                  <div
                    key={card.id}
                    className={`aspect-[4/3] rounded-2xl border-2 p-2 flex flex-col items-center justify-center transition-all ${
                      isHidden
                        ? 'border-dashed border-purple-400 bg-purple-50/70 shadow-inner'
                        : 'border-slate-200 bg-white shadow-xs'
                    }`}
                  >
                    {isHidden ? (
                      <div className="text-center space-y-1">
                        <span className="font-display font-black text-5xl text-purple-600 animate-bounce block">
                          ❓
                        </span>
                        <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">
                          Tranh biến mất!
                        </span>
                      </div>
                    ) : (
                      <>
                        <ResilientImage
                          src={card.imageDataUrl}
                          alt={card.word}
                          className="w-full h-full object-contain"
                        />
                        <span className="mt-1 font-bold text-xs text-slate-700">
                          {card.word}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {missingPhase === 'guess' && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold text-center text-slate-600">
                  Bấm chọn từ của bức tranh vừa biến mất:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {missingOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleMissingAnswer(opt)}
                      className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50 font-bold text-sm text-slate-800 shadow-2xs transition-all cursor-pointer text-center"
                    >
                      {opt.word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 7. SPIN THE WHEEL ARENA ---------------- */}
        {gameKind === 'wheel' && (
          <div className="max-w-4xl mx-auto w-full flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative flex flex-col items-center shrink-0">
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-rose-600 z-10 -mb-2 shadow-sm" />

              <div
                className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-slate-800 shadow-xl overflow-hidden"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: isWheelSpinning ? `transform ${wheelSpinDuration}ms cubic-bezier(0.12, 0.85, 0.25, 1.0)` : 'none',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {WHEEL_PRIZES.map((prize, idx) => {
                    const angle = 360 / WHEEL_PRIZES.length;
                    const startAngle = idx * angle;
                    const endAngle = (idx + 1) * angle;
                    const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
                    const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
                    const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
                    const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);
                    const textAngle = startAngle + angle / 2;
                    const textX = 50 + 32 * Math.cos((Math.PI * textAngle) / 180);
                    const textY = 50 + 32 * Math.sin((Math.PI * textAngle) / 180);

                    return (
                      <g key={idx}>
                        <path
                          d={`M50,50 L${x1},${y1} A50,50 0 0,1 ${x2},${y2} Z`}
                          fill={prize.color}
                          stroke="#ffffff"
                          strokeWidth="0.8"
                        />
                        <text
                          x={textX}
                          y={textY}
                          fill="#ffffff"
                          fontSize="4"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                        >
                          {prize.points}đ
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Fast Spin Buttons */}
              <div className="flex flex-col items-center gap-2 mt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSpinWheel('fast')}
                    disabled={isWheelSpinning}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ring-2 ring-amber-300"
                  >
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>{isWheelSpinning ? '⚡ Đang quay siêu tốc...' : '⚡ QUAY THẬT NHANH (0.9s)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSpinWheel('normal')}
                    disabled={isWheelSpinning}
                    className="py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    🎡 Quay Thường
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">⚡ Chế độ Siêu Tốc: Vòng xoay vút trong 0.9 giây dừng dứt khoát</p>
              </div>
            </div>

            <div className="flex-1 w-full max-w-md">
              {wheelWonPrize && wheelCurrentCard ? (
                <div className="p-5 rounded-2xl bg-slate-50 border-2 border-emerald-400 space-y-4 shadow-sm animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-800">
                      Thử thách nhận {wheelWonPrize.label}:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold">
                      +{wheelWonPrize.points} điểm
                    </span>
                  </div>

                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200 p-2 flex items-center justify-center max-w-[200px] mx-auto">
                    <ResilientImage
                      src={wheelCurrentCard.imageDataUrl}
                      alt="Wheel target"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {wheelOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleAnswerWheelQuestion(opt)}
                        className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-emerald-50 hover:border-emerald-500 font-bold text-xs text-slate-800 transition-colors shadow-2xs cursor-pointer text-center"
                      >
                        {opt.word}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 space-y-2">
                  <Disc className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">
                    Hãy bấm "QUAY BÁNH XE" để bắt đầu thử thách nhận điểm thưởng cho đội của mình!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- 8. WORD MAZE ARENA ---------------- */}
        {gameKind === 'maze' && currentMazeCard && (
          <div className="max-w-3xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
              {[0, 1, 2, 3, 4, 5].map((step) => {
                const isPassed = mazeStep > step;
                const isCurrent = mazeStep === step;
                return (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isPassed
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : isCurrent
                          ? 'bg-amber-500 text-white ring-4 ring-amber-300/40 shadow-md scale-110'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {step === 0 ? '🐰' : step === 5 ? '🥕' : step}
                    </div>
                    {step < 5 && (
                      <div className={`h-1 w-6 sm:w-12 transition-colors ${isPassed ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-white border-2 border-emerald-300 shadow-sm">
              <div className="w-44 h-36 rounded-xl border border-slate-200 bg-slate-50 p-2 flex items-center justify-center shrink-0">
                <ResilientImage
                  src={currentMazeCard.imageDataUrl}
                  alt={currentMazeCard.word}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Trạm số {mazeStep + 1} / 5:
                  </span>
                  <h3 className="font-bold text-base text-slate-900 mt-0.5">
                    Chọn cánh cổng từ vựng đúng để Thỏ nhảy tiếp:
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {mazeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleMazeAnswer(opt)}
                      className="py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 bg-white font-bold text-sm text-slate-800 transition-all shadow-2xs cursor-pointer text-center"
                    >
                      🚪 {opt.word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 9. WORD SORTING ARENA ---------------- */}
        {gameKind === 'sorting' && currentSortCard && (
          <div className="max-w-3xl mx-auto w-full space-y-6">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Thẻ cần phân loại (#{sortIdx + 1}/{sortQueue.length}):
              </span>
              <div className="w-48 h-36 rounded-2xl border-2 border-emerald-400 bg-white p-2.5 mx-auto flex flex-col items-center justify-center shadow-sm">
                <ResilientImage
                  src={currentSortCard.imageDataUrl}
                  alt={currentSortCard.word}
                  className="w-full h-full object-contain"
                />
                <span className="font-display font-extrabold text-base text-slate-800 mt-1">
                  {currentSortCard.word}
                </span>
                {showVietnamese && (
                  <span className="text-xs text-slate-500 font-semibold block">({currentSortCard.meaning})</span>
                )}
              </div>
            </div>

            {/* Custom Basket Settings */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 max-w-lg mx-auto text-left">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span>🧺 Tự đặt tên cho 02 giỏ phân loại:</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSortRule('alpha')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                      sortRule === 'alpha' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tự động chấm A–Z
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortRule('free')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                      sortRule === 'free' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tự do thảo luận
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-sky-800 uppercase block">Tên Giỏ 1 (Bên trái):</label>
                  <input
                    type="text"
                    value={basketAName}
                    onChange={(e) => setBasketAName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-sky-300 bg-sky-50/50 text-xs font-bold text-sky-950 focus:bg-white focus:outline-sky-500"
                    placeholder="Tên Giỏ 1..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-800 uppercase block">Tên Giỏ 2 (Bên phải):</label>
                  <input
                    type="text"
                    value={basketBName}
                    onChange={(e) => setBasketBName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/50 text-xs font-bold text-amber-950 focus:bg-white focus:outline-amber-500"
                    placeholder="Tên Giỏ 2..."
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                <span className="text-slate-400 font-medium">Gợi ý nhanh:</span>
                <button
                  type="button"
                  onClick={() => {
                    setBasketAName('Giỏ Chữ Cái A – M');
                    setBasketBName('Giỏ Chữ Cái N – Z');
                    setSortRule('alpha');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  🔤 A–M / N–Z
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBasketAName('🦁 Động Vật');
                    setBasketBName('🍎 Đồ Ăn & Đồ Vật');
                    setSortRule('free');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  🦁 Động vật / Đồ vật
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBasketAName('🔵 Số Ít (Singular)');
                    setBasketBName('🔴 Số Nhiều (Plural)');
                    setSortRule('free');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  🔵 Số ít / Số nhiều
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBasketAName('⭐ Từ Ngắn (≤4 chữ)');
                    setBasketBName('🌟 Từ Dài (>4 chữ)');
                    setSortRule('free');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  ⭐ Từ ngắn / Từ dài
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSortIntoBasket('A')}
                className="p-5 rounded-2xl border-2 border-sky-400 bg-sky-50/70 hover:bg-sky-100/70 transition-all text-center space-y-2 cursor-pointer shadow-sm hover:scale-102"
              >
                <span className="text-3xl block">🧺</span>
                <span className="font-display font-black text-lg text-sky-900 block">
                  {basketAName}
                </span>
                <span className="text-xs font-bold text-sky-700 block">
                  Đã chứa: {sortedBasketA.length} từ
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSortIntoBasket('B')}
                className="p-5 rounded-2xl border-2 border-amber-400 bg-amber-50/70 hover:bg-amber-100/70 transition-all text-center space-y-2 cursor-pointer shadow-sm hover:scale-102"
              >
                <span className="text-3xl block">🧺</span>
                <span className="font-display font-black text-lg text-amber-900 block">
                  {basketBName}
                </span>
                <span className="text-xs font-bold text-amber-700 block">
                  Đã chứa: {sortedBasketB.length} từ
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ---------------- 10. SPELL IT ARENA ---------------- */}
        {gameKind === 'spell' && currentSpellCard && (
          <div className="max-w-xl mx-auto w-full space-y-6 text-center">
            <div className="w-44 h-36 rounded-2xl border border-slate-200 bg-slate-50 p-2 mx-auto flex items-center justify-center shadow-xs">
              <ResilientImage
                src={currentSpellCard.imageDataUrl}
                alt={currentSpellCard.word}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-xs text-slate-500 font-medium">
              {showVietnamese && (
                <>
                  Nghĩa: <strong className="text-slate-800">{currentSpellCard.meaning}</strong> ·{' '}
                </>
              )}
              Phiên âm: <span className="font-mono">{currentSpellCard.phonetic}</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 min-h-[52px]">
              {spellBuilt.map((l) => (
                <div
                  key={l.id}
                  className={`w-11 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-xl shadow-xs border-2 ${
                    spellFeedback === 'correct'
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                      : spellFeedback === 'wrong'
                      ? 'border-rose-500 bg-rose-100 text-rose-800'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {l.char}
                </div>
              ))}
              {Array.from({ length: Math.max(0, currentSpellCard.word.replace(/[^A-Za-z]/g, '').length - spellBuilt.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-11 h-12 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-slate-400"
                >
                  _
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {spellLetters.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={l.used || spellFeedback !== 'idle'}
                  onClick={() => handlePickSpellLetter(l)}
                  className={`w-11 h-12 rounded-xl font-display font-extrabold text-lg transition-all flex items-center justify-center cursor-pointer ${
                    l.used
                      ? 'border border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-2 border-emerald-500 bg-white hover:bg-emerald-50 text-slate-800 shadow-xs hover:scale-105'
                  }`}
                >
                  {l.char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- 11. TABOO WORDS ARENA ---------------- */}
        {gameKind === 'taboo' && currentTabooCard && (
          <div className="max-w-md mx-auto w-full space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Thẻ Taboo #{tabooIdx + 1}/{tabooQueue.length}
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${
                  tabooTimer <= 10 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-700'
                }`}>
                  ⏱️ {tabooTimer}s
                </span>
                <button
                  type="button"
                  onClick={() => setIsTabooTimerRunning(!isTabooTimerRunning)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-bold cursor-pointer"
                >
                  {isTabooTimerRunning ? 'Tạm dừng' : 'Bắt đầu đếm'}
                </button>
              </div>
            </div>

            <div className="p-6 rounded-3xl border-4 border-amber-400 bg-gradient-to-b from-amber-50 to-orange-50/40 text-center space-y-4 shadow-md">
              <div>
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-widest block mb-1">
                  Từ khóa bí mật cần đoán:
                </span>
                <h2 className="font-display font-black text-3xl sm:text-4xl text-slate-900 tracking-tight">
                  {currentTabooCard.word}
                </h2>
                <p className="text-xs text-slate-600 mt-1 font-mono">
                  {showVietnamese ? `${currentTabooCard.phonetic} · ${currentTabooCard.meaning}` : currentTabooCard.phonetic}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border-2 border-rose-300 space-y-2">
                <span className="text-xs font-bold text-rose-600 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                  🚫 3 TỪ CẤM (TUYỆT ĐỐI KHÔNG NÓI):
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {getTabooWordsForCard(currentTabooCard).map((w, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-rose-50 text-rose-800 font-bold text-xs border border-rose-200"
                    >
                      ❌ {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleTabooSuccess}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer text-center"
              >
                ✅ Đội đoán đúng (+20đ)
              </button>
              <button
                type="button"
                onClick={handleTabooSkip}
                className="py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                ⏭️ Bỏ qua / Đổi lượt
              </button>
            </div>
          </div>
        )}

        {/* ---------------- 12. BUILD A SENTENCE ARENA ---------------- */}
        {gameKind === 'sentence' && currentSentenceCard && (
          <div className="max-w-2xl mx-auto w-full space-y-6 text-center">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Thử thách Xếp câu (#{sentenceIdx + 1}/{sentenceQueue.length})
              </span>
              <p className="text-xs text-slate-600 mt-1">
                Bấm các khối từ theo đúng thứ tự để tạo thành câu hoàn chỉnh:
              </p>
              {showVietnamese && (
                <p className="text-xs font-semibold text-emerald-800 mt-1">
                  Gợi ý nghĩa: "{currentSentenceCard.meaning}"
                </p>
              )}
            </div>

            <div className="min-h-[64px] p-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 flex flex-wrap items-center justify-center gap-2">
              {builtSentence.length === 0 ? (
                <span className="text-xs text-emerald-800/60 font-medium italic">
                  (Bấm các khối từ bên dưới để ghép vào đây...)
                </span>
              ) : (
                builtSentence.map((w) => (
                  <span
                    key={w.id}
                    className="py-1.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xs animate-scale-in"
                  >
                    {w.text}
                  </span>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {sentenceWords.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  disabled={w.used || sentenceFeedback !== 'idle'}
                  onClick={() => handlePickSentenceWord(w)}
                  className={`py-2.5 px-4 rounded-xl font-bold text-sm transition-all shadow-2xs cursor-pointer ${
                    w.used
                      ? 'border border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-2 border-indigo-400 bg-white hover:bg-indigo-50 text-indigo-950 hover:scale-105'
                  }`}
                >
                  {w.text}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => buildSentenceForCard(currentSentenceCard)}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
            >
              🔄 Xếp lại câu này
            </button>
          </div>
        )}

        {/* ---------------- 13. ESCAPE ROOM ARENA ---------------- */}
        {gameKind === 'escape' && escapeCard && (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400 animate-pulse" />
                <span className="font-bold text-sm">
                  Phòng Thoát Hiểm: Cửa #{escapeRoomLevel} / 3
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((lvl) => (
                  <span
                    key={lvl}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      escapeRoomLevel > lvl
                        ? 'bg-emerald-500 text-white'
                        : escapeRoomLevel === lvl
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {escapeRoomLevel > lvl ? '✓' : lvl}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border-2 border-amber-300 space-y-4 shadow-sm text-center">
              <div className="w-48 h-36 rounded-xl border border-slate-200 bg-slate-50 p-2 mx-auto flex items-center justify-center">
                <ResilientImage
                  src={escapeCard.imageDataUrl}
                  alt={escapeCard.word}
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 mb-1">
                  Mật mã giải cứu cửa #{escapeRoomLevel}: Chọn từ vựng đúng để tra chìa khóa:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-md mx-auto pt-2">
                  {escapeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleEscapeRoomAnswer(opt)}
                      className="py-3 px-4 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 font-bold text-sm text-slate-800 shadow-2xs transition-all cursor-pointer text-center"
                    >
                      <div>🗝️ {opt.word}</div>
                      {showVietnamese && (
                        <div className="text-[11px] font-normal text-slate-500 mt-0.5">({opt.meaning})</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 14. MEMORY FLIP ARENA ---------------- */}
        {gameKind === 'memory' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-3 max-w-2xl mx-auto w-full">
            {memoryTiles.map((tile) => {
              const isFlipped = flippedUids.includes(tile.uid) || !!tile.matchedBy;
              const isMatched = !!tile.matchedBy;
              const matchedTeam = tile.matchedBy;

              return (
                <button
                  key={tile.uid}
                  type="button"
                  disabled={isMatched || lockBoard}
                  onClick={() => handleMemoryTileClick(tile)}
                  className={`aspect-[4/3] rounded-2xl border-2 p-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs ${
                    isMatched
                      ? matchedTeam === 'A'
                        ? 'border-[#0284C7] bg-[#0284C7]/15 text-[#0284C7] opacity-80'
                        : 'border-rose-500 bg-rose-100 text-rose-700 opacity-80'
                      : isFlipped
                      ? 'border-emerald-500 bg-white shadow-md'
                      : 'border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200 hover:border-emerald-400'
                  }`}
                >
                  {isFlipped ? (
                    tile.kind === 'image' ? (
                      <ResilientImage
                        src={tile.imageUrl}
                        alt="Memory tile"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="font-display font-bold text-base text-slate-900 text-center px-1">
                        {tile.label}
                      </span>
                    )
                  ) : (
                    <span className="font-display font-black text-2xl text-slate-400 select-none">
                      ★
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ---------------- 15. QUIZLET LIVE - TEAM RACE ---------------- */}
        {gameKind === 'team-race' && (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Header banner with Team Count Selector */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md border border-slate-700">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🏁</span>
                <div>
                  <h3 className="font-display font-black text-lg text-amber-400">Quizlet Live — Team Race</h3>
                  <p className="text-xs text-slate-300">Nhóm nào đạt chuỗi 10 điểm trước sẽ về đích xuất sắc!</p>
                </div>
              </div>

              {/* Select Number of Teams */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-bold text-amber-300 px-1.5">Số đội:</span>
                  {[2, 3, 4, 6, 8].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setTeamRaceSquadCount(count);
                        setActiveSquadIdx(0);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        teamRaceSquadCount === count
                          ? 'bg-amber-400 text-slate-950 shadow-xs scale-105 font-black'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {count} Đội
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                  <span className="text-xs text-slate-400">Lượt:</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-900 flex items-center gap-1.5 shadow-2xs">
                    <span>{teamRaceSquads[activeSquadIdx]?.avatar}</span>
                    <span>{teamRaceSquads[activeSquadIdx]?.name}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Squads Race Progress Bars (Quizlet Live style) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              {teamRaceSquads.slice(0, teamRaceSquadCount).map((sq, i) => {
                const pct = Math.min(100, (sq.score / 10) * 100);
                const isCurrent = i === activeSquadIdx;
                return (
                  <div
                    key={sq.id}
                    onClick={() => setActiveSquadIdx(i)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isCurrent
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-100 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{sq.avatar}</span>
                        <span className="font-extrabold">{sq.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.2 rounded-full font-bold animate-pulse">
                            Lượt chơi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-black text-sm text-slate-900">{sq.score}</span>
                        <span className="text-[10px] text-slate-400">/ 10</span>
                      </div>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5 relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1 text-[9px] font-black text-white ${sq.barColor}`}
                        style={{ width: `${Math.max(6, pct)}%` }}
                      >
                        {sq.score > 0 ? sq.score : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Question Card */}
            {teamRaceCurrentCard && (
              <div className="p-6 rounded-2xl bg-white border-2 border-indigo-300 shadow-sm text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xs font-bold text-slate-500">
                    Câu hỏi cho nhóm <span className="text-indigo-600 font-extrabold">{teamRaceSquads[activeSquadIdx]?.name}</span>:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      speakVocabulary(teamRaceCurrentCard.word, {
                        audioDataUrl: teamRaceCurrentCard.audioDataUrl,
                        rate: settings.speechRate,
                        accent: settings.voiceAccent,
                      })
                    }
                    className="p-2 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {teamRaceCurrentCard.imageDataUrl && (
                  <div className="w-40 h-32 rounded-xl border border-slate-200 bg-slate-50 p-2 mx-auto flex items-center justify-center">
                    <ResilientImage
                      src={teamRaceCurrentCard.imageDataUrl}
                      alt={teamRaceCurrentCard.word}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {showVietnamese && (
                  <p className="text-xs font-semibold text-slate-500">
                    Ý nghĩa tiếng Việt: <span className="text-slate-900 font-bold">"{teamRaceCurrentCard.meaning}"</span>
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
                  {teamRaceChoices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleTeamRaceAnswer(c)}
                      className="py-3 px-4 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 font-bold text-sm text-slate-800 shadow-xs transition-all cursor-pointer text-center"
                    >
                      {c.word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 16. GIMKIT - ONE WAY OUT ---------------- */}
        {gameKind === 'gimkit-escape' && (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Mission HUD Header */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white border-2 border-purple-500/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl animate-bounce">👾</span>
                  <div>
                    <h3 className="font-display font-black text-xl text-purple-300 tracking-wide">
                      GIMKIT — ONE WAY OUT
                    </h3>
                    <p className="text-xs text-purple-200">
                      Sinh vật lạ đang chiếm giữ tàu! Trả lời đúng để nạp năng lượng & thu thập chìa khóa thoát hiểm.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Energy Meter */}
                  <div className="text-right">
                    <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
                      <Zap className="w-3 h-3 text-amber-400" />
                      Năng lượng
                    </div>
                    <div className="font-black text-lg text-amber-400 tabular-nums">{gimkitEnergy}%</div>
                  </div>

                  {/* Keys Collected */}
                  <div className="text-right border-l border-purple-800 pl-3">
                    <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
                      <Key className="w-3 h-3 text-emerald-400" />
                      Chìa khóa
                    </div>
                    <div className="font-black text-lg text-emerald-400 tabular-nums">{gimkitKeys} / 3</div>
                  </div>
                </div>
              </div>

              {/* Energy Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-purple-300 font-semibold">
                  <span>Tiến độ khoang hiện tại (#{gimkitRoomIndex + 1})</span>
                  <span>{gimkitEnergy}% (Cần 100% để lấy chìa khóa)</span>
                </div>
                <div className="w-full h-3 bg-purple-950/80 rounded-full border border-purple-600/50 p-0.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.max(4, gimkitEnergy)}%` }}
                  />
                </div>
              </div>

              {/* 3 Key slots visual */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {[1, 2, 3].map((slot) => {
                  const hasKey = gimkitKeys >= slot;
                  return (
                    <div
                      key={slot}
                      className={`p-2 rounded-xl border text-center text-xs font-bold flex items-center justify-center gap-2 ${
                        hasKey
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                          : 'border-purple-800 bg-purple-950/30 text-purple-400'
                      }`}
                    >
                      <span>{hasKey ? '🔑' : '🔒'}</span>
                      <span>Chìa khóa #{slot}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question Stage */}
            {gimkitCurrentCard && (
              <div className="p-6 rounded-2xl bg-white border-2 border-purple-200 shadow-sm text-center space-y-4">
                <div className="w-40 h-32 rounded-xl border border-slate-200 bg-slate-50 p-2 mx-auto flex items-center justify-center">
                  <ResilientImage
                    src={gimkitCurrentCard.imageDataUrl}
                    alt={gimkitCurrentCard.word}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">
                    Lượt của <span className="text-purple-700 font-extrabold">{nextTeamName(activeTeam)}</span>: Chọn từ vựng đúng để kích hoạt nguồn năng lượng:
                  </p>
                  {showVietnamese && (
                    <p className="text-sm font-black text-slate-900">
                      "{gimkitCurrentCard.meaning}"
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
                  {gimkitChoices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleGimkitAnswer(c)}
                      className="py-3 px-4 rounded-xl border-2 border-slate-200 bg-white hover:border-purple-500 hover:bg-purple-50 font-bold text-sm text-slate-800 shadow-xs transition-all cursor-pointer text-center"
                    >
                      ⚡ {c.word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 17. SURVEY GAME SHOW (FAMILY FEUD STYLE) ---------------- */}
        {gameKind === 'survey-slam' && (
          <div className="space-y-6 max-w-5xl mx-auto w-full relative">
            {/* Top Control & Round Header Bar */}
            <div className="p-4 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl border-2 border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-2xl bg-amber-400/20 border border-amber-400/40">📺</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-black text-xl text-amber-400 tracking-wide uppercase">
                      Survey Game Show
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-600 text-white shadow-xs">
                      VÒNG {surveyRoundNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Đấu trường khảo sát từ vựng tiếng Anh phong cách Family Feud</p>
                </div>
              </div>

              {/* Top Action Controls: Select Team Count & Round Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Number of Teams Selector */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-inner">
                  <span className="text-[11px] font-bold text-amber-300 px-2">Số đội:</span>
                  {[2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setSurveyTeamCount(cnt);
                        setSurveyActiveTeamIdx((prev) => prev % cnt);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        surveyTeamCount === cnt
                          ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {cnt} Đội
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNextSurveyRound}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  title="Chuyển sang vòng khảo sát tiếp theo"
                >
                  <span>⏭️</span>
                  <span>Vòng tiếp theo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSurveyGameOver(!isSurveyGameOver)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  title="Xem xếp hạng tổng kết các đội"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{isSurveyGameOver ? 'Đóng xếp hạng' : 'Xếp hạng chung cuộc'}</span>
                </button>
              </div>
            </div>

            {/* Final Game Over Ranking Podium (Optional Toggle) */}
            {isSurveyGameOver && (
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-slate-950 shadow-2xl border-4 border-amber-300 animate-fade-in space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-amber-400/60">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <h4 className="font-display font-black text-2xl uppercase tracking-wider text-slate-950">
                        Bảng Vinh Danh Gameshow Chung Cuộc
                      </h4>
                      <p className="text-xs font-bold text-amber-950">
                        Tổng điểm tích lũy qua tất cả các vòng khảo sát
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSurveyGameOver(false)}
                    className="p-1.5 rounded-full bg-amber-400/80 hover:bg-amber-300 text-slate-950 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {[...surveyTeams.slice(0, surveyTeamCount)]
                    .sort((a, b) => b.score - a.score)
                    .map((team, rankIdx) => (
                      <div
                        key={team.id}
                        className={`p-4 rounded-2xl bg-white/95 backdrop-blur-md shadow-lg border-2 text-center space-y-2 relative ${
                          rankIdx === 0 ? 'border-amber-500 ring-4 ring-amber-300 scale-103' : 'border-slate-200'
                        }`}
                      >
                        {rankIdx === 0 && (
                          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm border border-amber-600">
                            👑 Quán Quân
                          </span>
                        )}
                        <span className="text-4xl block pt-1">{team.avatar}</span>
                        <h5 className="font-extrabold text-sm text-slate-900 truncate">{team.name}</h5>
                        <p className="font-display font-black text-2xl text-indigo-700">{team.score} đ</p>
                        <span className="inline-block text-[11px] font-bold text-slate-500">Hạng #{rankIdx + 1}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Teams Interactive Scoreboard (2 - 4 Teams) */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${surveyTeamCount >= 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-3.5`}>
              {surveyTeams.slice(0, surveyTeamCount).map((team, idx) => {
                const isActive = idx === surveyActiveTeamIdx;
                const isOriginal = surveyStealMode && idx === surveyOriginalTeamIdx;
                const isEditing = editingSurveyTeamIdx === idx;

                return (
                  <div
                    key={team.id}
                    onClick={() => {
                      if (!surveyStealMode) setSurveyActiveTeamIdx(idx);
                    }}
                    className={`p-4 rounded-3xl border-2 transition-all cursor-pointer relative shadow-md flex flex-col justify-between ${
                      isActive
                        ? 'bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white border-amber-400 ring-4 ring-amber-400/30 scale-102'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    {/* Active turn badge */}
                    {isActive && (
                      <span className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md animate-pulse">
                        {surveyStealMode ? '🚨 ĐANG CƯỚP ĐIỂM (STEAL)' : '⭐ ĐANG ĐẾN LƯỢT'}
                      </span>
                    )}

                    {isOriginal && (
                      <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500 text-white shadow-xs">
                        Bảo vệ điểm
                      </span>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl p-1.5 rounded-xl bg-slate-100/20">{team.avatar}</span>
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={team.name}
                            autoFocus
                            onBlur={(e) => handleUpdateSurveyTeamName(idx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateSurveyTeamName(idx, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingSurveyTeamIdx(null);
                            }}
                            className="text-xs font-bold px-2 py-1 rounded-lg border border-indigo-400 bg-white text-slate-900 w-32 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSurveyTeamIdx(idx);
                            }}
                            className="group flex items-center gap-1 cursor-pointer truncate"
                            title="Bấm để đổi tên đội"
                          >
                            <span className={`text-xs font-extrabold truncate ${isActive ? 'text-amber-300' : 'text-slate-800'}`}>
                              {team.name}
                            </span>
                            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                          </div>
                        )}
                      </div>

                      {/* Manual point fine-tuning */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleManualAdjustSurveyScore(idx, -5)}
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${
                            isActive ? 'bg-white/10 hover:bg-white/20 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                          title="Trừ 5 điểm"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManualAdjustSurveyScore(idx, 5)}
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${
                            isActive ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                          }`}
                          title="Cộng 5 điểm"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className={`text-[11px] font-semibold ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                        Tổng điểm:
                      </span>
                      <span className={`font-display font-black text-2xl ${isActive ? 'text-amber-400' : 'text-indigo-600'}`}>
                        {team.score} đ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Giant Family Feud TV Stage Board */}
            <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-blue-950 via-indigo-950 to-slate-950 text-white border-4 border-amber-400 shadow-2xl space-y-6 relative overflow-hidden">
              {/* Decorative Studio Lights Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-indigo-900/80">
                {/* Survey Question Display & Editor */}
                <div className="flex-1 w-full text-center sm:text-left space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-black text-amber-300 uppercase tracking-widest">
                    <span>📢 CÂU HỎI KHẢO SÁT (SURVEY QUESTION):</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingSurveyQuestion(!isEditingSurveyQuestion)}
                      className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] cursor-pointer transition-colors"
                      title="Chỉnh sửa câu hỏi khảo sát"
                    >
                      ✏️ Tùy chỉnh
                    </button>
                  </div>

                  {isEditingSurveyQuestion ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={surveyQuestion}
                        onChange={(e) => setSurveyQuestion(e.target.value)}
                        placeholder="Nhập câu hỏi khảo sát cho học sinh..."
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-400 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
                      />
                      <select
                        onChange={(e) => {
                          if (e.target.value) setSurveyQuestion(e.target.value);
                        }}
                        className="px-2 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none cursor-pointer"
                        title="Chọn câu hỏi mẫu"
                      >
                        <option value="">-- Mẫu có sẵn --</option>
                        {DEFAULT_SURVEY_PRESETS.map((preset, pIdx) => (
                          <option key={pIdx} value={preset}>
                            {preset}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsEditingSurveyQuestion(false)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer hover:bg-emerald-700 shrink-0"
                      >
                        Xong
                      </button>
                    </div>
                  ) : (
                    <h4 className="font-display font-black text-lg sm:text-2xl text-white tracking-wide drop-shadow-md">
                      "{surveyQuestion}"
                    </h4>
                  )}
                </div>

                {/* Strikes Box & Round Bank Container */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Round Bank */}
                  <div className="px-4 py-2.5 rounded-2xl bg-amber-400/20 border-2 border-amber-400 text-center shadow-inner flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                      💰 Quỹ Thưởng Vòng
                    </span>
                    <span className="font-display font-black text-2xl text-amber-400 leading-tight">
                      {surveyRoundBank} đ
                    </span>
                  </div>

                  {/* 3 Family Feud Strikes Indicators */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                      Lỗi (Strikes)
                    </span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((s) => {
                        const isStruck = surveyStrikes >= s;
                        return (
                          <div
                            key={s}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border-2 flex items-center justify-center font-black text-lg sm:text-xl transition-all shadow-md ${
                              isStruck
                                ? 'border-rose-500 bg-rose-600 text-white shadow-rose-600/50 scale-110 animate-bounce'
                                : 'border-slate-800 bg-slate-900/80 text-slate-700'
                            }`}
                          >
                            ✕
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Steal Mode Warning Banner */}
              {surveyStealMode && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 text-white font-extrabold text-sm text-center shadow-lg border-2 border-amber-300 animate-pulse flex items-center justify-center gap-2">
                  <span className="text-xl">🚨</span>
                  <span>
                    CƠ HỘI CƯỚP ĐIỂM (STEAL)! {surveyTeams[surveyActiveTeamIdx]?.name} chỉ có DUY NHẤT 1 LẦN ĐOÁN để cướp trọn {surveyRoundBank} điểm!
                  </span>
                </div>
              )}

              {/* Round Winner Announcement Banner */}
              {surveyRoundWinner && (
                <div className="p-4 rounded-2xl bg-emerald-600/90 text-white border-2 border-emerald-400 shadow-xl text-center space-y-2 animate-fade-in">
                  <p className="font-display font-black text-base sm:text-lg">{surveyRoundWinner}</p>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleNextSurveyRound}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-md hover:bg-amber-300 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⏭️</span>
                      <span>Sang Vòng Tiếp Theo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRevealAllSurveySlots}
                      className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Mở hết các ô còn lại</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 6 Authentic Family Feud Slats (2 Columns x 3 Rows) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {surveySlots.map((slot) => {
                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleRevealSurveySlot(slot)}
                      className={`h-22 sm:h-24 rounded-2xl border-2 transition-all cursor-pointer shadow-lg relative flex items-center justify-between px-3 sm:px-4 select-none ${
                        slot.isRevealed
                          ? 'border-amber-400 bg-gradient-to-r from-amber-50 via-white to-amber-100 text-slate-900 shadow-amber-400/20'
                          : 'border-amber-400/80 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-800 hover:to-indigo-800 text-white hover:border-amber-300 hover:scale-101 hover:shadow-indigo-500/30'
                      }`}
                      title={slot.isRevealed ? 'Bấm để phóng to xem chi tiết từ vựng' : 'Bấm để lật mở đáp án'}
                    >
                      {/* Left Rank Badge */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-display font-black text-sm sm:text-base shrink-0 border-2 shadow-inner ${
                            slot.isRevealed
                              ? 'bg-amber-400 text-slate-950 border-amber-500'
                              : 'bg-indigo-950 text-amber-400 border-amber-400/60'
                          }`}
                        >
                          #{slot.rank}
                        </div>

                        {slot.isRevealed ? (
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Card Image Thumbnail with Click-to-Zoom */}
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                              <ResilientImage
                                src={slot.card.imageDataUrl}
                                alt={slot.card.word}
                                className="w-full h-full object-contain"
                              />
                            </div>

                            {/* English Word & Meaning */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-display font-black text-base sm:text-lg text-indigo-950 tracking-wide uppercase truncate">
                                  {slot.card.word}
                                </h5>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakVocabulary(slot.card.word, {
                                      audioDataUrl: slot.card.audioDataUrl,
                                      rate: settings.speechRate,
                                      accent: settings.voiceAccent,
                                    });
                                  }}
                                  className="p-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors shadow-2xs cursor-pointer shrink-0"
                                  title="Nghe phát âm chuẩn"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {showVietnamese && <p className="text-xs font-bold text-slate-500 truncate">{slot.card.meaning}</p>}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs sm:text-sm text-indigo-300 font-bold tracking-widest">
                              · · · · · · · · · · · · · · ·
                            </span>
                            <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider">
                              Chạm để mở đáp án #{slot.rank}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Points Badge */}
                      <div className="shrink-0 pl-2">
                        {slot.isRevealed ? (
                          <div className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-display font-black text-base sm:text-lg shadow-md border border-amber-500 flex flex-col items-center">
                            <span>{slot.points}</span>
                            <span className="text-[9px] font-black -mt-1 uppercase tracking-tighter">điểm</span>
                          </div>
                        ) : (
                          <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-amber-400/40 text-amber-300 font-mono font-bold text-xs">
                            {slot.points}đ
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action Control Bar for Teacher */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-900/60">
                {/* Strike Button */}
                <button
                  type="button"
                  onClick={handleSurveyStrike}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-display font-black text-sm uppercase tracking-wider shadow-lg hover:shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <X className="w-5 h-5" />
                  <span>
                    {surveyStealMode ? 'BÁO SAI (CƯỚP THẤT BẠI ✕)' : 'BÁO LỖI (STRIKE ✕)'}
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Manual Turn Cycle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = (surveyActiveTeamIdx + 1) % surveyTeamCount;
                      setSurveyActiveTeamIdx(next);
                      setBannerText(`Đã chuyển lượt sang ${surveyTeams[next]?.name}!`);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🔄</span>
                    <span>Đổi lượt đội khác</span>
                  </button>

                  {/* Reveal All Slats Button */}
                  <button
                    type="button"
                    onClick={handleRevealAllSurveySlots}
                    className="px-3.5 py-2.5 rounded-xl bg-indigo-800/80 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Mở hết đáp án</span>
                  </button>

                  {/* Next Round Button */}
                  <button
                    type="button"
                    onClick={handleNextSurveyRound}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⏭️</span>
                    <span>Vòng tiếp theo</span>
                  </button>
                </div>
              </div>

              {/* Giant Red X Strike Flash Animation Overlay */}
              {surveyStrikeFlash !== null && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-40 animate-fade-in pointer-events-none">
                  <div className="w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-7xl sm:text-9xl border-8 border-white shadow-2xl animate-bounce">
                    ✕
                  </div>
                  <span className="font-display font-black text-3xl sm:text-4xl text-rose-500 uppercase tracking-widest mt-4 drop-shadow-lg">
                    STRIKE {surveyStrikeFlash}!
                  </span>
                </div>
              )}
            </div>

            {/* Lightbox Zoom Modal for Vocabulary Card */}
            {surveyModalCard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-3xl border-4 border-amber-400 p-6 max-w-md w-full text-center space-y-4 shadow-2xl relative">
                  <button
                    type="button"
                    onClick={() => setSurveyModalCard(null)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                    title="Đóng (✕)"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 uppercase tracking-wider shadow-sm">
                    🌟 Chi Tiết Từ Vựng Khảo Sát
                  </span>

                  <div className="w-64 h-52 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 mx-auto flex items-center justify-center shadow-inner">
                    <ResilientImage
                      src={surveyModalCard.imageDataUrl}
                      alt={surveyModalCard.word}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {showVietnamese && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Nghĩa tiếng Việt:
                      </p>
                      <p className="text-xl font-black text-slate-900">
                        "{surveyModalCard.meaning}"
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="text-sm font-semibold text-slate-500">Từ tiếng Anh:</span>
                    <span className="text-2xl font-black text-indigo-700">{surveyModalCard.word}</span>
                    <button
                      type="button"
                      onClick={() =>
                        speakVocabulary(surveyModalCard.word, {
                          audioDataUrl: surveyModalCard.audioDataUrl,
                          rate: settings.speechRate,
                          accent: settings.voiceAccent,
                        })
                      }
                      className="p-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors shadow-2xs cursor-pointer"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSurveyModalCard(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Quay lại bảng Game Show
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 18. FLIPPITY - TILE PUZZLE ---------------- */}
        {gameKind === 'tile-puzzle' && (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔲</span>
                <div>
                  <h3 className="font-display font-black text-base text-indigo-950">Flippity — Tile Puzzle</h3>
                  <p className="text-xs text-indigo-700">
                    Bấm nút "Xoay" hoặc bấm 2 ô để hoán đổi vị trí sao cho toàn bộ các cạnh khớp đúng 0°!
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-indigo-900 bg-white px-3 py-1 rounded-full border border-indigo-200 shadow-2xs">
                {puzzleTiles.filter((t) => t.rotation === 0).length} / {puzzleTiles.length} ô đã khớp
              </span>
            </div>

            {/* Puzzle Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-100 rounded-3xl border border-slate-300">
              {puzzleTiles.map((tile, idx) => {
                const isSelected = selectedPuzzleIdx === idx;
                const isAligned = tile.rotation === 0;

                return (
                  <div
                    key={tile.id}
                    className={`rounded-2xl border-2 p-3 bg-white transition-all duration-300 shadow-xs flex flex-col justify-between gap-2.5 ${
                      isAligned
                        ? 'border-emerald-500 bg-emerald-50/30'
                        : isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-400 bg-indigo-50/20'
                        : 'border-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Mảnh #{idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full font-black ${isAligned ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {tile.rotation}°
                      </span>
                    </div>

                    <div
                      className="w-full aspect-square rounded-xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center transition-transform duration-300 overflow-hidden"
                      style={{ transform: `rotate(${tile.rotation}deg)` }}
                    >
                      <ResilientImage
                        src={tile.card.imageDataUrl}
                        alt={tile.card.word}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="text-center">
                      <div className="font-extrabold text-sm text-slate-900">{tile.card.word}</div>
                      {showVietnamese && <div className="text-[11px] text-slate-500">{tile.card.meaning}</div>}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRotatePuzzleTile(idx)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                        title="Xoay 90 độ"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Xoay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSwapPuzzleTile(idx)}
                        className={`py-1.5 px-2.5 rounded-lg font-bold text-xs border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-600'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                        title="Đổi chỗ mảnh"
                      >
                        {isSelected ? 'Đang chọn' : 'Đổi'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- 19. EDUCAPLAY - ASTERQUIZ ---------------- */}
        {gameKind === 'aster-quiz' && (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Cosmic Race Arena */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-900 to-purple-950 text-white border-2 border-indigo-500/40 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">🚀</span>
                  <div>
                    <h3 className="font-display font-black text-xl text-amber-300">Educaplay — AsterQuiz</h3>
                    <p className="text-xs text-indigo-200">Bắn hạ thiên thạch để điều khiển tàu vũ trụ vượt qua dải ngân hà!</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <span>Trạm đích: 🪐 Trạm Vũ Trụ Không Gian</span>
                </div>
              </div>

              {/* Lane A: Blue Spaceship */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-indigo-900/40 border border-sky-500/30">
                <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-sky-400" />
                    {teamAAvatar} {teamAName} (Phi thuyền Xanh)
                  </span>
                  <span>Chặng {asterPosA} / 5</span>
                </div>

                {/* Track with stations */}
                <div className="relative w-full h-8 bg-slate-950 rounded-full border border-sky-800 flex items-center px-2">
                  <div
                    className="absolute transition-all duration-700 flex items-center gap-1"
                    style={{ left: `${Math.min(92, (asterPosA / 5) * 88)}%` }}
                  >
                    <span className="text-xl">🚀</span>
                    {asterLaserActive === 'A' && (
                      <span className="text-xs font-black text-amber-400 animate-ping">⚡ LASER!</span>
                    )}
                  </div>
                  <div className="w-full flex justify-between text-xs opacity-60 px-2 pointer-events-none">
                    <span>☄️</span>
                    <span>☄️</span>
                    <span>☄️</span>
                    <span>☄️</span>
                    <span>🪐</span>
                  </div>
                </div>
              </div>

              {/* Lane B: Red Spaceship */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-purple-900/40 border border-rose-500/30">
                <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                  <span className="flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-rose-400" />
                    {teamBAvatar} {teamBName} (Phi thuyền Đỏ)
                  </span>
                  <span>Chặng {asterPosB} / 5</span>
                </div>

                {/* Track with stations */}
                <div className="relative w-full h-8 bg-slate-950 rounded-full border border-rose-800 flex items-center px-2">
                  <div
                    className="absolute transition-all duration-700 flex items-center gap-1"
                    style={{ left: `${Math.min(92, (asterPosB / 5) * 88)}%` }}
                  >
                    <span className="text-xl">🛸</span>
                    {asterLaserActive === 'B' && (
                      <span className="text-xs font-black text-amber-400 animate-ping">⚡ LASER!</span>
                    )}
                  </div>
                  <div className="w-full flex justify-between text-xs opacity-60 px-2 pointer-events-none">
                    <span>☄️</span>
                    <span>☄️</span>
                    <span>☄️</span>
                    <span>☄️</span>
                    <span>🪐</span>
                  </div>
                </div>
              </div>

              {/* Current Asteroid Target */}
              {asterCurrentCard && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-400/40 text-center space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                      ☄️ THIÊN THẠCH PHÍA TRƯỚC ĐANG CẢN ĐƯỜNG:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        speakVocabulary(asterCurrentCard.word, {
                          audioDataUrl: asterCurrentCard.audioDataUrl,
                          rate: settings.speechRate,
                          accent: settings.voiceAccent,
                        })
                      }
                      className="p-1.5 rounded-full bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-sm cursor-pointer"
                      title="Phát âm từ vựng"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {showVietnamese && (
                    <p className="text-base font-extrabold text-white">
                      Ý nghĩa: <span className="text-amber-400">"{asterCurrentCard.meaning}"</span>
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                    {asterChoices.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAsterQuizAnswer(c)}
                        className="py-3 px-4 rounded-xl border border-amber-400/60 bg-gradient-to-r from-indigo-900 to-purple-900 hover:from-amber-500 hover:to-amber-600 hover:text-slate-950 font-black text-sm text-amber-200 shadow-md transition-all cursor-pointer text-center"
                      >
                        ☄️ {c.word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Finished Modal / Winner Banner */}
      {isFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 border-2 border-emerald-400 shadow-2xl text-center space-y-4">
            <Trophy className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
            <h2 className="font-display font-black text-2xl text-slate-900">
              TRẬN ĐẤU HOÀN TẤT!
            </h2>
            <p className="text-sm font-bold text-emerald-800">
              {scoreA > scoreB
                ? `🏆 Chúc mừng ${nextTeamName('A')} chiến thắng (${scoreA} - ${scoreB})!`
                : scoreB > scoreA
                ? `🏆 Chúc mừng ${nextTeamName('B')} chiến thắng (${scoreB} - ${scoreA})!`
                : `🤝 Trận đấu hòa nhau kịch tính (${scoreA} - ${scoreB})!`}
            </p>
            <button
              type="button"
              onClick={resetCurrentGame}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-sm shadow-md hover:opacity-95 cursor-pointer"
            >
              🎉 Chơi Trận Tiếp Theo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
