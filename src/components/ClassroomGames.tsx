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

  // ---------------- 8. WORD MAZE ----------------
  const [mazeStep, setMazeStep] = useState(0);
  const [mazeQueue, setMazeQueue] = useState<VocabCard[]>([]);
  const [mazeOptions, setMazeOptions] = useState<VocabCard[]>([]);

  // ---------------- 9. WORD SORTING ----------------
  const [sortQueue, setSortQueue] = useState<VocabCard[]>([]);
  const [sortIdx, setSortIdx] = useState(0);
  const [sortedBasketA, setSortedBasketA] = useState<VocabCard[]>([]);
  const [sortedBasketB, setSortedBasketB] = useState<VocabCard[]>([]);

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

  const awardPoints = (team: TeamKey, pts: number) => {
    if (team === 'A') setScoreA((s) => s + pts);
    else setScoreB((s) => s + pts);
  };

  const nextTeamName = (t: TeamKey) => (t === 'A' ? settings.teamAName : settings.teamBName);

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
      setBannerText(`Lượt của ${settings.teamAName}: Lắng nghe loa phát âm và bấm trúng bong bóng đang bay!`);
    } else if (gameKind === 'race') {
      setRacePosA(0);
      setRacePosB(0);
      const shuffled = shuffleArray(poolCards);
      setRaceQueue(shuffled);
      setRaceIdx(0);
      if (shuffled[0]) {
        setRaceChoices(buildOptionsForCard(shuffled[0], poolCards, 4));
      }
      setBannerText(`Lượt của ${settings.teamAName}: Nghe hoặc nhìn hình chọn đúng để xe rồ ga về đích (+15 điểm)!`);
    } else if (gameKind === 'scramble') {
      const shuffled = shuffleArray(poolCards);
      setScrambleQueue(shuffled);
      setScrambleIdx(0);
      buildScrambleForCard(shuffled[0]);
      setBannerText(`Lượt của ${settings.teamAName}: Nhìn hình và bấm các chữ cái xáo trộn để ghép thành từ đúng.`);
    } else if (gameKind === 'match') {
      const subset = poolCards.slice(0, 6);
      setMatchLeftCards(shuffleArray(subset));
      setMatchRightCards(shuffleArray(subset));
      setSelectedLeftId(null);
      setMatchedCardTeams({});
      setWrongPairFlash(null);
      setBannerText(`Lượt của ${settings.teamAName}: Chọn 1 tranh bên trái rồi nối với từ tiếng Anh bên phải.`);
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
      setBannerText(`Lượt của ${settings.teamAName}: Chọn 1 chiếc hộp bí mật để mở ra câu đố và điểm thưởng!`);
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
      setBannerText(`Lượt của ${settings.teamAName}: Bấm nút "QUAY BÁNH XE" để xác định số điểm thử thách!`);
    } else if (gameKind === 'maze') {
      setMazeStep(0);
      const shuffled = shuffleArray(poolCards);
      setMazeQueue(shuffled);
      if (shuffled[0]) {
        setMazeOptions(buildOptionsForCard(shuffled[0], poolCards, 3));
      }
      setBannerText(`Lượt của ${settings.teamAName}: Dẫn đường cho bạn Thỏ 🐰 qua 5 trạm để về đích nhận cà rốt 🥕!`);
    } else if (gameKind === 'sorting') {
      const shuffled = shuffleArray(poolCards);
      setSortQueue(shuffled);
      setSortIdx(0);
      setSortedBasketA([]);
      setSortedBasketB([]);
      setBannerText(`Lượt của ${settings.teamAName}: Phân loại từ vào Giỏ chữ cái A–M hoặc Giỏ N–Z!`);
    } else if (gameKind === 'spell') {
      const shuffled = shuffleArray(poolCards);
      setSpellQueue(shuffled);
      setSpellIdx(0);
      buildScrambleForCard(shuffled[0]);
      setBannerText(`Lượt của ${settings.teamAName}: Bấm từng chữ cái theo đúng thứ tự để đánh vần từ vựng!`);
    } else if (gameKind === 'taboo') {
      const shuffled = shuffleArray(poolCards);
      setTabooQueue(shuffled);
      setTabooIdx(0);
      setTabooTimer(30);
      setIsTabooTimerRunning(false);
      setBannerText(`Lượt của ${settings.teamAName}: Mô tả từ khóa cho đồng đội đoán mà KHÔNG ĐƯỢC nói 3 từ cấm!`);
    } else if (gameKind === 'sentence') {
      const shuffled = shuffleArray(poolCards);
      setSentenceQueue(shuffled);
      setSentenceIdx(0);
      buildSentenceForCard(shuffled[0]);
      setBannerText(`Lượt của ${settings.teamAName}: Sắp xếp các từ bị xáo trộn thành câu tiếng Anh hoàn chỉnh!`);
    } else if (gameKind === 'escape') {
      setEscapeRoomLevel(1);
      const shuffled = shuffleArray(poolCards);
      const c = shuffled[0] || poolCards[0];
      setEscapeCard(c);
      setEscapeOptions(buildOptionsForCard(c, poolCards, 3));
      setBannerText(`Lượt của ${settings.teamAName}: Căn phòng số 1 đang khóa! Giải mã từ vựng để mở cửa thoát hiểm!`);
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
      setBannerText(`Lượt của ${settings.teamAName}: Lật 1 thẻ hình và 1 thẻ chữ tiếng Anh khớp nhau.`);
    }
  }, [
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
  const handleSpinWheel = () => {
    if (isWheelSpinning) return;
    setIsWheelSpinning(true);
    setWheelWonPrize(null);
    setWheelCurrentCard(null);
    playClassroomSfx('flip', settings.soundEffectsEnabled);

    const segmentCount = WHEEL_PRIZES.length;
    const randomIdx = Math.floor(Math.random() * segmentCount);
    const chosenPrize = WHEEL_PRIZES[randomIdx];

    const segmentAngle = 360 / segmentCount;
    const extraSpins = 5 * 360;
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
    }, 3200);
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

    const firstLetter = currentSortCard.word.trim().toUpperCase()[0];
    const isFirstHalf = firstLetter >= 'A' && firstLetter <= 'M';
    const isCorrect = (basket === 'A' && isFirstHalf) || (basket === 'B' && !isFirstHalf);

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
        setBannerText(`Đúng giỏ rồi! +10 điểm cho ${nextTeamName(activeTeam)}.`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
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
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500 font-medium">
            Bộ 14 Trò Chơi Tương Tác Lớp Học (Versus Mode) · Thi Đấu Hai Đội Trên Màn Hình Máy Chiếu
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
        </div>
      </div>

      {/* GAME SELECTOR: SLIDER / GRID VIEW WITH SMOOTH SCROLL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Danh sách 14 Trò chơi lớp học (Đang chọn: {ALL_GAMES.find((g) => g.id === gameKind)?.title}):
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
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
      <section className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Team A */}
          <button
            type="button"
            onClick={() => setActiveTeam('A')}
            className={`md:col-span-4 p-4 rounded-xl border text-left transition-all flex items-center justify-between gap-4 cursor-pointer ${
              activeTeam === 'A'
                ? 'border-[#0284C7] bg-[#0284C7]/10 ring-2 ring-[#0284C7]/20 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0284C7]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0284C7]">
                  {settings.teamAName}
                </span>
                {activeTeam === 'A' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0284C7] text-white font-bold animate-pulse">
                    Đang đến lượt!
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Đội Xanh Dương</p>
            </div>
            <div className="text-right">
              <span className="font-display font-black text-3xl lg:text-4xl text-[#0284C7] tabular-nums">
                {scoreA}
              </span>
              <span className="text-xs font-medium text-slate-400 ml-1">điểm</span>
            </div>
          </button>

          {/* VS Center Banner */}
          <div className="md:col-span-4 text-center px-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black tracking-widest mb-1.5">
              <span>⚔️ VERSUS MODE ⚔️</span>
            </div>
            <p className="text-xs font-medium text-slate-700 line-clamp-2 min-h-[32px] flex items-center justify-center">
              {bannerText}
            </p>
          </div>

          {/* Team B */}
          <button
            type="button"
            onClick={() => setActiveTeam('B')}
            className={`md:col-span-4 p-4 rounded-xl border text-left transition-all flex items-center justify-between gap-4 cursor-pointer ${
              activeTeam === 'B'
                ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  {settings.teamBName}
                </span>
                {activeTeam === 'B' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                    Đang đến lượt!
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Đội Đỏ Cam</p>
            </div>
            <div className="text-right">
              <span className="font-display font-black text-3xl lg:text-4xl text-rose-600 tabular-nums">
                {scoreB}
              </span>
              <span className="text-xs font-medium text-slate-400 ml-1">điểm</span>
            </div>
          </button>
        </div>
      </section>

      {/* GAME ARENA */}
      <main className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[440px] flex flex-col justify-center">

        {/* ---------------- 1. BUBBLE POP / THU HOẠCH TRÁI CÂY ---------------- */}
        {gameKind === 'bubble' && currentBubbleTarget && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {/* Top Bar with Audio & Theme Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-sky-50 border border-sky-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePlayCurrentBubbleAudio}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 animate-bounce" />
                  <span>🔊 Bấm để nghe lại phát âm</span>
                </button>
                <span className="text-xs font-bold text-sky-950">
                  Từ #{bubbleIdx + 1}/{bubbleQueue.length}
                </span>
              </div>

              {/* Theme Toggle: Bong bóng vs Trái cây */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-white border border-sky-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBubbleTheme('bubble')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    bubbleTheme === 'bubble' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  🎈 Bong bóng
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

            {/* Floating Bubbles / Fruits Stage */}
            <div className="relative min-h-[300px] sm:min-h-[340px] rounded-3xl bg-gradient-to-b from-sky-100/60 via-indigo-50/40 to-emerald-50/50 border-2 border-sky-200 p-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 overflow-hidden shadow-inner">
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
                    className={`relative rounded-3xl p-4 transition-all flex flex-col items-center justify-center cursor-pointer shadow-md group ${
                      isPopped
                        ? 'scale-0 opacity-0 transition-all duration-300'
                        : bubbleTheme === 'bubble'
                        ? 'w-36 h-36 sm:w-44 sm:h-44 bg-gradient-to-tr from-sky-400/80 via-white/90 to-sky-300/80 border-4 border-sky-300 hover:scale-108 hover:shadow-xl'
                        : 'w-36 h-36 sm:w-44 sm:h-44 bg-gradient-to-tr from-emerald-100 via-white to-amber-100 border-4 border-emerald-300 hover:scale-108 hover:shadow-xl'
                    }`}
                    style={{
                      animation: isPopped ? 'none' : `bounce 2.6s ease-in-out infinite alternate ${floatDelays[i % floatDelays.length]}`,
                    }}
                  >
                    {/* Specular Glint */}
                    <div className="absolute top-3 left-4 w-5 h-2.5 rounded-full bg-white/70 rotate-[-25deg]" />

                    {bubbleTheme === 'fruit' && (
                      <span className="text-xl sm:text-2xl mb-1">{fruitEmoji}</span>
                    )}

                    {/* Image icon preview */}
                    <div className="w-16 h-14 sm:w-20 sm:h-16 rounded-xl bg-white/80 p-1 mb-1.5 flex items-center justify-center overflow-hidden border border-slate-200/50 shadow-2xs">
                      <ResilientImage
                        src={card.imageDataUrl}
                        alt={card.word}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <span className="font-display font-black text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors px-1 text-center">
                      {card.word}
                    </span>
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
                  <span>🏎️ {settings.teamAName} (Đội Xanh)</span>
                  <span>{racePosA * 20}% Về đích</span>
                </div>
                <div className="h-10 bg-slate-800 rounded-xl relative overflow-hidden flex items-center px-2 border border-slate-700">
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-repeating-linear-gradient-45 from-white from-[0] to-black to-[10px] opacity-40" />
                  <div
                    className="absolute transition-all duration-500 ease-out flex items-center gap-1"
                    style={{ left: `calc(${racePosA * 18}% + 4px)` }}
                  >
                    <span className="text-2xl sm:text-3xl">🏎️</span>
                    <span className="text-[10px] font-bold bg-[#0284C7] px-1.5 py-0.5 rounded text-white shadow">
                      A
                    </span>
                  </div>
                </div>
              </div>

              {/* Lane B */}
              <div>
                <div className="flex justify-between text-xs font-bold text-rose-300 mb-1">
                  <span>🏎️ {settings.teamBName} (Đội Đỏ)</span>
                  <span>{racePosB * 20}% Về đích</span>
                </div>
                <div className="h-10 bg-slate-800 rounded-xl relative overflow-hidden flex items-center px-2 border border-slate-700">
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-repeating-linear-gradient-45 from-white from-[0] to-black to-[10px] opacity-40" />
                  <div
                    className="absolute transition-all duration-500 ease-out flex items-center gap-1"
                    style={{ left: `calc(${racePosB * 18}% + 4px)` }}
                  >
                    <span className="text-2xl sm:text-3xl">🏎️</span>
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
              Nghĩa tiếng Việt: <strong className="text-slate-800">{currentScrambleCard.meaning}</strong> · Phiên âm: <span className="font-mono">{currentScrambleCard.phonetic}</span>
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
                          {opt.word}
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
                  transition: isWheelSpinning ? 'transform 3.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
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

              <button
                type="button"
                onClick={handleSpinWheel}
                disabled={isWheelSpinning}
                className="mt-4 py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isWheelSpinning ? '🎡 Đang quay...' : '🎡 Bấm QUAY BÁNH XE'}
              </button>
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
                  Giỏ Chữ Cái A – M
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
                  Giỏ Chữ Cái N – Z
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
              Nghĩa: <strong className="text-slate-800">{currentSpellCard.meaning}</strong> · Phiên âm: <span className="font-mono">{currentSpellCard.phonetic}</span>
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
                  {currentTabooCard.phonetic} · {currentTabooCard.meaning}
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
                      🗝️ {opt.word}
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
                ? `🏆 Chúc mừng ${settings.teamAName} chiến thắng (${scoreA} - ${scoreB})!`
                : scoreB > scoreA
                ? `🏆 Chúc mừng ${settings.teamBName} chiến thắng (${scoreB} - ${scoreA})!`
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
