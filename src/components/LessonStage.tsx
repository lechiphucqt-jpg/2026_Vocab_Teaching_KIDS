import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Star,
  Volume2,
  Mic,
  Gamepad2,
} from 'lucide-react';
import type { BrandSettings, LessonDeck, NavTab, VocabCard } from '../types/edtech';
import { playClassroomSfx, speakVocabulary } from '../utils/mediaUtils';
import { BrandMark } from './BrandMark';
import { ResilientImage } from './ResilientImage';

interface LessonStageProps {
  decks: LessonDeck[];
  cards: VocabCard[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  settings: BrandSettings;
  onUpdateSettings: (partial: Partial<BrandSettings>) => void;
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onJumpToSpeaking: (cardId: string) => void;
}

export function LessonStage({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  settings,
  onUpdateSettings,
  isPresentationMode,
  onTogglePresentationMode,
  onNavigateTab,
  onJumpToSpeaking,
}: LessonStageProps) {
  const deckCards = useMemo(
    () =>
      cards
        .filter((c) => c.deckId === selectedDeckId)
        .sort((a, b) => a.order - b.order),
    [cards, selectedDeckId]
  );

  const activeDeck = decks.find((d) => d.id === selectedDeckId) ?? decks[0];
  const [activeIndex, setActiveIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(true);
  const [showExample, setShowExample] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setAutoPlay(false);
  }, [selectedDeckId]);

  const safeIndex = deckCards.length > 0 ? Math.min(activeIndex, deckCards.length - 1) : 0;
  const currentCard = deckCards[safeIndex];

  const handleSpeakCard = useCallback(
    (card: VocabCard | undefined, speakSentence = false) => {
      if (!card) return;
      const text = speakSentence ? card.example : card.word;
      speakVocabulary(text, {
        audioDataUrl: speakSentence ? undefined : card.audioDataUrl,
        rate: settings.speechRate,
        accent: settings.voiceAccent,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    },
    [settings.speechRate, settings.voiceAccent]
  );

  const handleNext = useCallback(() => {
    if (deckCards.length === 0) return;
    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setActiveIndex((prev) => (prev + 1) % deckCards.length);
  }, [deckCards.length, settings.soundEffectsEnabled]);

  const handlePrev = useCallback(() => {
    if (deckCards.length === 0) return;
    playClassroomSfx('flip', settings.soundEffectsEnabled);
    setActiveIndex((prev) => (prev - 1 + deckCards.length) % deckCards.length);
  }, [deckCards.length, settings.soundEffectsEnabled]);

  // Keyboard presenter remote support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleSpeakCard(currentCard, false);
      } else if (e.key.toLowerCase() === 'm') {
        setShowMeaning((v) => !v);
      } else if (e.key === 'Escape' && isPresentationMode) {
        onTogglePresentationMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, handleNext, handlePrev, handleSpeakCard, isPresentationMode, onTogglePresentationMode]);

