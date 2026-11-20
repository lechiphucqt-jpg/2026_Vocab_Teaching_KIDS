import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crop,
  FolderPlus,
  GripVertical,
  ImagePlus,
  Mic,
  Pencil,
  Plus,
  ScanSearch,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  SAMPLE_TEXTBOOK_PAGE_URL,
  SAMPLE_TEXTBOOK_REGIONS,
  type SampleTextbookRegion,
} from '../data/seedData';
import type { BrandSettings, LessonDeck, VocabCard } from '../types/edtech';
import {
  blobToBase64,
  compressImageFileToBase64,
  estimateStringBytes,
  formatBytes,
  speakVocabulary,
} from '../utils/mediaUtils';
import { generateDeckWithAI, getStoredApiKey } from '../utils/geminiService';
import { triggerCelebration } from '../utils/celebration';
import { ResilientImage } from './ResilientImage';

interface ContentStudioProps {
  decks: LessonDeck[];
  cards: VocabCard[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  settings: BrandSettings;
  onCreateDeck: (title: string, subtitle: string, level: string) => Promise<string>;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onSaveCard: (card: VocabCard) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onReorderDeckCards: (deckId: string, orderedCards: VocabCard[]) => Promise<void>;
}

type StudioSubTab = 'manager' | 'cropper';

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ContentStudio({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  settings,
  onCreateDeck,
  onDeleteDeck,
  onSaveCard,
  onDeleteCard,
  onReorderDeckCards,
}: ContentStudioProps) {
  const [subTab, setSubTab] = useState<StudioSubTab>('manager');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const deckCards = useMemo(
    () =>
      cards
        .filter((c) => c.deckId === selectedDeckId)
        .sort((a, b) => a.order - b.order),
    [cards, selectedDeckId]
  );

  // ---------------- DECK CREATION ----------------
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckSubtitle, setNewDeckSubtitle] = useState('');

