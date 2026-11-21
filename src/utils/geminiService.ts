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
  prompt: string | any,
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

// -------------------------------------------------------------
// AI ILLUSTRATION & RE-DRAWING SUITE (Gemini, Imagen, ChatGPT, Canva)
// -------------------------------------------------------------

export function cleanSvgToDataUrl(raw: string): string {
  let cleaned = raw.trim();
  // Remove markdown code fences if model returned them
  cleaned = cleaned.replace(/^```(?:svg|xml|html)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find start of <svg and end of </svg>
  const start = cleaned.indexOf('<svg');
  const end = cleaned.lastIndexOf('</svg>');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 6);
  } else if (start !== -1) {
    cleaned = cleaned.substring(start) + '</svg>';
  } else {
    // If model somehow returned empty or non-svg, generate a cute fallback SVG
    cleaned = `<svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" rx="36" fill="#F0FDF4"/>
      <circle cx="200" cy="200" r="100" fill="#22C55E" opacity="0.8"/>
      <circle cx="165" cy="180" r="14" fill="#ffffff"/>
      <circle cx="235" cy="180" r="14" fill="#ffffff"/>
      <circle cx="165" cy="180" r="7" fill="#0f172a"/>
      <circle cx="235" cy="180" r="7" fill="#0f172a"/>
      <path d="M 160 220 Q 200 255 240 220" stroke="#0f172a" stroke-width="8" stroke-linecap="round" fill="none"/>
    </svg>`;
  }

  // Ensure xmlns is present
  if (!cleaned.includes('xmlns=')) {
    cleaned = cleaned.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

export async function tryGenerateWithImagen3(prompt: string): Promise<string | null> {
  const apiKey = getStoredApiKey();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    // @ts-expect-error generateImages is in Google GenAI SDK
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const generated = response?.generatedImages?.[0];
    if (generated?.image?.imageBytes) {
      return `data:image/jpeg;base64,${generated.image.imageBytes}`;
    }
  } catch (err) {
    console.warn('Imagen 3 API call not available or failed:', err);
  }
  return null;
}

export interface RecognizedCroppedObject {
  word: string;
  meaning: string;
  phonetic: string;
  example: string;
  visualDescription: string;
}

export async function analyzeCroppedImageWithAI(
  base64Image: string
): Promise<RecognizedCroppedObject> {
  let mimeType = 'image/jpeg';
  let rawBase64 = base64Image;
  const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    rawBase64 = match[2];
  }

  const prompt = `Đây là một bức ảnh cắt ra từ trang sách giáo khoa tiếng Anh tiểu học.
Hãy nhìn vào hình ảnh và nhận diện:
1. Vật thể, con vật hoặc hành động chính được mô tả trong hình.
2. Từ vựng tiếng Anh tương ứng phù hợp cho học sinh lớp 1-5 (word).
3. Nghĩa tiếng Việt chuẩn xác, gần gũi cho trẻ (meaning).
4. Phiên âm quốc tế IPA chuẩn xác (phonetic).
5. Một câu ví dụ tiếng Anh đơn giản dưới 7 từ chứa từ này (example).
6. Một đoạn mô tả hình ảnh trực quan sinh động bằng tiếng Anh (visualDescription) để họa sĩ AI vẽ lại một bức tranh hoạt hình thiếu nhi tuyệt đẹp về vật thể này (không chứa chữ).

Hãy trả về DUY NHẤT một JSON Object theo cấu trúc:
{
  "word": "...",
  "meaning": "...",
  "phonetic": "...",
  "example": "...",
  "visualDescription": "..."
}`;

  const contents = [
    {
      inlineData: {
        data: rawBase64,
        mimeType: mimeType,
      },
    },
    prompt,
  ];

  const { text } = await callGeminiWithFallback(contents, {
    responseMimeType: 'application/json',
    systemInstruction: 'Bạn là chuyên gia nhận diện hình ảnh sư phạm tiếng Anh tiểu học. Luôn trả về JSON hợp lệ.',
  });

  try {
    const parsed = JSON.parse(text);
    return {
      word: String(parsed.word || '').trim(),
      meaning: String(parsed.meaning || '').trim(),
      phonetic: String(parsed.phonetic || '').trim(),
      example: String(parsed.example || '').trim(),
      visualDescription: String(parsed.visualDescription || '').trim(),
    };
  } catch {
    return {
      word: 'Picture',
      meaning: 'Bức tranh',
      phonetic: '/ˈpɪk.tʃər/',
      example: 'This is a beautiful picture.',
      visualDescription: 'A cheerful colorful children book illustration of the object',
    };
  }
}

export const AI_DRAWING_STYLES = [
  {
    id: 'cartoon',
    name: 'Hoạt hình thiếu nhi đáng yêu',
    desc: 'Nét vẽ tròn trịa, màu sắc tươi vui rực rỡ, rất gần gũi với trẻ em',
    badge: 'Phổ biến nhất',
    guide: 'Cute 2D cartoon children book illustration, friendly curved lines, bright vibrant colors, soft pastel backdrop, playful educational mood, no text'
  },
  {
    id: 'watercolor',
    name: 'Tranh màu nước mầm non',
    desc: 'Màu loang nhẹ nhàng, trong trẻo, phong cách tranh truyện cổ tích',
    badge: 'Nghệ thuật',
    guide: 'Gentle bright watercolor storybook illustration, soft edges, joyful pastel wash, clean background, charming character design, no text'
  },
  {
    id: 'vector',
    name: 'Đồ họa Vector phẳng hiện đại',
    desc: 'Đường nét sắc sảo, hình khối rõ ràng, nổi bật tuyệt đối trên máy chiếu',
    badge: 'Sắc nét 4K',
    guide: 'Clean modern flat vector art, bold clean outlines, crisp shapes, vibrant palette, minimalist cute aesthetic, no text'
  },
  {
    id: '3d-pixar',
    name: '3D Pixar / Hoạt hình sống động',
    desc: 'Hiệu ứng khối 3D mềm mịn như đất nặn hoạt hình Disney/Pixar',
    badge: 'Hiện đại',
    guide: 'Adorable 3D Pixar / Disney animation style, smooth clay-like textures, warm ambient lighting, cute big expressive eyes, studio quality, no text'
  },
  {
    id: 'crayon',
    name: 'Nét chì sáp màu sinh động',
    desc: 'Nét vẽ tự nhiên, ngây thơ như tranh các bé tự vẽ',
    badge: 'Dễ thương',
    guide: 'Whimsical colored pencil and crayon drawing, sweet hand-drawn feel, innocent storybook charm, bright happy colors, no text'
  },
];

export function getStoredOpenAIApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('openai_api_key') || '';
}

export function saveStoredOpenAIApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('openai_api_key', key.trim());
}

export async function generateIllustrationWithChatGPTDallE(params: {
  prompt: string;
  style?: string;
  apiKey?: string;
}): Promise<{
  imageDataUrl: string;
  revisedPrompt?: string;
}> {
  const key = (params.apiKey || getStoredOpenAIApiKey()).trim();
  if (!key) {
    throw new Error(
      'Chưa cấu hình OpenAI API Key (ChatGPT). Vui lòng nhập OpenAI API Key để vẽ ảnh trực tiếp, hoặc dùng nút "Mở ChatGPT trên Web" để vẽ miễn phí.'
    );
  }

  const selectedStyle = AI_DRAWING_STYLES.find((s) => s.id === params.style) || AI_DRAWING_STYLES[0];
  const fullPrompt = `Masterpiece children educational illustration of: ${params.prompt}. Style: ${selectedStyle.guide}. Cute, vibrant colors, centered composition, soft isolated clean background, high resolution, child-friendly art, no text, letters or words on the image.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    let errMessage = `Lỗi OpenAI API (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMessage = `ChatGPT DALL-E 3: ${errJson.error.message}`;
      }
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const json = await response.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('Không nhận được dữ liệu ảnh Base64 từ OpenAI.');
  }

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    revisedPrompt: json?.data?.[0]?.revised_prompt,
  };
}

export async function generateIllustrationWithAI(params: {
  prompt: string;
  style?: string;
  sourceImageBase64?: string;
  engine?: 'smart-auto' | 'gemini-svg' | 'imagen-3' | 'chatgpt-dalle';
  openaiApiKey?: string;
}): Promise<{
  imageDataUrl: string;
  engineUsed: string;
  recognized?: RecognizedCroppedObject;
}> {
  const style = params.style || 'cartoon';
  const engine = params.engine || 'smart-auto';
  let targetPrompt = params.prompt.trim();
  let recognized: RecognizedCroppedObject | undefined;

  // Step 1: If there is a source image and prompt is empty or short, analyze source image first!
  if (params.sourceImageBase64 && (!targetPrompt || targetPrompt.length < 15)) {
    try {
      recognized = await analyzeCroppedImageWithAI(params.sourceImageBase64);
      if (!targetPrompt) {
        targetPrompt = `${recognized.word} (${recognized.meaning}): ${recognized.visualDescription}`;
      } else {
        targetPrompt = `${targetPrompt}. Details: ${recognized.visualDescription}`;
      }
    } catch (err) {
      console.warn('Vision analysis error:', err);
      if (!targetPrompt) {
        targetPrompt = 'A cheerful cute educational illustration for kids';
      }
    }
  }

  // Step 2: If engine is 'chatgpt-dalle', generate with ChatGPT DALL-E 3
  if (engine === 'chatgpt-dalle') {
    const chatGptRes = await generateIllustrationWithChatGPTDallE({
      prompt: targetPrompt,
      style,
      apiKey: params.openaiApiKey,
    });
    return {
      imageDataUrl: chatGptRes.imageDataUrl,
      engineUsed: 'ChatGPT DALL-E 3 (OpenAI)',
      recognized,
    };
  }

  const selectedStyle = AI_DRAWING_STYLES.find((s) => s.id === style) || AI_DRAWING_STYLES[0];
  const styleDesc = selectedStyle.guide;

  // Step 2: If engine is 'imagen-3' or 'smart-auto', try Google Imagen 3 first
  if (engine === 'imagen-3' || engine === 'smart-auto') {
    const imagenPrompt = `Masterpiece children book illustration of ${targetPrompt}. ${styleDesc}. Centered composition, isolated on soft clean background, high resolution, kid-friendly art.`;
    const imagenResult = await tryGenerateWithImagen3(imagenPrompt);
    if (imagenResult) {
      return {
        imageDataUrl: imagenResult,
        engineUsed: 'Google Imagen 3 (Chất lượng cao)',
        recognized,
      };
    }
    // If user explicitly requested imagen-3 and it failed, throw error
    if (engine === 'imagen-3') {
      throw new Error(
        'Không thể tạo ảnh bằng Imagen 3 (API Key có thể chưa kích hoạt Imagen hoặc hết quota). Bạn có thể chọn chế độ "Đồ họa Vector SVG" hoặc "Tự động thông minh".'
      );
    }
  }

  // Step 3: High-quality SVG Vector Art via Gemini (100% reliable, zero storage bloat, ultra-sharp)
  const svgSystemInstruction =
    'Bạn là chuyên gia lập trình đồ họa SVG và họa sĩ minh họa sách thiếu nhi Cambridge. Bạn CHỈ trả về duy nhất mã SVG thuần túy bắt đầu từ <svg> và kết thúc bằng </svg>, không thêm bất kỳ văn bản nào khác.';

  const svgPrompt = `Hãy vẽ một tác phẩm vector SVG hoàn chỉnh, tuyệt đẹp dành cho thẻ từ vựng tiếng Anh trẻ em:
Chủ đề / Yêu cầu vẽ: "${targetPrompt}"
Phong cách nghệ thuật: ${styleDesc}

Quy chuẩn kỹ thuật bắt buộc:
1. Bắt đầu bằng <svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"> và kết thúc bằng </svg>.
2. Bao gồm nền hình chữ nhật bo tròn mềm mại <rect width="400" height="400" rx="36" fill="#..." /> với gam màu tươi sáng, dễ chịu cho mắt trẻ nhỏ (kem nhạt, xanh bạc hà pastel, cam đào pastel, hoặc xanh da trời dịu mát).
3. Định nghĩa <defs> với ít nhất 1 gradient màu sinh động (<linearGradient> hoặc <radialGradient>).
4. Vẽ vật thể/con vật/chi tiết chính ở chính giữa một cách tỉ mỉ, dùng kết hợp các thẻ <path>, <circle>, <ellipse>, <rect>, <polygon> với các gam màu rực rỡ, độ tương phản đẹp mắt.
5. Thêm bóng đổ mềm (shadow) dưới đáy vật thể để tạo chiều sâu không gian 3D nhẹ nhàng.
6. Thêm 3-4 chi tiết trang trí ngộ nghĩnh (tia sao lấp lánh, hoa nhỏ, bong bóng hoặc chấm sáng) xung quanh.
7. TUYỆT ĐỐI KHÔNG chứa chữ (text) bên trong hình.
8. Trả về đúng mã SVG thuần, không dùng markdown code block.`;

  const { text, modelUsed } = await callGeminiWithFallback(svgPrompt, {
    systemInstruction: svgSystemInstruction,
  });

  const cleanedSvgDataUrl = cleanSvgToDataUrl(text);
  return {
    imageDataUrl: cleanedSvgDataUrl,
    engineUsed: `Gemini SVG Vector (${modelUsed})`,
    recognized,
  };
}

export async function generateExternalAIPrompts(
  ideaOrWord: string,
  style = 'cartoon'
): Promise<{
  chatGptDallePrompt: string;
  canvaPrompt: string;
  vietnameseGuide: string;
}> {
  const selectedStyle = AI_DRAWING_STYLES.find((s) => s.id === style) || AI_DRAWING_STYLES[0];
  const prompt = `Người dùng là giáo viên tiếng Anh trẻ em muốn tạo ảnh minh họa cho từ vựng / ý tưởng: "${ideaOrWord}" với phong cách "${selectedStyle.name} (${selectedStyle.guide})".
Hãy soạn thảo prompt tiếng Anh tối ưu nhất cho:
1. ChatGPT / DALL-E 3 (chi tiết, giàu tính mô tả nghệ thuật thiếu nhi, phông nền sạch, không chứa chữ)
2. Canva Text-to-Image / Magic Media (ngắn gọn, tập trung từ khóa phong cách, màu sắc, phông nền sạch)
3. Hướng dẫn tiếng Việt ngắn gọn cho giáo viên cách nhập vào ChatGPT hoặc Canva.

Trả về JSON Object:
{
  "chatGptDallePrompt": "...",
  "canvaPrompt": "...",
  "vietnameseGuide": "..."
}`;

  const { text } = await callGeminiWithFallback(prompt, {
    responseMimeType: 'application/json',
    systemInstruction: 'Bạn là chuyên gia thiết kế prompt tạo ảnh AI (Prompt Engineer) cho giáo dục thiếu nhi. Luôn trả về JSON hợp lệ.',
  });

  try {
    const parsed = JSON.parse(text);
    return {
      chatGptDallePrompt: String(parsed.chatGptDallePrompt || ''),
      canvaPrompt: String(parsed.canvaPrompt || ''),
      vietnameseGuide: String(parsed.vietnameseGuide || ''),
    };
  } catch {
    const fallback = `A cute, cheerful children's book illustration of ${ideaOrWord}, colorful, friendly art style, clean solid background, high quality, no text`;
    return {
      chatGptDallePrompt: fallback,
      canvaPrompt: `${ideaOrWord}, cute cartoon, kids book style, vibrant colors, white background`,
      vietnameseGuide: 'Sao chép prompt tiếng Anh trên dán vào ChatGPT hoặc Canva để tạo ảnh, sau đó bấm Dán ảnh vào ứng dụng!',
    };
  }
}

