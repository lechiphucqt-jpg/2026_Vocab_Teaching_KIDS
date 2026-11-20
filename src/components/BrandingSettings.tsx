import { useState, useEffect } from 'react';
import {
  Check,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { BrandSettings, LessonDeck, StorageStats, VocabCard } from '../types/edtech';
import {
  compressImageFileToBase64,
  estimateStringBytes,
  formatBytes,
} from '../utils/mediaUtils';
import { buildPortableExportPackage } from '../db/localDb';
import {
  getSavedDirectoryName,
  pickAndSaveLocalDirectory,
  saveFileToChosenDirectory,
} from '../utils/localStorageDirectory';
import { BrandMark } from './BrandMark';

interface BrandingSettingsProps {
  settings: BrandSettings;
  storageStats: StorageStats;
  decks: LessonDeck[];
  cards: VocabCard[];
  onUpdateSettings: (partial: Partial<BrandSettings>) => void;
  onExportPackage: () => Promise<void>;
  onImportPackage: (file: File) => Promise<void>;
  onResetSampleData: () => Promise<void>;
}

export function BrandingSettings({
  settings,
  storageStats,
  onUpdateSettings,
  onExportPackage,
  onImportPackage,
  onResetSampleData,
}: BrandingSettingsProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [chosenLocalDir, setChosenLocalDir] = useState<string | null>(getSavedDirectoryName());
  const [isSavingLocalDir, setIsSavingLocalDir] = useState(false);

  useEffect(() => {
    setChosenLocalDir(getSavedDirectoryName());
  }, []);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const handlePickDirectory = async () => {
    const res = await pickAndSaveLocalDirectory();
    if (res.success) {
      setChosenLocalDir(res.dirName);
      flashNotice(`Đã kết nối thành công với thư mục máy tính: "${res.dirName}".`);
    } else if (res.error) {
      flashNotice(res.error);
    }
  };

  const handleSaveToChosenDirectory = async () => {
    setIsSavingLocalDir(true);
    try {
      const pkg = await buildPortableExportPackage(decks, cards, settings);
      const jsonContent = JSON.stringify(pkg, null, 2);
      const filename = `tieng-anh-thay-phuc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const res = await saveFileToChosenDirectory(filename, jsonContent);
      flashNotice(res.message);
    } catch (err: unknown) {
      flashNotice(`Lỗi lưu tệp: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingLocalDir(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const base64Logo = await compressImageFileToBase64(file, 320, 1);
      onUpdateSettings({ customLogoDataUrl: base64Logo });
      flashNotice(
        `Đã lưu logo riêng vào IndexedDB (${formatBytes(estimateStringBytes(base64Logo))}) và đồng bộ trên toàn bộ giao diện.`
      );
    } catch {
      flashNotice('Không thể tải logo. Vui lòng chọn tệp PNG, SVG hoặc JPG.');
    }
  };

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      await onExportPackage();
      flashNotice('Đã xuất gói bài giảng cục bộ (.json) kèm toàn bộ hình ảnh & âm thanh Base64.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      await onImportPackage(file);
      flashNotice('Đã nhập gói bài giảng thành công vào bộ nhớ cục bộ IndexedDB.');
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : 'Tệp gói bài giảng không hợp lệ.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200">
        <p className="text-sm text-slate-500">
          Cá nhân hóa Thương hiệu (Dynamic Branding) & Quản trị Dữ liệu Local-First
        </p>
        <h1 className="mt-1 font-display font-bold text-3xl lg:text-4xl tracking-tight text-slate-900">
          Cấu hình Thương hiệu & Lưu trữ Cục bộ
        </h1>
      </div>

      {notice && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Dynamic Branding & Classroom Preferences */}
        <section className="lg:col-span-7 space-y-6">
          {/* Dynamic Logo Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900">
                Logo Thương hiệu Động (Dynamic Branding)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Tải lên logo riêng của trung tâm hoặc lớp học. Logo sẽ được nhúng Base64 trong IndexedDB và tự động ghi đè lên thanh điều hướng, bảng trình chiếu và đấu trường trò chơi bên cạnh nhãn cố định <strong>“Tiếng Anh Thầy Phúc”</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <BrandMark logoDataUrl={settings.customLogoDataUrl} size="lg" />

              <div className="flex-1 space-y-2">
                <div className="font-display font-bold text-lg text-slate-900">
                  {settings.brandTitle}
                </div>
                <div className="text-xs text-slate-500">
                  {settings.customLogoDataUrl
                    ? `Đang dùng logo tùy chỉnh (${formatBytes(estimateStringBytes(settings.customLogoDataUrl))})`
                    : 'Đang dùng biểu tượng chữ lồng mặc định (TP)'}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0284C7] text-white text-xs font-semibold hover:bg-[#0369A1] transition-colors cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    Tải lên Logo riêng
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                      }}
                    />
                  </label>

                  {settings.customLogoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ customLogoDataUrl: null });
                        flashNotice('Đã khôi phục logo mặc định.');
                      }}
                      className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Dùng lại biểu tượng mặc định
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Classroom Preferences */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <h2 className="font-display font-bold text-xl text-slate-900">
              Thiết lập Lớp học & Giọng đọc Mặc định
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nhãn thương hiệu cố định (Luôn hiển thị ở mọi màn hình)
                </label>
                <input
                  type="text"
                  value={settings.brandTitle}
                  disabled
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mô tả lớp học / Khẩu hiệu giảng dạy
                </label>
                <input
                  type="text"
                  value={settings.classroomSubtitle}
                  onChange={(e) => onUpdateSettings({ classroomSubtitle: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tên Đội 1 (Versus Mode)
                </label>
                <input
                  type="text"
                  value={settings.teamAName}
                  onChange={(e) => onUpdateSettings({ teamAName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tên Đội 2 (Versus Mode)
                </label>
                <input
                  type="text"
                  value={settings.teamBName}
                  onChange={(e) => onUpdateSettings({ teamBName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Giọng đọc bản ngữ mặc định
                </label>
                <select
                  value={settings.voiceAccent}
                  onChange={(e) =>
                    onUpdateSettings({ voiceAccent: e.target.value as 'en-US' | 'en-GB' })
                  }
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900"
                >
                  <option value="en-US">Anh – Mỹ (en-US)</option>
                  <option value="en-GB">Anh – Anh (en-GB)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tốc độ phát âm mặc định
                </label>
                <select
                  value={settings.speechRate}
                  onChange={(e) =>
                    onUpdateSettings({ speechRate: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900"
                >
                  <option value={0.7}>Chậm cho bé mới học (0.7x)</option>
                  <option value={0.85}>Tự nhiên rõ ràng (0.85x)</option>
                  <option value={1.0}>Tốc độ bản ngữ (1.0x)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Local-First Storage & Portable Packaging */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">
                  Kiến trúc Local-First (100% Ngoại tuyến)
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Toàn bộ từ vựng, hình ảnh Base64, giọng thu âm giáo viên và logo riêng được lưu cục bộ trong <strong>IndexedDB</strong> của máy tính này — tuyệt đối không tải dữ liệu lên máy chủ đám mây.
                </p>
              </div>
            </div>

            {/* Tabular Storage Metrics */}
            <div className="divide-y divide-slate-100 border-t border-b border-slate-100 text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Số chủ đề bài giảng</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {storageStats.deckCount} chủ đề
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Tổng số thẻ từ vựng</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {storageStats.cardCount} thẻ
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Ảnh nhúng Base64 tùy chỉnh</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {storageStats.embeddedImageCount} ảnh
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Giọng giáo viên thu âm</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {storageStats.customAudioCount} tệp
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-slate-400" />
                  Dung lượng cục bộ ước tính
                </span>
                <span className="font-mono font-semibold text-[#0284C7] tabular-nums">
                  {formatBytes(storageStats.estimatedBytes)}
                </span>
              </div>
            </div>

            {/* Local Computer Directory Picker */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-[#15803d]" />
                  Thư mục lưu trữ trên máy tính:
                </span>
                <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 truncate max-w-[200px]" title={chosenLocalDir || 'Chưa chọn'}>
                  {chosenLocalDir ? `📁 ${chosenLocalDir}` : 'Mặc định (IndexedDB)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePickDirectory}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-[#ecfdf5] hover:bg-[#dcfce7] text-[#15803d] text-xs font-bold transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Chọn thư mục máy tính...
                </button>

                <button
                  type="button"
                  disabled={isSavingLocalDir}
                  onClick={handleSaveToChosenDirectory}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingLocalDir ? 'Đang lưu...' : 'Lưu ngay vào thư mục'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                💡 Dữ liệu bài giảng sẽ được ghi trực tiếp vào ổ đĩa của máy tính (không qua hộp thoại download của trình duyệt).
              </p>
            </div>

            {/* Export / Import Portable JSON */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportClick}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                <Download className="w-4 h-4" />
                {isExporting
                  ? 'Đang mã hóa Base64 & đóng gói...'
                  : 'Xuất gói bài giảng di động (.json Base64)'}
              </button>

              <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer">
                <Database className="w-4 h-4 text-[#0284C7]" />
                Nhập gói bài giảng từ máy khác (.json)
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Safe Reset Control */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <h3 className="font-display font-semibold text-base text-slate-900">
              Khôi phục bộ bài giảng mẫu ban đầu
            </h3>
            <p className="text-xs text-slate-500">
              Đưa dữ liệu IndexedDB về bộ từ vựng mẫu (Unit 1 Động vật & Unit 2 Trái cây – Lớp học). Nên xuất file sao lưu trước khi thực hiện.
            </p>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục dữ liệu mẫu
              </button>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await onResetSampleData();
                    setConfirmReset(false);
                    flashNotice('Đã khôi phục toàn bộ dữ liệu mẫu ban đầu.');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                >
                  Xác nhận khôi phục
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
