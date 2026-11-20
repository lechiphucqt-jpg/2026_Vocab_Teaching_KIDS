import { GoogleGenAI } from '@google/genai';
import type { AIModelId } from '../types/edtech';

export const AI_MODELS: { id: AIModelId; name: string; tag: string; desc: string; isDefault?: boolean }[] = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    tag: 'Khuyên dùng · Nhanh nhất',
    desc: 'Tốc độ phản hồi cực nhanh, tối ưu cho phản hồi phát âm và tương tác trực tiếp.',
    isDefault: true,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    tag: 'Tư duy sâu',
    desc: 'Lý luận sư phạm chi tiết, tối ưu cho phân tích âm học và thiết kế bài giảng sâu.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tag: 'Dự phòng ổn định',
    desc: 'Độ trễ thấp, quota dồi dào, model dự phòng an toàn khi các bản preview quá tải.',
  },
];

const LOCAL_STORAGE_KEY_API_KEY = 'gemini_api_key';
const LOCAL_STORAGE_KEY_MODEL = 'gemini_selected_model';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY)?.trim() || '';
}

export function saveStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, key.trim());
}

export function getStoredModel(): AIModelId {
  if (typeof window === 'undefined') return 'gemini-3-flash-preview';
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY_MODEL) as AIModelId | null;
  if (saved && AI_MODELS.some((m) => m.id === saved)) {
    return saved;
  }
  return 'gemini-3-flash-preview';
}

export function saveStoredModel(model: AIModelId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY_MODEL, model);
}

export interface CallGenAiOptions {
  systemInstruction?: string;
  responseMimeType?: string;
  onModelAttempt?: (modelId: AIModelId, attemptIndex: number) => void;
}

/**
 * Execute Gemini API calls with automatic multi-model fallback and strict error reporting
 * as defined in AI_INSTRUCTIONS.md.
 */
export async function callGeminiWithFallback(
  prompt: string,
  options?: CallGenAiOptions
): Promise<{ text: string; modelUsed: AIModelId }> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key. Vui lòng bấm vào "Cài đặt API Key" trên thanh điều hướng để nhập key.');
  }

  const preferredModel = getStoredModel();
  // Build priority order: preferredModel first, then the remaining models in fallback sequence
  const fallbackSequence: AIModelId[] = [
    preferredModel,
    ...AI_MODELS.map((m) => m.id).filter((id) => id !== preferredModel),
  ];

  let lastError: Error | null = null;
  const errorsCollected: string[] = [];

  for (let i = 0; i < fallbackSequence.length; i++) {
    const modelId = fallbackSequence[i];
    options?.onModelAttempt?.(modelId, i);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: options?.systemInstruction,
          responseMimeType: options?.responseMimeType,
          temperature: 0.7,
        },
      });

      const responseText = response.text?.trim() || '';
      if (!responseText) {
        throw new Error(`Model ${modelId} trả về phản hồi rỗng.`);
      }

      return { text: responseText, modelUsed: modelId };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errorsCollected.push(`[${modelId}]: ${errMsg}`);
      lastError = err instanceof Error ? err : new Error(errMsg);
      // Auto-retry with the next model in sequence immediately
    }
  }

  // All models in the fallback sequence failed
  const fullDetail = errorsCollected.join('\n');
  throw new Error(`Đã dừng do lỗi API sau khi thử qua tất cả các model:\n${fullDetail}`);
}

/**
 * AI Pronunciation Coach: Pedagogical analysis of a child's spoken pronunciation
 */