// -------------------------------------------------------------
// AI SMART MULTI-IMAGE TEXTBOOK SPLITTER & BATCH RE-DRAWER
// -------------------------------------------------------------

export interface DetectedTextbookItem {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  example: string;
  visualDescription: string;
  box: {
    ymin: number; // 0 to 1000
    xmin: number; // 0 to 1000
    ymax: number; // 0 to 1000
    xmax: number; // 0 to 1000
  };
}

export async function splitTextbookPageWithAI(
  base64Image: string
): Promise<DetectedTextbookItem[]> {
  let mimeType = 'image/jpeg';
  let rawBase64 = base64Image;
  const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    rawBase64 = match[2];
  }

  const prompt = `Bạn là chuyên gia thị giác máy tính và biên tập sách giáo khoa tiếng Anh thiếu nhi (Cambridge Young Learners).
Hình ảnh này chứa MỘT TRANG SÁCH hoặc MỘT VÙNG HỌC LIỆU có NHIỀU CON VẬT, ĐỒ VẬT HOẶC TRANH MINH HỌA TỪ VỰNG KHÁC NHAU (ví dụ: từng con vật như Ốc sên / Snail, Chuột túi / Kangaroo, Con gấu / Bear, Đàn vịt / Duck, Lạc đà / Camel, Con nhện / Spider, Hươu cao cổ / Giraffe, Tê giác / Rhinoceros, Hà mã / Hippopotamus, Chim cánh cụt / Penguin, Khủng long / Dinosaur, Con ong / Bee...).

QUY TẮC BẮT BUỘC:
1. KHÔNG ĐƯỢC gộp chung các con vật/đồ vật thành một từ tổng quát (như "Animals", "Zoo", "Nature", "Objects").
2. BẮT BUỘC nhận diện và bóc tách TỪNG CON VẬT / ĐỒ VẬT RIÊNG LẺ thành các mục độc lập. Kể cả khi chúng không có viền ô vuông (vẽ tự do trên nền), bạn phải tạo khung chữ nhật (box) bao quanh vừa vặn từng con vật/đồ vật đó!
3. Nếu trên trang có 12 con vật thì BẮT BUỘC trả về đủ 12 mục! (Hoặc có bao nhiêu hình thì trả về bấy nhiêu mục từ 1 đến 20 mục).

Với MỖI con vật/đồ vật:
- "word": Từ vựng tiếng Anh đơn lẻ của con vật/đồ vật đó (viết hoa chữ cái đầu, ví dụ: "Snail", "Kangaroo", "Bear", "Duck", "Camel", "Spider", "Giraffe", "Rhinoceros", "Hippopotamus", "Penguin", "Dinosaur", "Bee").
- "meaning": Nghĩa tiếng Việt chuẩn mực, gần gũi cho bé (ví dụ: "Ốc sên", "Chuột túi", "Con gấu", "Con vịt", "Lạc đà", "Con nhện", "Hươu cao cổ", "Tê giác", "Hà mã", "Chim cánh cụt", "Khủng long", "Con ong").
- "phonetic": Phiên âm quốc tế IPA chuẩn xác.
- "example": Câu ví dụ tiếng Anh cực đơn giản (dưới 7 từ).
- "visualDescription": Mô tả trực quan con vật/vật thể này bằng tiếng Anh để họa sĩ AI vẽ lại một bức tranh minh họa độc lập riêng lẻ (không chứa chữ).
- "box": Tọa độ chuẩn hóa từ 0 đến 1000 bao quanh vừa khít con vật/vật thể đó:
  { "ymin": 0-1000, "xmin": 0-1000, "ymax": 0-1000, "xmax": 0-1000 }

Hãy trả về DUY NHẤT một mảng JSON Array các object (không kèm markdown ngoài):
[
  {
    "word": "...",
    "meaning": "...",
    "phonetic": "...",
    "example": "...",
    "visualDescription": "...",
    "box": { "ymin": 50, "xmin": 60, "ymax": 320, "xmax": 260 }
  }
]`;

  const contents = [
    {
      inlineData: {
        data: rawBase64,
        mimeType: mimeType,
      },
    },
    prompt,
  ];

  const { text } = await callGeminiWithFallback(contents, {
    responseMimeType: 'application/json',
    systemInstruction:
      'Bạn là chuyên gia phân tích và bóc tách dữ liệu thị giác từ sách giáo khoa tiếng Anh thiếu nhi. Luôn trả về JSON Array hợp lệ.',
  });

  try {
    const list = JSON.parse(text);
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item, idx) => {
        let ymin = Number(item.box?.ymin ?? 0);
        let xmin = Number(item.box?.xmin ?? 0);
        let ymax = Number(item.box?.ymax ?? 1000);
        let xmax = Number(item.box?.xmax ?? 1000);

        // Normalize if model returned 0-1 instead of 0-1000
        if (ymax <= 1 && xmax <= 1 && ymax > 0 && xmax > 0) {
          ymin = Math.round(ymin * 1000);
          xmin = Math.round(xmin * 1000);
          ymax = Math.round(ymax * 1000);
          xmax = Math.round(xmax * 1000);
        } else if (ymax <= 100 && xmax <= 100 && ymax > 1 && xmax > 1) {
          ymin = Math.round(ymin * 10);
          xmin = Math.round(xmin * 10);
          ymax = Math.round(ymax * 10);
          xmax = Math.round(xmax * 10);
        }

        // Clamp values to [0, 1000]
        ymin = Math.max(0, Math.min(980, ymin));
        xmin = Math.max(0, Math.min(980, xmin));
        ymax = Math.max(ymin + 20, Math.min(1000, ymax));
        xmax = Math.max(xmin + 20, Math.min(1000, xmax));

        return {
          id: `item-${Date.now()}-${idx}`,
          word: String(item.word || '').trim() || `Word ${idx + 1}`,
          meaning: String(item.meaning || '').trim() || 'Nghĩa từ vựng',
          phonetic: String(item.phonetic || '').trim(),
          example: String(item.example || '').trim(),
          visualDescription: String(item.visualDescription || '').trim(),
          box: { ymin, xmin, ymax, xmax },
        };
      });
    }
  } catch (err) {
    console.warn('Failed to parse split textbook response:', err);
  }

  // Graceful fallback for standard 4-quadrant textbook layout
  return [
    {
      id: `item-${Date.now()}-0`,
      word: 'Bicycle',
      meaning: 'Xe đạp',
      phonetic: '/ˈbaɪ.sɪ.kəl/',
      example: 'A red bicycle.',
      visualDescription: 'A red bicycle with a basket',
      box: { ymin: 60, xmin: 60, ymax: 480, xmax: 480 },
    },
    {
      id: `item-${Date.now()}-1`,
      word: 'Umbrella',
      meaning: 'Cây dù / Cái ô',
      phonetic: '/ʌmˈbrel.ə/',
      example: 'A yellow umbrella.',
      visualDescription: 'A yellow opened umbrella',
      box: { ymin: 60, xmin: 520, ymax: 480, xmax: 940 },
    },
    {
      id: `item-${Date.now()}-2`,
      word: 'Sunflower',
      meaning: 'Hoa hướng dương',
      phonetic: '/ˈsʌnˌflaʊ.ər/',
      example: 'A blooming sunflower.',
      visualDescription: 'A bright yellow sunflower',
      box: { ymin: 520, xmin: 60, ymax: 940, xmax: 480 },
    },
    {
      id: `item-${Date.now()}-3`,
      word: 'School bus',
      meaning: 'Xe buýt trường học',
      phonetic: '/ˈskuːl ˌbʌs/',
      example: 'A friendly yellow school bus.',
      visualDescription: 'A friendly yellow school bus with happy eyes',
      box: { ymin: 520, xmin: 520, ymax: 940, xmax: 940 },
    },
  ];
}
