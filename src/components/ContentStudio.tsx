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
  Clipboard,
  Palette,
  Paintbrush,
  ExternalLink,
  Copy,
  RotateCcw,
  Wand2,
  ImageIcon,
  Bot,
  CheckCircle2,
  CheckSquare,
  Layers,
  Download,
  Split,
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
import {
  generateDeckWithAI,
  getStoredApiKey,
  getStoredOpenAIApiKey,
  saveStoredOpenAIApiKey,
  generateIllustrationWithAI,
  generateIllustrationWithChatGPTDallE,
  generateExternalAIPrompts,
  AI_DRAWING_STYLES,
  splitTextbookPageWithAI,
  type DetectedTextbookItem,
} from '../utils/geminiService';
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

export interface BatchSplitCardItem {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  example: string;
  visualDescription: string;
  cropBase64: string;
  aiDrawnBase64?: string;
  activeImage: 'crop' | 'ai';
  isSelected: boolean;
  isRedrawing?: boolean;
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

  // ---------------- AI DRAWING & RE-DRAWING (Gemini / Imagen / Canva / ChatGPT) ----------------
  const [isAiRedrawing, setIsAiRedrawing] = useState(false);
  const [showAiDrawModal, setShowAiDrawModal] = useState(false);
  const [aiDrawModalTab, setAiDrawModalTab] = useState<'gemini' | 'chatgpt' | 'external'>('gemini');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiDrawStyle, setAiDrawStyle] = useState('cartoon');
  const [aiDrawEngine, setAiDrawEngine] = useState<'smart-auto' | 'chatgpt-dalle' | 'gemini-svg' | 'imagen-3'>('smart-auto');
  const [isAiGeneratingIllustration, setIsAiGeneratingIllustration] = useState(false);
  const [aiGeneratedPreview, setAiGeneratedPreview] = useState<string | null>(null);
  const [aiGeneratedEngineUsed, setAiGeneratedEngineUsed] = useState<string>('');
  const [aiExternalPrompts, setAiExternalPrompts] = useState<{
    chatGptDallePrompt: string;
    canvaPrompt: string;
    vietnameseGuide: string;
  } | null>(null);
  const [isGeneratingExternalPrompts, setIsGeneratingExternalPrompts] = useState(false);
  const [copiedField, setCopiedField] = useState<'chatgpt' | 'canva' | null>(null);

  // OpenAI ChatGPT DALL-E State
  const [openaiKeyInput, setOpenaiKeyInput] = useState(getStoredOpenAIApiKey());
  const [showOpenaiKeySettings, setShowOpenaiKeySettings] = useState(false);

  // ---------------- AI BATCH TEXTBOOK SPLIT & REDRAW ----------------
  const [isAiSplittingPage, setIsAiSplittingPage] = useState(false);
  const [showBatchSplitModal, setShowBatchSplitModal] = useState(false);
  const [batchSplitItems, setBatchSplitItems] = useState<BatchSplitCardItem[]>([]);
  const [isBatchRedrawingAll, setIsBatchRedrawingAll] = useState(false);
  const [batchDrawStyle, setBatchDrawStyle] = useState('cartoon');
  const [batchDrawEngine, setBatchDrawEngine] = useState<'smart-auto' | 'chatgpt-dalle' | 'gemini-svg' | 'imagen-3'>('smart-auto');

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
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);

        // Label tag on top of box
        if (r.label) {
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(r.label).width;
          const badgeW = Math.min(rw - 4, textW + 14);
          ctx.fillStyle = '#0284C7';
          ctx.fillRect(rx, ry, badgeW, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(r.label, rx + 6, ry + 14);
        }
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

  // ---------------- CLIPBOARD PASTE FOR TEXTBOOK CROPPER ----------------
  useEffect(() => {
    if (subTab !== 'cropper') return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isTypingText =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              setTextbookImageSrc(String(reader.result));
              setIsUsingSamplePage(false);
              setDetectedRegions([]);
              setCropRect(null);
              setCroppedPreviewBase64('');
              showToast('📋 Đã dán ảnh trang sách từ Clipboard thành công!');
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [subTab]);

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const file = new File([blob], 'clipboard-page.png', { type: imgType });
            const reader = new FileReader();
            reader.onload = () => {
              setTextbookImageSrc(String(reader.result));
              setIsUsingSamplePage(false);
              setDetectedRegions([]);
              setCropRect(null);
              setCroppedPreviewBase64('');
              showToast('📋 Đã dán ảnh trang sách từ Clipboard thành công!');
            };
            reader.readAsDataURL(file);
            return;
          }
        }
        showToast(
          'Chưa tìm thấy ảnh trong Clipboard. Thầy cô vui lòng chụp màn hình (Win + Shift + S) rồi bấm lại nút này hoặc nhấn Ctrl + V.'
        );
      } else {
        showToast('Trình duyệt bảo mật clipboard. Thầy cô chỉ cần nhấn phím Ctrl + V trên bàn phím để dán ảnh!');
      }
    } catch {
      showToast('Thầy cô hãy nhấn tổ hợp phím Ctrl + V trên bàn phím để dán ảnh chụp màn hình!');
    }
  };

  // ---------------- AI REDRAW & CUSTOM DRAWING HANDLERS ----------------
  const handleAiRedrawCroppedImage = async () => {
    if (!croppedPreviewBase64) {
      showToast('Vui lòng khoanh vùng ảnh trên trang sách hoặc chọn ô trước khi bấm vẽ lại!');
      return;
    }
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      showToast('Chưa cấu hình API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng.');
      return;
    }

    setIsAiRedrawing(true);
    try {
      const promptToUse = cropWord.trim()
        ? `A friendly educational children's book illustration of ${cropWord.trim()} (${cropMeaning.trim()})`
        : '';
      const result = await generateIllustrationWithAI({
        prompt: promptToUse,
        style: aiDrawStyle,
        sourceImageBase64: croppedPreviewBase64,
        engine: aiDrawEngine,
      });

      setCroppedPreviewBase64(result.imageDataUrl);
      if (result.recognized) {
        if (!cropWord.trim()) setCropWord(result.recognized.word);
        if (!cropMeaning.trim()) setCropMeaning(result.recognized.meaning);
        if (!cropPhonetic.trim()) setCropPhonetic(result.recognized.phonetic);
        if (!cropExample.trim()) setCropExample(result.recognized.example);
      }
      triggerCelebration();
      showToast(`✨ Đã vẽ lại hình minh họa bằng ${result.engineUsed}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Lỗi vẽ lại hình: ${msg}`);
    } finally {
      setIsAiRedrawing(false);
    }
  };

  const handleSaveOpenaiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!openaiKeyInput.trim()) {
      showToast('Vui lòng nhập OpenAI API Key hợp lệ.');
      return;
    }
    saveStoredOpenAIApiKey(openaiKeyInput.trim());
    setShowOpenaiKeySettings(false);
    showToast('✨ Đã lưu OpenAI API Key cho ChatGPT!');
  };

  const handleOpenChatGPTWebWithPrompt = async () => {
    const prompt = aiCustomPrompt.trim() || cropWord.trim() || 'A cute friendly character for children';
    const selectedStyle = AI_DRAWING_STYLES.find((s) => s.id === aiDrawStyle) || AI_DRAWING_STYLES[0];
    const craftedPrompt = `Create a masterpiece children book illustration of "${prompt}". Style: ${selectedStyle.guide}. Cute, vibrant colors, centered composition, soft clean background, kid-friendly art, high resolution, no text or words on image.`;
    
    try {
      await navigator.clipboard.writeText(craftedPrompt);
      showToast('📋 Đã sao chép Prompt cho ChatGPT! Đang mở ChatGPT...');
    } catch {
      showToast('Đang mở ChatGPT...');
    }
    window.open('https://chatgpt.com', '_blank');
  };

  const handleGenerateCustomIllustration = async () => {
    const prompt = aiCustomPrompt.trim() || cropWord.trim();
    if (!prompt) {
      showToast('Vui lòng nhập ý tưởng hoặc tên từ vựng muốn vẽ!');
      return;
    }

    if (aiDrawEngine === 'chatgpt-dalle') {
      const oKey = openaiKeyInput.trim() || getStoredOpenAIApiKey();
      if (!oKey) {
        setShowOpenaiKeySettings(true);
        showToast('Chưa cấu hình OpenAI API Key. Vui lòng nhập Key hoặc bấm nút "Mở ChatGPT trên Web".');
        return;
      }
    } else {
      const apiKey = getStoredApiKey();
      if (!apiKey) {
        showToast('Chưa cấu hình API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng.');
        return;
      }
    }

    setIsAiGeneratingIllustration(true);
    try {
      const result = await generateIllustrationWithAI({
        prompt,
        style: aiDrawStyle,
        engine: aiDrawEngine,
        openaiApiKey: openaiKeyInput.trim() || getStoredOpenAIApiKey(),
      });
      setAiGeneratedPreview(result.imageDataUrl);
      setAiGeneratedEngineUsed(result.engineUsed);
      triggerCelebration();
      showToast(`✨ Đã vẽ xong tranh minh họa bằng ${result.engineUsed}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Lỗi tạo ảnh: ${msg}`);
    } finally {
      setIsAiGeneratingIllustration(false);
    }
  };

  const handleApplyAiIllustrationToCard = () => {
    if (!aiGeneratedPreview) return;
    setCroppedPreviewBase64(aiGeneratedPreview);
    if (formOpen) {
      setFormImageDataUrl(aiGeneratedPreview);
    }
    if (!cropWord.trim() && aiCustomPrompt.trim()) {
      setCropWord(aiCustomPrompt.trim());
    }
    setShowAiDrawModal(false);
    showToast('Đã áp dụng hình vẽ AI vào thẻ từ vựng!');
  };

  const handleGenerateExternalPrompts = async () => {
    const prompt = aiCustomPrompt.trim() || cropWord.trim() || 'A cute friendly character for children';
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      showToast('Chưa cấu hình API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng.');
      return;
    }

    setIsGeneratingExternalPrompts(true);
    try {
      const prompts = await generateExternalAIPrompts(prompt, aiDrawStyle);
      setAiExternalPrompts(prompts);
      showToast('Đã tạo Prompt tối ưu cho ChatGPT & Canva!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Lỗi tạo prompt: ${msg}`);
    } finally {
      setIsGeneratingExternalPrompts(false);
    }
  };

  const handleCopyPrompt = (text: string, type: 'chatgpt' | 'canva') => {
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    showToast(`Đã sao chép Prompt cho ${type === 'chatgpt' ? 'ChatGPT (DALL-E 3)' : 'Canva'}!`);
    window.setTimeout(() => setCopiedField(null), 2500);
  };

  const handlePasteExternalImage = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    let file: File | null = null;
    if ('clipboardData' in e && e.clipboardData?.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        if (e.clipboardData.items[i].type.startsWith('image/')) {
          file = e.clipboardData.items[i].getAsFile();
          break;
        }
      }
    } else if ('dataTransfer' in e && e.dataTransfer?.files) {
      if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type.startsWith('image/')) {
        file = e.dataTransfer.files[0];
      }
    }
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAiGeneratedPreview(String(reader.result));
        setAiGeneratedEngineUsed('Ảnh tải/dán từ bên ngoài (ChatGPT / Canva)');
        showToast('Đã nhận diện ảnh dán từ ChatGPT/Canva thành công!');
      };
      reader.readAsDataURL(file);
    }
  };

  // ---------------- AI SMART MULTI-IMAGE TEXTBOOK SPLITTER & BATCH RE-DRAWER ----------------
  const getPageImageBase64 = (): string => {
    if (textbookImageSrc.startsWith('data:image/')) return textbookImageSrc;
    const img = loadedPageImgRef.current;
    if (img && img.complete) {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth || img.width;
        tempCanvas.height = img.naturalHeight || img.height;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          return tempCanvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (err) {
        console.warn('Canvas toDataURL failed:', err);
      }
    }
    return textbookImageSrc;
  };

  const extractSubImageFromBox = (
    img: HTMLImageElement,
    box: { ymin: number; xmin: number; ymax: number; xmax: number }
  ): string => {
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return '';

    const sx = Math.max(0, Math.round((box.xmin / 1000) * imgW));
    const sy = Math.max(0, Math.round((box.ymin / 1000) * imgH));
    const sw = Math.min(imgW - sx, Math.round(((box.xmax - box.xmin) / 1000) * imgW));
    const sh = Math.min(imgH - sy, Math.round(((box.ymax - box.ymin) / 1000) * imgH));

    if (sw <= 5 || sh <= 5) return '';

    const canvas = document.createElement('canvas');
    const maxOut = 520;
    const scale = Math.min(1, maxOut / Math.max(sw, sh));
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  };

  const handleAiAutoSplitTextbookPage = async (sourceBase64Override?: string) => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      showToast('Chưa cấu hình API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng.');
      return;
    }

    const img = loadedPageImgRef.current;
    if (!img) {
      showToast('Chưa tải được trang sách. Vui lòng chờ ảnh hiển thị hoặc dán lại.');
      return;
    }

    setIsAiSplittingPage(true);
    showToast('AI đang quét và bóc tách từng con vật / đối tượng riêng biệt...');

    try {
      const targetBase64 = sourceBase64Override || getPageImageBase64();
      const detectedItems = await splitTextbookPageWithAI(targetBase64);

      if (detectedItems.length === 0) {
        showToast('Không phát hiện được đối tượng nào. Thầy cô có thể kéo chuột thủ công để cắt.');
        setIsAiSplittingPage(false);
        return;
      }

      // If sourceBase64Override was used, load that image element to crop from it
      let targetImg: HTMLImageElement = img;
      if (sourceBase64Override) {
        targetImg = await new Promise((resolve, reject) => {
          const tempImg = new Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.onload = () => resolve(tempImg);
          tempImg.onerror = reject;
          tempImg.src = sourceBase64Override;
        });
      }

      // Extract sub-images and create batch items
      const newBatchItems: BatchSplitCardItem[] = detectedItems.map((item, idx) => {
        const cropBase64 = extractSubImageFromBox(targetImg, item.box);
        return {
          id: `split-${Date.now()}-${idx}`,
          word: item.word,
          meaning: item.meaning,
          phonetic: item.phonetic || `/${item.word.toLowerCase()}/`,
          example: item.example,
          visualDescription: item.visualDescription,
          cropBase64,
          activeImage: 'crop',
          isSelected: true,
        };
      });

      setBatchSplitItems(newBatchItems);

      // If splitting the main page, also map to canvas regions
      if (!sourceBase64Override) {
        const regions: SampleTextbookRegion[] = detectedItems.map((item, idx) => ({
          id: item.id,
          label: `${idx + 1}. ${item.word}`,
          word: item.word,
          phonetic: item.phonetic,
          meaning: item.meaning,
          example: item.example,
          x: item.box.xmin / 1000,
          y: item.box.ymin / 1000,
          w: (item.box.xmax - item.box.xmin) / 1000,
          h: (item.box.ymax - item.box.ymin) / 1000,
        }));

        setDetectedRegions(regions);

        // Select first region for immediate preview on right sidebar as well
        if (regions[0]) {
          handleSelectRegion(regions[0]);
        }
      } else {
        if (newBatchItems[0]) {
          setCroppedPreviewBase64(newBatchItems[0].cropBase64);
          setCropWord(newBatchItems[0].word);
          setCropMeaning(newBatchItems[0].meaning);
          setCropPhonetic(newBatchItems[0].phonetic);
          setCropExample(newBatchItems[0].example);
        }
      }

      setShowBatchSplitModal(true);
      triggerCelebration();
      showToast(`✨ Đã nhận diện & tách thành công ${newBatchItems.length} hình ảnh riêng biệt!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Lỗi tách ảnh: ${msg}`);
    } finally {
      setIsAiSplittingPage(false);
    }
  };

  const handleBatchRedrawAll = async () => {
    if (batchDrawEngine === 'chatgpt-dalle') {
      const oKey = getStoredOpenAIApiKey();
      if (!oKey) {
        showToast('Chưa cấu hình OpenAI API Key để vẽ bằng ChatGPT. Vui lòng nhập OpenAI Key trong Cài đặt API Key.');
        return;
      }
    } else {
      const apiKey = getStoredApiKey();
      if (!apiKey) {
        showToast('Chưa cấu hình API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng.');
        return;
      }
    }

    setIsBatchRedrawingAll(true);
    showToast(`AI đang vẽ lại hình ảnh cho tất cả các thẻ...`);

    try {
      const updated = [...batchSplitItems];
      for (let i = 0; i < updated.length; i++) {
        const item = updated[i];
        if (!item.isSelected) continue;

        updated[i] = { ...updated[i], isRedrawing: true };
        setBatchSplitItems([...updated]);

        try {
          const prompt = `${item.word} (${item.meaning}). ${item.visualDescription}`;
          const res = await generateIllustrationWithAI({
            prompt,
            style: batchDrawStyle,
            sourceImageBase64: item.cropBase64,
            engine: batchDrawEngine,
          });
          updated[i] = {
            ...updated[i],
            aiDrawnBase64: res.imageDataUrl,
            activeImage: 'ai',
            isRedrawing: false,
          };
        } catch (e) {
          console.warn(`Lỗi vẽ lại mục ${item.word}:`, e);
          updated[i] = { ...updated[i], isRedrawing: false };
        }
        setBatchSplitItems([...updated]);
      }

      triggerCelebration();
      showToast('✨ Đã vẽ lại toàn bộ tranh minh họa bằng AI!');
    } finally {
      setIsBatchRedrawingAll(false);
    }
  };

  const handleBatchRedrawSingle = async (idx: number) => {
    const item = batchSplitItems[idx];
    if (!item) return;

    if (batchDrawEngine === 'chatgpt-dalle') {
      const oKey = getStoredOpenAIApiKey();
      if (!oKey) {
        showToast('Chưa cấu hình OpenAI API Key để vẽ bằng ChatGPT.');
        return;
      }
    } else {
      const apiKey = getStoredApiKey();
      if (!apiKey) {
        showToast('Chưa cấu hình API Key.');
        return;
      }
    }

    const updated = [...batchSplitItems];
    updated[idx] = { ...updated[idx], isRedrawing: true };
    setBatchSplitItems([...updated]);

    try {
      const prompt = `${item.word} (${item.meaning}). ${item.visualDescription}`;
      const res = await generateIllustrationWithAI({
        prompt,
        style: batchDrawStyle,
        sourceImageBase64: item.cropBase64,
        engine: batchDrawEngine,
      });
      updated[idx] = {
        ...updated[idx],
        aiDrawnBase64: res.imageDataUrl,
        activeImage: 'ai',
        isRedrawing: false,
      };
      setBatchSplitItems([...updated]);
      showToast(`✨ Đã vẽ lại hình cho "${item.word}"!`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`Lỗi vẽ lại: ${msg}`);
      updated[idx] = { ...updated[idx], isRedrawing: false };
      setBatchSplitItems([...updated]);
    }
  };

  const handleSaveAllBatchCards = async () => {
    const selected = batchSplitItems.filter((i) => i.isSelected);
    if (selected.length === 0) {
      showToast('Chưa chọn thẻ nào để lưu.');
      return;
    }

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      const finalImage =
        item.activeImage === 'ai' && item.aiDrawnBase64 ? item.aiDrawnBase64 : item.cropBase64;

      const newCard: VocabCard = {
        id: `card-split-${Date.now()}-${i}`,
        deckId: selectedDeckId,
        word: item.word.trim(),
        phonetic: item.phonetic.trim() || `/${item.word.trim().toLowerCase()}/`,
        meaning: item.meaning.trim(),
        example: item.example.trim(),
        imageDataUrl: finalImage,
        order: deckCards.length + i,
        bestStars: 0,
        createdAt: Date.now() + i,
      };

      await onSaveCard(newCard);
    }

    setShowBatchSplitModal(false);
    triggerCelebration();
    showToast(`🎉 Đã tự động tách và lưu thành công ${selected.length} thẻ từ vựng vào bài học!`);
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

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        Tải ảnh
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
                      <button
                        type="button"
                        onClick={() => {
                          setAiCustomPrompt(formWord ? `${formWord} (${formMeaning})` : '');
                          setShowAiDrawModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer whitespace-nowrap shadow-2xs"
                        title="Vẽ tranh minh họa bằng AI cho từ này"
                      >
                        <Palette className="w-3.5 h-3.5 text-purple-600" />
                        Vẽ AI
                      </button>
                    </div>
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
                {/* AI Multi-Image Auto-Split & Batch Redraw Button */}
                <button
                  type="button"
                  onClick={handleAiAutoSplitTextbookPage}
                  disabled={isAiSplittingPage}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold whitespace-nowrap shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  title="AI tự động nhận diện tất cả các hình vẽ trên trang sách, vẽ lại và tự động tách thành các ảnh riêng biệt"
                >
                  {isAiSplittingPage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                      <span>Đang quét & tách ảnh...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>✨ AI Tự tách ảnh & Vẽ lại</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRunSmartScan}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0284C7] text-white text-xs font-semibold hover:bg-[#0369A1] whitespace-nowrap shadow-xs cursor-pointer"
                  title="Chia khung lưới mẫu nhanh 4 ô"
                >
                  <ScanSearch className="w-4 h-4" />
                  Chia khung lưới
                </button>

                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
                  title="Dán ảnh chụp màn hình từ Clipboard (Win + Shift + S rồi bấm vào đây hoặc ấn Ctrl + V)"
                >
                  <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
                  Dán ảnh chụp (Ctrl+V)
                </button>

                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shadow-xs">
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
                    className="text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Dùng trang mẫu
                  </button>
                )}
              </div>
            </div>

            {/* Quick Screenshot Paste Tip Banner */}
            <div className="flex items-center justify-between text-xs text-emerald-900 bg-emerald-50/90 border border-emerald-200 rounded-xl px-3.5 py-2">
              <div className="flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  💡 <strong>Chụp màn hình & Dán tức thì:</strong> Nhấn{' '}
                  <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-[11px] font-mono font-bold text-emerald-950 shadow-2xs">
                    Win + Shift + S
                  </kbd>{' '}
                  để chụp trang sách rồi nhấn{' '}
                  <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-[11px] font-mono font-bold text-emerald-950 shadow-2xs">
                    Ctrl + V
                  </kbd>{' '}
                  để dán thẳng vào trang sách này!
                </span>
              </div>
              <span className="hidden sm:inline-block text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                Sẵn sàng nhận ảnh
              </span>
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
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-700">
                    Khung tranh đã nhận diện trên trang (nhấn để xem thẻ):
                  </div>
                  {batchSplitItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowBatchSplitModal(true)}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Split className="w-3.5 h-3.5" />
                      Mở bảng tách ảnh ({batchSplitItems.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {detectedRegions.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => handleSelectRegion(reg)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-[#0284C7] hover:bg-[#0284C7]/6 text-xs font-medium text-slate-800 transition-colors whitespace-nowrap cursor-pointer"
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

            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
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

              {isAiRedrawing && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                  <p className="text-xs font-bold text-slate-800">Gemini AI đang nhận diện & vẽ lại hình...</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Đang chuyển đổi ảnh chụp từ sách thành hình minh họa vector/3D sắc nét
                  </p>
                </div>
              )}
            </div>

            {/* AI Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleAiAutoSplitTextbookPage(croppedPreviewBase64 || undefined)}
                disabled={isAiSplittingPage}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Nếu trang sách hoặc ảnh này có nhiều con vật/đồ vật, AI sẽ tự động tách thành từng ảnh riêng biệt và vẽ lại từng ảnh!"
              >
                {isAiSplittingPage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>Đang tách ảnh & nhận diện từng con vật...</span>
                  </>
                ) : (
                  <>
                    <Split className="w-4 h-4 text-emerald-200" />
                    <span>✨ Tách thành các ảnh riêng biệt & Vẽ lại</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAiRedrawCroppedImage}
                  disabled={!croppedPreviewBase64 || isAiRedrawing}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                  title="AI tự động nhận diện vật thể trong ảnh sách và vẽ lại thành hình minh họa vector/3D đẹp mắt"
                >
                  {isAiRedrawing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 text-purple-200" />
                  )}
                  <span>Vẽ lại hình này</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAiCustomPrompt(cropWord ? `${cropWord} (${cropMeaning})` : '');
                    setShowAiDrawModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 text-purple-800 text-xs font-semibold hover:bg-purple-100 hover:border-purple-400 transition-colors shadow-xs cursor-pointer"
                  title="Tự vẽ theo ý tưởng riêng hoặc lấy Prompt cho ChatGPT, Canva"
                >
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  <span>Tự vẽ ý tưởng</span>
                </button>
              </div>
            </div>

            {croppedPreviewBase64 && (
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>Dung lượng nhúng Base64:</span>
                <span className="tabular-nums font-semibold">{formatBytes(estimateStringBytes(croppedPreviewBase64))}</span>
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

      {/* AI DRAWING & RE-DRAWING MODAL (Gemini · ChatGPT · Canva) */}
      {showAiDrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
                  <Palette className="w-5 h-5 text-purple-100" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    Xưởng Vẽ Tranh Minh Họa AI
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-medium">
                      Gemini · Canva · ChatGPT
                    </span>
                  </h3>
                  <p className="text-xs text-purple-100">
                    Tự động vẽ tranh minh họa cho từ vựng hoặc hỗ trợ prompt chuẩn cho ChatGPT & Canva
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDrawModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setAiDrawModalTab('gemini')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  aiDrawModalTab === 'gemini'
                    ? 'border-purple-600 text-purple-700 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                ✨ Vẽ trực tiếp bằng AI (Gemini · Imagen)
              </button>
              <button
                type="button"
                onClick={() => setAiDrawModalTab('chatgpt')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  aiDrawModalTab === 'chatgpt'
                    ? 'border-emerald-600 text-emerald-800 bg-white ring-1 ring-emerald-500/10'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-4 h-4 text-emerald-600" />
                🤖 Vẽ bằng ChatGPT (DALL-E 3)
              </button>
              <button
                type="button"
                onClick={() => setAiDrawModalTab('external')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  aiDrawModalTab === 'external'
                    ? 'border-indigo-600 text-indigo-700 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                🎨 Trợ lý Prompt Canva & Web
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {aiDrawModalTab === 'gemini' ? (
                <>
                  {/* Prompt input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ý tưởng hoặc nội dung muốn vẽ (tiếng Việt hoặc tiếng Anh):
                    </label>
                    <input
                      type="text"
                      value={aiCustomPrompt}
                      onChange={(e) => setAiCustomPrompt(e.target.value)}
                      placeholder="VD: Chú voi con phun nước vui đùa trong rừng hoa, A cute red bicycle with flowers..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Style selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Chọn phong cách minh họa thiếu nhi:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {AI_DRAWING_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setAiDrawStyle(style.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                            aiDrawStyle === style.id
                              ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800">{style.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {style.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Engine selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Công nghệ tạo ảnh:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setAiDrawEngine('smart-auto')}
                        className={`p-2.5 rounded-xl border text-center transition-colors text-xs font-semibold cursor-pointer ${
                          aiDrawEngine === 'smart-auto'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        ⚡ Tự động
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiDrawEngine('chatgpt-dalle')}
                        className={`p-2.5 rounded-xl border text-center transition-colors text-xs font-bold cursor-pointer ${
                          aiDrawEngine === 'chatgpt-dalle'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                            : 'border-emerald-200 bg-emerald-50/40 text-emerald-900 hover:bg-emerald-50'
                        }`}
                      >
                        🤖 ChatGPT
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiDrawEngine('gemini-svg')}
                        className={`p-2.5 rounded-xl border text-center transition-colors text-xs font-semibold cursor-pointer ${
                          aiDrawEngine === 'gemini-svg'
                            ? 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📐 Vector SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiDrawEngine('imagen-3')}
                        className={`p-2.5 rounded-xl border text-center transition-colors text-xs font-semibold cursor-pointer ${
                          aiDrawEngine === 'imagen-3'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        🖼️ Imagen 3
                      </button>
                    </div>

                    {aiDrawEngine === 'chatgpt-dalle' && (
                      <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Bot className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            {openaiKeyInput ? 'Đã sẵn sàng vẽ bằng ChatGPT DALL-E 3.' : 'Chưa có OpenAI Key (nhập key hoặc dùng nút mở web).'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAiDrawModalTab('chatgpt')}
                          className="font-bold underline text-emerald-800 hover:text-emerald-950 cursor-pointer text-[11px] shrink-0"
                        >
                          Cài đặt ChatGPT →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    onClick={handleGenerateCustomIllustration}
                    disabled={isAiGeneratingIllustration || (!aiCustomPrompt.trim() && !cropWord.trim())}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    {isAiGeneratingIllustration ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI đang vẽ tranh minh họa...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>Bắt đầu vẽ tranh bằng AI</span>
                      </>
                    )}
                  </button>

                  {/* Preview Result */}
                  {aiGeneratedPreview && (
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Kết quả tranh vẽ AI:</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {aiGeneratedEngineUsed}
                        </span>
                      </div>
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center max-w-sm mx-auto shadow-inner">
                        <img
                          src={aiGeneratedPreview}
                          alt="AI generated illustration"
                          className="w-full h-full object-contain bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleApplyAiIllustrationToCard}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Dùng hình này cho thẻ từ vựng
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateCustomIllustration}
                          disabled={isAiGeneratingIllustration}
                          className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Vẽ lại
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : aiDrawModalTab === 'chatgpt' ? (
                /* TAB: DEDICATED CHATGPT (DALL-E 3) DRAWING STUDIO */
                <div className="space-y-5">
                  {/* Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-2 text-sm text-[#15803d]">
                      <Bot className="w-5 h-5 text-emerald-700" />
                      Xưởng Vẽ Tranh Minh Họa Bằng ChatGPT (DALL-E 3)
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      ChatGPT (DALL-E 3) tạo hình ảnh 3D Pixar và hoạt hình giáo dục thiếu nhi cực kỳ trong trẻo, sinh động. Thầy cô có thể vẽ trực tiếp bằng OpenAI API Key hoặc bấm mở nhanh ChatGPT trên Web kèm Prompt chuẩn đã tạo sẵn.
                    </p>
                  </div>

                  {/* Prompt input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ý tưởng hoặc từ vựng muốn ChatGPT vẽ (tiếng Việt hoặc tiếng Anh):
                    </label>
                    <input
                      type="text"
                      value={aiCustomPrompt}
                      onChange={(e) => setAiCustomPrompt(e.target.value)}
                      placeholder="VD: Chú hươu cao cổ 3D Pixar mỉm cười đáng yêu, A friendly baby elephant..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Style selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Chọn phong cách minh họa:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AI_DRAWING_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setAiDrawStyle(style.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                            aiDrawStyle === style.id
                              ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-bold text-slate-800">{style.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {style.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Two Methods Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Method 1: Direct DALL-E 3 API */}
                    <div className="p-4 rounded-xl border-2 border-emerald-400 bg-emerald-50/40 space-y-3 flex flex-col justify-between shadow-2xs">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-emerald-600" />
                            Cách 1: Vẽ trực tiếp bằng API
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Tự động 100%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Ảnh được ChatGPT vẽ và tự động nhúng thẳng vào ứng dụng trong vài giây.
                        </p>

                        {/* OpenAI API Key status / input */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">OpenAI API Key:</span>
                            <button
                              type="button"
                              onClick={() => setShowOpenaiKeySettings(!showOpenaiKeySettings)}
                              className="text-emerald-700 hover:underline font-bold cursor-pointer"
                            >
                              {openaiKeyInput ? 'Đổi Key' : 'Nhập Key'}
                            </button>
                          </div>
                          {(!openaiKeyInput || showOpenaiKeySettings) ? (
                            <div className="flex gap-1.5">
                              <input
                                type="password"
                                placeholder="sk-proj-..."
                                value={openaiKeyInput}
                                onChange={(e) => setOpenaiKeyInput(e.target.value)}
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                              />
                              <button
                                type="button"
                                onClick={handleSaveOpenaiKey}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shrink-0 cursor-pointer"
                              >
                                Lưu
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-mono">••••••••••••••••</span>
                              <span className="text-[10px] text-slate-500">(Đã lưu)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAiDrawEngine('chatgpt-dalle');
                          handleGenerateCustomIllustration();
                        }}
                        disabled={isAiGeneratingIllustration || (!aiCustomPrompt.trim() && !cropWord.trim())}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 mt-2"
                      >
                        {isAiGeneratingIllustration ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>ChatGPT đang vẽ...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            <span>Bắt đầu vẽ bằng ChatGPT (API)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Method 2: Free ChatGPT Web (1-Click) */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 flex flex-col justify-between shadow-2xs">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-emerald-600" />
                            Cách 2: Vẽ trên Web ChatGPT
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Miễn phí 100%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Dành cho thầy cô dùng tài khoản ChatGPT trên web (chatgpt.com). Tự động copy prompt chuẩn và mở ChatGPT.
                        </p>
                        <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <p>1. Bấm nút dưới (Prompt chuẩn sẽ tự động copy).</p>
                          <p>2. Dán (Ctrl+V) vào ChatGPT để vẽ tranh.</p>
                          <p>3. Chuột phải vào ảnh → Chọn "Sao chép hình ảnh", rồi dán (Ctrl+V) vào app.</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenChatGPTWebWithPrompt}
                        className="w-full py-2.5 px-4 rounded-xl border border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer mt-2"
                      >
                        <ExternalLink className="w-4 h-4 text-emerald-700" />
                        <span>🚀 Mở ChatGPT để vẽ (Đã copy Prompt)</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview Result if generated */}
                  {aiGeneratedPreview && (
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Kết quả tranh vẽ ChatGPT:</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {aiGeneratedEngineUsed}
                        </span>
                      </div>
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center max-w-sm mx-auto shadow-inner">
                        <img
                          src={aiGeneratedPreview}
                          alt="AI generated illustration"
                          className="w-full h-full object-contain bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleApplyAiIllustrationToCard}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Dùng hình này cho thẻ từ vựng
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiDrawEngine('chatgpt-dalle');
                            handleGenerateCustomIllustration();
                          }}
                          disabled={isAiGeneratingIllustration}
                          className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Vẽ lại
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fast Paste Dropzone inside modal */}
                  <div
                    onPaste={handlePasteExternalImage}
                    tabIndex={0}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 text-center cursor-pointer transition-colors outline-none focus:border-emerald-600 focus:bg-emerald-50/30"
                  >
                    <p className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
                      <Clipboard className="w-4 h-4 text-emerald-600" />
                      Dán ảnh từ ChatGPT vào đây (ấn Ctrl + V)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sau khi sao chép ảnh từ ChatGPT web, bấm vào ô này rồi nhấn Ctrl + V để nạp ảnh ngay lập tức.
                    </p>
                  </div>
                </div>
              ) : (
                /* TAB 2: EXTERNAL AI PROMPT HELPER (Canva & Other) */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 leading-relaxed">
                    💡 <strong>Hỗ trợ ChatGPT (DALL-E 3) & Canva:</strong> Thầy cô có thể sinh Prompt chuyên nghiệp bằng tiếng Anh, sao chép sang ChatGPT hoặc Canva để vẽ ảnh theo ý muốn, sau đó dán trực tiếp kết quả ảnh vào đây!
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Từ vựng hoặc ý tưởng muốn vẽ:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiCustomPrompt}
                        onChange={(e) => setAiCustomPrompt(e.target.value)}
                        placeholder="VD: School Bus, Con voi, Chiếc cặp sách màu vàng..."
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateExternalPrompts}
                        disabled={isGeneratingExternalPrompts}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isGeneratingExternalPrompts ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Tạo Prompt chuẩn
                      </button>
                    </div>
                  </div>

                  {aiExternalPrompts && (
                    <div className="space-y-3.5 pt-2">
                      {/* ChatGPT Box */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            🟢 Prompt cho ChatGPT / DALL-E 3:
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href="https://chatgpt.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              Mở ChatGPT <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyPrompt(aiExternalPrompts.chatGptDallePrompt, 'chatgpt')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-2xs cursor-pointer"
                            >
                              {copiedField === 'chatgpt' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              Sao chép
                            </button>
                          </div>
                        </div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all break-words">
                          {aiExternalPrompts.chatGptDallePrompt}
                        </div>
                      </div>

                      {/* Canva Box */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            🔵 Prompt cho Canva (Magic Media / Tạo ảnh):
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href="https://www.canva.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-[#00c4cc] hover:underline flex items-center gap-1"
                            >
                              Mở Canva <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyPrompt(aiExternalPrompts.canvaPrompt, 'canva')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-2xs cursor-pointer"
                            >
                              {copiedField === 'canva' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              Sao chép
                            </button>
                          </div>
                        </div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all break-words">
                          {aiExternalPrompts.canvaPrompt}
                        </div>
                      </div>

                      {/* Drop/Paste Target Box */}
                      <div
                        onPaste={handlePasteExternalImage}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handlePasteExternalImage}
                        className="p-4 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/40 text-center space-y-2 hover:bg-indigo-50/70 transition-colors"
                      >
                        <ImageIcon className="w-6 h-6 text-indigo-500 mx-auto" />
                        <p className="text-xs font-bold text-indigo-900">
                          Dán hoặc kéo thả ảnh từ ChatGPT / Canva vào đây
                        </p>
                        <p className="text-[11px] text-indigo-700">
                          Nhấn tổ hợp phím <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200">Ctrl + V</kbd> khi đang ở trong khung này, hoặc kéo thả tệp ảnh đã tải về
                        </p>
                      </div>

                      {/* Preview if image loaded */}
                      {aiGeneratedPreview && (
                        <div className="pt-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">Ảnh đã nhận diện:</span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {aiGeneratedEngineUsed}
                            </span>
                          </div>
                          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center max-w-sm mx-auto">
                            <img
                              src={aiGeneratedPreview}
                              alt="Result preview"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyAiIllustrationToCard}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Dùng ảnh này cho thẻ từ vựng
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI MULTI-IMAGE TEXTBOOK AUTO-SPLIT & BATCH MODAL */}
      {showBatchSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-emerald-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
                  <Split className="w-5 h-5 text-purple-100" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    Tự Động Tách Ảnh & Nhận Diện Trang Sách Bằng AI
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-white/20 text-white font-medium">
                      Tìm thấy {batchSplitItems.length} ô tranh
                    </span>
                  </h3>
                  <p className="text-xs text-purple-100">
                    AI đã tách thành các ảnh riêng biệt kèm từ vựng. Thầy cô có thể giữ ảnh gốc hoặc dùng AI vẽ lại toàn bộ!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchSplitModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-bar Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = batchSplitItems.every((i) => i.isSelected);
                    setBatchSplitItems((prev) =>
                      prev.map((item) => ({ ...item, isSelected: !allSelected }))
                    );
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                >
                  {batchSplitItems.every((i) => i.isSelected) ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Chọn tất cả ({batchSplitItems.filter((i) => i.isSelected).length}/{batchSplitItems.length})</span>
                </button>

                <div className="h-4 w-px bg-slate-300" />

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Phong cách vẽ AI:</span>
                  <select
                    value={batchDrawStyle}
                    onChange={(e) => setBatchDrawStyle(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 outline-none cursor-pointer"
                  >
                    {AI_DRAWING_STYLES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Công nghệ AI:</span>
                  <select
                    value={batchDrawEngine}
                    onChange={(e) => setBatchDrawEngine(e.target.value as 'smart-auto' | 'chatgpt-dalle' | 'gemini-svg' | 'imagen-3')}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="smart-auto">⚡ Tự động thông minh</option>
                    <option value="chatgpt-dalle">🤖 ChatGPT (DALL-E 3)</option>
                    <option value="gemini-svg">📐 Vector SVG (Gemini)</option>
                    <option value="imagen-3">🖼️ Google Imagen 3</option>
                  </select>
                </div>
              </div>

              {/* Master Redraw Button */}
              <button
                type="button"
                onClick={handleBatchRedrawAll}
                disabled={isBatchRedrawingAll}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isBatchRedrawingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI đang vẽ lại tất cả...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                    <span>✨ AI Vẽ lại toàn bộ tranh ({batchSplitItems.length} hình)</span>
                  </>
                )}
              </button>
            </div>

            {/* Grid of Separated Items */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-100/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {batchSplitItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border p-4 transition-all shadow-xs space-y-3 ${
                      item.isSelected ? 'border-emerald-400 ring-2 ring-emerald-500/10' : 'border-slate-200 opacity-60'
                    }`}
                  >
                    {/* Item Top Bar */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBatchSplitItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, isSelected: checked } : it))
                            );
                          }}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="font-bold text-xs text-slate-800">
                          Thẻ #{idx + 1}: <span className="text-[#15803d]">{item.word}</span>
                        </span>
                      </label>

                      {/* Image Source Mode Toggle */}
                      <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setBatchSplitItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, activeImage: 'crop' } : it))
                            );
                          }}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                            item.activeImage === 'crop'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Ảnh cắt từ sách
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.aiDrawnBase64) {
                              handleBatchRedrawSingle(idx);
                            } else {
                              setBatchSplitItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, activeImage: 'ai' } : it))
                              );
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                            item.activeImage === 'ai'
                              ? 'bg-purple-600 text-white shadow-2xs font-bold'
                              : 'text-purple-700 hover:text-purple-900'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          {item.aiDrawnBase64 ? 'Ảnh AI vẽ lại' : 'Vẽ lại bằng AI'}
                        </button>
                      </div>
                    </div>

                    {/* Image Preview & Info Grid */}
                    <div className="grid grid-cols-12 gap-3 items-start">
                      {/* Left: Image Container */}
                      <div className="col-span-5 relative aspect-square rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center">
                        <img
                          src={
                            item.activeImage === 'ai' && item.aiDrawnBase64
                              ? item.aiDrawnBase64
                              : item.cropBase64
                          }
                          alt={item.word}
                          className="w-full h-full object-contain bg-white"
                        />
                        {item.isRedrawing && (
                          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center z-10">
                            <Loader2 className="w-5 h-5 text-purple-600 animate-spin mb-1" />
                            <span className="text-[10px] font-bold text-purple-800">Đang vẽ...</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Editable Fields */}
                      <div className="col-span-7 space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Từ tiếng Anh
                          </label>
                          <input
                            type="text"
                            value={item.word}
                            onChange={(e) => {
                              const v = e.target.value;
                              setBatchSplitItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, word: v } : it))
                              );
                            }}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Nghĩa tiếng Việt
                          </label>
                          <input
                            type="text"
                            value={item.meaning}
                            onChange={(e) => {
                              const v = e.target.value;
                              setBatchSplitItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, meaning: v } : it))
                              );
                            }}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-900"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-mono text-[#0284C7] truncate">
                            {item.phonetic}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleBatchRedrawSingle(idx)}
                            disabled={item.isRedrawing}
                            className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {item.aiDrawnBase64 ? 'Vẽ lại khác' : 'Tạo nét vẽ AI'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Sẽ nạp vào chủ đề: <strong>{decks.find((d) => d.id === selectedDeckId)?.title || 'Chủ đề hiện tại'}</strong>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBatchSplitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllBatchCards}
                  disabled={batchSplitItems.filter((i) => i.isSelected).length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Nạp tất cả {batchSplitItems.filter((i) => i.isSelected).length} thẻ vào bài học
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
