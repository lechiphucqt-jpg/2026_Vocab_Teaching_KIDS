import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  ExternalLink,
  FileUp,
  FolderOpen,
  HardDrive,
  KeyRound,
  Maximize2,
  Menu,
  Minimize2,
  Plus,
  Presentation,
  Save,
  Sparkles,
  Upload,
  X,
  Check,
} from 'lucide-react';
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
import {
  ensureDirectoryHandleAndPermission,
  getSavedDirectoryName,
  pickAndSaveLocalDirectory,
  saveActiveDatabaseToDirectory,
  saveFileToChosenDirectory,
} from './utils/localStorageDirectory';

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
  // Google Drive Modal state
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);

  // Zoom Controller state (A- 110% A+)
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Local Computer Storage state
  const [localDirName, setLocalDirName] = useState<string | null>(getSavedDirectoryName());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Classroom cumulative game scores
  const [scoreA, setScoreA] = useState(25);
  const [scoreB, setScoreB] = useState(20);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3600);
  };

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

        if (!getStoredApiKey()) {
          setTimeout(() => setIsApiKeyModalOpen(true), 800);
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

  const activeDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) || decks[0],
    [decks, selectedDeckId]
  );

  const currentDeckCardsCount = useMemo(
    () => cards.filter((c) => c.deckId === selectedDeckId).length,
    [cards, selectedDeckId]
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
    showToast('Đã tải gói sao lưu (.json) về máy tính.');
  };

  const handleImportPackage = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ExportPackage;
      const nextState = await importPortablePackage(parsed);
      setDecks(nextState.decks);
      setCards(nextState.cards);
      setSettings(nextState.settings);
      if (nextState.decks[0]) {
        setSelectedDeckId(nextState.decks[0].id);
      }
      showToast(`Đã nhập đề thành công! Gồm ${nextState.decks.length} chủ đề và ${nextState.cards.length} từ vựng.`);
    } catch {
      showToast('Tệp không đúng định dạng JSON gói bài giảng.');
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

  // Zoom control handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(140, prev + 10));
  };
  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(80, prev - 10));
  };

  // Fullscreen handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleReloadActiveDatabase = async (jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent) as ExportPackage;
      const nextState = await importPortablePackage(parsed);
      setDecks(nextState.decks);
      setCards(nextState.cards);
      setSettings(nextState.settings);
      if (nextState.decks[0]) {
        setSelectedDeckId(nextState.decks[0].id);
      }
      setStorageStats(computeStorageStats(nextState.decks, nextState.cards, nextState.settings));
      showToast(`🎉 Đã nạp thành công ${nextState.decks.length} chủ đề và ${nextState.cards.length} thẻ từ thư mục máy tính!`);
    } catch (err: unknown) {
      showToast(`Không thể nạp dữ liệu: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Local Computer Directory Picker & Save (Requirement 2 & Image 3)
  const handlePickOrSaveLocalDir = async () => {
    try {
      showToast('Đang kết nối thư mục máy tính...');
      const dirCheck = await ensureDirectoryHandleAndPermission(true);
      if (dirCheck.dirName) {
        setLocalDirName(dirCheck.dirName);
      }
      const pkg = await buildPortableExportPackage(decks, cards, settings);
      const jsonContent = JSON.stringify(pkg, null, 2);
      const saveRes = await saveActiveDatabaseToDirectory(jsonContent, dirCheck.handle);
      showToast(saveRes.message);
    } catch (err: unknown) {
      showToast(`Lỗi lưu máy tính: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* ---------------- TOP HEADER (ROW 1 - REFER TO IMAGE 3) ---------------- */}
      <header className="sticky top-0 z-40 bg-white border-b border-emerald-100 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Mark + Title + VOCABULARY BANK Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('lessons')}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
            >
              <BrandMark logoDataUrl={settings.customLogoDataUrl} size="md" />
              <span className="font-display font-extrabold text-xl tracking-tight text-[#15803d] whitespace-nowrap">
                {settings.brandTitle}
              </span>
            </button>

            {/* Pill Badge matching Image 3: VOCABULARY BANK • STARTERS */}
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ecfdf5] border border-[#86efac] text-[#15803d] uppercase whitespace-nowrap">
              VOCABULARY BANK • STARTERS
            </span>
          </div>

          {/* Right Action Buttons (Pill styling matching Image 3) */}
          <div className="hidden xl:flex items-center gap-2 shrink-0">
            {/* 1. Zoom Pill Controller: A- 110% A+ */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ecfdf5] border border-[#86efac] text-[#15803d] text-xs font-bold">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Thu nhỏ chữ"
                className="hover:text-emerald-950 px-1 cursor-pointer"
              >
                A–
              </button>
              <span className="tabular-nums font-mono text-[11px] px-0.5">{zoomLevel}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Phóng to chữ"
                className="hover:text-emerald-950 px-1 cursor-pointer"
              >
                A+
              </button>
            </div>

            {/* 2. Toàn màn hình Pill */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ecfdf5] border border-[#86efac] text-[#15803d] hover:bg-[#dcfce7] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Toàn màn hình</span>
            </button>

            {/* 3. API Key (Miễn phí) Pill */}
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fffbeb] border border-[#fde047] text-[#b45309] hover:bg-[#fef9c3] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>API Key</span>
              <span className="text-[10px] font-normal text-amber-700">(Miễn phí)</span>
            </button>

            {/* 4. Lưu trữ máy tính Pill (Requirement 2 & Image 3) */}
            <button
              type="button"
              onClick={handlePickOrSaveLocalDir}
              title={localDirName ? `Thư mục hiện tại: ${localDirName}` : 'Chọn thư mục lưu trữ trên máy tính'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ecfdf5] border border-[#86efac] text-[#15803d] hover:bg-[#dcfce7] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{localDirName ? `Lưu máy tính (${localDirName})` : 'Lưu trữ máy tính'}</span>
            </button>

            {/* 5. Google Drive Pill */}
            <button
              type="button"
              onClick={() => setIsGoogleDriveModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fef3c7] border border-[#fcd34d] text-[#92400e] hover:bg-[#fde68a] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </button>

            {/* 6. Nhập đề Pill */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0fdf4] border border-[#86efac] text-[#166534] hover:bg-[#dcfce7] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Nhập đề</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportPackage(f);
              }}
            />

            {/* 7. Nạp đề & Audio CTA Button */}
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nạp đề & Audio</span>
            </button>
          </div>

          {/* Mobile Actions Menu Trigger */}
          <div className="flex xl:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-[#fffbeb] border border-[#fde047] text-[#b45309] text-xs font-bold"
            >
              API Key
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ---------------- SUB-HEADER CONTEXT BAR (ROW 2 - REFER TO IMAGE 3) ---------------- */}
        <div className="bg-slate-50/70 border-t border-emerald-100/80 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left Context: Bài học / Chủ đề Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-xs text-[#15803d] whitespace-nowrap">
                Chủ đề:
              </span>
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="px-3 py-1 rounded-lg border border-[#86efac] bg-white text-xs font-bold text-[#166534] outline-none focus:ring-2 focus:ring-[#15803d] cursor-pointer"
              >
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.title}
                  </option>
                ))}
              </select>

              <div className="hidden sm:block h-4 w-px bg-slate-300 mx-1"></div>
            </div>

            {/* Middle Nav Items Styled like Image 3 (Pills) */}
            <nav className="flex items-center gap-1 overflow-x-auto py-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#15803d] text-white shadow-2xs'
                        : 'text-slate-700 hover:text-[#15803d] hover:bg-emerald-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right Context Badges matching Image 3: Level Pill + Word Count */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-0.5 rounded-lg bg-[#ecfdf5] border border-[#86efac] text-[#15803d] text-xs font-bold whitespace-nowrap">
                {activeDeck?.level || 'Starters · 6–9 tuổi'}
              </span>
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                · {currentDeckCardsCount} từ vựng
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Extended Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={handlePickOrSaveLocalDir}
                className="p-2 rounded-lg bg-[#ecfdf5] text-[#15803d] border border-[#86efac] flex items-center justify-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5" />
                Lưu trữ máy tính
              </button>
              <button
                type="button"
                onClick={() => setIsGoogleDriveModalOpen(true)}
                className="p-2 rounded-lg bg-[#fef3c7] text-[#92400e] border border-[#fcd34d] flex items-center justify-center gap-1.5"
              >
                <Cloud className="w-3.5 h-3.5" />
                Google Drive
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-[#f0fdf4] text-[#166534] border border-[#86efac] flex items-center justify-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5" />
                Nhập đề (.json)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('studio');
                  setMobileMenuOpen(false);
                }}
                className="p-2 rounded-lg bg-[#15803d] text-white flex items-center justify-center gap-1.5 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Nạp đề & Audio
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Container with Dynamic Zoom Level */}
      <main
        style={{ zoom: `${zoomLevel}%` }}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-transform duration-200"
      >
        {!hydrated ? (
          <div className="py-20 text-center text-sm text-slate-500 font-medium">
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
                localDirName={localDirName}
                onLocalDirChange={setLocalDirName}
                onShowToast={showToast}
                onReloadActiveDatabase={handleReloadActiveDatabase}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-100 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <BrandMark logoDataUrl={settings.customLogoDataUrl} size="sm" />
            <span className="font-bold text-[#15803d]">{settings.brandTitle}</span>
            <span aria-hidden="true">·</span>
            <span>Local-First · Lưu trữ máy tính & IndexedDB</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handlePickOrSaveLocalDir}
              className="hover:text-[#15803d] font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              {localDirName ? `Thư mục máy tính: ${localDirName}` : 'Chọn thư mục lưu trữ máy tính'}
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

      {/* Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {/* Google Drive Helper Modal */}
      {isGoogleDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-base">
                <Cloud className="w-5 h-5 text-amber-500" />
                <span>Đồng Bộ Google Drive</span>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleDriveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có thể xuất gói bài giảng đầy đủ (`.json`) và lưu vào thư mục Google Drive để mở và dạy học trên bất kỳ máy tính, iPad hoặc laptop trường học nào:
            </p>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div><strong>Bước 1:</strong> Bấm nút bên dưới để tải gói bài giảng `.json` về máy.</div>
              <div><strong>Bước 2:</strong> Kéo tệp vừa tải vào thư mục Google Drive của bạn.</div>
              <div><strong>Bước 3:</strong> Trên máy tính khác, bấm nút <strong>"Nhập đề"</strong> trên thanh điều hướng và chọn tệp từ Google Drive.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleExportPackage();
                  setIsGoogleDriveModalOpen(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>Tải tệp lưu lên Google Drive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
