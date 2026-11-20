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
  Sparkles,
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

  // Requirement 1: English word revealed after clicking the image; Vietnamese has a separate button
  const [showEnglishWord, setShowEnglishWord] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);
  const [showExample, setShowExample] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setAutoPlay(false);
  }, [selectedDeckId]);

  const safeIndex = deckCards.length > 0 ? Math.min(activeIndex, deckCards.length - 1) : 0;
  const currentCard = deckCards[safeIndex];

  // Reset reveal states when switching cards
  useEffect(() => {
    setShowEnglishWord(false);
    setShowMeaning(false);
  }, [safeIndex, selectedDeckId]);

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

  const handleImageClick = useCallback(() => {
    if (!currentCard) return;
    if (!showEnglishWord) {
      setShowEnglishWord(true);
      playClassroomSfx('flip', settings.soundEffectsEnabled);
      handleSpeakCard(currentCard, false);
    } else {
      // Re-pronounce when clicking again
      handleSpeakCard(currentCard, false);
    }
  }, [currentCard, showEnglishWord, settings.soundEffectsEnabled, handleSpeakCard]);

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
        if (!showEnglishWord) {
          handleImageClick();
        } else {
          handleSpeakCard(currentCard, false);
        }
      } else if (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'v') {
        setShowMeaning((v) => !v);
      } else if (e.key === 'Escape' && isPresentationMode) {
        onTogglePresentationMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, handleNext, handlePrev, handleSpeakCard, handleImageClick, isPresentationMode, onTogglePresentationMode, showEnglishWord]);

  // Auto-play slideshow timer
  useEffect(() => {
    if (!autoPlay || deckCards.length === 0) return;
    setShowEnglishWord(true);
    handleSpeakCard(deckCards[safeIndex], false);
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % deckCards.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [autoPlay, deckCards, safeIndex, handleSpeakCard]);

  // ---------------- CLASSROOM PROJECTION OVERLAY ----------------
  if (isPresentationMode && currentCard) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col">
        {/* Presentation Header */}
        <div className="flex items-center justify-between gap-6 px-8 py-4 bg-white border-b border-emerald-100 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark logoDataUrl={settings.customLogoDataUrl} size="md" />
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-display font-bold text-lg text-[#15803d] whitespace-nowrap">
                {settings.brandTitle}
              </span>
              <span className="text-sm text-slate-500 truncate hidden sm:inline">
                {activeDeck?.title} · Thẻ {safeIndex + 1}/{deckCards.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Separate button to reveal Vietnamese meaning */}
            <button
              type="button"
              onClick={() => setShowMeaning((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#86efac] bg-[#ecfdf5] hover:bg-[#dcfce7] text-sm font-bold text-[#15803d] transition-colors cursor-pointer"
            >
              {showMeaning ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showMeaning ? 'Ẩn nghĩa Việt' : 'Click xem nghĩa tiếng Việt'}
            </button>

            <button
              type="button"
              onClick={onTogglePresentationMode}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              Thoát trình chiếu
            </button>
          </div>
        </div>

        {/* Presentation Body */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10 overflow-y-auto">
          <div className="w-full max-w-6xl bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch shadow-lg">
            {/* Left: Image with Click-to-Reveal */}
            <div
              onClick={handleImageClick}
              className="lg:col-span-7 bg-slate-100 relative min-h-[340px] lg:min-h-[540px] cursor-pointer group select-none"
              title={showEnglishWord ? 'Nhấn để nghe lại phát âm' : 'Nhấn vào ảnh để hiện từ tiếng Anh'}
            >
              <ResilientImage
                src={currentCard.imageDataUrl}
                alt={currentCard.word}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />

              {!showEnglishWord && (
                <div className="absolute inset-0 bg-black/15 group-hover:bg-black/25 flex items-end justify-center pb-8 transition-all">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/95 text-slate-900 font-bold text-sm sm:text-base shadow-lg group-hover:scale-105 transition-transform">
                    <span>👆 Nhấn vào bức ảnh để hiện từ tiếng Anh</span>
                  </span>
                </div>
              )}
            </div>

            {/* Right: Vocabulary Content (Refer to Image 1) */}
            <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="text-sm font-medium text-slate-500 tabular-nums">
                  {activeDeck?.subtitle || activeDeck?.title} · Từ {safeIndex + 1} / {deckCards.length}
                </div>

                {/* English Word Section: Hidden until image is clicked */}
                {showEnglishWord ? (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <h2 className="font-display font-extrabold text-5xl lg:text-6xl tracking-tight text-slate-900">
                      {currentCard.word}
                    </h2>
                    <p className="font-mono text-2xl text-[#0284C7] font-semibold">
                      {currentCard.phonetic}
                    </p>
                    {currentCard.syllables && (
                      <p className="text-base text-slate-600 font-medium">
                        Tách âm: <span className="font-bold text-slate-800">{currentCard.syllables}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="w-full p-6 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 transition-all text-center cursor-pointer group"
                  >
                    <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🖼️ 👆</div>
                    <div className="font-bold text-lg text-emerald-800">
                      Nhấn vào bức ảnh để hiện từ tiếng Anh
                    </div>
                    <div className="text-xs text-emerald-600 mt-1">
                      (Đoán từ trước cùng các bạn trong lớp nhé!)
                    </div>
                  </button>
                )}

                {/* Vietnamese Meaning Section: Separate Click Button (Requirement 1) */}
                <div className="pt-5 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Nghĩa tiếng Việt
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMeaning((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#86efac] bg-[#ecfdf5] hover:bg-[#dcfce7] text-xs font-bold text-[#15803d] transition-colors cursor-pointer"
                    >
                      {showMeaning ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showMeaning ? 'Ẩn nghĩa' : 'Click xem nghĩa tiếng Việt'}</span>
                    </button>
                  </div>

                  {showMeaning ? (
                    <div className="mt-1 font-display font-bold text-3xl lg:text-4xl text-slate-900 animate-in fade-in duration-200">
                      {currentCard.meaning}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMeaning(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-500 text-center transition-colors cursor-pointer"
                    >
                      Bấm vào đây để xem nghĩa tiếng Việt
                    </button>
                  )}
                </div>

                {/* Example Sentence Section */}
                {showExample && currentCard.example && (
                  <div className="pt-4 border-t border-slate-100 space-y-1.5">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Câu ví dụ
                    </div>
                    <p className="text-lg text-slate-700 leading-relaxed italic">
                      “{currentCard.example}”
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Pronunciation & Controls */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSpeakCard(currentCard, false)}
                    className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white font-bold text-base transition-colors shadow-xs cursor-pointer"
                  >
                    <Volume2 className={`w-5 h-5 ${isSpeaking ? 'scale-110' : ''} transition-transform`} />
                    Nghe phát âm
                  </button>
                  {currentCard.example && (
                    <button
                      type="button"
                      onClick={() => handleSpeakCard(currentCard, true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Đọc câu mẫu
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
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

  // ---------------- NORMAL STAGE MODE ----------------
  return (
    <div className="space-y-8">
      {/* Top Setting Bar: Speeds & Accents */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-emerald-100">
        <div>
          <p className="text-sm text-slate-500">
            {settings.classroomSubtitle} · Học liệu Nghe – Nhìn cục bộ
          </p>
          <h1 className="mt-1 font-display font-bold text-3xl lg:text-4xl tracking-tight text-slate-900">
            Sân khấu Từ vựng Tương tác
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Presentation Fullscreen Button */}
          <button
            type="button"
            onClick={onTogglePresentationMode}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Phóng to bài giảng</span>
          </button>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
            {[0.7, 0.85, 1.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onUpdateSettings({ speechRate: rate })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                  settings.speechRate === rate
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rate === 0.7 ? 'Chậm 0.7x' : rate === 0.85 ? 'Chuẩn 0.85x' : 'Nhanh 1.0x'}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
            {(['en-US', 'en-GB'] as const).map((accent) => (
              <button
                key={accent}
                type="button"
                onClick={() => onUpdateSettings({ voiceAccent: accent })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  settings.voiceAccent === accent
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {accent === 'en-US' ? 'Giọng Mỹ' : 'Giọng Anh'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Stage (8 cols) + Right Deck Queue (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-8 space-y-5">
          {!currentCard ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <p className="text-lg font-semibold text-slate-900">
                Bài học này chưa có thẻ từ vựng nào
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('studio')}
                className="px-5 py-2.5 rounded-xl bg-[#15803d] text-white text-sm font-bold hover:bg-[#166534] transition-colors cursor-pointer"
              >
                Mở Kho từ & Sách
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              {/* Picture Stage: Click on Image to Reveal Word */}
              <div
                onClick={handleImageClick}
                className="relative aspect-[16/10] bg-slate-100 overflow-hidden cursor-pointer group select-none"
                title={showEnglishWord ? 'Nhấn để nghe lại phát âm' : 'Nhấn vào ảnh để hiện từ tiếng Anh'}
              >
                <ResilientImage
                  src={currentCard.imageDataUrl}
                  alt={currentCard.word}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                />

                {/* Subtle Brand Stamp */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs">
                  <BrandMark logoDataUrl={settings.customLogoDataUrl} size="sm" />
                  <span className="text-xs font-bold text-[#15803d] whitespace-nowrap">
                    {settings.brandTitle}
                  </span>
                </div>

                {/* Click hint on image if word not revealed yet */}
                {!showEnglishWord && (
                  <div className="absolute inset-0 bg-black/15 group-hover:bg-black/25 flex items-end justify-center pb-6 transition-all">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 text-slate-900 font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
                      <span>👆 Nhấn vào ảnh để hiện từ tiếng Anh</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Vocabulary Content & Controls (Refer to Image 1) */}
              <div className="p-6 lg:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-500 tabular-nums">
                      {activeDeck?.subtitle || activeDeck?.title} · Từ {safeIndex + 1} / {deckCards.length}
                    </div>

                    {/* Word area: Shown only after clicking image */}
                    {showEnglishWord ? (
                      <div className="mt-2 space-y-1.5 animate-in fade-in duration-300">
                        <h2 className="font-display font-extrabold text-4xl lg:text-5xl tracking-tight text-slate-900">
                          {currentCard.word}
                        </h2>
                        <div className="font-mono text-xl text-[#0284C7] font-semibold">
                          {currentCard.phonetic}
                        </div>
                        {currentCard.syllables && (
                          <p className="text-sm text-slate-600 font-medium">
                            Tách âm: <span className="font-bold text-slate-800">{currentCard.syllables}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleImageClick}
                        className="mt-3 w-full p-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 transition-all text-center cursor-pointer group"
                      >
                        <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🖼️ 👆</div>
                        <div className="font-bold text-sm text-emerald-800">
                          Nhấn vào bức ảnh để hiện từ tiếng Anh
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Pronunciation Action Button */}
                  <button
                    type="button"
                    onClick={() => handleSpeakCard(currentCard, false)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs sm:text-sm transition-colors shrink-0 shadow-xs cursor-pointer"
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeaking ? 'scale-110' : ''} transition-transform`} />
                    {isSpeaking ? 'Đang phát âm...' : 'Nghe phát âm'}
                  </button>
                </div>

                {/* Meaning Section: Separate Click Button (Requirement 1) */}
                <div className="pt-5 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Nghĩa tiếng Việt
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMeaning((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#86efac] bg-[#ecfdf5] hover:bg-[#dcfce7] text-xs font-bold text-[#15803d] transition-colors cursor-pointer"
                    >
                      {showMeaning ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showMeaning ? 'Ẩn nghĩa' : 'Click xem nghĩa tiếng Việt'}</span>
                    </button>
                  </div>

                  {showMeaning ? (
                    <div className="font-display font-bold text-2xl lg:text-3xl text-slate-900 animate-in fade-in duration-200">
                      {currentCard.meaning}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMeaning(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-500 text-center transition-colors cursor-pointer"
                    >
                      Bấm vào đây để xem nghĩa tiếng Việt
                    </button>
                  )}
                </div>

                {/* Example sentence */}
                {showExample && currentCard.example && (
                  <div className="pt-4 border-t border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Câu ví dụ
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSpeakCard(currentCard, true)}
                        className="text-xs font-medium text-[#15803d] hover:underline cursor-pointer"
                      >
                        Nghe cả câu
                      </button>
                    </div>
                    <p className="text-sm sm:text-base text-slate-700 leading-relaxed italic">
                      “{currentCard.example}”
                    </p>
                  </div>
                )}

                {/* Navigation Bar: Prev / Next */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Từ trước
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onJumpToSpeaking(currentCard.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Luyện nói từ này
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Từ tiếp
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Lesson Deck Queue (4 cols) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-display font-bold text-base text-slate-900">
                {activeDeck?.title}
              </h2>
              <p className="text-xs text-slate-500">{activeDeck?.level}</p>
            </div>
            <span className="text-xs font-bold text-[#15803d] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              {deckCards.length} từ
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto pr-1">
            {deckCards.map((card, idx) => {
              const isCurrent = idx === safeIndex;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`w-full py-3 px-3 rounded-xl flex items-center justify-between gap-3 transition-colors text-left cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-50/80 border border-emerald-300'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      <ResilientImage
                        src={card.imageDataUrl}
                        alt={card.word}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold truncate ${
                          isCurrent ? 'text-[#15803d]' : 'text-slate-900'
                        }`}
                      >
                        {card.word}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {card.meaning}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= card.bestStars
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 fill-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
