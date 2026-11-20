import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Star,
  Volume2,
  AlertCircle,
  Sparkles,
  Bot,
  MessageCircle,
  Send,
  X,
  Smile,
} from 'lucide-react';
import type { BrandSettings, LessonDeck, SpeakingEvaluation, VocabCard } from '../types/edtech';
import {
  evaluatePronunciation,
  playClassroomSfx,
  speakVocabulary,
} from '../utils/mediaUtils';
import {
  chatWithAIBuddy,
  evaluatePronunciationWithAI,
  getStoredApiKey,
} from '../utils/geminiService';
import { triggerCelebration } from '../utils/celebration';
import { ResilientImage } from './ResilientImage';

interface SpeakingStudioProps {
  decks: LessonDeck[];
  cards: VocabCard[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  initialCardId?: string | null;
  settings: BrandSettings;
  onSaveCardStars: (cardId: string, stars: number) => void;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  results: {
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string; confidence: number };
    };
    length: number;
  };
}

export function SpeakingStudio({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  initialCardId,
  settings,
  onSaveCardStars,
}: SpeakingStudioProps) {
  const deckCards = useMemo(
    () =>
      cards
        .filter((c) => c.deckId === selectedDeckId)
        .sort((a, b) => a.order - b.order),
    [cards, selectedDeckId]
  );

  const [selectedCardId, setSelectedCardId] = useState<string>(
    initialCardId || deckCards[0]?.id || ''
  );

  useEffect(() => {
    if (initialCardId && deckCards.some((c) => c.id === initialCardId)) {
      setSelectedCardId(initialCardId);
    } else if (!deckCards.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(deckCards[0]?.id || '');
    }
  }, [deckCards, initialCardId, selectedCardId]);

  const activeCard = deckCards.find((c) => c.id === selectedCardId) ?? deckCards[0];

  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [practiceInput, setPracticeInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Gemini AI States
  const [isAiEvaluating, setIsAiEvaluating] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    endingSoundOk: boolean;
    vowelOk: boolean;
    stressOk: boolean;
    encouragingMessageVi: string;
    suggestedDrill: string;
    stars: number;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Buddy AI Chat States
  const [showBuddyChat, setShowBuddyChat] = useState(false);
  const [buddyMessages, setBuddyMessages] = useState<{ sender: 'buddy' | 'user'; text: string }[]>([
    {
      sender: 'buddy',
      text: 'Hello bé! Mình là gấu Buddy 🐻. Bé hãy luyện đọc từ vựng rồi nhắn cho mình nhé!',
    },
  ]);
  const [buddyInput, setBuddyInput] = useState('');
  const [isBuddyTyping, setIsBuddyTyping] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const hasSpeechApi = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }, []);

  const drawIdleWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };

  useEffect(() => {
    drawIdleWave();
  }, [selectedCardId]);

  const stopAllCapture = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsListening(false);
    drawIdleWave();
  };

  const applyEvaluation = (evalResult: SpeakingEvaluation) => {
    setEvaluation(evalResult);
    if (activeCard && evalResult.stars > activeCard.bestStars) {
      onSaveCardStars(activeCard.id, evalResult.stars);
    }
    if (evalResult.stars >= 4) {
      triggerCelebration();
      playClassroomSfx('match', settings.soundEffectsEnabled);
    } else if (evalResult.stars >= 3) {
      playClassroomSfx('star', settings.soundEffectsEnabled);
    } else {
      playClassroomSfx('wrong', settings.soundEffectsEnabled);
    }
  };

  const startSpeakingSession = async () => {
    if (!activeCard) return;
    stopAllCapture();
    setEvaluation(null);
    setLiveTranscript('');
    setStatusMessage(null);
    setAiAnalysisResult(null);
    setAiError(null);

    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    // Try microphone stream for live waveform & offline playback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const renderFrame = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        analyser.getByteTimeDomainData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0284C7';
        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        animFrameRef.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();

      if (typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedAudioUrl(url);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
    } catch {
      setStatusMessage(
        'Chưa cấp quyền micro hoặc thiết bị không có micro. Thầy cô có thể dùng chế độ Giáo viên chấm sao hoặc kiểm tra phát âm văn bản bên dưới.'
      );
    }

    // Launch Web Speech Recognition
    if (hasSpeechApi) {
      const w = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const RecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (RecognitionCtor) {
        const recognition = new RecognitionCtor();
        recognition.lang = settings.voiceAccent;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.continuous = false;

        recognition.onresult = (event) => {
          let bestText = '';
          for (let i = 0; i < event.results.length; i++) {
            bestText = event.results[i][0]?.transcript || bestText;
            if (event.results[i].isFinal) {
              const result = evaluatePronunciation(bestText, activeCard.word);
              setLiveTranscript(bestText);
              applyEvaluation(result);
              stopAllCapture();
              return;
            }
          }
          setLiveTranscript(bestText);
        };

        recognition.onerror = (ev) => {
          if (ev.error === 'not-allowed') {
            setStatusMessage('Trình duyệt đang chặn micro. Hãy cho phép quyền micro hoặc dùng chế độ Giáo viên chấm sao.');
          }
          stopAllCapture();
        };

        recognition.onend = () => {
          stopAllCapture();
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
          setIsListening(true);
        } catch {
          stopAllCapture();
        }
      }
    } else {
      setIsListening(true);
    }
  };

  const handleStopSpeaking = () => {
    stopAllCapture();
    if (liveTranscript && activeCard) {
      const result = evaluatePronunciation(liveTranscript, activeCard.word);
      applyEvaluation(result);
    }
  };

  const handlePlayModelAudio = (slow = false) => {
    if (!activeCard) return;
    speakVocabulary(activeCard.word, {
      audioDataUrl: activeCard.audioDataUrl,
      rate: slow ? 0.65 : settings.speechRate,
      accent: settings.voiceAccent,
    });
  };

  const handleManualStarAward = (starCount: number) => {
    if (!activeCard) return;
    const manualResult: SpeakingEvaluation = {
      transcript: activeCard.word,
      targetWord: activeCard.word,
      stars: starCount,
      similarity: starCount * 20,
      feedbackTitle:
        starCount >= 4
          ? 'Thầy chấm: Xuất sắc!'
          : starCount === 3
          ? 'Thầy chấm: Khá tốt!'
          : 'Thầy chấm: Cần cố gắng thêm!',
      feedbackDetail: `Giáo viên ghi nhận ${starCount} sao trực tiếp trong giờ học trên lớp.`,
      source: 'manual',
      timestamp: Date.now(),
    };
    applyEvaluation(manualResult);
  };

  const handleCheckTypedPhonetic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceInput.trim() || !activeCard) return;
    const res = evaluatePronunciation(practiceInput.trim(), activeCard.word);
    applyEvaluation(res);
  };

  // ---------------- GEMINI AI EVALUATION ----------------
  const handleRunAiEvaluation = async () => {
    if (!activeCard) return;
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      setAiError('Chưa có Gemini API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng để nhập key.');
      return;
    }

    setIsAiEvaluating(true);
    setAiError(null);
    try {
      const speechToAnalyze = liveTranscript || practiceInput || activeCard.word;
      const res = await evaluatePronunciationWithAI(activeCard.word, activeCard.phonetic, speechToAnalyze);
      setAiAnalysisResult(res);
      applyEvaluation({
        transcript: speechToAnalyze,
        targetWord: activeCard.word,
        stars: res.stars,
        similarity: res.stars * 20,
        feedbackTitle: res.stars >= 4 ? 'Xuất sắc theo nhận xét Gemini AI!' : 'Lời khuyên từ Trợ lý AI:',
        feedbackDetail: res.encouragingMessageVi,
        source: 'gemini-ai',
        timestamp: Date.now(),
        aiDetailedAdvice: res,
      });
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAiEvaluating(false);
    }
  };

  // ---------------- BUDDY CHAT HANDLER ----------------
  const handleSendBuddyMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buddyInput.trim() || !activeCard || isBuddyTyping) return;
    const userText = buddyInput.trim();
    setBuddyMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setBuddyInput('');
    setIsBuddyTyping(true);

    try {
      const reply = await chatWithAIBuddy(activeCard.word, activeCard.meaning, userText);
      setBuddyMessages((prev) => [...prev, { sender: 'buddy', text: reply }]);
      // Read aloud the English part of buddy's response
      const firstLine = reply.split('\n')[0] || reply;
      speakVocabulary(firstLine.replace(/\(.*?\)/g, ''), {
        rate: settings.speechRate,
        accent: settings.voiceAccent,
      });
    } catch (err: unknown) {
      setBuddyMessages((prev) => [
        ...prev,
        { sender: 'buddy', text: `(Lỗi kết nối AI: ${err instanceof Error ? err.message : String(err)})` },
      ]);
    } finally {
      setIsBuddyTyping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Deck Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-sm text-slate-500">
            Phòng Luyện Phát Âm Trẻ Em · Tích hợp Trí tuệ Nhân tạo Gemini AI & Web Speech
          </p>
          <h1 className="mt-1 font-display font-bold text-3xl tracking-tight text-slate-900">
            Luyện Nói & Chẩn Đoán Phát Âm
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDeckId}
            onChange={(e) => onSelectDeck(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({cards.filter((c) => c.deckId === d.id).length} từ)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowBuddyChat(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Bot className="w-4 h-4" />
            <span>Gặp Gấu Buddy AI 🐻</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Card Focus + Word Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Interactive Practice Box */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          {activeCard && (
            <>
              {/* Card Header & Model Audios */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-slate-100">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-slate-50 border border-slate-200 p-2 shrink-0 flex items-center justify-center overflow-hidden">
                  <ResilientImage
                    src={activeCard.imageDataUrl}
                    alt={activeCard.word}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">
                    <span>Thẻ mục tiêu #{activeCard.order + 1}</span>
                    <span>·</span>
                    <span>Đạt kỷ lục: {activeCard.bestStars} ★</span>
                  </div>

                  <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-slate-900 tracking-tight">
                    {activeCard.word}
                  </h2>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-slate-500 text-sm">
                    <span className="font-mono text-sky-600 font-semibold text-lg">
                      {activeCard.phonetic}
                    </span>
                    {activeCard.syllables && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                        {activeCard.syllables}
                      </span>
                    )}
                  </div>

                  <p className="text-base text-slate-700 font-medium">
                    Nghĩa: <span className="font-bold text-emerald-700">“{activeCard.meaning}”</span>
                  </p>
                  <p className="text-xs text-slate-500 italic">“{activeCard.example}”</p>

                  {/* Audio Buttons */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handlePlayModelAudio(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Nghe chuẩn bản ngữ
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlayModelAudio(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Đọc chậm (0.65x)
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Mic Waveform & Controls */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {!isListening ? (
                    <button
                      type="button"
                      onClick={startSpeakingSession}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-sm font-bold shadow-sm transition-all"
                    >
                      <Mic className="w-5 h-5" />
                      <span>Bấm & Đọc từ vựng</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopSpeaking}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm animate-pulse transition-all"
                    >
                      <MicOff className="w-5 h-5" />
                      <span>Dừng & Chấm điểm</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRunAiEvaluation}
                    disabled={isAiEvaluating}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAiEvaluating ? 'AI Đang chẩn đoán...' : 'Chẩn đoán âm học AI (Gemini)'}</span>
                  </button>

                  <div className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center">
                    <canvas ref={canvasRef} width={360} height={42} className="w-full h-10" />
                  </div>
                </div>

                {liveTranscript && (
                  <div className="text-sm text-slate-600 bg-sky-50/60 p-3 rounded-xl border border-sky-100 flex items-center justify-between">
                    <div>
                      Hệ thống nghe được:{' '}
                      <span className="font-mono font-bold text-sky-900 text-base">
                        “{liveTranscript}”
                      </span>
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}

                {statusMessage && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>

              {/* Gemini AI Detailed Diagnostic Card */}
              {aiAnalysisResult && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/70 border border-purple-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <h3 className="font-display font-bold text-base text-purple-900">
                        Chẩn Đoán Ngữ Âm Chuyên Sâu Của Gemini AI
                      </h3>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-200 text-purple-800">
                      {aiAnalysisResult.stars}/5 sao
                    </span>
                  </div>

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-purple-100 text-center">
                      <div className="text-slate-500">Âm đuôi (Ending)</div>
                      <div className={`font-bold mt-1 ${aiAnalysisResult.endingSoundOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {aiAnalysisResult.endingSoundOk ? '✓ Rõ ràng' : '⚠ Cần bật hơi'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-purple-100 text-center">
                      <div className="text-slate-500">Nguyên âm (Vowel)</div>
                      <div className={`font-bold mt-1 ${aiAnalysisResult.vowelOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {aiAnalysisResult.vowelOk ? '✓ Chuẩn xác' : '⚠ Cần mở khẩu hình'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-purple-100 text-center">
                      <div className="text-slate-500">Trọng âm (Stress)</div>
                      <div className={`font-bold mt-1 ${aiAnalysisResult.stressOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {aiAnalysisResult.stressOk ? '✓ Đúng nhịp' : '⚠ Nhấn nhẹ'}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-purple-950 bg-white p-3.5 rounded-xl border border-purple-100 space-y-1">
                    <div className="font-bold text-purple-900">Lời khuyên của cô giáo AI:</div>
                    <p className="leading-relaxed">{aiAnalysisResult.encouragingMessageVi}</p>
                    <div className="pt-2 text-indigo-700 font-medium">
                      🎯 Bài tập luyện lại: {aiAnalysisResult.suggestedDrill}
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Star Evaluation Result */}
              {evaluation && !aiAnalysisResult && (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <Star
                          key={idx}
                          className={`w-7 h-7 transition-transform ${
                            idx <= evaluation.stars
                              ? 'fill-amber-400 text-amber-400 scale-105'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                      <span className="ml-2 font-mono font-bold text-lg text-slate-900">
                        {evaluation.stars}/5 sao
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Độ khớp: {evaluation.similarity}%</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900">
                      {evaluation.feedbackTitle}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">{evaluation.feedbackDetail}</p>
                  </div>
                </div>
              )}

              {/* Teacher Direct Scoring Bar */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  <strong className="text-slate-700">Thầy cô chấm sao trực tiếp trên lớp:</strong>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((starCount) => (
                    <button
                      key={starCount}
                      type="button"
                      onClick={() => handleManualStarAward(starCount)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-xs font-bold text-slate-800 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {starCount}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right Word Queue */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-slate-900">Từ vựng bài học</h2>
            <span className="text-xs text-slate-500 font-semibold">{deckCards.length} từ</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1">
            {deckCards.map((card) => {
              const isCurrent = card.id === activeCard?.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCardId(card.id)}
                  className={`w-full py-3 px-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors text-left ${
                    isCurrent ? 'bg-[#0284C7]/10' : 'hover:bg-slate-50'
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
                      <div className={`text-sm font-bold truncate ${isCurrent ? 'text-[#0284C7]' : 'text-slate-900'}`}>
                        {card.word}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{card.meaning}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${s <= card.bestStars ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* AI Buddy Chat Modal */}
      {showBuddyChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[520px]">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🐻</span>
                <div>
                  <h3 className="font-bold text-sm">Gấu Buddy Trợ Giảng AI</h3>
                  <p className="text-[11px] text-amber-100">
                    Thực hành giao tiếp với từ: <strong>{activeCard?.word}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuddyChat(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {buddyMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white rounded-br-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isBuddyTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs text-slate-400 italic">
                    Gấu Buddy đang gõ...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendBuddyMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                placeholder={`Nói chuyện với Buddy (VD: I see a ${activeCard?.word})...`}
                value={buddyInput}
                onChange={(e) => setBuddyInput(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={isBuddyTyping || !buddyInput.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
