/**
 * File System Access API utility:
 * Allows user to choose a dedicated directory on their local computer
 * (e.g., D:\Du_Lieu_Tieng_Anh) to store, backup, and sync lesson data.
 */

const DB_NAME = 'VocabKidStorageHandleDB';
const STORE_NAME = 'directory_handles';
const HANDLE_KEY = 'chosen_local_dir';
const DIR_NAME_KEY = 'vocab_kid_local_dir_name';

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

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const db = await openHandleDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => {
        resolve((req.result as FileSystemDirectoryHandle) || null);
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
      error: 'Trình duyệt hiện tại không hỗ trợ File System Access API. Dữ liệu vẫn được lưu an toàn trong IndexedDB của máy tính này.',
    };
  }

  try {
    const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const dirName = handle.name || 'Thư mục máy tính';

    // Store in IndexedDB
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    localStorage.setItem(DIR_NAME_KEY, dirName);
    return { success: true, dirName, handle };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, dirName: '', error: 'Đã hủy chọn thư mục.' };
    }
    return { success: false, dirName: '', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveFileToChosenDirectory(
  filename: string,
  content: string | Blob
): Promise<{ success: boolean; message: string }> {
  try {
    const handle = await getSavedDirectoryHandle();
    if (!handle) {
      return {
        success: false,
        message: 'Chưa chọn thư mục lưu trữ trên máy tính. Vui lòng bấm "Chọn thư mục máy tính" trước.',
      };
    }

    // Verify or request permission
    const opts = { mode: 'readwrite' as const };
    const query = await (handle as unknown as { queryPermission: (o: typeof opts) => Promise<string> }).queryPermission(opts);
    if (query !== 'granted') {
      const req = await (handle as unknown as { requestPermission: (o: typeof opts) => Promise<string> }).requestPermission(opts);
      if (req !== 'granted') {
        return { success: false, message: 'Người dùng từ chối cấp quyền ghi vào thư mục này.' };
      }
    }

    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    const dirName = getSavedDirectoryName() || handle.name;
    return {
      success: true,
      message: `Đã lưu tệp "${filename}" thành công vào thư mục "${dirName}" trên máy tính!`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: `Không thể lưu vào thư mục máy tính: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
