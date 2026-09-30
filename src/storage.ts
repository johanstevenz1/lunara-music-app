import { type Library, restore, snapshot } from './core/library.js';
const DB_NAME = 'lunara-library';
let database: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('library');
      request.result.createObjectStore('audio');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}
async function write(store: string, key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage was aborted.'));
  });
}
export async function loadLibrary(): Promise<Library | null> {
  const saved = await read<ReturnType<typeof snapshot>>('library', 'current');
  return saved ? restore(saved) : null;
}
export function saveLibrary(library: Library): Promise<void> {
  return write('library', 'current', snapshot(library));
}
export function saveAudio(id: string, file: Blob): Promise<void> {
  return write('audio', id, file);
}
export function loadAudio(id: string): Promise<Blob | undefined> {
  return read('audio', id);
}