  // ---------------- AI AUTO-DECK GENERATOR ----------------
  const [showAiGenModal, setShowAiGenModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiWordCount, setAiWordCount] = useState(6);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);

  const handleAiGenerateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim() || isAiGenerating) return;
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      setAiGenError('Chưa có Gemini API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng để nhập key.');
      return;
    }
    setIsAiGenerating(true);
    setAiGenError(null);
    try {
      const generatedWords = await generateDeckWithAI(aiTopic.trim(), aiWordCount);
      const newDeckId = await onCreateDeck(
        aiTopic.trim(),
        `Chủ đề AI: ${aiTopic.trim()}`,
        'Starters · 6–9 tuổi'
      );
      onSelectDeck(newDeckId);

      for (let i = 0; i < generatedWords.length; i++) {
        const item = generatedWords[i];
        const svgClean = item.svgIcon.includes('<svg')
          ? item.svgIcon
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#0284C7"/><text x="50" y="58" font-size="28" fill="#fff" text-anchor="middle">★</text></svg>`;
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgClean)}`;

        const card: VocabCard = {
          id: `card-ai-${Date.now()}-${i}`,
          deckId: newDeckId,
          word: item.word,
          phonetic: item.phonetic,
          meaning: item.meaning,
          example: item.example,
          syllables: item.syllables,
          imageDataUrl: dataUrl,
          order: i,
          bestStars: 0,
          createdAt: Date.now(),
        };
        await onSaveCard(card);
      }

      triggerCelebration();
      showToast(`Đã tạo thành công bộ bài giảng "${aiTopic.trim()}" gồm ${generatedWords.length} từ bằng Gemini AI!`);
      setShowAiGenModal(false);
      setAiTopic('');
    } catch (err: unknown) {
      setAiGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAddDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;
    const id = await onCreateDeck(
      newDeckTitle.trim(),
      newDeckSubtitle.trim() || 'Custom Vocabulary Unit',
      'Starters · 6–9 tuổi'
    );
    onSelectDeck(id);
    setNewDeckTitle('');
    setNewDeckSubtitle('');
    setShowNewDeckForm(false);
    showToast('Đã tạo chủ đề bài giảng mới trong bộ nhớ cục bộ.');
  };

  // ---------------- CARD ADD / EDIT FORM ----------------
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formWord, setFormWord] = useState('');
  const [formPhonetic, setFormPhonetic] = useState('');
  const [formSyllables, setFormSyllables] = useState('');
  const [formMeaning, setFormMeaning] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formImageDataUrl, setFormImageDataUrl] = useState('');
  const [formAudioDataUrl, setFormAudioDataUrl] = useState<string | undefined>(undefined);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);

  // Drag & Drop state
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState(false);

  const openCreateForm = (prefillImage = '', prefillWord = '') => {
    setEditingCardId(null);
    setFormWord(prefillWord);
    setFormPhonetic('');
    setFormSyllables('');
    setFormMeaning('');
    setFormExample('');
    setFormImageDataUrl(prefillImage);
    setFormAudioDataUrl(undefined);
    setFormOpen(true);
  };

  const openEditForm = (card: VocabCard) => {
    setEditingCardId(card.id);
    setFormWord(card.word);
    setFormPhonetic(card.phonetic);
    setFormSyllables(card.syllables ?? '');
    setFormMeaning(card.meaning);
    setFormExample(card.example);
    setFormImageDataUrl(card.imageDataUrl);
    setFormAudioDataUrl(card.audioDataUrl);
    setFormOpen(true);
  };

  const handleImageFileUpload = async (file: File) => {
    try {
      const base64 = await compressImageFileToBase64(file, 760, 0.82);
      setFormImageDataUrl(base64);
      showToast(`Đã nén & nhúng ảnh Base64 (${formatBytes(estimateStringBytes(base64))}).`);
    } catch {
      showToast('Không thể đọc tệp ảnh. Vui lòng thử định dạng JPG/PNG.');
    }
  };

  const handleDropNewCardImage = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const base64 = await compressImageFileToBase64(file, 760, 0.82);
    const guessedWord = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
    openCreateForm(base64, guessedWord);
    showToast(`Đã mã hóa Base64 (${formatBytes(estimateStringBytes(base64))}). Hãy điền nghĩa và lưu thẻ.`);
  };

  const handleReplaceCardImageDrop = async (e: React.DragEvent, card: VocabCard) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const base64 = await compressImageFileToBase64(file, 760, 0.82);
      await onSaveCard({ ...card, imageDataUrl: base64 });
      showToast(`Đã cập nhật ảnh Base64 cho từ "${card.word}".`);
      return;
    }

    // Reorder dragged card
    if (draggingCardId && draggingCardId !== card.id) {
      const fromIdx = deckCards.findIndex((c) => c.id === draggingCardId);
      const toIdx = deckCards.findIndex((c) => c.id === card.id);
      if (fromIdx >= 0 && toIdx >= 0) {
        const reordered = [...deckCards];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        const withOrder = reordered.map((c, idx) => ({ ...c, order: idx }));
        await onReorderDeckCards(selectedDeckId, withOrder);
        showToast('Đã cập nhật thứ tự trình chiếu thẻ.');
      }
    }
    setDraggingCardId(null);
  };

  const toggleVoiceRecording = async () => {
    if (isRecordingVoice && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecordingVoice(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const base64Audio = await blobToBase64(blob);
        setFormAudioDataUrl(base64Audio);
        showToast(`Đã nhúng giọng giáo viên Base64 (${formatBytes(estimateStringBytes(base64Audio))}).`);
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecordingVoice(true);
    } catch {
      showToast('Chưa cấp quyền micro để thu âm giọng giáo viên.');
    }
  };

  const handleSubmitCardForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWord.trim() || !formMeaning.trim()) return;

    const existing = editingCardId ? cards.find((c) => c.id === editingCardId) : undefined;
    const card: VocabCard = {
      id: existing ? existing.id : `card-${Date.now()}`,
      deckId: existing ? existing.deckId : selectedDeckId,
      word: formWord.trim(),
      phonetic: formPhonetic.trim() || `/${formWord.trim().toLowerCase()}/`,
      syllables: formSyllables.trim() || undefined,
      meaning: formMeaning.trim(),
      example: formExample.trim(),
      imageDataUrl: formImageDataUrl,
      audioDataUrl: formAudioDataUrl,
      order: existing ? existing.order : deckCards.length,
      bestStars: existing ? existing.bestStars : 0,
      createdAt: existing ? existing.createdAt : Date.now(),
    };

    await onSaveCard(card);
    setFormOpen(false);
    setEditingCardId(null);
    showToast(existing ? `Đã cập nhật từ "${card.word}".` : `Đã thêm từ "${card.word}" vào bài giảng.`);
  };

  // ---------------- SMART TEXTBOOK CROPPER & OCR HELPER ----------------
  const [textbookImageSrc, setTextbookImageSrc] = useState<string>(SAMPLE_TEXTBOOK_PAGE_URL);
  const [isUsingSamplePage, setIsUsingSamplePage] = useState(true);
  const [detectedRegions, setDetectedRegions] = useState<SampleTextbookRegion[]>([]);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [croppedPreviewBase64, setCroppedPreviewBase64] = useState<string>('');
  const [cropWord, setCropWord] = useState('');
  const [cropPhonetic, setCropPhonetic] = useState('');
  const [cropMeaning, setCropMeaning] = useState('');
  const [cropExample, setCropExample] = useState('');

  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedPageImgRef = useRef<HTMLImageElement | null>(null);

  const redrawTextbookCanvas = useMemo(
    () => (rect: CropRect | null, regions: SampleTextbookRegion[]) => {
      const canvas = pageCanvasRef.current;
      const img = loadedPageImgRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw detected regions if present
      regions.forEach((r) => {
        const rx = r.x * canvas.width;
        const ry = r.y * canvas.height;
        const rw = r.w * canvas.width;
        const rh = r.h * canvas.height;
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
      });

      // Draw active rubber-band selection
      if (rect && rect.w > 4 && rect.h > 4) {
        ctx.fillStyle = 'rgba(2, 132, 199, 0.14)';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
    },
    []
  );

  useEffect(() => {
    if (subTab !== 'cropper') return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedPageImgRef.current = img;
      const canvas = pageCanvasRef.current;
      if (canvas) {
        const maxW = 760;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        redrawTextbookCanvas(cropRect, detectedRegions);
      }
    };
    img.src = textbookImageSrc;
  }, [subTab, textbookImageSrc, cropRect, detectedRegions, redrawTextbookCanvas]);

  const extractCroppedBase64 = (rect: CropRect) => {
    const canvas = pageCanvasRef.current;
    const img = loadedPageImgRef.current;
    if (!canvas || !img || rect.w < 12 || rect.h < 12) return;

    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;
    const sx = Math.max(0, Math.round(rect.x * scaleX));
    const sy = Math.max(0, Math.round(rect.y * scaleY));
    const sw = Math.min(img.width - sx, Math.round(rect.w * scaleX));
    const sh = Math.min(img.height - sy, Math.round(rect.h * scaleY));

    const outCanvas = document.createElement('canvas');
    const maxOut = 640;
    const outScale = Math.min(1, maxOut / Math.max(sw, sh));
    outCanvas.width = Math.max(1, Math.round(sw * outScale));
    outCanvas.height = Math.max(1, Math.round(sh * outScale));
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;
    outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, outCanvas.width, outCanvas.height);
    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.84);
    setCroppedPreviewBase64(dataUrl);
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = pageCanvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((e.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    setDragStart(pt);
    setIsDraggingCrop(true);
    setCropRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCrop || !dragStart) return;
    const pt = getCanvasPoint(e);
    const nextRect: CropRect = {
      x: Math.min(dragStart.x, pt.x),
      y: Math.min(dragStart.y, pt.y),
      w: Math.abs(pt.x - dragStart.x),
      h: Math.abs(pt.y - dragStart.y),
    };
    setCropRect(nextRect);
    redrawTextbookCanvas(nextRect, detectedRegions);
  };

  const handleCanvasMouseUp = () => {
    if (!isDraggingCrop) return;
    setIsDraggingCrop(false);
    if (cropRect && cropRect.w > 16 && cropRect.h > 16) {
      extractCroppedBase64(cropRect);
    }
  };

  const handleRunSmartScan = () => {
    const canvas = pageCanvasRef.current;
    if (!canvas) return;
    if (isUsingSamplePage) {
      setDetectedRegions(SAMPLE_TEXTBOOK_REGIONS);
      const first = SAMPLE_TEXTBOOK_REGIONS[0];
      const rect: CropRect = {
        x: first.x * canvas.width,
        y: first.y * canvas.height,
        w: first.w * canvas.width,
        h: first.h * canvas.height,
      };
      setCropRect(rect);
      extractCroppedBase64(rect);
      setCropWord(first.word);
      setCropPhonetic(first.phonetic);
      setCropMeaning(first.meaning);
      setCropExample(first.example);
      showToast('Đã nhận diện 4 khung tranh và gợi ý từ vựng trên trang sách mẫu.');
    } else {
      // Auto-suggest 2x2 textbook grid on any uploaded textbook photo
      const genericRegions: SampleTextbookRegion[] = [
        { id: 'g1', label: 'Ô trên trái (1)', word: '', phonetic: '', meaning: '', example: '', x: 0.05, y: 0.06, w: 0.43, h: 0.42 },
        { id: 'g2', label: 'Ô trên phải (2)', word: '', phonetic: '', meaning: '', example: '', x: 0.52, y: 0.06, w: 0.43, h: 0.42 },
        { id: 'g3', label: 'Ô dưới trái (3)', word: '', phonetic: '', meaning: '', example: '', x: 0.05, y: 0.52, w: 0.43, h: 0.42 },
        { id: 'g4', label: 'Ô dưới phải (4)', word: '', phonetic: '', meaning: '', example: '', x: 0.52, y: 0.52, w: 0.43, h: 0.42 },
      ];
      setDetectedRegions(genericRegions);
      const first = genericRegions[0];
      const rect: CropRect = {
        x: first.x * canvas.width,
        y: first.y * canvas.height,
        w: first.w * canvas.width,
        h: first.h * canvas.height,
      };
      setCropRect(rect);
      extractCroppedBase64(rect);
      showToast('Đã chia lưới 4 khung sách giáo khoa. Thầy cô có thể chọn ô hoặc kéo chuột tùy chỉnh.');
    }
  };

  const handleSelectRegion = (region: SampleTextbookRegion) => {
    const canvas = pageCanvasRef.current;
    if (!canvas) return;
    const rect: CropRect = {
      x: region.x * canvas.width,
      y: region.y * canvas.height,
      w: region.w * canvas.width,
      h: region.h * canvas.height,
    };
    setCropRect(rect);
    extractCroppedBase64(rect);
    if (region.word) setCropWord(region.word);
    if (region.phonetic) setCropPhonetic(region.phonetic);
    if (region.meaning) setCropMeaning(region.meaning);
    if (region.example) setCropExample(region.example);
  };

  const handleUploadTextbookPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setTextbookImageSrc(String(reader.result));
      setIsUsingSamplePage(false);
      setDetectedRegions([]);
      setCropRect(null);
      setCroppedPreviewBase64('');
      showToast('Đã tải trang sách lên canvas. Kéo chuột để khoanh vùng cắt ảnh.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!croppedPreviewBase64 || !cropWord.trim() || !cropMeaning.trim()) return;

    const newCard: VocabCard = {
      id: `card-crop-${Date.now()}`,
      deckId: selectedDeckId,
      word: cropWord.trim(),
      phonetic: cropPhonetic.trim() || `/${cropWord.trim().toLowerCase()}/`,
      meaning: cropMeaning.trim(),
      example: cropExample.trim(),
      imageDataUrl: croppedPreviewBase64,
      order: deckCards.length,
      bestStars: 0,
      createdAt: Date.now(),
    };

    await onSaveCard(newCard);
    setCropWord('');
    setCropPhonetic('');
    setCropMeaning('');
    setCropExample('');
    showToast(`Đã cắt & lưu "${newCard.word}" dạng Base64 vào bài giảng!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500">
            Quản trị Học liệu Kéo-Thả · Nhúng ảnh & âm thanh Base64 nội bộ
          </p>
          <h1 className="mt-1 font-display font-bold text-3xl lg:text-4xl tracking-tight text-slate-900">
            Kho Từ vựng & Cắt trang Sách
          </h1>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('manager')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subTab === 'manager'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quản lý Bộ từ (Kéo-Thả)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cropper')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subTab === 'cropper'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cắt trang Sách giáo khoa
          </button>
        </div>
      </div>

      {/* Inline Toast Feedback */}
      {toast && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Deck Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="studio-deck-select" className="text-xs font-semibold text-slate-600">
            Chủ đề đang chỉnh sửa:
          </label>
          <select
            id="studio-deck-select"
            value={selectedDeckId}
            onChange={(e) => onSelectDeck(e.target.value)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900"
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({cards.filter((c) => c.deckId === d.id).length} từ)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowNewDeckForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 text-[#0284C7]" />
            Tạo chủ đề mới
          </button>

          <button
            type="button"
            onClick={() => setShowAiGenModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            Soạn bài bằng AI (Gemini)
          </button>

          {decks.length > 1 && (
            <button
              type="button"
              onClick={async () => {
                await onDeleteDeck(selectedDeckId);
                showToast('Đã xóa chủ đề khỏi IndexedDB.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-rose-600 hover:bg-rose-50 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa chủ đề này
            </button>
          )}
        </div>

        {subTab === 'manager' && (
          <button
            type="button"
            onClick={() => openCreateForm()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0284C7] text-white text-xs font-semibold hover:bg-[#0369A1] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Thêm từ vựng mới
          </button>
        )}
      </div>

      {/* Inline New Deck Form */}
      {showNewDeckForm && (
        <form
          onSubmit={handleAddDeck}
          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-end gap-3"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tên chủ đề (VD: Unit 3: Phương tiện giao thông)
            </label>
            <input
              type="text"
              required
              value={newDeckTitle}
              onChange={(e) => setNewDeckTitle(e.target.value)}
              placeholder="Nhập tên bài học..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tên tiếng Anh (tùy chọn)
            </label>
            <input
              type="text"
              value={newDeckSubtitle}
              onChange={(e) => setNewDeckSubtitle(e.target.value)}
              placeholder="VD: Vehicles & Transport"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 whitespace-nowrap"
          >
            Lưu chủ đề
          </button>
        </form>
      )}

      {/* SUB-TAB 1: DRAG & DROP CRUD MANAGER */}
      {subTab === 'manager' && (
        <div className="space-y-6">
          {/* Drag & Drop Quick Add Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone(true);
            }}
            onDragLeave={() => setDragOverZone(false)}
            onDrop={handleDropNewCardImage}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragOverZone
                ? 'border-[#0284C7] bg-[#0284C7]/6'
                : 'border-slate-300 bg-white'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <ImagePlus className="w-6 h-6 text-[#0284C7] shrink-0" />
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Kéo-thả hình ảnh vào đây</span> để tạo ngay thẻ từ vựng mới (tự động nén & mã hóa Base64), hoặc kéo thẻ bên dưới để sắp xếp lại thứ tự giảng dạy.
              </div>
              <label className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer whitespace-nowrap">
                Chọn file ảnh
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const b64 = await compressImageFileToBase64(f, 760, 0.82);
                      openCreateForm(b64);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Add / Edit Inline Panel */}
          {formOpen && (
            <form
              onSubmit={handleSubmitCardForm}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="font-display font-bold text-lg text-slate-900">
                  {editingCardId ? 'Chỉnh sửa thẻ từ vựng' : 'Thêm thẻ từ vựng mới (Nhúng Base64)'}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Image Upload & Preview */}
                <div className="lg:col-span-4 space-y-3">
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    {formImageDataUrl ? (
                      <ResilientImage
                        src={formImageDataUrl}
                        alt={formWord || 'Xem trước'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-400 p-4 text-center">
                        <Upload className="w-6 h-6 mb-2 text-slate-300" />
                        Chưa có ảnh minh họa
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      Tải ảnh (Base64)
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageFileUpload(f);
                        }}
                      />
                    </label>
                    {formImageDataUrl && (
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {formatBytes(estimateStringBytes(formImageDataUrl))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vocabulary Fields */}
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Từ tiếng Anh *
                    </label>
                    <input
                      type="text"
                      required
                      value={formWord}
                      onChange={(e) => setFormWord(e.target.value)}
                      placeholder="VD: Bicycle"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nghĩa tiếng Việt *
                    </label>
                    <input
                      type="text"
                      required
                      value={formMeaning}
                      onChange={(e) => setFormMeaning(e.target.value)}
                      placeholder="VD: Xe đạp"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Phiên âm IPA
                    </label>
                    <input
                      type="text"
                      value={formPhonetic}
                      onChange={(e) => setFormPhonetic(e.target.value)}
                      placeholder="VD: /ˈbaɪ.sɪ.kəl/"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tách âm tiết (hỗ trợ trẻ đánh vần)
                    </label>
                    <input
                      type="text"
                      value={formSyllables}
                      onChange={(e) => setFormSyllables(e.target.value)}
                      placeholder="VD: Bi · cy · cle"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Câu ví dụ minh họa
                    </label>
                    <input
                      type="text"
                      value={formExample}
                      onChange={(e) => setFormExample(e.target.value)}
                      placeholder="VD: I ride my red bicycle to school."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>

                  {/* Teacher Voice Base64 Recorder */}
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">Âm thanh nhúng riêng:</span>{' '}
                      {formAudioDataUrl
                        ? `Đã nhúng giọng giáo viên (${formatBytes(estimateStringBytes(formAudioDataUrl))})`
                        : 'Đang dùng giọng đọc bản ngữ tích hợp (Web Speech)'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleVoiceRecording}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          isRecordingVoice
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {isRecordingVoice ? (
                          <>
                            <Square className="w-3.5 h-3.5" />
                            Dừng ghi âm
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-[#0284C7]" />
                            Thu giọng giáo viên
                          </>
                        )}
                      </button>
                      {formAudioDataUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              speakVocabulary(formWord, { audioDataUrl: formAudioDataUrl })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Nghe thử
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormAudioDataUrl(undefined)}
                            className="text-xs text-rose-600 hover:underline"
                          >
                            Gỡ
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0284C7] text-white text-sm font-semibold hover:bg-[#0369A1]"
                >
                  {editingCardId ? 'Lưu thay đổi' : 'Lưu thẻ vào IndexedDB'}
                </button>
              </div>
            </form>
          )}

          {/* Vocabulary Cards Grid with Drag-to-Reorder & Drop-Image-to-Replace */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {deckCards.map((card, idx) => (
              <div
                key={card.id}
                draggable
                onDragStart={() => setDraggingCardId(card.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleReplaceCardImageDrop(e, card)}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <ResilientImage
                      src={card.imageDataUrl}
                      alt={card.word}
                      className="w-full h-full object-cover"
                    />
                    <div
                      title="Kéo để sắp xếp lại thứ tự thẻ"
                      className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 text-xs font-mono text-slate-600 border border-slate-200 cursor-grab"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                      #{idx + 1}
                    </div>
                  </div>

                  <div className="p-4 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-display font-bold text-xl text-slate-900 truncate">
                        {card.word}
                      </h3>
                      <span className="font-mono text-xs text-[#0284C7] shrink-0">
                        {card.phonetic}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{card.meaning}</p>
                    <p className="text-xs text-slate-500">
                      {card.imageDataUrl.startsWith('data:')
                        ? `Base64 nhúng (${formatBytes(estimateStringBytes(card.imageDataUrl))})`
                        : 'Tài nguyên gói cài đặt'}
                      {card.audioDataUrl ? ' · Có giọng thu âm' : ''}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      speakVocabulary(card.word, {
                        audioDataUrl: card.audioDataUrl,
                        rate: settings.speechRate,
                        accent: settings.voiceAccent,
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:underline whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Nghe thử
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(card)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteCard(card.id);
                        showToast(`Đã xóa thẻ "${card.word}".`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SMART TEXTBOOK CROPPER & OCR HELPER */}
      {subTab === 'cropper' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Canvas Workspace */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">
                  Trang Sách giáo khoa nguồn
                </h2>
                <p className="text-xs text-slate-500">
                  Kéo chuột tạo khung chữ nhật để cắt bất kỳ hình minh họa nào thành ảnh Base64.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunSmartScan}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0284C7] text-white text-xs font-semibold hover:bg-[#0369A1] whitespace-nowrap"
                >
                  <ScanSearch className="w-4 h-4" />
                  Tự động nhận diện khung ảnh
                </button>

                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  Tải ảnh trang sách
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadTextbookPhoto(f);
                    }}
                  />
                </label>

                {!isUsingSamplePage && (
                  <button
                    type="button"
                    onClick={() => {
                      setTextbookImageSrc(SAMPLE_TEXTBOOK_PAGE_URL);
                      setIsUsingSamplePage(true);
                      setDetectedRegions([]);
                      setCropRect(null);
                    }}
                    className="text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap"
                  >
                    Dùng trang mẫu
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 select-none">
              <canvas
                ref={pageCanvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="w-full h-auto block cursor-crosshair"
              />
            </div>

            {/* Detected Quick-Select Boxes */}
            {detectedRegions.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-slate-700">
                  Khung tranh đã phát hiện trên trang (nhấn để cắt nhanh):
                </div>
                <div className="flex flex-wrap gap-2">
                  {detectedRegions.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => handleSelectRegion(reg)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-[#0284C7] hover:bg-[#0284C7]/6 text-xs font-medium text-slate-800 transition-colors whitespace-nowrap"
                    >
                      <Crop className="w-3.5 h-3.5 text-[#0284C7]" />
                      {reg.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right Extracted Card Builder */}
          <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900">
                Thẻ cắt ra & Trích xuất từ
              </h2>
              <p className="text-xs text-slate-500">
                Ảnh cắt được nén chuẩn JPEG Base64 để không bao giờ mất liên kết khi đóng gói.
              </p>
            </div>

            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
              {croppedPreviewBase64 ? (
                <img
                  src={croppedPreviewBase64}
                  alt="Ảnh đã cắt từ sách"
                  className="w-full h-full object-contain bg-white"
                />
              ) : (
                <div className="text-center p-6 text-xs text-slate-500 space-y-2">
                  <Crop className="w-6 h-6 text-slate-400 mx-auto" />
                  <p>
                    Nhấn <strong>“Tự động nhận diện khung ảnh”</strong> hoặc kéo chuột trực tiếp trên trang sách bên trái để xem thẻ cắt.
                  </p>
                </div>
              )}
            </div>

            {croppedPreviewBase64 && (
              <div className="text-xs font-mono text-slate-500 tabular-nums">
                Dung lượng nhúng Base64: {formatBytes(estimateStringBytes(croppedPreviewBase64))}
              </div>
            )}

            <form onSubmit={handleSaveCroppedCard} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Từ tiếng Anh *
                  </label>
                  <input
                    type="text"
                    required
                    value={cropWord}
                    onChange={(e) => setCropWord(e.target.value)}
                    placeholder="VD: Bicycle"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nghĩa tiếng Việt *
                  </label>
                  <input
                    type="text"
                    required
                    value={cropMeaning}
                    onChange={(e) => setCropMeaning(e.target.value)}
                    placeholder="VD: Xe đạp"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Phiên âm IPA
                </label>
                <input
                  type="text"
                  value={cropPhonetic}
                  onChange={(e) => setCropPhonetic(e.target.value)}
                  placeholder="VD: /ˈbaɪ.sɪ.kəl/"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Câu ví dụ (tùy chọn)
                </label>
                <input
                  type="text"
                  value={cropExample}
                  onChange={(e) => setCropExample(e.target.value)}
                  placeholder="VD: I ride my red bicycle to the park."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!croppedPreviewBase64}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0284C7] text-white text-sm font-semibold hover:bg-[#0369A1] disabled:opacity-50 transition-colors"
              >
                Lưu thành thẻ Base64 vào chủ đề đang chọn
              </button>
            </form>
          </aside>
        </div>
      )}

      {/* AI AUTO-DECK GENERATOR MODAL */}
      {showAiGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-purple-200" />
                <div>
                  <h3 className="font-bold text-base">Soạn Bài Giảng Bằng Gemini AI</h3>
                  <p className="text-xs text-purple-100">Tự động sinh từ vựng, phiên âm IPA, câu ví dụ và minh họa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiGenModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAiGenerateDeck} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chủ đề bài học (tiếng Việt hoặc tiếng Anh):
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Động vật biển, Đồ dùng học tập, Trái cây nhiệt đới..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Số lượng từ vựng cần sinh:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[4, 6, 8].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setAiWordCount(count)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        aiWordCount === count
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {count} từ vựng
                    </button>
                  ))}
                </div>
              </div>

              {aiGenError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{aiGenError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAiGenModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isAiGenerating || !aiTopic.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini đang soạn bài...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Bắt đầu Tạo bài học</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
