import { useState, useEffect } from 'react';
import { KeyRound, Sparkles, ExternalLink, Check, AlertCircle, X, ShieldCheck, Bot } from 'lucide-react';
import {
  AI_MODELS,
  getStoredApiKey,
  getStoredModel,
  getStoredOpenAIApiKey,
  saveStoredApiKey,
  saveStoredModel,
  saveStoredOpenAIApiKey,
} from '../utils/geminiService';
import type { AIModelId } from '../types/edtech';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ApiKeyModal({ isOpen, onClose, onSaved }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModelId>('gemini-3-flash-preview');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setOpenaiKey(getStoredOpenAIApiKey());
      setSelectedModel(getStoredModel());
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setErrorMessage('Vui lòng nhập Gemini API key của bạn để kích hoạt các tính năng AI.');
      return;
    }

    saveStoredApiKey(apiKey.trim());
    saveStoredOpenAIApiKey(openaiKey.trim());
    saveStoredModel(selectedModel);
    setShowSuccessToast(true);
    setErrorMessage(null);

    setTimeout(() => {
      setShowSuccessToast(false);
      onSaved?.();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cài Đặt Gemini API Key & Model</h2>
              <p className="text-xs text-sky-100">Kích hoạt trợ lý AI phát âm & tự động soạn bài giảng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
          {/* Instructions Box with red link */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Hướng dẫn lấy Google Gemini API Key miễn phí:</span>
            </div>
            <p className="leading-relaxed">
              1. Truy cập vào cổng Google AI Studio:{' '}
              <a
                href="https://aistudio.google.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-red-600 hover:text-red-700 underline inline-flex items-center gap-0.5"
              >
                https://aistudio.google.com/api-keys <ExternalLink className="w-3 h-3 ml-0.5 inline" />
              </a>
              <br />
              2. Đăng nhập tài khoản Google của bạn và bấm <strong>"Create API key"</strong>.
              <br />
              3. Sao chép đoạn mã API key và dán vào ô bên dưới. Key sẽ được lưu an toàn trong trình duyệt (localStorage) của bạn.
            </p>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Google Gemini API Key:
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none font-mono text-sm"
              />
            </div>
            {errorMessage && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorMessage}
              </p>
            )}
          </div>

          {/* OpenAI API Key Input (for ChatGPT DALL-E 3) */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-emerald-700" />
                OpenAI API Key (Vẽ tranh bằng ChatGPT DALL-E 3) - Tùy chọn:
              </label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-0.5"
              >
                Lấy OpenAI Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder="sk-proj-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-emerald-300 bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none font-mono text-xs text-slate-800"
            />
            <p className="text-[11px] text-emerald-800/80">
              Dùng để kích hoạt tính năng vẽ tranh minh họa trực tiếp bằng ChatGPT DALL-E 3. (Nếu không có key, thầy cô vẫn có thể dùng nút mở ChatGPT trên web để vẽ miễn phí).
            </p>
          </div>

          {/* Model Cards Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Lựa chọn Model AI (Kèm cơ chế tự động chuyển đổi Fallback khi quá tải):
            </label>
            <div className="space-y-2.5">
              {AI_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <label
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="aiModel"
                          value={m.id}
                          checked={isSelected}
                          onChange={() => setSelectedModel(m.id)}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="font-bold text-sm text-slate-900">{m.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.isDefault ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-6">{m.desc}</p>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>API key được lưu trữ cục bộ tại máy của bạn và chỉ gửi trực tiếp đến máy chủ Google Gemini.</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              {showSuccessToast ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã lưu thành công!</span>
                </>
              ) : (
                <span>Lưu Cấu Hình</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
