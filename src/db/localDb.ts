import {
  DEFAULT_BRAND_SETTINGS,
  INITIAL_CARDS,
  INITIAL_DECKS,
} from '../data/seedData';
import type {
  BrandSettings,
  ExportPackage,
  LessonDeck,
  StorageStats,
  VocabCard,
} from '../types/edtech';
import { estimateStringBytes, urlToBase64 } from '../utils/mediaUtils';

const DB_NAME = 'TiengAnhThayPhucLocalDB';
const DB_VERSION = 1;

const STORE_DECKS = 'decks';
const STORE_CARDS = 'cards';
const STORE_SETTINGS = 'settings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Không thể mở IndexedDB.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DECKS)) {
        db.createObjectStore(STORE_DECKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        const cardStore = db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
        cardStore.createIndex('deckId', 'deckId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function putInStore<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteFromStore(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface HydratedState {
  decks: LessonDeck[];
  cards: VocabCard[];
  settings: BrandSettings;
}

export async function initAndLoadLocalDb(): Promise<HydratedState> {
  const db = await openDatabase();
  let decks = await getAllFromStore<LessonDeck>(db, STORE_DECKS);
  let cards = await getAllFromStore<VocabCard>(db, STORE_CARDS);
  const settingsList = await getAllFromStore<BrandSettings>(db, STORE_SETTINGS);

  if (decks.length === 0) {
    for (const deck of INITIAL_DECKS) {
      await putInStore(db, STORE_DECKS, deck);
    }
    decks = [...INITIAL_DECKS];
  }

  if (cards.length === 0) {
    for (const card of INITIAL_CARDS) {
      await putInStore(db, STORE_CARDS, card);
    }
    cards = [...INITIAL_CARDS];
  }

  let settings = settingsList.find((s) => s.id === 'primary');
  if (!settings) {
    settings = { ...DEFAULT_BRAND_SETTINGS };
    await putInStore(db, STORE_SETTINGS, settings);
  }

  db.close();

  return {
    decks: decks.sort((a, b) => a.order - b.order),
    cards: cards.sort((a, b) => a.order - b.order),
    settings,
  };
}

export async function saveDeck(deck: LessonDeck): Promise<void> {
  const db = await openDatabase();
  await putInStore(db, STORE_DECKS, deck);
  db.close();
}

export async function removeDeck(deckId: string): Promise<void> {
  const db = await openDatabase();
  const cards = await getAllFromStore<VocabCard>(db, STORE_CARDS);
  for (const c of cards) {
    if (c.deckId === deckId) {
      await deleteFromStore(db, STORE_CARDS, c.id);
    }
  }
  await deleteFromStore(db, STORE_DECKS, deckId);
  db.close();
}

export async function saveCard(card: VocabCard): Promise<void> {
  const db = await openDatabase();
  await putInStore(db, STORE_CARDS, card);
  db.close();
}

export async function saveCardsBatch(cards: VocabCard[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CARDS, 'readwrite');
  const store = tx.objectStore(STORE_CARDS);
  for (const card of cards) {
    store.put(card);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function removeCard(cardId: string): Promise<void> {
  const db = await openDatabase();
  await deleteFromStore(db, STORE_CARDS, cardId);
  db.close();
}

export async function saveSettings(settings: BrandSettings): Promise<void> {
  const db = await openDatabase();
  await putInStore(db, STORE_SETTINGS, settings);
  db.close();
}

export async function resetToSampleData(): Promise<HydratedState> {
  const db = await openDatabase();
  await clearStore(db, STORE_DECKS);
  await clearStore(db, STORE_CARDS);
  await clearStore(db, STORE_SETTINGS);

  for (const deck of INITIAL_DECKS) {
    await putInStore(db, STORE_DECKS, deck);
  }
  for (const card of INITIAL_CARDS) {
    await putInStore(db, STORE_CARDS, card);
  }
  await putInStore(db, STORE_SETTINGS, DEFAULT_BRAND_SETTINGS);
  db.close();

  return {
    decks: [...INITIAL_DECKS],
    cards: [...INITIAL_CARDS],
    settings: { ...DEFAULT_BRAND_SETTINGS },
  };
}

/**
 * Exports a 100% self-contained JSON lesson bundle with all images & audio embedded as Base64.
 */
export async function buildPortableExportPackage(
  decks: LessonDeck[],
  cards: VocabCard[],
  settings: BrandSettings
): Promise<ExportPackage> {
  const embeddedCards = await Promise.all(
    cards.map(async (card) => ({
      ...card,
      imageDataUrl: await urlToBase64(card.imageDataUrl, 0.82),
    }))
  );

  return {
    format: 'tieng-anh-thay-phuc-v1',
    exportedAt: new Date().toISOString(),
    brandSettings: settings,
    decks,
    cards: embeddedCards,
  };
}

export async function importPortablePackage(pkg: ExportPackage): Promise<HydratedState> {
  if (pkg.format !== 'tieng-anh-thay-phuc-v1' || !Array.isArray(pkg.decks) || !Array.isArray(pkg.cards)) {
    throw new Error('Tệp gói bài giảng không đúng định dạng Tiếng Anh Thầy Phúc (.json).');
  }

  const db = await openDatabase();
  await clearStore(db, STORE_DECKS);
  await clearStore(db, STORE_CARDS);
  await clearStore(db, STORE_SETTINGS);

  for (const deck of pkg.decks) {
    await putInStore(db, STORE_DECKS, deck);
  }
  for (const card of pkg.cards) {
    await putInStore(db, STORE_CARDS, card);
  }
  const mergedSettings: BrandSettings = {
    ...DEFAULT_BRAND_SETTINGS,
    ...(pkg.brandSettings ?? {}),
    id: 'primary',
    brandTitle: 'Tiếng Anh Thầy Phúc',
  };
  await putInStore(db, STORE_SETTINGS, mergedSettings);
  db.close();

  return {
    decks: pkg.decks.sort((a, b) => a.order - b.order),
    cards: pkg.cards.sort((a, b) => a.order - b.order),
    settings: mergedSettings,
  };
}

export function computeStorageStats(
  decks: LessonDeck[],
  cards: VocabCard[],
  settings: BrandSettings
): StorageStats {
  let estimatedBytes = estimateStringBytes(JSON.stringify(decks));
  estimatedBytes += estimateStringBytes(JSON.stringify(settings));
  let customAudioCount = 0;
  let embeddedImageCount = 0;

  for (const card of cards) {
    estimatedBytes += estimateStringBytes(JSON.stringify(card));
    if (card.audioDataUrl) customAudioCount += 1;
    if (card.imageDataUrl.startsWith('data:')) embeddedImageCount += 1;
  }

  return {
    deckCount: decks.length,
    cardCount: cards.length,
    customAudioCount,
    embeddedImageCount,
    estimatedBytes,
  };
}
