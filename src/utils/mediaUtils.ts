import type { SpeakingEvaluation } from '../types/edtech';

/**
 * Compresses any uploaded Image File into an embedded Base64 Data URL
 * using HTML5 Canvas so local IndexedDB packages remain lightweight and portable.
 */
export function compressImageFileToBase64(
  file: File,
  maxDimension = 760,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        // Preserve transparency for PNG/SVG logos when requested via quality === 1
        if (file.type === 'image/png' || file.type === 'image/svg+xml') {
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL('image/png'));
        } else {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL('image/jpeg', quality));
        }
      };
      img.onerror = () => reject(new Error('Định dạng hình ảnh không hợp lệ.'));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a local asset URL into a self-contained Base64 Data URL
 * so exported .json lesson packages never break links when moved across computers.
 */
export function urlToBase64(url: string, quality = 0.82): Promise<string> {
  if (url.startsWith('data:')) {
    return Promise.resolve(url);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxDim = 760;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(url);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể mã hóa âm thanh sang Base64.'));
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function estimateStringBytes(str?: string | null): number {
  if (!str) return 0;
  return new Blob([str]).size;
}

/**
 * Offline-first pronunciation player:
 * Plays embedded teacher Base64 audio if available, otherwise synthesizes crisp
 * native English speech via the browser's built-in Web Speech API.
 */
let activeAudioEl: HTMLAudioElement | null = null;

export function speakVocabulary(
  text: string,
  options?: {
    audioDataUrl?: string;
    rate?: number;
    accent?: 'en-US' | 'en-GB';
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (activeAudioEl) {
    activeAudioEl.pause();
    activeAudioEl = null;
  }

  if (options?.audioDataUrl) {
    const audio = new Audio(options.audioDataUrl);
    activeAudioEl = audio;
    audio.onplay = () => options.onStart?.();
    audio.onended = () => {
      activeAudioEl = null;
      options.onEnd?.();
    };
    audio.onerror = () => {
      activeAudioEl = null;
      speakWithWebSpeech(text, options);
    };
    audio.play().catch(() => speakWithWebSpeech(text, options));
    return;
  }

  speakWithWebSpeech(text, options);
}

function speakWithWebSpeech(
  text: string,
  options?: {
    rate?: number;
    accent?: 'en-US' | 'en-GB';
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const accent = options?.accent ?? 'en-US';
  utterance.lang = accent;
  utterance.rate = options?.rate ?? 0.85;
  utterance.pitch = 1.04;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang === accent && /Google|Samantha|Daniel|Natural/i.test(v.name)) ||
    voices.find((v) => v.lang === accent) ||
    voices.find((v) => v.lang.startsWith('en'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onstart = () => options?.onStart?.();
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

/**
 * Pure Web Audio API offline sound effect synthesizer for classroom games & speaking rewards.
 */
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playClassroomSfx(
  kind: 'flip' | 'match' | 'wrong' | 'star' | 'victory',
  enabled = true
): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playTone = (
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.12
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(0.001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  };

  if (kind === 'flip') {
    playTone(520, 0, 0.08, 'triangle', 0.08);
  } else if (kind === 'match') {
    playTone(523.25, 0, 0.14, 'triangle', 0.14);
    playTone(659.25, 0.09, 0.16, 'triangle', 0.14);
    playTone(783.99, 0.18, 0.24, 'sine', 0.16);
  } else if (kind === 'wrong') {
    playTone(240, 0, 0.14, 'sawtooth', 0.07);
    playTone(190, 0.11, 0.18, 'sawtooth', 0.07);
  } else if (kind === 'star') {
    playTone(587.33, 0, 0.12, 'sine', 0.12);
    playTone(880, 0.1, 0.22, 'sine', 0.14);
  } else if (kind === 'victory') {
    playTone(523.25, 0, 0.14, 'triangle', 0.14);
    playTone(659.25, 0.12, 0.14, 'triangle', 0.14);
    playTone(783.99, 0.24, 0.14, 'triangle', 0.14);
    playTone(1046.5, 0.36, 0.38, 'triangle', 0.16);
  }
}

/**
 * Local phonetic & Levenshtein pronunciation scorer mapping spoken text to 1–5 stars.
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function consonantSkeleton(s: string): string {
  return s.replace(/[aeiouy\s]/g, '').replace(/(.)\1+/g, '$1');
}

export function evaluatePronunciation(
  transcript: string,
  targetWord: string
): SpeakingEvaluation {
  const spoken = normalizeText(transcript);
  const target = normalizeText(targetWord);

  if (!spoken) {
    return {
      transcript: '',
      targetWord,
      stars: 1,
      similarity: 0,
      feedbackTitle: 'Chưa nghe rõ giọng đọc',
      feedbackDetail: 'Bé hãy lại gần micro và đọc to, rõ ràng hơn nhé.',
      source: 'speech-api',
      timestamp: Date.now(),
    };
  }

  // Also check individual tokens in case the child said "a lion" or "it is an elephant"
  const candidates = [spoken, ...spoken.split(' ')];
  let bestSim = 0;

  for (const cand of candidates) {
    if (!cand) continue;
    if (cand === target) {
      bestSim = 1;
      break;
    }
    const dist = levenshtein(cand, target);
    const maxLen = Math.max(cand.length, target.length, 1);
    const rawSim = Math.max(0, 1 - dist / maxLen);

    const skA = consonantSkeleton(cand);
    const skB = consonantSkeleton(target);
    const skDist = levenshtein(skA, skB);
    const skSim = skB.length > 0 ? Math.max(0, 1 - skDist / Math.max(skA.length, skB.length)) : rawSim;

    const combined = rawSim * 0.65 + skSim * 0.35;
    if (combined > bestSim) bestSim = combined;
  }

  let stars = 1;
  let feedbackTitle = 'Cố lên bé ơi!';
  let feedbackDetail = 'Hãy nghe lại giọng mẫu thật kỹ và đọc chậm theo từng âm tiết nhé.';

  if (bestSim >= 0.9) {
    stars = 5;
    feedbackTitle = 'Xuất sắc! Phát âm chuẩn bản ngữ!';
    feedbackDetail = 'Âm đầu và âm cuối rất rõ ràng. Bé xứng đáng nhận trọn 5 sao!';
  } else if (bestSim >= 0.74) {
    stars = 4;
    feedbackTitle = 'Rất tốt! Gần hoàn hảo rồi!';
    feedbackDetail = 'Phát âm rõ ràng, bé chỉ cần nhấn rõ hơn một chút ở trọng âm nhé.';
  } else if (bestSim >= 0.54) {
    stars = 3;
    feedbackTitle = 'Khá lắm! Đang tiến bộ rồi!';
    feedbackDetail = 'Nghe lại từ mẫu một lần nữa và chú ý âm cuối (ending sound) nhé.';
  } else if (bestSim >= 0.32) {
    stars = 2;
    feedbackTitle = 'Thử lại lần nữa nào!';
    feedbackDetail = 'Bé hãy nghe âm thanh chậm (0.7x) rồi đọc theo thầy nhé.';
  }

  return {
    transcript,
    targetWord,
    stars,
    similarity: Math.round(bestSim * 100),
    feedbackTitle,
    feedbackDetail,
    source: 'speech-api',
    timestamp: Date.now(),
  };
}