  // Auto-play slideshow timer
  useEffect(() => {
    if (!autoPlay || deckCards.length === 0) return;
    handleSpeakCard(deckCards[safeIndex], false);
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % deckCards.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [autoPlay, deckCards, safeIndex, handleSpeakCard]);

  // Distraction-free Classroom Projection Overlay
  if (isPresentationMode && currentCard) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col">
        <div className="flex items-center justify-between gap-6 px-8 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark logoDataUrl={settings.customLogoDataUrl} size="md" />
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-display font-bold text-lg text-slate-900 whitespace-nowrap">
                {settings.brandTitle}
              </span>
              <span className="text-sm text-slate-500 truncate hidden sm:inline">
                {activeDeck?.title} · Thẻ {safeIndex + 1}/{deckCards.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowMeaning((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              {showMeaning ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showMeaning ? 'Ẩn nghĩa Việt' : 'Hiện nghĩa Việt'}
            </button>
            <button
              type="button"
              onClick={onTogglePresentationMode}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Minimize2 className="w-4 h-4" />
              Thoát trình chiếu
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-10 overflow-y-auto">
          <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 bg-slate-100 relative min-h-[340px] lg:min-h-[540px]">
              <ResilientImage
                src={currentCard.imageDataUrl}
                alt={currentCard.word}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="text-sm text-slate-500 tabular-nums">
                  {activeDeck?.subtitle} · Từ {safeIndex + 1} / {deckCards.length}
                </div>

                <div>
                  <h2 className="font-display font-bold text-5xl lg:text-6xl tracking-tight text-slate-900">
                    {currentCard.word}
                  </h2>
                  <p className="mt-2 font-mono text-xl text-[#0284C7]">
                    {currentCard.phonetic}
                  </p>
                  {currentCard.syllables && (
                    <p className="mt-1.5 text-base text-slate-500">
                      Tách âm: <span className="font-medium text-slate-700">{currentCard.syllables}</span>
                    </p>
                  )}
                </div>

                {showMeaning && (
                  <div className="pt-5 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-500">Nghĩa tiếng Việt</div>
                    <div className="mt-1 font-display font-semibold text-3xl text-slate-900">
                      {currentCard.meaning}
                    </div>
                  </div>
                )}

                {showExample && currentCard.example && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="text-xs font-medium text-slate-500">Câu ví dụ</div>
                    <p className="mt-1 text-lg text-slate-700 leading-relaxed">
                      “{currentCard.example}”
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSpeakCard(currentCard, false)}
                    className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0284C7] text-white font-semibold text-base hover:bg-[#0369A1] transition-colors whitespace-nowrap"
                  >
                    <Volume2 className={`w-5 h-5 ${isSpeaking ? 'scale-110' : ''} transition-transform`} />
                    Nghe phát âm
                  </button>
                  {currentCard.example && (
                    <button
                      type="button"
                      onClick={() => handleSpeakCard(currentCard, true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      Đọc câu mẫu
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Từ trước
                  </button>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Phím Space: Nghe · Mũi tên: Chuyển thẻ
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    Từ tiếp
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title & Active Lesson Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500">
            {settings.classroomSubtitle} · Học liệu Nghe – Nhìn cục bộ
          </p>
          <h1 className="mt-1 font-display font-bold text-3xl lg:text-4xl tracking-tight text-slate-900">
            Sân khấu Từ vựng Tương tác
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            {[0.7, 0.85, 1.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onUpdateSettings({ speechRate: rate })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                  settings.speechRate === rate
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rate === 0.7 ? 'Chậm 0.7x' : rate === 0.85 ? 'Chuẩn 0.85x' : 'Nhanh 1.0x'}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            {(['en-US', 'en-GB'] as const).map((accent) => (
              <button
                key={accent}
                type="button"
                onClick={() => onUpdateSettings({ voiceAccent: accent })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  settings.voiceAccent === accent
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {accent === 'en-US' ? 'Giọng Mỹ' : 'Giọng Anh'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-Zone Educational Layout: Left Interactive Stage (8 cols) + Right Lesson & Deck Control Deck (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Visual-Auditory Stage */}
        <section className="lg:col-span-8 space-y-5">
          {!currentCard ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <p className="text-lg font-semibold text-slate-900">
                Bài học này chưa có thẻ từ vựng nào
              </p>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Thầy cô hãy chuyển sang mục Kho từ & Sách để thêm từ vựng mới hoặc cắt hình ảnh trực tiếp từ trang sách giáo khoa.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('studio')}
                className="px-5 py-2.5 rounded-lg bg-[#0284C7] text-white text-sm font-medium hover:bg-[#0369A1] transition-colors"
              >
                Mở Kho từ & Sách
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* Visual Illustration Stage */}
                <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                  <ResilientImage
                    src={currentCard.imageDataUrl}
                    alt={currentCard.word}
                    className="w-full h-full object-cover"
                  />

                  {/* Subtle Brand Stamp on Stage */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/92 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200/80">
                    <BrandMark logoDataUrl={settings.customLogoDataUrl} size="sm" />
                    <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {settings.brandTitle}
                    </span>
                  </div>

                  {/* Expand Projection Button */}
                  <button
                    type="button"
                    onClick={onTogglePresentationMode}
                    title="Phóng to toàn màn hình trình chiếu lớp học"
                    className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-white/92 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200/80 text-xs font-medium text-slate-700 hover:bg-white transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Phóng to bảng
                  </button>
                </div>

                {/* Vocabulary Content & Controls */}
                <div className="p-6 lg:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {activeDeck?.title} · Thẻ {safeIndex + 1} / {deckCards.length}
                        {currentCard.audioDataUrl ? ' · Có giọng thu âm riêng của giáo viên' : ' · Giọng đọc chuẩn bản ngữ'}
                      </div>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight text-slate-900">
                          {currentCard.word}
                        </h2>
                        <span className="font-mono text-lg text-[#0284C7]">
                          {currentCard.phonetic}
                        </span>
                      </div>
                      {currentCard.syllables && (
                        <p className="mt-1.5 text-sm text-slate-500">
                          Âm tiết: <span className="font-medium text-slate-700">{currentCard.syllables}</span>
                        </p>
                      )}
                    </div>

                    {/* Pronunciation Action Button */}
                    <button
                      type="button"
                      onClick={() => handleSpeakCard(currentCard, false)}
                      className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0284C7] text-white font-semibold text-sm hover:bg-[#0369A1] transition-colors shrink-0 whitespace-nowrap"
                    >
                      <Volume2 className={`w-5 h-5 ${isSpeaking ? 'scale-110' : ''} transition-transform`} />
                      {isSpeaking ? 'Đang phát âm...' : 'Nghe phát âm'}
                    </button>
                  </div>

                  {/* Meaning & Example Split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-200">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Nghĩa tiếng Việt
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowMeaning((v) => !v)}
                          className="text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap"
                        >
                          {showMeaning ? 'Che nghĩa' : 'Hiện nghĩa'}
                        </button>
                      </div>
                      <p className="mt-1.5 font-display font-semibold text-2xl text-slate-900">
                        {showMeaning ? currentCard.meaning : '••••••••'}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Câu ví dụ ngữ cảnh
                        </span>
                        <div className="flex items-center gap-3">
                          {currentCard.example && (
                            <button
                              type="button"
                              onClick={() => handleSpeakCard(currentCard, true)}
                              className="text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap"
                            >
                              Nghe cả câu
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowExample((v) => !v)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap"
                          >
                            {showExample ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">
                        {showExample
                          ? currentCard.example || 'Chưa có câu ví dụ.'
                          : 'Nhấn “Hiện” để xem câu ví dụ.'}
                      </p>
                    </div>
                  </div>

                  {/* Stage Footer Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrev}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Thẻ trước
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Thẻ sau
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoPlay((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                          autoPlay
                            ? 'border-[#0284C7] bg-[#0284C7]/10 text-[#0284C7]'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {autoPlay ? 'Dừng tự động' : 'Tự động phát'}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-1"
                        title={`Thành tích luyện nói cao nhất: ${currentCard.bestStars}/5 sao`}
                      >
                        {[1, 2, 3, 4, 5].map((starIdx) => (
                          <Star
                            key={starIdx}
                            className={`w-4 h-4 ${
                              starIdx <= currentCard.bestStars
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => onJumpToSpeaking(currentCard.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        <Mic className="w-4 h-4" />
                        Luyện nói từ này
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thumbnail Filmstrip for Quick Jump */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {deckCards.map((card, idx) => {
                  const isActive = idx === safeIndex;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setActiveIndex(idx);
                        handleSpeakCard(card, false);
                      }}
                      className={`group text-left bg-white rounded-xl overflow-hidden border transition-all ${
                        isActive
                          ? 'border-[#0284C7] ring-2 ring-[#0284C7]/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                        <ResilientImage
                          src={card.imageDataUrl}
                          alt={card.word}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                      </div>
                      <div className="p-2.5">
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {card.word}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {card.meaning}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Right Control & Lesson Deck Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Deck Selector */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg text-slate-900">
                Chọn bài giảng
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {decks.length} chủ đề
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {decks.map((deck) => {
                const count = cards.filter((c) => c.deckId === deck.id).length;
                const isSelected = deck.id === selectedDeckId;
                return (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => onSelectDeck(deck.id)}
                    className={`w-full text-left py-3.5 px-3 -mx-3 rounded-lg transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#0284C7]/8 text-[#0284C7]'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`font-semibold text-sm truncate ${isSelected ? 'text-[#0284C7]' : 'text-slate-900'}`}>
                        {deck.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {deck.subtitle} · {deck.level}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                      {count} từ
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Classroom Activity Launchers */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display font-semibold text-lg text-slate-900">
              Hoạt động tiếp nối trên lớp
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sau khi giới thiệu từ mới bằng Flashcard, giáo viên có thể chuyển ngay sang luyện phát âm hoặc tổ chức thi đấu hai đội.
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab('speaking')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-[#0284C7]" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Phòng Luyện nói 1–5 sao</div>
                    <div className="text-xs text-slate-500">Chấm phát âm & thu âm nghe lại</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('games')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Gamepad2 className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Thi đấu Versus Mode</div>
                    <div className="text-xs text-slate-500">Lật bài · Nối từ · Đuổi hình bắt chữ</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Presenter Shortcuts Reference */}
          <div className="px-1 text-xs text-slate-500 space-y-1.5">
            <div className="font-medium text-slate-700">Phím tắt điều khiển khi giảng dạy</div>
            <div className="flex items-center justify-between">
              <span>Phát âm từ hiện tại</span>
              <span className="font-mono text-slate-700">Space</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Chuyển thẻ trước / sau</span>
              <span className="font-mono text-slate-700">← / →</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ẩn hoặc hiện nghĩa tiếng Việt</span>
              <span className="font-mono text-slate-700">M</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
