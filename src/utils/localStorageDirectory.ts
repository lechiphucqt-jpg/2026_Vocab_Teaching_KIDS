/**
 * File System Access API utility:
 * Allows user to choose a dedicated directory on their local computer
 * (e.g., D:\Du_Lieu_Tieng_Anh) to store, backup, and sync lesson data.
 */

const DB_NAME = 'VocabKidStorageHandleDB';
const STORE_NAME = 'directory_handles';
const HANDLE_KEY = 'chosen_local_dir';
const DIR_NAME_KEY = 'vocab_kid_local_dir_name';
const AUTO_SYNC_KEY = 'vocab_kid_auto_sync_enabled';

export const ACTIVE_DB_FILENAME = 'vocab-kids-database.json';

let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null;

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function getSavedDirectoryName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DIR_NAME_KEY);
}

export function isAutoSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTO_SYNC_KEY) === 'true';
}

export function setAutoSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedDirectoryHandle) {
    return cachedDirectoryHandle;
  }
  if (!isFileSystemAccessSupported()) return null;
  try {
    const db = await openHandleDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => {
        const handle = (req.result as FileSystemDirectoryHandle) || null;
        if (handle) {
          cachedDirectoryHandle = handle;
        }
        resolve(handle);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function pickAndSaveLocalDirectory(): Promise<{
  success: boolean;
  dirName: string;
  handle?: FileSystemDirectoryHandle;
  error?: string;
}> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      dirName: '',
      error: 'Trình duyệt hiện tại không hỗ trợ chọn thư mục trực tiếp. Dữ liệu sẽ được tải về qua trình duyệt và lưu an toàn trong IndexedDB của máy tính.',
    };
  }

  try {
    const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const dirName = handle.name || 'Thư mục máy tính';
    cachedDirectoryHandle = handle;

    // Store in IndexedDB
    try {
      const db = await openHandleDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (dbErr) {
      console.warn('Could not persist handle in IndexedDB:', dbErr);
    }

    localStorage.setItem(DIR_NAME_KEY, dirName);
    return { success: true, dirName, handle };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, dirName: '', error: 'Đã hủy thao tác chọn thư mục.' };
    }
    return { success: false, dirName: '', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ensures a directory handle is ready and has active readwrite permission.
 * MUST be invoked directly in a user gesture (e.g. click event) before lengthy async tasks!
 */
export async function ensureDirectoryHandleAndPermission(
  promptIfMissing = true
): Promise<{
  handle: FileSystemDirectoryHandle | null;
  dirName: string;
  granted: boolean;
  error?: string;
}> {
  if (!isFileSystemAccessSupported()) {
    return {
      handle: null,
      dirName: getSavedDirectoryName() || '',
      granted: false,
      error: 'Trình duyệt không hỗ trợ File System Access API.',
    };
  }

  let handle = await getSavedDirectoryHandle();
  const savedName = getSavedDirectoryName();
  let dirName = savedName || (handle ? handle.name : '');

  if (handle) {
    try {
      const opts = { mode: 'readwrite' as const };
      const q = await (handle as unknown as { queryPermission: (o: typeof opts) => Promise<string> }).queryPermission(opts);
      if (q === 'granted') {
        return { handle, dirName: dirName || handle.name, granted: true };
      }
      // Must be called while user gesture is active!
      const req = await (handle as unknown as { requestPermission: (o: typeof opts) => Promise<string> }).requestPermission(opts);
      if (req === 'granted') {
        return { handle, dirName: dirName || handle.name, granted: true };
      }
    } catch (err) {
      console.warn('Could not query/request permission on existing handle:', err);
      handle = null;
    }
  }

  // If no handle or permission was not granted and promptIfMissing is true:
  if (promptIfMissing) {
    const pickRes = await pickAndSaveLocalDirectory();
    if (pickRes.success && pickRes.handle) {
      return {
        handle: pickRes.handle,
        dirName: pickRes.dirName,
        granted: true,
      };
    }
    return {
      handle: null,
      dirName,
      granted: false,
      error: pickRes.error || 'Chưa cấp quyền chọn thư mục.',
    };
  }

  return {
    handle: null,
    dirName,
    granted: false,
    error: 'Chưa cấp quyền truy cập thư mục.',
  };
}

/**
 * Direct file download fallback for browsers or when directory permissions fail
 */
export function downloadFileFallback(
  content: string | Blob,
  filename: string,
  mimeType = 'application/json'
) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export async function saveFileToChosenDirectory(
  filename: string,
  content: string | Blob,
  preAcquiredHandle?: FileSystemDirectoryHandle | null
): Promise<{
  success: boolean;
  message: string;
  fallbackDownload?: boolean;
  dirName?: string;
}> {
  try {
    let handle = preAcquiredHandle !== undefined ? preAcquiredHandle : await getSavedDirectoryHandle();
    const dirName = getSavedDirectoryName() || (handle ? handle.name : 'Thư mục máy tính');

    // If handle is provided, check permission
    if (handle) {
      try {
        const opts = { mode: 'readwrite' as const };
        const query = await (handle as unknown as { queryPermission: (o: typeof opts) => Promise<string> }).queryPermission(opts);
        if (query !== 'granted') {
          const req = await (handle as unknown as { requestPermission: (o: typeof opts) => Promise<string> }).requestPermission(opts);
          if (req !== 'granted') {
            handle = null;
          }
        }
      } catch (err) {
        console.warn('Handle permission check error:', err);
        handle = null;
      }
    }

    // Direct write to directory if handle is valid and permitted
    if (handle) {
      const fileHandle = await handle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return {
        success: true,
        dirName,
        message: `Đã lưu tệp "${filename}" thành công vào thư mục "${dirName}" trên máy tính!`,
      };
    }

    // Safe fallback: download file directly so user's data is NEVER lost
    downloadFileFallback(content, filename, 'application/json');
    return {
      success: true,
      fallbackDownload: true,
      dirName,
      message: `Đã tải gói sao lưu "${filename}" về máy tính (thư mục Downloads). Thầy cô có thể chuyển tệp vào thư mục "${dirName}".`,
    };
  } catch (err: unknown) {
    try {
      downloadFileFallback(content, filename, 'application/json');
      return {
        success: true,
        fallbackDownload: true,
        message: `Đã lưu bằng cách tải về máy do ổ đĩa hạn chế quyền: ${err instanceof Error ? err.message : String(err)}`,
      };
    } catch {
      return {
        success: false,
        message: `Không thể lưu vào thư mục: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

/**
 * Read text content of a file from chosen directory
 */
export async function readFileFromChosenDirectory(
  filename: string,
  preAcquiredHandle?: FileSystemDirectoryHandle | null
): Promise<{
  success: boolean;
  content?: string;
  dirName: string;
  message: string;
}> {
  let handle = preAcquiredHandle !== undefined ? preAcquiredHandle : await getSavedDirectoryHandle();
  const dirName = getSavedDirectoryName() || (handle ? handle.name : 'Thư mục máy tính');

  if (!handle) {
    return {
      success: false,
      dirName,
      message: `Chưa kết nối thư mục máy tính. Vui lòng bấm "Chọn thư mục máy tính" trước.`,
    };
  }

  try {
    const opts = { mode: 'read' as const };
    const query = await (handle as unknown as { queryPermission: (o: typeof opts) => Promise<string> }).queryPermission(opts);
    if (query !== 'granted') {
      const req = await (handle as unknown as { requestPermission: (o: typeof opts) => Promise<string> }).requestPermission(opts);
      if (req !== 'granted') {
        return {
          success: false,
          dirName,
          message: `Chưa được cấp quyền đọc thư mục "${dirName}".`,
        };
      }
    }

    const fileHandle = await handle.getFileHandle(filename, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    return {
      success: true,
      content: text,
      dirName,
      message: `Đã đọc thành công tệp "${filename}" từ thư mục "${dirName}".`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      dirName,
      message: `Không tìm thấy hoặc không đọc được tệp "${filename}" trong thư mục "${dirName}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Load Active Database from local directory (e.g. vocab-kids-database.json)
 */
export async function loadActiveDatabaseFromDirectory(
  preAcquiredHandle?: FileSystemDirectoryHandle | null
): Promise<{
  success: boolean;
  content?: string;
  dirName: string;
  message: string;
}> {
  return readFileFromChosenDirectory(ACTIVE_DB_FILENAME, preAcquiredHandle);
}

/**
 * Save Active Database into local directory (vocab-kids-database.json)
 */
export async function saveActiveDatabaseToDirectory(
  jsonContent: string,
  preAcquiredHandle?: FileSystemDirectoryHandle | null
): Promise<{
  success: boolean;
  message: string;
  fallbackDownload?: boolean;
  dirName?: string;
}> {
  return saveFileToChosenDirectory(ACTIVE_DB_FILENAME, jsonContent, preAcquiredHandle);
}

/**
 * Create a timestamped backup snapshot in the chosen directory (e.g. Backup_VocabKIDS_2026-11-21_09h15.json)
 */
export async function createBackupSnapshotInDirectory(
  jsonContent: string,
  preAcquiredHandle?: FileSystemDirectoryHandle | null
): Promise<{
  success: boolean;
  message: string;
  filename: string;
  fallbackDownload?: boolean;
  dirName?: string;
}> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `Backup_VocabKIDS_${dateStr}_${timeStr}.json`;

  const res = await saveFileToChosenDirectory(filename, jsonContent, preAcquiredHandle);
  return {
    ...res,
    filename,
    message: res.success
      ? `Đã tạo bản sao lưu dự phòng "${filename}" thành công vào thư mục "${res.dirName || 'máy tính'}"!`
      : res.message,
  };
}

/**
 * Silent auto-sync trigger: if enabled and handle is available, writes active db
 */
export async function triggerAutoSyncIfEnabled(jsonContent: string): Promise<boolean> {
  if (!isAutoSyncEnabled() || !cachedDirectoryHandle) return false;
  try {
    const opts = { mode: 'readwrite' as const };
    const q = await (cachedDirectoryHandle as unknown as { queryPermission: (o: typeof opts) => Promise<string> }).queryPermission(opts);
    if (q !== 'granted') return false;

    const fileHandle = await cachedDirectoryHandle.getFileHandle(ACTIVE_DB_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonContent);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