export async function evaluatePronunciationWithAI(
  targetWord: string,
  phonetic: string,
  spokenText: string
): Promise<{
  endingSoundOk: boolean;
  vowelOk: boolean;
  stressOk: boolean;
  encouragingMessageVi: string;
  suggestedDrill: string;
  stars: number;
}> {
  const prompt = `Bạn là Trợ lý Giáo viên Tiếng Anh Trẻ Em (6-9 tuổi).
Học sinh đang luyện đọc từ vựng:
- Từ mục tiêu: "${targetWord}"
- Phiên âm chuẩn IPA: "${phonetic}"
- Trẻ đã đọc thành (nhận diện qua micro): "${spokenText}"

Hãy phân tích âm học và trả về JSON theo đúng định dạng sau (không thêm markdown hay chữ gì khác ngoài JSON):
{
  "endingSoundOk": true hoặc false (âm đuôi / ending sound có đọc rõ không),
  "vowelOk": true hoặc false (nguyên âm chính có đúng không),
  "stressOk": true hoặc false (trọng âm có đúng không),
  "stars": số nguyên từ 1 đến 5 (độ chuẩn xác),
  "encouragingMessageVi": "Lời nhận xét và hướng dẫn cực kỳ dễ thương, khích lệ bé bằng tiếng Việt (tối đa 2 câu, ví dụ: 'Bé đọc to lắm, chú ý bật hơi nhẹ đuôi /k/ ở cuối từ nhé!')",
  "suggestedDrill": "Một bài tập ngắn vui vẻ để bé tập lại (ví dụ: 'Hãy làm tiếng thì thầm: k... k... k... rồi đọc book!')"
}`;

  const { text } = await callGeminiWithFallback(prompt, {
    responseMimeType: 'application/json',
    systemInstruction: 'Bạn là chuyên gia ngữ âm và sư phạm tiếng Anh mầm non và tiểu học. Luôn trả về JSON hợp lệ.',
  });

  try {
    return JSON.parse(text);
  } catch {
    return {
      endingSoundOk: true,
      vowelOk: true,
      stressOk: true,
      stars: 4,
      encouragingMessageVi: 'Bé phát âm rất đáng yêu! Cố gắng nghe lại từ mẫu và đọc to hơn một chút nhé.',
      suggestedDrill: `Đọc to từ ${targetWord} cùng thầy nào!`,
    };
  }
}

/**
 * AI Deck Generator: Generates a complete 6-8 vocabulary deck from a topic
 */
export interface GeneratedWordItem {
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  syllables?: string;
  svgIcon: string;
}

export async function generateDeckWithAI(
  topic: string,
  count = 6
): Promise<GeneratedWordItem[]> {
  const prompt = `Hãy đóng vai là chuyên gia biên soạn giáo trình tiếng Anh Cambridge Starters cho trẻ 6-9 tuổi.
Hãy tạo danh sách ${count} từ vựng tiếng Anh theo chủ đề: "${topic}".
Mỗi từ phải đi kèm:
- word: từ vựng tiếng Anh đơn giản, chuẩn cho trẻ em (viết thường hoặc chữ cái đầu hoa)
- phonetic: phiên âm quốc tế IPA chính xác (ví dụ: /æp.l̩/)
- meaning: nghĩa tiếng Việt ngắn gọn, dễ hiểu cho trẻ
- example: một câu ví dụ tiếng Anh cực kỳ đơn giản (dưới 7 từ, ví dụ: "I like red apples.")
- syllables: cách tách âm tiết vui nhộn (ví dụ: "ap-ple")
- svgIcon: mã SVG nội tuyến sạch sẽ, kích thước viewBox="0 0 100 100", dùng các hình tròn, chữ nhật, đường cong minh họa đồ vật/con vật vui mắt, màu sắc rực rỡ (dùng fill hex bắt mắt).

Trả về định dạng JSON Array chứa các object trên.`;

  const { text } = await callGeminiWithFallback(prompt, {
    responseMimeType: 'application/json',
    systemInstruction: 'Bạn là chuyên gia biên soạn giáo án Tiếng Anh Cambridge Young Learners. Trả về JSON hợp lệ không markdown.',
  });

  try {
    const list = JSON.parse(text);
    if (Array.isArray(list)) {
      return list.map((item) => ({
        word: String(item.word || '').trim(),
        phonetic: String(item.phonetic || '').trim(),
        meaning: String(item.meaning || '').trim(),
        example: String(item.example || '').trim(),
        syllables: item.syllables ? String(item.syllables).trim() : undefined,
        svgIcon: String(item.svgIcon || ''),
      }));
    }
  } catch {
    // handled below
  }
  throw new Error('Dữ liệu từ vựng AI trả về không đúng cấu trúc danh sách.');
}

/**
 * AI Buddy: Friendly interactive conversational agent for kids
 */
export async function chatWithAIBuddy(
  targetWord: string,
  meaning: string,
  userMessage: string
): Promise<string> {
  const prompt = `Bạn là "Buddy" - chú gấu bông thông minh trợ giảng tiếng Anh cho trẻ em lớp 1-3.
Từ vựng chính của bài học này: "${targetWord}" (nghĩa: "${meaning}").
Bé vừa nói với bạn: "${userMessage}".

Hãy phản hồi lại bé:
- Sử dụng tiếng Anh cực kỳ đơn giản (1-2 câu ngắn).
- Kèm theo bản dịch tiếng Việt thân mật trong ngoặc đơn bên dưới.
- Khích lệ bé dùng từ "${targetWord}".
- Thể hiện sự hào hứng, thân thiện và nhiều năng lượng.`;

  const { text } = await callGeminiWithFallback(prompt, {
    systemInstruction: 'Bạn là chú gấu Buddy thân thiện, vui tính, nói ngắn gọn, dễ thương cho trẻ em.',
  });

  return text;
}
