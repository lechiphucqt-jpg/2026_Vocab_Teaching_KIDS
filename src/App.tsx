import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Menu, Presentation, Sparkles, X } from 'lucide-react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { BrandingSettings } from './components/BrandingSettings';
import { BrandMark } from './components/BrandMark';
import { ClassroomGames } from './components/ClassroomGames';
import { ContentStudio } from './components/ContentStudio';
import { LessonStage } from './components/LessonStage';
import { PrintMaterialsStudio } from './components/PrintMaterialsStudio';
import { ProgressAnalytics } from './components/ProgressAnalytics';
import { SpeakingStudio } from './components/SpeakingStudio';
import { DEFAULT_BRAND_SETTINGS } from './data/seedData';
import {
  buildPortableExportPackage,
  computeStorageStats,
  importPortablePackage,
  initAndLoadLocalDb,
  removeCard,
  removeDeck,
  resetToSampleData,
  saveCard,
  saveCardsBatch,
  saveDeck,
  saveSettings,
} from './db/localDb';
import type { BrandSettings, ExportPackage, LessonDeck, NavTab, VocabCard } from './types/edtech';
import { getStoredApiKey } from './utils/geminiService';

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'lessons', label: 'Bài học' },
  { id: 'speaking', label: 'Luyện nói & AI' },
  { id: 'games', label: 'Trò chơi' },
  { id: 'materials', label: 'Học liệu & In ấn' },
  { id: 'analytics', label: 'Tiến độ & Vườn hoa' },
  { id: 'studio', label: 'Kho từ & Sách' },
  { id: 'branding', label: 'Thương hiệu' },
];

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [decks, setDecks] = useState<LessonDeck[]>([]);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT_BRAND_SETTINGS);
  const [activeTab, setActiveTab] = useState<NavTab>('lessons');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('deck-animals');
  const [speakingFocusCardId, setSpeakingFocusCardId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Api Key Modal state
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Classroom cumulative game scores
  const [scoreA, setScoreA] = useState(25);
  const [scoreB, setScoreB] = useState(20);

  useEffect(() => {
    let cancelled = false;
    initAndLoadLocalDb()
      .then((state) => {
        if (cancelled) return;
        setDecks(state.decks);
        setCards(state.cards);
        setSettings(state.settings);
        if (state.decks.length > 0) {
          setSelectedDeckId(state.decks[0].id);
        }
        setHydrated(true);

        // Check if API key is already configured; if not, open modal prompt as per AI_INSTRUCTIONS.md
        if (!getStoredApiKey()) {
          setTimeout(() => setIsApiKeyModalOpen(true), 600);
        }
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const storageStats = useMemo(
    () => computeStorageStats(decks, cards, settings),
    [decks, cards, settings]
  );

  const handleUpdateSettings = (partial: Partial<BrandSettings>) => {
    setSettings((prev) => {
      const next: BrandSettings = {
        ...prev,
        ...partial,
        id: 'primary',
        brandTitle: 'Tiếng Anh Thầy Phúc',
      };
      saveSettings(next).catch(() => {});
      return next;
    });
  };

  const handleCreateDeck = async (title: string, subtitle: string, level: string) => {
    const newDeck: LessonDeck = {
      id: `deck-${Date.now()}`,
      title,
      subtitle,
      level,
      createdAt: Date.now(),
      order: decks.length,
    };
    await saveDeck(newDeck);
    setDecks((prev) => [...prev, newDeck]);
    return newDeck.id;
  };

  const handleDeleteDeck = async (deckId: string) => {
    await removeDeck(deckId);
    const remainingDecks = decks.filter((d) => d.id !== deckId);
    setDecks(remainingDecks);
    setCards((prev) => prev.filter((c) => c.deckId !== deckId));
    if (selectedDeckId === deckId && remainingDecks[0]) {
      setSelectedDeckId(remainingDecks[0].id);
    }
  };

  const handleSaveCard = async (card: VocabCard) => {
    await saveCard(card);
    setCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) {
        return prev.map((c) => (c.id === card.id ? card : c));
      }
      return [...prev, card];
    });
  };

  const handleDeleteCard = async (cardId: string) => {
    await removeCard(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleReorderDeckCards = async (deckId: string, orderedCards: VocabCard[]) => {
    await saveCardsBatch(orderedCards);
    setCards((prev) => {
      const others = prev.filter((c) => c.deckId !== deckId);
      return [...others, ...orderedCards];
    });
  };

  const handleSaveCardStars = (cardId: string, stars: number) => {
    const target = cards.find((c) => c.id === cardId);
    if (!target) return;
    const updated: VocabCard = {
      ...target,
      bestStars: Math.max(target.bestStars, stars),
      lastPracticedAt: Date.now(),
      practiceCount: (target.practiceCount || 0) + 1,
    };
    handleSaveCard(updated).catch(() => {});
  };

  const handleExportPackage = async () => {
    const pkg = await buildPortableExportPackage(decks, cards, settings);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tieng-anh-thay-phuc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportPackage = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as ExportPackage;
    const nextState = await importPortablePackage(parsed);
    setDecks(nextState.decks);
    setCards(nextState.cards);
    setSettings(nextState.settings);
    if (nextState.decks[0]) {
      setSelectedDeckId(nextState.decks[0].id);
    }
  };

  const handleResetSampleData = async () => {
    const fresh = await resetToSampleData();
    setDecks(fresh.decks);
    setCards(fresh.cards);
    setSettings(fresh.settings);
    if (fresh.decks[0]) {
      setSelectedDeckId(fresh.decks[0].id);
    }
  };

  const handleEnterPresentation = () => {
    setActiveTab('lessons');
    setIsPresentationMode(true);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Fixed Brand Wordmark + Dynamic Custom Logo */}
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left cursor-pointer"
          >
            <BrandMark logoDataUrl={settings.customLogoDataUrl} size="md" />
            <span className="font-display font-bold text-lg tracking-tight text-slate-900 whitespace-nowrap">
              {settings.brandTitle}
            </span>
          </button>

          {/* Zone 2: Single-Line Clean Text Nav Links */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden lg:flex items-center gap-5 text-sm font-medium overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                    isActive
                      ? 'border-[#0284C7] text-[#0284C7] font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Settings (API Key) with Red Instruction Text + Presentation Mode */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Required by AI_INSTRUCTIONS.md: Settings (API Key) button with red text */}
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex flex-col items-end text-right px-2.5 py-1 rounded-xl border border-slate-200 hover:border-sky-300 bg-white hover:bg-slate-50 transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 group-hover:text-sky-600">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>Settings (API Key)</span>
              </div>
              <span className="text-[10px] font-bold text-red-600 animate-pulse">
                Lấy API key để sử dụng app
              </span>
            </button>

            <button
              type="button"
              onClick={handleEnterPresentation}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0284C7] text-white text-xs sm:text-sm font-semibold hover:bg-[#0369A1] transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
            >
              <Presentation className="w-4 h-4" />
              <span className="hidden sm:inline">Trình chiếu</span>
            </button>

            <button
              type="button"
              aria-label="Mở menu điều hướng"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#0284C7]/10 text-[#0284C7] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hydrated ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Đang tải dữ liệu bài giảng cục bộ từ IndexedDB...
          </div>
        ) : (
          <>
            {activeTab === 'lessons' && (
              <LessonStage
                decks={decks}
                cards={cards}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                isPresentationMode={isPresentationMode}
                onTogglePresentationMode={() => setIsPresentationMode((v) => !v)}
                onNavigateTab={setActiveTab}
                onJumpToSpeaking={(cardId) => {
                  setSpeakingFocusCardId(cardId);
                  setActiveTab('speaking');
                }}
              />
            )}

            {activeTab === 'speaking' && (
              <SpeakingStudio
                decks={decks}
                cards={cards}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
                initialCardId={speakingFocusCardId}
                settings={settings}
                onSaveCardStars={handleSaveCardStars}
              />
            )}

            {activeTab === 'games' && (
              <ClassroomGames
                decks={decks}
                cards={cards}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === 'materials' && (
              <PrintMaterialsStudio
                decks={decks}
                cards={cards}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
                settings={settings}
              />
            )}

            {activeTab === 'analytics' && (
              <ProgressAnalytics
                decks={decks}
                cards={cards}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
                settings={settings}
                scoreA={scoreA}
                scoreB={scoreB}
              />
            )}

            {activeTab === 'studio' && (
              <ContentStudio
                decks={decks}
                cards={cards}
                selectedDeckId={selectedDeckId}
                onSelectDeck={setSelectedDeckId}
                settings={settings}
                onCreateDeck={handleCreateDeck}
                onDeleteDeck={handleDeleteDeck}
                onSaveCard={handleSaveCard}
                onDeleteCard={handleDeleteCard}
                onReorderDeckCards={handleReorderDeckCards}
              />
            )}

            {activeTab === 'branding' && (
              <BrandingSettings
                settings={settings}
                storageStats={storageStats}
                decks={decks}
                cards={cards}
                onUpdateSettings={handleUpdateSettings}
                onExportPackage={handleExportPackage}
                onImportPackage={handleImportPackage}
                onResetSampleData={handleResetSampleData}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Persistent Brand Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <BrandMark logoDataUrl={settings.customLogoDataUrl} size="sm" />
            <span className="font-semibold text-slate-800">{settings.brandTitle}</span>
            <span aria-hidden="true">·</span>
            <span>Lưu trữ cục bộ IndexedDB · Hỗ trợ xuất PowerPoint, Word, Moodle LMS</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="hover:text-sky-600 transition-colors whitespace-nowrap cursor-pointer font-medium text-slate-700"
            >
              Cài đặt Gemini AI Key
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('materials')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              In Phiếu & Tải Slide
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleExportPackage}
              className="hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              Sao lưu (.json)
            </button>
          </div>
        </div>
      </footer>

      {/* Required API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
