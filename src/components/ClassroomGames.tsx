import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eraser,
  HelpCircle,
  RotateCcw,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Flame,
  Award,
} from 'lucide-react';
import type { BrandSettings, GameKind, LessonDeck, VocabCard } from '../types/edtech';
import { playClassroomSfx, speakVocabulary } from '../utils/mediaUtils';
import { triggerCelebration } from '../utils/celebration';
import { BrandMark } from './BrandMark';
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

export function ClassroomGames({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  settings,
  onUpdateSettings,
}: ClassroomGamesProps) {
  const [gameKind, setGameKind] = useState<GameKind>('memory');
  const [useAllDecks, setUseAllDecks] = useState(true);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [activeTeam, setActiveTeam] = useState<TeamKey>('A');
  const [bannerText, setBannerText] = useState('Chọn cặp thẻ hoặc từ khớp nhau để ghi điểm cho đội của mình.');
  const [isFinished, setIsFinished] = useState(false);

  const poolCards = useMemo(() => {
    const list = useAllDecks ? cards : cards.filter((c) => c.deckId === selectedDeckId);
    return list.slice(0, 8);
  }, [cards, selectedDeckId, useAllDecks]);

  // ---------------- GAME 1: MEMORY FLIP ----------------
  const [memoryTiles, setMemoryTiles] = useState<MemoryTile[]>([]);
  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [lockBoard, setLockBoard] = useState(false);

  // ---------------- GAME 2: WORD MATCH ----------------
  const [matchLeftCards, setMatchLeftCards] = useState<VocabCard[]>([]);
  const [matchRightCards, setMatchRightCards] = useState<VocabCard[]>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedCardTeams, setMatchedCardTeams] = useState<Record<string, TeamKey>>({});
  const [wrongPairFlash, setWrongPairFlash] = useState<string | null>(null);

  // ---------------- GAME 3: PICTURE SCRAMBLE ----------------
  const [scrambleQueue, setScrambleQueue] = useState<VocabCard[]>([]);
  const [scrambleIdx, setScrambleIdx] = useState(0);
  const [scrambleLetters, setScrambleLetters] = useState<ScrambleLetter[]>([]);
  const [builtLetters, setBuiltLetters] = useState<ScrambleLetter[]>([]);
  const [scrambleFeedback, setScrambleFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // ---------------- GAME 4: BUBBLE POP ----------------
  const [bubbleQueue, setBubbleQueue] = useState<VocabCard[]>([]);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const [bubbleChoices, setBubbleChoices] = useState<VocabCard[]>([]);
  const [poppedIds, setPoppedIds] = useState<string[]>([]);

  // ---------------- GAME 5: GRAND PRIX RACE ----------------
  const [racePosA, setRacePosA] = useState(0);
  const [racePosB, setRacePosB] = useState(0);
  const [raceIdx, setRaceIdx] = useState(0);
  const [raceChoices, setRaceChoices] = useState<VocabCard[]>([]);

  const buildScrambleForCard = useCallback((card: VocabCard | undefined) => {
    if (!card) {
      setScrambleLetters([]);
      setBuiltLetters([]);
      return;
    }
    const cleanWord = card.word.replace(/\s+/g, '').toUpperCase();
    const tiles: ScrambleLetter[] = cleanWord.split('').map((char, i) => ({
      id: `${card.id}-${i}-${char}`,
      char,
      used: false,
    }));
    setScrambleLetters(shuffleArray(tiles));
    setBuiltLetters([]);
    setScrambleFeedback('idle');
  }, []);

  const buildBubbleChoices = useCallback((targetCard: VocabCard, all: VocabCard[]) => {
    const distractors = all.filter((c) => c.id !== targetCard.id);
    const chosenDistractors = shuffleArray(distractors).slice(0, 3);
    setBubbleChoices(shuffleArray([targetCard, ...chosenDistractors]));
    setPoppedIds([]);
  }, []);

  const buildRaceChoices = useCallback((targetCard: VocabCard, all: VocabCard[]) => {
    const distractors = all.filter((c) => c.id !== targetCard.id);
    const chosenDistractors = shuffleArray(distractors).slice(0, 3);
    setRaceChoices(shuffleArray([targetCard, ...chosenDistractors]));
  }, []);

  const resetCurrentGame = useCallback(() => {
    setScoreA(0);
    setScoreB(0);
    setActiveTeam('A');
    setIsFinished(false);

    if (poolCards.length === 0) return;

    if (gameKind === 'memory') {
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
    } else if (gameKind === 'match') {
      const subset = poolCards.slice(0, 6);
      setMatchLeftCards(shuffleArray(subset));
      setMatchRightCards(shuffleArray(subset));
      setSelectedLeftId(null);
      setMatchedCardTeams({});
      setWrongPairFlash(null);
      setBannerText(`Lượt của ${settings.teamAName}: Chọn 1 bức tranh bên trái rồi nối với từ tiếng Anh bên phải.`);
    } else if (gameKind === 'scramble') {
      const shuffled = shuffleArray(poolCards);
      setScrambleQueue(shuffled);
      setScrambleIdx(0);
      buildScrambleForCard(shuffled[0]);
      setBannerText(`Lượt của ${settings.teamAName}: Nhìn tranh và ghép các chữ cái thành từ tiếng Anh đúng.`);
    } else if (gameKind === 'bubble') {
      const shuffled = shuffleArray(poolCards);
      setBubbleQueue(shuffled);
      setBubbleIdx(0);
      if (shuffled[0]) {
        buildBubbleChoices(shuffled[0], poolCards);
        speakVocabulary(shuffled[0].word, {
          audioDataUrl: shuffled[0].audioDataUrl,
          rate: settings.speechRate,
          accent: settings.voiceAccent,
        });
      }
      setBannerText(`Lượt của ${settings.teamAName}: Nghe phát âm và bấm nổ bong bóng từ vựng đúng!`);
    } else if (gameKind === 'race') {
      setRacePosA(0);
      setRacePosB(0);
      const shuffled = shuffleArray(poolCards);
      setRaceQueue(shuffled);
      setRaceIdx(0);
      if (shuffled[0]) {
        buildRaceChoices(shuffled[0], poolCards);
      }
      setBannerText(`Lượt của ${settings.teamAName}: Chọn đúng đáp án để nhấn ga vượt lên đích!`);
    }
  }, [buildBubbleChoices, buildRaceChoices, buildScrambleForCard, gameKind, poolCards, settings.speechRate, settings.teamAName, settings.voiceAccent]);

  // Helper state for race
  const [raceQueue, setRaceQueue] = useState<VocabCard[]>([]);

  useEffect(() => {
    resetCurrentGame();
  }, [resetCurrentGame]);

  const awardPoints = (team: TeamKey, pts: number) => {
    if (team === 'A') setScoreA((s) => s + pts);
    else setScoreB((s) => s + pts);
  };

  const nextTeamName = (t: TeamKey) => (t === 'A' ? settings.teamAName : settings.teamBName);

  // ---------------- MEMORY FLIP HANDLER ----------------
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
        window.setTimeout(() => {
          playClassroomSfx('match', settings.soundEffectsEnabled);
          speakVocabulary(first.label, {
            audioDataUrl: first.audioDataUrl,
            rate: settings.speechRate,
            accent: settings.voiceAccent,
          });
          awardPoints(activeTeam, 10);
          setMemoryTiles((prev) => {
            const updated = prev.map((t) =>
              t.cardId === first.cardId ? { ...t, matchedBy: activeTeam } : t
            );
            const allDone = updated.every((t) => t.matchedBy !== null);
            if (allDone) {
              setIsFinished(true);
              triggerCelebration();
              playClassroomSfx('victory', settings.soundEffectsEnabled);
              setBannerText('Hoàn thành bảng lật bài! Xem kết quả thi đấu bên trên.');
            } else {
              setBannerText(`Chính xác! ${nextTeamName(activeTeam)} ghi +10 điểm và được giữ lượt lật tiếp!`);
            }
            return updated;
          });
          setFlippedUids([]);
          setLockBoard(false);
        }, 420);
      } else {
        window.setTimeout(() => {
          playClassroomSfx('wrong', settings.soundEffectsEnabled);
          const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
          setActiveTeam(nextTeam);
          setBannerText(`Chưa khớp! Chuyển lượt sang ${nextTeamName(nextTeam)}.`);
          setFlippedUids([]);
          setLockBoard(false);
        }, 880);
      }
    }
  };

  // ---------------- WORD MATCH HANDLER ----------------
  const handleSelectMatchLeft = (leftCard: VocabCard) => {
    if (matchedCardTeams[leftCard.id]) return;
    setSelectedLeftId(leftCard.id);
    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setBannerText(`${nextTeamName(activeTeam)} đang chọn tranh "${leftCard.meaning}". Giờ hãy bấm vào từ tiếng Anh bên phải.`);
  };

  const handleSelectMatchRight = (rightCard: VocabCard) => {
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
      window.setTimeout(() => setWrongPairFlash(null), 600);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setSelectedLeftId(null);
      setBannerText(`Chưa đúng rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- SCRAMBLE HANDLERS ----------------
  const currentScrambleCard = scrambleQueue[scrambleIdx];

  const handlePickScrambleLetter = (letter: ScrambleLetter) => {
    if (letter.used || scrambleFeedback !== 'idle') return;
    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setScrambleLetters((prev) => prev.map((l) => (l.id === letter.id ? { ...l, used: true } : l)));
    const nextBuilt = [...builtLetters, letter];
    setBuiltLetters(nextBuilt);

    if (currentScrambleCard) {
      const cleanTarget = currentScrambleCard.word.replace(/\s+/g, '').toUpperCase();
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

          window.setTimeout(() => {
            const nextIdx = scrambleIdx + 1;
            if (nextIdx < scrambleQueue.length) {
              setScrambleIdx(nextIdx);
              buildScrambleForCard(scrambleQueue[nextIdx]);
              setBannerText(`Chính xác! +15 điểm cho ${nextTeamName(activeTeam)}.`);
            } else {
              setIsFinished(true);
              triggerCelebration();
              playClassroomSfx('victory', settings.soundEffectsEnabled);
              setBannerText('Hoàn thành tất cả từ vựng giải ô chữ!');
            }
          }, 1100);
        } else {
          setScrambleFeedback('wrong');
          playClassroomSfx('wrong', settings.soundEffectsEnabled);
          window.setTimeout(() => {
            setBuiltLetters([]);
            setScrambleLetters((prev) => prev.map((l) => ({ ...l, used: false })));
            setScrambleFeedback('idle');
            const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
            setActiveTeam(nextTeam);
            setBannerText(`Ghép chưa đúng! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
          }, 900);
        }
      }
    }
  };

  const handleSkipScrambleTurn = () => {
    const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
    setActiveTeam(nextTeam);
    setBannerText(`Đã nhường lượt sang ${nextTeamName(nextTeam)}.`);
  };

  // ---------------- BUBBLE POP HANDLER ----------------
  const currentBubbleTarget = bubbleQueue[bubbleIdx];

  const handleBubbleClick = (clickedCard: VocabCard) => {
    if (!currentBubbleTarget || isFinished || poppedIds.includes(clickedCard.id)) return;

    if (clickedCard.id === currentBubbleTarget.id) {
      // Correct bubble
      playClassroomSfx('match', settings.soundEffectsEnabled);
      setPoppedIds((prev) => [...prev, clickedCard.id]);
      awardPoints(activeTeam, 10);

      window.setTimeout(() => {
        const nextIdx = bubbleIdx + 1;
        if (nextIdx < bubbleQueue.length) {
          setBubbleIdx(nextIdx);
          buildBubbleChoices(bubbleQueue[nextIdx], poolCards);
          speakVocabulary(bubbleQueue[nextIdx].word, {
            audioDataUrl: bubbleQueue[nextIdx].audioDataUrl,
            rate: settings.speechRate,
            accent: settings.voiceAccent,
          });
          setBannerText(`Bùm! ${nextTeamName(activeTeam)} bắn trúng và ghi +10 điểm! Tiếp tục nào.`);
        } else {
          setIsFinished(true);
          triggerCelebration();
          playClassroomSfx('victory', settings.soundEffectsEnabled);
          setBannerText('Tuyệt đỉnh! Đã bắn nổ toàn bộ bóng từ vựng!');
        }
      }, 700);
    } else {
      // Wrong bubble
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Bắn nhầm bóng rồi! Đổi lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  // ---------------- GRAND PRIX RACE HANDLER ----------------
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
        setBannerText(`🏆 ${nextTeamName(activeTeam)} đã cán đích đầu tiên và giành chiến thắng Grand Prix!`);
      } else {
        const nextIdx = (raceIdx + 1) % raceQueue.length;
        setRaceIdx(nextIdx);
        buildRaceChoices(raceQueue[nextIdx], poolCards);
        setBannerText(`Rồ ga thành công! ${nextTeamName(activeTeam)} tiến thêm 1 trạm (+15 điểm)!`);
      }
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
      const nextTeam: TeamKey = activeTeam === 'A' ? 'B' : 'A';
      setActiveTeam(nextTeam);
      setBannerText(`Chưa đúng! Xe khựng lại, chuyển lượt sang ${nextTeamName(nextTeam)}.`);
    }
  };

  const winnerLabel =
    scoreA > scoreB
      ? `Chúc mừng ${settings.teamAName} chiến thắng vang dội!`
      : scoreB > scoreA
      ? `Chúc mừng ${settings.teamBName} chiến thắng ngoạn mục!`
      : 'Hai đội hòa điểm xuất sắc!';

  return (
    <div className="space-y-6">
      {/* Page Header & Game Mode Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500">
            Chế độ Thi đấu Lớp học (Versus Mode) · Tương tác hai đội trực tiếp trên màn hình
          </p>
          <h1 className="mt-1 font-display font-bold text-3xl lg:text-4xl tracking-tight text-slate-900">
            Trò chơi Ôn tập Từ vựng
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Game Kind Segmented Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full">
            {(
              [
                { id: 'memory', label: 'Lật bài trí nhớ' },
                { id: 'match', label: 'Nối từ siêu tốc' },
                { id: 'scramble', label: 'Ghép chữ' },
                { id: 'bubble', label: 'Bắn bong bóng 🎈' },
                { id: 'race', label: 'Đua xe Grand Prix 🏎️' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGameKind(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  gameKind === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ soundEffectsEnabled: !settings.soundEffectsEnabled })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {settings.soundEffectsEnabled ? (
              <Volume2 className="w-4 h-4 text-[#0284C7]" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            {settings.soundEffectsEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}
          </button>
        </div>
      </div>

      {/* Versus Mode Classroom Scoreboard */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Team A */}
          <button
            type="button"
            onClick={() => setActiveTeam('A')}
            className={`md:col-span-4 p-4 rounded-xl border text-left transition-all flex items-center justify-between gap-4 ${
              activeTeam === 'A'
                ? 'border-[#0284C7] bg-[#0284C7]/8 ring-2 ring-[#0284C7]/20 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0284C7]">
                <Users className="w-3.5 h-3.5" />
                <span>{activeTeam === 'A' ? 'Đang tới lượt chơi' : 'Nhấn để chọn lượt'}</span>
              </div>
              <div className="mt-1 font-display font-bold text-xl text-slate-900">
                {settings.teamAName}
              </div>
            </div>
            <div className="font-mono font-bold text-3xl text-[#0284C7] tabular-nums">
              {scoreA}
            </div>
          </button>

          {/* Center Controls & Branding */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center gap-2.5 px-2">
            <div className="flex items-center gap-2">
              <BrandMark logoDataUrl={settings.customLogoDataUrl} size="sm" />
              <span className="text-xs font-semibold text-slate-700">
                {settings.brandTitle} · Đấu trường lớp học
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <select
                aria-label="Nguồn từ vựng trò chơi"
                value={useAllDecks ? '__all__' : selectedDeckId}
                onChange={(e) => {
                  if (e.target.value === '__all__') {
                    setUseAllDecks(true);
                  } else {
                    setUseAllDecks(false);
                    onSelectDeck(e.target.value);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
              >
                <option value="__all__">Tất cả chủ đề ({cards.length} từ)</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={resetCurrentGame}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Chơi ván mới
              </button>
            </div>
          </div>

          {/* Team B */}
          <button
            type="button"
            onClick={() => setActiveTeam('B')}
            className={`md:col-span-4 p-4 rounded-xl border text-left transition-all flex items-center justify-between gap-4 ${
              activeTeam === 'B'
                ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/20 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                <Users className="w-3.5 h-3.5" />
                <span>{activeTeam === 'B' ? 'Đang tới lượt chơi' : 'Nhấn để chọn lượt'}</span>
              </div>
              <div className="mt-1 font-display font-bold text-xl text-slate-900">
                {settings.teamBName}
              </div>
            </div>
            <div className="font-mono font-bold text-3xl text-amber-600 tabular-nums">
              {scoreB}
            </div>
          </button>
        </div>

        {/* Turn Instruction Line */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-4 text-sm text-slate-700">
          <span className="font-medium text-sky-800">{bannerText}</span>
          <span className="text-xs text-slate-400 hidden sm:inline whitespace-nowrap">
            Chạm vào khung đội để đổi lượt thủ công
          </span>
        </div>
      </section>

      {/* Victory Banner */}
      {isFinished && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-slate-900">{winnerLabel}</h2>
              <p className="text-xs text-slate-600 mt-1">
                Tỷ số chung cuộc: {settings.teamAName} {scoreA} - {scoreB} {settings.teamBName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetCurrentGame}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            Chơi lại ván mới
          </button>
        </div>
      )}

      {/* GAME 1: MEMORY FLIP */}
      {gameKind === 'memory' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
            {memoryTiles.map((tile) => {
              const isFlipped = flippedUids.includes(tile.uid) || tile.matchedBy !== null;
              return (
                <button
                  key={tile.uid}
                  type="button"
                  onClick={() => handleMemoryTileClick(tile)}
                  className={`aspect-square rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center p-2 text-center select-none ${
                    isFlipped
                      ? tile.matchedBy === 'A'
                        ? 'border-[#0284C7] bg-[#0284C7]/10'
                        : tile.matchedBy === 'B'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-sky-400 bg-white'
                      : 'border-slate-300 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {isFlipped ? (
                    tile.kind === 'image' ? (
                      <ResilientImage
                        src={tile.imageUrl}
                        alt={tile.label}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="font-display font-bold text-sm sm:text-base text-slate-900 leading-tight">
                        {tile.label}
                      </span>
                    )
                  ) : (
                    <HelpCircle className="w-6 h-6 text-slate-400" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* GAME 2: WORD MATCH */}
      {gameKind === 'match' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Images */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">1. Chọn Hình Ảnh</h3>
              {matchLeftCards.map((card) => {
                const matchedTeam = matchedCardTeams[card.id];
                const isSelected = selectedLeftId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={!!matchedTeam}
                    onClick={() => handleSelectMatchLeft(card)}
                    className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-4 text-left ${
                      matchedTeam === 'A'
                        ? 'border-[#0284C7] bg-[#0284C7]/10 opacity-75'
                        : matchedTeam === 'B'
                        ? 'border-amber-500 bg-amber-50 opacity-75'
                        : isSelected
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <ResilientImage
                      src={card.imageDataUrl}
                      alt={card.word}
                      className="w-14 h-14 object-contain rounded-lg shrink-0 bg-slate-50"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-800">{card.meaning}</div>
                      <div className="text-xs text-slate-500 italic mt-0.5">{card.example}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Words */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">2. Nối Từ Tiếng Anh</h3>
              {matchRightCards.map((card) => {
                const matchedTeam = matchedCardTeams[card.id];
                const isWrongFlash = wrongPairFlash === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={!!matchedTeam}
                    onClick={() => handleSelectMatchRight(card)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left ${
                      matchedTeam === 'A'
                        ? 'border-[#0284C7] bg-[#0284C7]/10 opacity-75'
                        : matchedTeam === 'B'
                        ? 'border-amber-500 bg-amber-50 opacity-75'
                        : isWrongFlash
                        ? 'border-red-500 bg-red-50 animate-shake'
                        : 'border-slate-200 bg-white hover:border-sky-400'
                    }`}
                  >
                    <div>
                      <div className="text-lg font-bold text-slate-900">{card.word}</div>
                      <div className="text-xs text-sky-600 font-mono">{card.phonetic}</div>
                    </div>
                    {matchedTeam && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white shadow-xs">
                        {matchedTeam === 'A' ? settings.teamAName : settings.teamBName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* GAME 3: PICTURE SCRAMBLE */}
      {gameKind === 'scramble' && currentScrambleCard && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="w-48 h-48 sm:w-56 sm:h-56 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-center">
            <ResilientImage
              src={currentScrambleCard.imageDataUrl}
              alt={currentScrambleCard.word}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex-1 space-y-6 text-center md:text-left">
            <div>
              <span className="text-xs font-bold text-sky-600 uppercase tracking-wide">
                Từ vựng số {scrambleIdx + 1}/{scrambleQueue.length}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Gợi ý nghĩa: “{currentScrambleCard.meaning}”
              </h3>
              <p className="text-xs text-slate-500 italic mt-0.5">{currentScrambleCard.example}</p>
            </div>

            {/* Built letters slot */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              {currentScrambleCard.word.replace(/\s+/g, '').split('').map((_, i) => {
                const letter = builtLetters[i];
                return (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-xl font-display font-bold text-xl flex items-center justify-center border-2 ${
                      letter
                        ? scrambleFeedback === 'correct'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : scrambleFeedback === 'wrong'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-dashed border-slate-300 bg-slate-50 text-slate-300'
                    }`}
                  >
                    {letter?.char || ''}
                  </div>
                );
              })}
            </div>

            {/* Available letter pool */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              {scrambleLetters.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={l.used}
                  onClick={() => handlePickScrambleLetter(l)}
                  className={`w-11 h-11 rounded-xl font-bold text-lg border transition-all ${
                    l.used
                      ? 'bg-slate-100 text-slate-300 border-slate-200 scale-95'
                      : 'bg-white text-slate-800 border-slate-300 hover:border-sky-500 hover:text-sky-600 shadow-xs'
                  }`}
                >
                  {l.char}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start pt-2">
              <button
                type="button"
                onClick={() => {
                  setBuiltLetters([]);
                  setScrambleLetters((prev) => prev.map((l) => ({ ...l, used: false })));
                  setScrambleFeedback('idle');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Eraser className="w-3.5 h-3.5" />
                Xóa chữ ghép lại
              </button>
              <button
                type="button"
                onClick={handleSkipScrambleTurn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Nhường lượt đội bạn
              </button>
            </div>
          </div>
        </section>
      )}

      {/* GAME 4: BUBBLE POP */}
      {gameKind === 'bubble' && currentBubbleTarget && (
        <section className="bg-gradient-to-b from-sky-50/60 to-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-sky-100 pb-4">
            <div>
              <span className="text-xs font-bold text-sky-700 uppercase tracking-wide">
                Bong bóng mục tiêu {bubbleIdx + 1}/{bubbleQueue.length}
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                Tìm từ: <span className="text-sky-600">“{currentBubbleTarget.meaning}”</span>
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                speakVocabulary(currentBubbleTarget.word, {
                  audioDataUrl: currentBubbleTarget.audioDataUrl,
                  rate: settings.speechRate,
                  accent: settings.voiceAccent,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span>Nghe lại phát âm</span>
            </button>
          </div>

          {/* Floating Bubble Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6">
            {bubbleChoices.map((card, i) => {
              const isPopped = poppedIds.includes(card.id);
              const bubbleColors = [
                'from-rose-400 to-pink-500',
                'from-sky-400 to-blue-500',
                'from-amber-400 to-orange-500',
                'from-emerald-400 to-teal-500',
              ];
              const color = bubbleColors[i % bubbleColors.length];

              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={isPopped}
                  onClick={() => handleBubbleClick(card)}
                  className={`relative aspect-square rounded-full flex flex-col items-center justify-center p-4 text-white shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-br ${color} ${
                    isPopped ? 'scale-0 opacity-0 pointer-events-none' : 'opacity-100 animate-bounce'
                  }`}
                  style={{ animationDuration: `${2.2 + (i % 3) * 0.4}s` }}
                >
                  {/* Glossy highlight reflection */}
                  <div className="absolute top-2 left-4 w-6 h-3 bg-white/40 rounded-full blur-[1px]"></div>
                  <span className="text-2xl font-black drop-shadow-md">{card.word}</span>
                  <span className="text-xs text-white/90 font-mono mt-0.5 drop-shadow-xs">{card.phonetic}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* GAME 5: GRAND PRIX RACE */}
      {gameKind === 'race' && currentRaceTarget && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Race Tracks */}
          <div className="space-y-4 bg-slate-900 rounded-2xl p-6 text-white shadow-inner">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800 pb-2">
              <span>ĐƯỜNG ĐUA GRAND PRIX (5 TRẠM TỐC ĐỘ)</span>
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <Trophy className="w-3.5 h-3.5" /> ĐÍCH ĐẾN
              </span>
            </div>

            {/* Track 1: Team A */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-sky-400">
                <span>{settings.teamAName}</span>
                <span>Trạm {racePosA}/5</span>
              </div>
              <div className="relative h-10 bg-slate-800 rounded-lg flex items-center px-3 border border-slate-700">
                <div
                  className="absolute transition-all duration-500 ease-out flex items-center gap-1 text-2xl"
                  style={{ left: `${Math.min(92, racePosA * 18 + 2)}%` }}
                >
                  🏎️
                </div>
              </div>
            </div>

            {/* Track 2: Team B */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-amber-400">
                <span>{settings.teamBName}</span>
                <span>Trạm {racePosB}/5</span>
              </div>
              <div className="relative h-10 bg-slate-800 rounded-lg flex items-center px-3 border border-slate-700">
                <div
                  className="absolute transition-all duration-500 ease-out flex items-center gap-1 text-2xl"
                  style={{ left: `${Math.min(92, racePosB * 18 + 2)}%` }}
                >
                  🚗
                </div>
              </div>
            </div>
          </div>

          {/* Question Box */}
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-sky-600 uppercase">
              Lượt đua của: <strong>{nextTeamName(activeTeam)}</strong>
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              Từ tiếng Anh nào mang nghĩa: <span className="text-sky-600">“{currentRaceTarget.meaning}”</span>?
            </h3>
            <p className="text-xs text-slate-500">“{currentRaceTarget.example}”</p>

            {/* 4 Choices */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              {raceChoices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleRaceAnswer(c)}
                  className="p-4 rounded-xl border-2 border-slate-200 hover:border-sky-500 bg-white hover:bg-sky-50/50 text-slate-800 font-bold text-base transition-all shadow-xs flex flex-col items-center justify-center gap-0.5"
                >
                  <span>{c.word}</span>
                  <span className="text-xs font-mono font-normal text-slate-400">{c.phonetic}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
