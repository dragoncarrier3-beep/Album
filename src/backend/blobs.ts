import { del, get, set } from 'idb-keyval';

/**
 * Private object storage for uploaded originals + thumbnails (stand-in for a private
 * Supabase Storage bucket). Blobs never get a public URL; the UI receives short-lived
 * object URLs only after api.ts has authorised access.
 */
export interface BlobStore {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
  remove(key: string): Promise<void>;
}

const memory = new Map<string, Blob>();

export const memoryBlobStore: BlobStore = {
  async put(k, b) { memory.set(k, b); },
  async get(k) { return memory.get(k); },
  async remove(k) { memory.delete(k); },
};

const idbStore: BlobStore = {
  put: (k, b) => set(k, b),
  get: (k) => get<Blob>(k),
  remove: (k) => del(k),
};

export let blobStore: BlobStore = typeof indexedDB !== 'undefined' ? idbStore : memoryBlobStore;

export function setBlobStore(s: BlobStore) {
  blobStore = s;
}
