import { useState } from 'react';
import {
  Download,
  FileCode,
  FileDown,
  FileSpreadsheet,
  FileText,
  Printer,
  QrCode,
  Share2,
  Sparkles,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { BrandSettings, LessonDeck, VocabCard } from '../types/edtech';
import {
  downloadFile,
  generateMoodleXml,
  generatePowerPointPresentation,
  generatePrintableFlashcardsHtml,
  generateWorksheetHtml,
  openPrintDialog,
} from '../utils/exportMaterials';

interface PrintMaterialsStudioProps {
  decks: LessonDeck[];
  cards: VocabCard[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  settings: BrandSettings;
}

export function PrintMaterialsStudio({
  decks,
  cards,
  selectedDeckId,
  onSelectDeck,
  settings,
}: PrintMaterialsStudioProps) {
  const currentDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
  const deckCards = cards
    .filter((c) => c.deckId === selectedDeckId)
    .sort((a, b) => a.order - b.order);

  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadingPptx, setDownloadingPptx] = useState(false);

  const handleDownloadPptx = () => {
    if (!currentDeck || deckCards.length === 0) return;
    setDownloadingPptx(true);
    try {
      const blob = generatePowerPointPresentation(currentDeck, deckCards, settings);
      const filename = `BaiGiang_${currentDeck.title.replace(/\s+/g, '_')}_ThayPhuc.pptx`;
      downloadFile(blob, filename);
    } finally {
      setDownloadingPptx(false);
    }
  };

  const handleDownloadMoodleXml = () => {
    if (!currentDeck || deckCards.length === 0) return;
    const xml = generateMoodleXml(currentDeck, deckCards);
    const filename = `Moodle_Quiz_${currentDeck.title.replace(/\s+/g, '_')}.xml`;
    downloadFile(xml, filename, 'application/xml');
  };

  const handlePrintWorksheet = () => {
    if (!currentDeck || deckCards.length === 0) return;
    const html = generateWorksheetHtml(currentDeck, deckCards, settings);
    openPrintDialog(html);
  };

  const handlePrintFlashcards = () => {
    if (!currentDeck || deckCards.length === 0) return;
    const html = generatePrintableFlashcardsHtml(currentDeck, deckCards, settings);
    openPrintDialog(html);
  };

  const handleCopyShareLink = () => {
    const url = window.location.origin + window.location.pathname + `?deck=${selectedDeckId}&mode=student`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-500 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hệ thống Học liệu Đa phương tiện</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">
            Xuất Bài Giảng & Phiếu Bài Tập In Ấn
          </h2>
          <p className="mt-1 text-sky-100 text-sm max-w-xl">
            Tự động xuất PowerPoint (.pptx) trình chiếu, phiếu bài tập Word/PDF in sẵn, bộ Flashcard cắt dán và ngân hàng câu hỏi Moodle LMS từ dữ liệu bài học.
          </p>
        </div>

        {/* Deck Selector */}
        <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/20 min-w-[240px]">
          <label className="block text-xs font-medium text-sky-100 mb-1">
            Chọn chủ đề bài học:
          </label>
          <select
            value={selectedDeckId}
            onChange={(e) => onSelectDeck(e.target.value)}
            className="w-full bg-white text-slate-800 rounded-lg px-3 py-2 text-sm font-semibold border-none outline-none focus:ring-2 focus:ring-sky-300"
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.title} ({cards.filter((c) => c.deckId === deck.id).length} từ)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of 4 Key Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: PowerPoint (.pptx) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Slide PowerPoint (.pptx)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Xuất bài thuyết trình 16:9 với {deckCards.length + 1} slide chuẩn màu thương hiệu, chữ to rõ cho học sinh nhìn từ xa.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadPptx}
            disabled={downloadingPptx || deckCards.length === 0}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingPptx ? 'Đang tạo...' : 'Tải Slide PowerPoint (.pptx)'}</span>
          </button>
        </div>

        {/* Card 2: Worksheet (Print/PDF) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center mb-4">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Phiếu Bài Tập (A4 In/PDF)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Tự động tạo 3 phần: Nối từ (Matching), Điền chữ cái khuyết, Viết câu ví dụ và Bảng đáp án chấm bài.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrintWorksheet}
            disabled={deckCards.length === 0}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>In Phiếu Bài Tập (A4)</span>
          </button>
        </div>

        {/* Card 3: Printable Flashcards */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Bộ Thẻ Flashcard In Cắt</h3>
            <p className="text-xs text-slate-500 mt-1">
              Bố cục lưới A4 chuẩn nét cắt (Scissors marks) với hình ảnh, từ vựng, phiên âm và nghĩa tiếng Việt.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrintFlashcards}
            disabled={deckCards.length === 0}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>In Bộ Thẻ Flashcard</span>
          </button>
        </div>

        {/* Card 4: Moodle XML */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <FileCode className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Moodle LMS Question Bank</h3>
            <p className="text-xs text-slate-500 mt-1">
              Xuất tệp Moodle XML chứa câu hỏi Matching & Trắc nghiệm Multiple Choice để nạp trực tiếp vào Moodle.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadMoodleXml}
            disabled={deckCards.length === 0}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Tải Moodle XML (.xml)</span>
          </button>
        </div>
      </div>

      {/* Section 2: Home Study Share & QR Code */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 text-[#0284C7]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Giao Bài & Chia Sẻ Cho Học Sinh Tự Ôn Tại Nhà</h3>
              <p className="text-xs text-slate-500">Gửi đường dẫn bài học hoặc mã QR cho phụ huynh mở trên điện thoại / máy tính bảng</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shrink-0"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedLink ? 'Đã sao chép link bài học!' : 'Sao chép link ôn tập'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* QR visual placeholder */}
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
            <div className="w-32 h-32 bg-white p-2 rounded-lg shadow-xs flex items-center justify-center border border-slate-200 mb-3">
              <QrCode className="w-24 h-24 text-slate-800" />
            </div>
            <span className="text-xs font-bold text-slate-800">Quét mã QR để mở bài học</span>
            <span className="text-[11px] text-slate-500 mt-0.5">{currentDeck?.title}</span>
          </div>

          {/* Instructions */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">Không cần cài đặt phức tạp:</strong> Phụ huynh chỉ cần quét mã QR bằng Zalo, Camera điện thoại hoặc Safari/Chrome là có thể cho bé luyện phát âm và chơi game từ vựng ngay lập tức.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">Dữ liệu an toàn & bảo mật:</strong> Mọi bài học và âm thanh giọng đọc mẫu của Thầy Phúc được tải trực tiếp, không thu thập thông tin cá nhân của học sinh.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-purple-500 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">Báo cáo kết quả trực quan:</strong> Điểm số và số sao khi luyện nói tại nhà được lưu giữ để bé mang đến lớp khoe với thầy cô và các bạn.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
