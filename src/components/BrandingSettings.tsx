import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileCheck,
  FolderOpen,
  FolderSync,
  HardDrive,
  History,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import type { BrandSettings, LessonDeck, StorageStats, VocabCard } from '../types/edtech';
import {
  compressImageFileToBase64,
  estimateStringBytes,
  formatBytes,
} from '../utils/mediaUtils';
import { buildPortableExportPackage } from '../db/localDb';
import {
  ACTIVE_DB_FILENAME,
  createBackupSnapshotInDirectory,
  ensureDirectoryHandleAndPermission,
  getSavedDirectoryName,
  isAutoSyncEnabled,
  loadActiveDatabaseFromDirectory,
  pickAndSaveLocalDirectory,
  saveActiveDatabaseToDirectory,
  setAutoSyncEnabled,
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
  localDirName?: string | null;
  onLocalDirChange?: (dirName: string) => void;
  onShowToast?: (msg: string) => void;
  onReloadActiveDatabase?: (jsonContent: string) => Promise<void>;
}

export function BrandingSettings({
  settings,
  storageStats,
  decks,
  cards,
  onUpdateSettings,
  onExportPackage,
  onImportPackage,
  onResetSampleData,
  localDirName,
  onLocalDirChange,
  onShowToast,
  onReloadActiveDatabase,
}: BrandingSettingsProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [chosenLocalDir, setChosenLocalDir] = useState<string | null>(localDirName || getSavedDirectoryName());

  // Active Database Actions State
  const [isSavingActiveDb, setIsSavingActiveDb] = useState(false);
  const [isLoadingActiveDb, setIsLoadingActiveDb] = useState(false);
  const [justSavedActiveDb, setJustSavedActiveDb] = useState(false);
  const [justLoadedActiveDb, setJustLoadedActiveDb] = useState(false);
  const [activeDbNotice, setActiveDbNotice] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Backup Snapshot Actions State
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [justCreatedBackup, setJustCreatedBackup] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Auto-sync Toggle State
  const [autoSyncOn, setAutoSyncOn] = useState(isAutoSyncEnabled());

  useEffect(() => {
    setChosenLocalDir(localDirName || getSavedDirectoryName());
  }, [localDirName]);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const handlePickDirectory = async () => {
    setActiveDbNotice(null);
    const res = await pickAndSaveLocalDirectory();
    if (res.success) {
      setChosenLocalDir(res.dirName);
      if (onLocalDirChange) onLocalDirChange(res.dirName);
      const msg = `Đã kết nối thành công với thư mục máy tính: "${res.dirName}".`;
      setActiveDbNotice({ text: msg, type: 'success' });
      flashNotice(msg);
      if (onShowToast) onShowToast(msg);
    } else if (res.error) {
      setActiveDbNotice({ text: res.error, type: 'error' });
      flashNotice(res.error);
      if (onShowToast) onShowToast(res.error);
    }
  };

  /**
   * 1. ACTIVE STORAGE: Save/Update current live database directly to PC folder (vocab-kids-database.json)
   */
  const handleSaveActiveDatabase = async () => {
    setIsSavingActiveDb(true);
    setActiveDbNotice(null);
    try {
      const dirCheck = await ensureDirectoryHandleAndPermission(true);
      if (dirCheck.dirName) {
        setChosenLocalDir(dirCheck.dirName);
        if (onLocalDirChange) onLocalDirChange(dirCheck.dirName);
      }

      const pkg = await buildPortableExportPackage(decks, cards, settings);
      const jsonContent = JSON.stringify(pkg, null, 2);
      const res = await saveActiveDatabaseToDirectory(jsonContent, dirCheck.handle);

      if (res.success) {
        setJustSavedActiveDb(true);
        setTimeout(() => setJustSavedActiveDb(false), 3000);
        setActiveDbNotice({
          text: `Đã lưu và cập nhật toàn bộ dữ liệu hoạt động vào tệp "${ACTIVE_DB_FILENAME}" trong thư mục "${res.dirName || 'máy tính'}"!`,
          type: 'success',
        });
      } else {
        setActiveDbNotice({
          text: res.message,
          type: 'error',
        });
      }

      flashNotice(res.message);
      if (onShowToast) onShowToast(res.message);
    } catch (err: unknown) {
      const msg = `Lỗi cập nhật dữ liệu: ${err instanceof Error ? err.message : String(err)}`;
      setActiveDbNotice({ text: msg, type: 'error' });
      flashNotice(msg);
      if (onShowToast) onShowToast(msg);
    } finally {
      setIsSavingActiveDb(false);
    }
  };

  /**
   * 2. ACTIVE STORAGE: Load live database from PC folder into App to run the program
   */
  const handleLoadActiveDatabase = async () => {
    setIsLoadingActiveDb(true);
    setActiveDbNotice(null);
    try {
      const dirCheck = await ensureDirectoryHandleAndPermission(true);
      if (dirCheck.dirName) {
        setChosenLocalDir(dirCheck.dirName);
        if (onLocalDirChange) onLocalDirChange(dirCheck.dirName);
      }

      const res = await loadActiveDatabaseFromDirectory(dirCheck.handle);
      if (!res.success || !res.content) {
        setActiveDbNotice({
          text: `Chưa tìm thấy tệp "${ACTIVE_DB_FILENAME}" trong thư mục "${res.dirName}". Thầy cô vui lòng bấm "Lưu / Cập nhật vào thư mục" trước để tạo tệp dữ liệu này!`,
          type: 'info',
        });
        if (onShowToast) onShowToast(`Chưa có tệp ${ACTIVE_DB_FILENAME} trong thư mục.`);
        return;
      }

      if (onReloadActiveDatabase) {
        await onReloadActiveDatabase(res.content);
        setJustLoadedActiveDb(true);
        setTimeout(() => setJustLoadedActiveDb(false), 3000);
        setActiveDbNotice({
          text: `Đã nạp và đồng bộ thành công dữ liệu từ tệp "${ACTIVE_DB_FILENAME}" trong thư mục máy tính vào App để chạy!`,
          type: 'success',
        });
      }
    } catch (err: unknown) {
      const msg = `Lỗi nạp dữ liệu: ${err instanceof Error ? err.message : String(err)}`;
      setActiveDbNotice({ text: msg, type: 'error' });
      flashNotice(msg);
      if (onShowToast) onShowToast(msg);
    } finally {
      setIsLoadingActiveDb(false);
    }
  };

  /**
   * 3. BACKUP & RESTORE: Create a timestamped backup snapshot (Backup_VocabKIDS_YYYY-MM-DD_HH-mm.json)
   */
  const handleCreateBackupSnapshot = async () => {
    setIsCreatingBackup(true);
    setBackupNotice(null);
    try {
      const dirCheck = await ensureDirectoryHandleAndPermission(true);
      if (dirCheck.dirName) {
        setChosenLocalDir(dirCheck.dirName);
        if (onLocalDirChange) onLocalDirChange(dirCheck.dirName);
      }

      const pkg = await buildPortableExportPackage(decks, cards, settings);
      const jsonContent = JSON.stringify(pkg, null, 2);
      const res = await createBackupSnapshotInDirectory(jsonContent, dirCheck.handle);

      if (res.success) {
        setJustCreatedBackup(true);
        setTimeout(() => setJustCreatedBackup(false), 3000);
        setBackupNotice({
          text: res.message,
          type: 'success',
        });
      } else {
        setBackupNotice({
          text: res.message,
          type: 'error',
        });
      }

      flashNotice(res.message);
      if (onShowToast) onShowToast(res.message);
    } catch (err: unknown) {
      const msg = `Lỗi tạo bản sao lưu: ${err instanceof Error ? err.message : String(err)}`;
      setBackupNotice({ text: msg, type: 'error' });
      flashNotice(msg);
      if (onShowToast) onShowToast(msg);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleToggleAutoSync = () => {
    const nextVal = !autoSyncOn;
    setAutoSyncOn(nextVal);
    setAutoSyncEnabled(nextVal);
    const msg = nextVal
      ? 'Đã bật chế độ Tự động đồng bộ vào thư mục máy tính khi có chỉnh sửa.'
      : 'Đã tắt chế độ Tự động đồng bộ.';
    flashNotice(msg);
    if (onShowToast) onShowToast(msg);
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
      flashNotice('Đã xuất gói bài giảng di động (.json) kèm toàn bộ hình ảnh & âm thanh Base64.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      await onImportPackage(file);
      flashNotice('Đã phục hồi bài giảng thành công từ tệp sao lưu.');
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : 'Tệp sao lưu không hợp lệ.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200">
        <p className="text-sm text-slate-500">
          Cá nhân hóa Thương hiệu & Quản trị Dữ liệu Local-First Máy tính
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
        <section className="lg:col-span-6 space-y-6">
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
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center min-w-[80px] min-h-[80px]">
                <BrandMark logoDataUrl={settings.customLogoDataUrl} size="lg" />
              </div>
              <div className="space-y-2 flex-1">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#15803d]" />
                  Tải lên logo riêng (PNG, SVG, JPG)
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg"
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
                      onUpdateSettings({ customLogoDataUrl: undefined });
                      flashNotice('Đã xóa logo riêng, trở về biểu trưng mặc định.');
                    }}
                    className="block text-xs font-medium text-rose-600 hover:underline cursor-pointer"
                  >
                    Xóa logo riêng (Dùng biểu trưng mặc định)
                  </button>
                )}
                <p className="text-[11px] text-slate-500">
                  Kích thước đề xuất: 320×320px vuông, nền trong suốt PNG.
                </p>
              </div>
            </div>
          </div>

          {/* School Name & Primary Branding Color */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-slate-900">
              Tên Trung tâm & Tiêu đề Lớp học
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề hiển thị chính
              </label>
              <input
                type="text"
                value={settings.brandTitle}
                onChange={(e) => onUpdateSettings({ brandTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#15803d]"
                placeholder="VD: Tiếng Anh Thầy Phúc"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Khẩu hiệu / Phụ đề lớp học
              </label>
              <input
                type="text"
                value={settings.classroomTagline}
                onChange={(e) => onUpdateSettings({ classroomTagline: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#15803d]"
                placeholder="VD: Học từ vựng tương tác qua hình ảnh & âm thanh"
              />
            </div>
          </div>

          {/* Safe Reset Control */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <h3 className="font-display font-semibold text-base text-slate-900">
              Khôi phục bộ bài giảng mẫu ban đầu
            </h3>
            <p className="text-xs text-slate-500">
              Đưa dữ liệu IndexedDB về bộ từ vựng mẫu (Unit 1 Động vật & Unit 2 Trái cây – Lớp học). Nên tạo bản sao lưu trước khi thực hiện.
            </p>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
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
                  className="px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                >
                  Xác nhận khôi phục
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right: 1. Active Data Storage on PC + 2. Dedicated Backup & Restore */}
        <aside className="lg:col-span-6 space-y-6">
          {/* ========================================================================= */}
          {/* KHỐI 1: NƠI LƯU TRỮ DỮ LIỆU HOẠT ĐỘNG CỦA APP (ACTIVE DATA STORAGE ON PC) */}
          {/* ========================================================================= */}
          <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/80 text-emerald-800 shrink-0">
                <FolderSync className="w-6 h-6 text-[#15803d]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-900">
                    Kho Dữ Liệu Hoạt Động Trên Máy Tính
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
                    Live Active Storage
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Toàn bộ dữ liệu do thầy cô tải lên (chủ đề, từ vựng, tranh vẽ Base64, ghi âm) được lưu giữ tại đây. <strong>App sử dụng trực tiếp dữ liệu này để chạy chương trình</strong>.
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Chủ đề</span>
                <span className="font-bold text-slate-900 text-sm">{storageStats.deckCount} Unit</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Thẻ từ</span>
                <span className="font-bold text-slate-900 text-sm">{storageStats.cardCount} từ</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Ảnh Base64</span>
                <span className="font-bold text-slate-900 text-sm">{storageStats.embeddedImageCount} ảnh</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Dung lượng</span>
                <span className="font-bold text-[#0284C7] text-sm">{formatBytes(storageStats.estimatedBytes)}</span>
              </div>
            </div>

            {/* Current Chosen Directory Info & Change Button */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-[#15803d]" />
                  Thư mục máy tính đã chọn:
                </span>
                <button
                  type="button"
                  onClick={handlePickDirectory}
                  className="text-xs font-bold text-[#15803d] hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {chosenLocalDir ? 'Đổi thư mục khác...' : 'Chọn thư mục ngay...'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="font-mono text-xs font-bold text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 truncate max-w-full">
                  📁 {chosenLocalDir || 'Chưa chọn thư mục (Đang dùng tạm IndexedDB)'}
                </span>
                <span className="text-[11px] text-slate-500 font-medium shrink-0">
                  Tệp: <code>{ACTIVE_DB_FILENAME}</code>
                </span>
              </div>
            </div>

            {/* Action Buttons for Active Database */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Button: Save / Update to PC Folder */}
              <button
                type="button"
                disabled={isSavingActiveDb}
                onClick={handleSaveActiveDatabase}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60 ${
                  justSavedActiveDb
                    ? 'bg-emerald-700 ring-2 ring-emerald-400'
                    : 'bg-[#15803d] hover:bg-[#166534]'
                }`}
                title="Ghi đè toàn bộ dữ liệu mới nhất vào tệp vocab-kids-database.json trong thư mục máy tính"
              >
                {isSavingActiveDb ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : justSavedActiveDb ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Đã cập nhật vào thư mục!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu / Cập nhật vào thư mục</span>
                  </>
                )}
              </button>

              {/* Button: Load from PC Folder into Running App */}
              <button
                type="button"
                disabled={isLoadingActiveDb}
                onClick={handleLoadActiveDatabase}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-[#15803d] text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-60 ${
                  justLoadedActiveDb ? 'ring-2 ring-emerald-400 bg-emerald-50' : ''
                }`}
                title="Đọc tệp dữ liệu vocab-kids-database.json từ thư mục máy tính nạp vào App để chạy chương trình"
              >
                {isLoadingActiveDb ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Đang nạp dữ liệu...</span>
                  </>
                ) : justLoadedActiveDb ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Đã nạp vào App thành công!</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Nạp dữ liệu từ thư mục vào App</span>
                  </>
                )}
              </button>
            </div>

            {/* Active DB Inline Status Notice */}
            {activeDbNotice && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-start justify-between gap-2.5 transition-all animate-in fade-in ${
                  activeDbNotice.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-2xs'
                    : activeDbNotice.type === 'error'
                    ? 'bg-rose-50 border border-rose-300 text-rose-900'
                    : 'bg-blue-50 border border-blue-300 text-blue-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {activeDbNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : activeDbNotice.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <span>{activeDbNotice.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDbNotice(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 ml-1 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Smart Auto-Sync Switch */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Tự động đồng bộ vào thư mục khi chỉnh sửa (Auto-sync)
                </span>
                <p className="text-[11px] text-slate-500">
                  Mỗi khi thêm từ vựng, cắt ảnh hoặc sửa bài, app sẽ tự động ghi đè bản mới nhất vào thư mục máy tính.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoSync}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoSyncOn ? 'bg-[#15803d]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    autoSyncOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* KHỐI 2: HỆ THỐNG SAO LƯU DỰ PHÒNG & PHỤC HỒI (BACKUP & RESTORE SYSTEM)    */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100/80 text-purple-800 shrink-0">
                <ShieldCheck className="w-6 h-6 text-purple-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-900">
                    Hệ Thống Sao Lưu & Phục Hồi
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900">
                    Backup & Restore
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Tạo các bản sao lưu độc lập có <strong>gắn mốc ngày giờ chi tiết</strong> (Snapshots) để lưu trữ lâu dài hoặc phục hồi bài giảng khi lỡ xóa nhầm.
                </p>
              </div>
            </div>

            {/* Backup Snapshot Action */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isCreatingBackup}
                onClick={handleCreateBackupSnapshot}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60 ${
                  justCreatedBackup
                    ? 'bg-purple-800 ring-2 ring-purple-400'
                    : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800'
                }`}
                title="Tạo bản sao lưu độc lập dạng Backup_VocabKIDS_YYYY-MM-DD_HH-mm.json"
              >
                {isCreatingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                    <span>Đang đóng gói và tạo bản sao lưu...</span>
                  </>
                ) : justCreatedBackup ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-purple-200" />
                    <span>Đã tạo bản sao lưu thành công!</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-purple-200" />
                    <span>📦 Tạo bản sao lưu dự phòng ngay (Backup Snapshot)</span>
                  </>
                )}
              </button>

              {/* Backup Notice */}
              {backupNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-start justify-between gap-2.5 transition-all animate-in fade-in ${
                    backupNotice.type === 'success'
                      ? 'bg-purple-50 border border-purple-200 text-purple-950 shadow-2xs'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    <span>{backupNotice.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackupNotice(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 ml-1 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Restore from Backup File & Portable JSON */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 block">
                Phục hồi dữ liệu hoặc Chuyển sang máy tính khác:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer">
                  <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                  Phục hồi từ bản sao lưu (.json)
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

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExportClick}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExporting ? 'Đang xuất gói...' : 'Xuất gói di động (.json)'}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                💡 Thầy cô có thể copy tệp sao lưu (.json) vào USB để đem sang máy tính phòng học hoặc gửi cho đồng nghiệp nạp vào app.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
